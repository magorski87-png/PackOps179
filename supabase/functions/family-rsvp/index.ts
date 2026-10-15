// Public family-response endpoint AND approved-leader invitation creation.
// Deploy with --no-verify-jwt: public visitors have no Supabase session.
// Every privileged operation explicitly checks a verified Auth user and Pack membership.
import {createClient} from 'npm:@supabase/supabase-js@2';

const cloudUrl=Deno.env.get('SUPABASE_URL')!;
const serverKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const from=Deno.env.get('RSVP_FROM_EMAIL')||'';
const resendKey=Deno.env.get('RESEND_API_KEY')||'';
const publicSite=Deno.env.get('PUBLIC_SITE_ORIGIN')||'https://magorski87-png.github.io';
const sitePath=Deno.env.get('PUBLIC_SITE_PATH')||'/PackOps179/';
const db=createClient(cloudUrl,serverKey,{auth:{persistSession:false}});
const cors={'Access-Control-Allow-Origin':publicSite,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
function respond(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}})}
function invalid(message:string,status=400){return respond({error:message},status)}
async function hashToken(token:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('')}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX=/^[0-9a-f]{64}$/i;
function validAnswer(answer:Record<string,unknown>,kind:string,questions:unknown){
 if(!answer||typeof answer!=='object'||Array.isArray(answer))return false;
 if(JSON.stringify(answer).length>12000)return false;
 const yes=['yes','maybe','no'];
 if(kind==='rsvp'){
  if(!yes.includes(String(answer.status)))return false;
  for(const field of ['adults','children'])if(!Number.isInteger(answer[field])||Number(answer[field])<0||Number(answer[field])>30)return false;
 }
 if(kind==='poll'||kind==='volunteer'){
  const opts=Array.isArray(questions)?questions.flatMap((q:any)=>Array.isArray(q?.options)?q.options:[]):[];
  if(!opts.includes(answer.choice))return false;
 }
 return true;
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return invalid('POST required',405);
 if(Number(req.headers.get('content-length')||0)>20000)return invalid('Request too large',413);
 let body:Record<string,any>;
 try{body=await req.json();}catch{return invalid('Invalid request')}
 const action=String(body.action||'');
 try{
  if(action==='invite'){
   const authHeader=req.headers.get('authorization')||'';
   const bearer=authHeader.startsWith('Bearer ')?authHeader.slice(7):'';
   if(!bearer)return invalid('Approved PackOps login required',401);
   const {data:account,error:userError}=await db.auth.getUser(bearer);
   if(userError||!account?.user)return invalid('Sign in to PackOps first',401);
   const packId=String(body.packId||''),formId=String(body.formId||'');
   if(!UUID.test(packId)||!UUID.test(formId))return invalid('Invalid Pack or form');
   const {data:member}=await db.from('pack_members').select('role,den_scopes').eq('pack_id',packId).eq('user_id',account.user.id).eq('status','active').maybeSingle();
   if(!member||!['admin','cubmaster','den_leader'].includes(member.role))return invalid('Leader permission required',403);
   const {data:form}=await db.from('family_forms').select('id,title,description,kind,status,den_scope,closes_at').eq('pack_id',packId).eq('id',formId).maybeSingle();
   if(!form||form.status!=='open'||(form.closes_at&&Date.parse(form.closes_at)<=Date.now()))return invalid('This form is not open');
   if(member.role==='den_leader'&&(!form.den_scope||!member.den_scopes.includes(form.den_scope)))return invalid('Not assigned to this den',403);
   const label=String(body.recipientLabel||'').trim().slice(0,120);
   const email=String(body.recipientEmail||'').trim().toLowerCase();
   if(!label)return invalid('Family display name required');
   if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return invalid('Valid email required');
   if(body.sendEmail&&!email)return invalid('Recipient email required for sending');
   if(body.sendEmail&&(!from||!resendKey))return invalid('Email provider is not configured; create a link and share it manually instead',503);
   const note=String(body.note||'').trim();
   if(note.length>1000)return invalid('Keep the family note under 1,000 characters');
   const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
   const deadline=new Date(Date.now()+30*86400000);
   if(form.closes_at&&new Date(form.closes_at)<deadline)deadline.setTime(new Date(form.closes_at).getTime());
   const data={pack_id:packId,form_id:formId,recipient_label:label,recipient_email:email||null,
    token_hash:await hashToken(token),expires_at:deadline.toISOString(),created_by:account.user.id,personal_note:note};
   const created=await db.from('family_invitations').insert(data).select('id').single();
   if(created.error)throw created.error;
   const url=publicSite+sitePath+'#family/'+token;
   let emailed=false;let emailError='';
   if(body.sendEmail){
    try{const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:'Bearer '+resendKey,'Content-Type':'application/json','Idempotency-Key':'family-'+created.data.id},body:JSON.stringify({
     from,to:[email],subject:'Pack 179: '+form.title,
     text:'Pack 179 invites your family to respond to '+form.title+'.\n\n'+(note?'Note from your Pack leader:\n'+note+'\n\n':'')+'Open your private response link:\n'+url+'\n\nThis link is intended for your household only.\n'
    })});
    emailed=sent.ok;
    if(!emailed)emailError='The email provider rejected delivery. Check sender verification and delivery logs; the private link is available below.';
    }catch{emailError='Email delivery is unconfirmed. Check delivery logs before resending; the private link is available below.'}
    await db.from('family_invitations').update({delivery_status:emailed?'emailed':'email-failed'}).eq('id',created.data.id);
   }
   return respond({url,emailed,errorMessage:emailError,deliveryStatus:emailed?'emailed':body.sendEmail?'email-failed':'link-created'});
  }
  const token=String(body.token||'');
  if(!HEX.test(token))return invalid('Invalid invitation link',401);
  const hash=await hashToken(token);
  const found=await db.from('family_invitations').select('id,pack_id,form_id,recipient_label,personal_note,expires_at,last_submitted_at').eq('token_hash',hash).maybeSingle();
  const inv=found.data;
  if(found.error||!inv||Date.parse(inv.expires_at)<Date.now())return invalid('This invitation is invalid or expired',410);
  const formResult=await db.from('family_forms').select('id,title,description,kind,questions,status,closes_at').eq('id',inv.form_id).eq('pack_id',inv.pack_id).maybeSingle();
  const form=formResult.data;
  if(!form||form.status!=='open'||(form.closes_at&&Date.parse(form.closes_at)<Date.now()))return invalid('This RSVP or poll has closed',410);
  if(action==='get')return respond({title:form.title,description:form.description,kind:form.kind,questions:form.questions,recipientLabel:inv.recipient_label,personalNote:inv.personal_note||'',expiresAt:inv.expires_at});
  if(action!=='respond')return invalid('Unknown action');
  const answer=body.answer||{};
  if(!validAnswer(answer,form.kind,form.questions))return invalid('Complete the requested RSVP or poll fields');
  // Token-level burst protection; repeated legitimate edits remain possible.
  if(inv.last_submitted_at&&Date.now()-Date.parse(inv.last_submitted_at)<15000)return invalid('Please allow 15 seconds before changing your response',429);
  const save=await db.from('family_responses').upsert({pack_id:inv.pack_id,form_id:form.id,invitation_id:inv.id,answer,submitted_at:new Date().toISOString()},{onConflict:'invitation_id'});
  if(save.error)throw save.error;
  await db.from('family_invitations').update({last_submitted_at:new Date().toISOString()}).eq('id',inv.id);
  return respond({success:true,message:'Your response was recorded. You may use the same link to update it later.'});
 }catch(e){console.error('Family RSVP error',e);return invalid('The request could not be completed. Try again.',500)}
});
