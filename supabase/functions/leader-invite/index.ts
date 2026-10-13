import {db,site,sitePath,cors,response,memberFor,sendEmail} from '../_shared/pack.ts';
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return response({error:'POST required'},405);
 try{
  const raw=await req.text();if(raw.length>4000)return response({error:'Request too large'},413);
  const body=JSON.parse(raw),member=await memberFor(req,body.packId);
  if(!['admin','cubmaster'].includes(member.role))return response({error:'Pack administrator required'},403);
  const email=String(body.email||'').trim().toLowerCase();
  const {data:invite,error}=await db.from('member_invites').select('email,role,created_at,consumed_at').eq('pack_id',body.packId).eq('email',email).single();
  if(error||!invite||invite.consumed_at)return response({error:'Create a pending leader invitation before sending'},400);
  const result=await sendEmail(email,'You are invited to PackOps 179','You have been approved for PackOps 179 as '+invite.role+'.\n\nOpen '+site+sitePath+' and choose Continue with Google using this email address. No backend setup is needed.\n','leader-'+body.packId+'-'+email+'-'+invite.created_at);
  return response({accepted:result.accepted,message:result.accepted?'Invitation accepted by the email provider. Check delivery logs if it does not arrive.':result.error});
 }catch(e){return response({error:e instanceof Error?e.message:'Invitation could not be sent'},400)}
});
