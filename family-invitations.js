// Preview only. No network calls or automatic sends from this module.
export const validEmail=email=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
export function familyRecipients(roster,den=''){
 const byEmail=new Map();
 for(const scout of roster.filter(r=>!r.inactive&&(!den||r.den===den))){
  const contacts=scout.guardianContacts?.length?scout.guardianContacts:[{email:scout.email,name:scout.guardian}];
  for(const contact of contacts){
   const email=String(contact.email||'').trim().toLowerCase();
   if(!validEmail(email))continue;
   const row=byEmail.get(email)||{email,names:[],guardians:[]};
   if(!row.names.includes(scout.name))row.names.push(scout.name);
   if(contact.name&&!row.guardians.includes(contact.name))row.guardians.push(contact.name);
   byEmail.set(email,row);
  }
 }
 return [...byEmail.values()].map(r=>({...r,label:r.names.join(', ').slice(0,120)})).sort((a,b)=>a.label.localeCompare(b.label));
}
export function invitationPreview(form,recipients,sendEmail,note=''){
 if(!form||form.status!=='open')throw Error('Choose an open response form');
 if(!recipients.length||recipients.length>50)throw Error('Choose between 1 and 50 recipients');
 note=String(note||'').trim();if(note.length>1000)throw Error('Keep the family note under 1,000 characters');
 const seen=new Set();
 const rows=recipients.map(r=>{
  const email=String(r.email||'').trim().toLowerCase(),label=String(r.label||'').trim();
  if(!label||label.length>120||(email&&!validEmail(email))||(sendEmail&&!email))throw Error('Every selected household needs a name and valid email for sending');
  const key=email||label.toLowerCase();if(seen.has(key))throw Error('Duplicate recipient');seen.add(key);
  return {email,label,status:'pending'};
 });
 return {formId:form.id,title:form.title,sendEmail,note,recipients:rows,subject:'Pack 179: '+form.title,
  message:'Pack 179 invites your family to respond to '+form.title+'.\n\n'+(note?'Note from your Pack leader:\n'+note+'\n\n':'')+'Open your private response link:\n[Unique private link for this household]\n\nThis link is intended for your household only.\n'};
}
