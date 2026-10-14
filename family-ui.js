// Pure display helpers for Pack 179 family RSVP screens.
export function familyResults(records){
 const replies=new Map(records.responses.map(r=>[r.invitation_id,r.answer]));
 const totals={invited:records.invitations.length,replied:replies.size,yes:0,maybe:0,no:0,adults:0,children:0};
 for(const a of replies.values()){if(a.status==='yes'){totals.yes++;totals.adults+=Number(a.adults||0);totals.children+=Number(a.children||0)}else if(a.status==='maybe')totals.maybe++;else if(a.status==='no')totals.no++}
 return {...totals,unanswered:totals.invited-totals.replied};
}
export function familyResponseCsv(records){
 const quotes=x=>'"'+String(x??'').replace(/^[\s]*[=+@-]/,m=>"'"+m).replaceAll('"','""')+'"';
 const replies=new Map(records.responses.map(r=>[r.invitation_id,r]));
 const columns=['Family','Email','Status','Adults','Children','Choice','Submitted'];
 return [columns.map(quotes).join(','),...records.invitations.map(x=>{
  const response=replies.get(x.id),answer=response?.answer||{};
  return [x.recipient_label,x.recipient_email||'',answer.status||'Not yet responded',answer.adults??'',answer.children??'',answer.choice||'',response?.submitted_at||''].map(quotes).join(',');
 })].join('\r\n');
}
export function familyPublicPanel(data,{field,select,esc}){
 if(!data)return '<div class="panel">Opening your private invitation…</div>';
 const header='<section class="panel stack"><span class="eyebrow">PACK 179 · FAMILY RESPONSE</span><h1>'+esc(data.title)+'</h1><p>'+esc(data.description||'')+'</p><p>Invited household: <strong>'+esc(data.recipientLabel)+'</strong></p>'+(data.personalNote?'<div class="note"><strong>Note from your Pack leader</strong><p style="white-space:pre-wrap">'+esc(data.personalNote)+'</p></div>':'');
 const footer='<p class="meta">Your response is private to authorized Pack leaders. You can reuse this link to update it.</p></section>';
 if(data.kind==='rsvp')return header+'<form class="stack" data-form="family-public-response">'+select('Will you attend?','status',[['yes','Yes'],['maybe','Maybe'],['no','No']],'yes')+'<div class="form-grid">'+field('Adults attending','adults','number','1','min="0" max="30" required')+field('Children attending','children','number','1','min="0" max="30" required')+'</div><button class="btn" type="submit">Submit my RSVP</button></form>'+footer;
 const options=Array.isArray(data.questions)?data.questions.flatMap(q=>Array.isArray(q.options)?q.options:[]):[];
 return header+'<form class="stack" data-form="family-public-response">'+select(data.kind==='volunteer'?'Choose a volunteer position':'Choose your answer','choice',options.map(x=>[x,x]))+'<button class="btn" type="submit">Submit response</button></form>'+footer;
}
