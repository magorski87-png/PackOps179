import {db,site,sitePath,cors,response,memberFor,reviewers,sendEmail,bridgeCall} from '../_shared/pack.ts';
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST')return response({error:'POST required'},405);
 try{
  const raw=await req.text();if(raw.length>10000)return response({error:'Request too large'},413);
  const body=JSON.parse(raw),member=await memberFor(req,body.packId);
  if(body.action==='snapshot'){
   if(!reviewers.includes(member.role))return response({error:'Finance reviewer required'},403);
   return response(await bridgeCall({action:'snapshot',packId:body.packId,year:body.year}));
  }
  const {data:r,error}=await db.from('finance_requests').select('*').eq('pack_id',body.packId).eq('id',body.requestId).single();
  if(error||!r)return response({error:'Transaction not found'},404);
  if(!reviewers.includes(member.role)&&r.submitted_by!==member.user.id)return response({error:'Transaction not available'},403);
  if(body.action==='notify'){
   const {data:pending,error:pendingError}=await db.from('finance_notifications').select('*').eq('pack_id',body.packId).eq('request_id',r.id).eq('email_state','pending');
   if(pendingError)throw Error('Unable to read notification queue');
   if(!Deno.env.get('RESEND_API_KEY')||!Deno.env.get('RSVP_FROM_EMAIL'))return response({message:'In-app notifications created. Email provider is not configured.'});
   let accepted=0;
   for(const notice of pending||[]){
    const {data:active}=await db.from('pack_members').select('role').eq('pack_id',body.packId).eq('user_id',notice.user_id).eq('status','active').maybeSingle();
    if(!active||!reviewers.includes(active.role))continue;
    // Claim atomically. A timeout leaves an explicit sending/failed state, never an automatic duplicate.
    const {data:claimed}=await db.from('finance_notifications').update({email_state:'sending'}).eq('id',notice.id).eq('email_state','pending').select('id');
    if(!claimed?.length)continue;
    const {data:account}=await db.auth.admin.getUserById(notice.user_id);
    const result=account.user?.email?await sendEmail(account.user.email,'PackOps: transaction awaiting review','A new Pack transaction is ready for your review. Sign in to see the details:\n'+site+sitePath+'#budget','finance-'+notice.id):{accepted:false};
    await db.from('finance_notifications').update({email_state:result.accepted?'accepted':'failed'}).eq('id',notice.id);
    if(result.accepted)accepted++;
   }
   return response({message:accepted+' reviewer email(s) accepted by provider. In-app notifications are available.'});
  }
  if(body.action!=='post')return response({error:'Unknown action'},400);
  if(!reviewers.includes(member.role))return response({error:'Finance reviewer required'},403);
  if(r.status==='posted')return response({request:r});
  if(r.status!=='payment_verified')return response({error:'Approve and verify payment before posting'},409);
  const data=await bridgeCall({action:'post',packId:body.packId,year:r.source_year,transaction:{id:r.id,description:r.description,date:r.transaction_date,debit:r.direction==='out'?Number(r.amount):0,credit:r.direction==='in'?Number(r.amount):0,receipt:r.receipt_url||''}});
  const row={id:'packops:'+r.id,description:r.description,date:r.transaction_date,debit:r.direction==='out'?Number(r.amount):0,credit:r.direction==='in'?Number(r.amount):0,balance:Number(data.balance),sourceRow:Number(data.row),sourceYear:r.source_year};
  if(data.id!==r.id||!Number.isFinite(row.balance)||!Number.isInteger(row.sourceRow)||row.sourceRow<2)throw Error('Ledger response could not be verified');
  const completed=await db.rpc('pack_finish_ledger_post',{p_pack:body.packId,p_id:r.id,p_actor:member.user.id,p_row:row});
  if(completed.error)throw Error('Ledger accepted the row, but PackOps confirmation failed. Retry this same transaction; do not submit another.');
  return response({request:completed.data});
 }catch(e){return response({error:e instanceof Error?e.message:'Request failed'},400)}
});
