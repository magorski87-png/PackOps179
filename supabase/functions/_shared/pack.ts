import {createClient} from 'npm:@supabase/supabase-js@2';
export const site=Deno.env.get('PUBLIC_SITE_ORIGIN')||'https://magorski87-png.github.io';
export const sitePath=Deno.env.get('PUBLIC_SITE_PATH')||'/PackOps179/';
export const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
export const cors={'Access-Control-Allow-Origin':site,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
export const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
export const reviewers=['admin','cubmaster','treasurer'];
export async function memberFor(req:Request,packId:string){
 if(!/^[0-9a-f-]{36}$/i.test(packId))throw Error('Invalid Pack');
 const token=(req.headers.get('authorization')||'').replace(/^Bearer /,'');
 const {data,error}=await db.auth.getUser(token);if(error||!data.user)throw Error('Sign in to PackOps first');
 const {data:member,error:memberError}=await db.from('pack_members').select('role,status,den_scopes').eq('pack_id',packId).eq('user_id',data.user.id).eq('status','active').maybeSingle();
 if(memberError||!member)throw Error('Active Pack membership required');
 return {...member,user:data.user};
}
export async function sendEmail(email:string,subject:string,text:string,key:string){
 const from=Deno.env.get('RSVP_FROM_EMAIL'),secret=Deno.env.get('RESEND_API_KEY');
 if(!from||!secret)return {accepted:false,error:'Email provider is not configured. Share the PackOps link manually.'};
 try{
  const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({from,to:[email],subject,text}),signal:AbortSignal.timeout(15000)});
  return {accepted:res.ok,error:res.ok?'':'Email provider did not accept the message. Check sender verification and provider delivery logs.'};
 }catch{return {accepted:false,error:'Email delivery is unconfirmed. Check the provider log before retrying.'}}
}
export async function bridgeCall(payload:unknown){
 const url=Deno.env.get('LEDGER_BRIDGE_URL')||'',secret=Deno.env.get('LEDGER_BRIDGE_SECRET')||'';
 if(!/^https:\/\/script\.google\.com\/macros\/s\/[-\w]+\/exec$/.test(url)||secret.length<32)throw Error('Official ledger posting is not configured. Connect a reviewed native Google Sheet first.');
 const message=JSON.stringify({timestamp:Date.now(),payload});
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=[...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message)))].map(n=>n.toString(16).padStart(2,'0')).join('');
 const result=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,signature}),signal:AbortSignal.timeout(45000)});
 const data=await result.json();if(!result.ok||!data.ok)throw Error(data.error||'The ledger did not confirm this operation. Retry with the same request ID.');
 return data;
}
