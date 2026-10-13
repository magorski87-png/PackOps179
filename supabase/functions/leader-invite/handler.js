import {sendEmail} from '../_shared/send-email.js';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function leaderInviteHandler({makeClient,publicSite,sitePath,apiKey,from,fetcher=fetch}){
 const cors={'Access-Control-Allow-Origin':publicSite,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
 const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
 return async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return respond({error:'POST required'},405);
  try{
   const bearer=(req.headers.get('authorization')||'').match(/^Bearer (.+)$/i)?.[1];
   if(!bearer)return respond({error:'PackOps sign-in required'},401);
   const db=makeClient(bearer);
   const {data:account,error:authError}=await db.auth.getUser(bearer);
   if(authError||!account?.user)return respond({error:'PackOps sign-in required'},401);
   const raw=await req.text();if(raw.length>4096)return respond({error:'Request too large'},413);
   let body;try{body=JSON.parse(raw)}catch{return respond({error:'Invalid request'},400)}
   const packId=String(body?.packId||''),email=String(body?.email||'').trim().toLowerCase();
   if(!UUID.test(packId)||email.length>254||!/^\S+@\S+\.\S+$/.test(email))return respond({error:'Valid Pack UUID and leader email required'},400);
   const membership=await db.from('pack_members').select('role,status').eq('pack_id',packId).eq('user_id',account.user.id).maybeSingle();
   if(membership.error||membership.data?.status!=='active'||!['admin','cubmaster'].includes(membership.data?.role))return respond({error:'Active Pack administrator required'},403);
   // Recipient and role must come from an existing RLS-protected approval.
   const result=await db.from('member_invites').select('email,role,created_at,consumed_at').eq('pack_id',packId).eq('email',email).maybeSingle();
   if(result.error||!result.data||result.data.consumed_at)return respond({error:'Pending leader approval required'},409);
   const invite=result.data;
   const url=new URL(sitePath,publicSite);if(url.origin!==new URL(publicSite).origin||url.protocol!=='https:')throw Error('Invalid public site configuration');
   url.hash='settings';
   // Repeated clicks for the same approval share an idempotency key (24h provider window).
   const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(packId+'|'+email+'|'+invite.created_at));
   const key=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
   return respond(await sendEmail({apiKey,from,to:invite.email,subject:'Pack 179: your PackOps access',text:'You have been approved for PackOps as '+invite.role+'.\n\nOpen '+url.href+'\n\nChoose Continue with Google using '+invite.email+'. No backend setup or email confirmation link is required. Your assigned Pack role controls access.',idempotencyKey:'leader-'+key,fetcher}));
  }catch{return respond({error:'Invitation email could not be processed. Approval is unchanged; share the PackOps website link manually.'},500)}
 };
}
