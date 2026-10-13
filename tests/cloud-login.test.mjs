import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
let authUser=null,activeMember=null,creates=0,logins=0,inviteCalls=0;
const events=[];
globalThis.packopsTestCreateClient=(url,key,options)=>{
 creates++;assert.equal(options.auth.persistSession,true);assert.equal(options.auth.flowType,'pkce');
 return {auth:{getUser:async()=>({data:{user:authUser}}),signInWithOAuth:async opts=>{logins++;assert.equal(opts.provider,'google');return {}},stopAutoRefresh:()=>{}},
  rpc:async(name,args)=>{inviteCalls++;assert.equal(name,'pack_accept_invite');events.push(args);return {}},
  from:table=>{const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:activeMember})};assert.equal(table,'pack_members');return query}
 };
};
const hooks=registerHooks({resolve(specifier,context,next){if(specifier.startsWith('https://esm.sh/@supabase/'))return {url:'test:supabase',shortCircuit:true};return next(specifier,context)},load(url,context,next){if(url==='test:supabase')return {format:'module',source:'export const createClient=globalThis.packopsTestCreateClient;',shortCircuit:true};return next(url,context)}});
const {configureCloud,cloudState,googleCloudLogin,fetchCloudRows}=await import('../cloud.js');
test('fresh and returning users retain Google login and database membership checks',async()=>{
 const cfg={projectUrl:'https://example.supabase.co',publishableKey:'sb_publishable_example',pack:'11111111-2222-4333-8444-555555555555'};
 globalThis.location={origin:'https://pack.example',pathname:'/PackOps179/'};
 try{
  await configureCloud(cfg);assert.equal(cloudState().configured,true);assert.equal(logins,0);assert.equal(cloudState().authenticated,false);
  await googleCloudLogin();assert.equal(logins,1);
  authUser={id:'leader',email:'leader@example.com'};
  await configureCloud(cfg);assert.equal(cloudState().authenticated,true);assert.equal(cloudState().member,null);
  await assert.rejects(()=>fetchCloudRows('roster'),/approved/);
  activeMember={role:'den_leader',status:'active',den_scopes:['Webelos']};
  await configureCloud(cfg);assert.equal(cloudState().member.role,'den_leader');assert.equal(creates,1);assert.equal(logins,1);assert.equal(inviteCalls,2);assert.ok(events.every(x=>x.target_pack===cfg.pack));
  activeMember={...activeMember,status:'suspended'};await configureCloud(cfg);assert.equal(cloudState().member,null);
  await configureCloud({...cfg,publishableKey:'sb_publishable_rotated'});assert.equal(creates,2);
 }finally{hooks.deregister();delete globalThis.packopsTestCreateClient;delete globalThis.location}
});
