// Server-only helper. Never include this directory in the frontend build.
export async function sendEmail({apiKey,from,to,subject,text,idempotencyKey,fetcher=fetch}){
 if(!apiKey||!from)return {emailStatus:'failed',emailError:'Email provider is not configured. Set RESEND_API_KEY and RSVP_FROM_EMAIL in Supabase Edge Function secrets.'};
 try{
  const response=await fetcher('https://api.resend.com/emails',{
   method:'POST',headers:{authorization:'Bearer '+apiKey,'Content-Type':'application/json',...(idempotencyKey?{'Idempotency-Key':idempotencyKey}:{})},
   body:JSON.stringify({from,to:[to],subject,text}),signal:AbortSignal.timeout(15000)
  });
  const body=await response.json().catch(()=>({}));
  if(!response.ok||typeof body.id!=='string'||!body.id)return {emailStatus:'failed',emailError:'Email provider did not accept the message'+(response.status?' (HTTP '+response.status+')':'')+'. Check the verified sender, recipient restrictions, API key and provider logs; share the link manually.'};
  return {emailStatus:'accepted',emailId:body.id};
 }catch{return {emailStatus:'failed',emailError:'Email delivery could not be confirmed. Check provider logs before retrying; share the link manually if needed.'}}
}
