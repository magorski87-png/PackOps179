import test from 'node:test';
import assert from 'node:assert/strict';
import {sendEmail} from '../supabase/functions/_shared/send-email.js';
import {leaderInviteHandler} from '../supabase/functions/leader-invite/handler.js';
const packId='11111111-2222-4333-8444-555555555555';
const base={apiKey:'server-only-example',from:'pack@example.com',to:'leader@example.com',subject:'Invite',text:'Hello'};
test('email results distinguish missing config, rejection, timeout and provider acceptance',async()=>{
 assert.equal((await sendEmail({...base,apiKey:''})).emailStatus,'failed');
 for(const response of [new Response('{"message":"private provider detail"}',{status:403}),new Response('{}',{status:200})]){
  const r=await sendEmail({...base,fetcher:async()=>response});assert.equal(r.emailStatus,'failed');assert.doesNotMatch(JSON.stringify(r),/private provider detail/);
 }
 assert.equal((await sendEmail({...base,fetcher:async()=>{throw Error('timeout')}})).emailStatus,'failed');
 assert.deepEqual(await sendEmail({...base,fetcher:async()=>Response.json({id:'email-123'})}),{emailStatus:'accepted',emailId:'email-123'});
});
function setup({role='admin',status='active',validUser=true,invite=true,consumed=false,providerOk=true}={}){
 const sent=[];const queries=[];
 const handler=leaderInviteHandler({publicSite:'https://pack.example',sitePath:'/PackOps179/',apiKey:base.apiKey,from:base.from,
  makeClient:()=>({auth:{getUser:async()=>({data:{user:validUser?{id:'admin-id'}:null}})},from:table=>{
   const query={table,filters:[]};queries.push(query);
   const chain={select:()=>chain,eq:(...args)=>{query.filters.push(args);return chain},maybeSingle:async()=>({data:table==='pack_members'?{role,status}:invite?{email:base.to,role:'den_leader',created_at:'2026-01-01',consumed_at:consumed?'2026-01-02':null}:null})};return chain;
  }}),fetcher:async(url,opts)=>{sent.push({url,...opts});return providerOk?Response.json({id:'email-123'}):new Response('{}',{status:403})}});
 const request=(auth=true)=>handler(new Request('https://function.example',{method:'POST',headers:auth?{Authorization:'Bearer example-user-token'}:{},body:JSON.stringify({packId,email:base.to,role:'admin',url:'https://evil.example'})}));
 return {request,sent,queries};
}
test('leader email requires a verified active admin and an unconsumed approval',async()=>{
 for(const options of [{validUser:false},{role:'den_leader'},{role:'treasurer'},{status:'suspended'},{invite:false},{consumed:true}]){
  const s=setup(options);assert.ok((await s.request()).status>=400);assert.equal(s.sent.length,0);
 }
 const s=setup();assert.equal((await s.request(false)).status,401);assert.equal(s.sent.length,0);
});
test('leader email uses saved recipient/role, fixed website, pack-scoped queries and retry key',async()=>{
 const s=setup();assert.equal((await (await s.request()).json()).emailStatus,'accepted');await s.request();
 const message=JSON.parse(s.sent[0].body);
 assert.deepEqual(message.to,[base.to]);assert.match(message.text,/den_leader/);assert.match(message.text,/https:\/\/pack.example\/PackOps179\/#settings/);assert.doesNotMatch(message.text,/evil.example/);
 assert.equal(s.sent[0].headers['Idempotency-Key'],s.sent[1].headers['Idempotency-Key']);
 assert.ok(s.queries.every(q=>q.filters.some(([k,v])=>k==='pack_id'&&v===packId)));
 const failed=setup({providerOk:false});assert.equal((await (await failed.request()).json()).emailStatus,'failed');
});
