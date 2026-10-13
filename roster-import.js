import {csvParse,makeId} from './data.js';
const normalize=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const col=(headers,...names)=>{for(const key of names){const exact=headers.findIndex(h=>h===key);if(exact>=0)return exact;}for(const key of names){const fuzzy=headers.findIndex(h=>h.includes(key));if(fuzzy>=0)return fuzzy;}return -1};
export const RANKS=['Lion','Tiger','Wolf','Bear','Webelos','Arrow of Light'];
export function denGroup(raw){
 const den=normalize(raw);
 if(!den)return 'Unassigned';
 if(/^aol\b/.test(den)||/^arrow of light\b/.test(den))return 'Arrow of Light';
 for(const rank of RANKS.slice(0,5))if(new RegExp('^'+rank.toLowerCase()+'\\b').test(den))return rank;
 return 'Needs review';
}
export function parseRoster(text){
 const rows=csvParse(String(text||'').replace(/^\ufeff/,''));
 const headerAt=rows.findIndex(row=>{
  const headers=row.map(normalize);return headers.includes('first name')&&headers.includes('last name')&&headers.some(h=>h.includes('email')||h.includes('phone')||h.includes('guardian'));
 });
 if(headerAt<0)throw Error('Could not identify First Name / Last Name header columns. Expected a Scoutbook-style CSV roster. Please export the report as CSV.');
 const heads=rows[headerAt].map(normalize);
 const index={first:col(heads,'first name','given name'),last:col(heads,'last name','surname','family name'),guardian:col(heads,'parent guardian name','parent name','guardian name'),relation:col(heads,'relationship','guardian relationship'),email:col(heads,'email','email address'),mobile:col(heads,'mobile phone','cell phone'),home:col(heads,'home phone'),den:col(heads,'den','den name'),rank:col(heads,'rank','program level'),id:col(heads,'bsa number','bsa member id','member id','membership id'),location:col(heads,'address','street address')};
 const result=[],warnings=[],seenIds=new Set(),seenNames=new Set();let ignored=0;
 for(let i=headerAt+1;i<rows.length;i++){
  const row=rows[i],value=k=>index[k]<0?'':String(row[index[k]]||'').trim();
  const first=value('first'),last=value('last'),memberId=value('id');
  if(!first&&!last){ignored++;continue}
  if(/^(youth|adult|summary|total|members|unit|first name)$/i.test(first)&&!last){ignored++;continue}
  const issues=[];
  if(!first||!last)issues.push('Missing first or last name');
  if(!value('guardian'))issues.push('Guardian information missing');
  if(!value('email')&&!value('mobile')&&!value('home'))issues.push('No contact method');
  if(value('email')&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value('email')))issues.push('Email appears invalid');
  const rawDen=value('den'),rank=value('rank'),group=denGroup(rawDen);
  if(!rawDen)issues.push('Den missing');
  if(group==='Needs review')issues.push('Den label is ambiguous — verify against Scoutbook');
  if(group!=='Needs review'&&group!=='Unassigned'&&RANKS.includes(rank)&&rank!==group)issues.push('Rank and den disagree — verify, do not auto-correct');
  const nameKey=normalize(first+' '+last);
  if(memberId&&seenIds.has(memberId)||seenNames.has(nameKey))issues.push('Possible duplicate Scout — review before importing');
  if(memberId)seenIds.add(memberId);seenNames.add(nameKey);
  const rec={id:makeId(),first,last,name:`${first} ${last}`.trim(),guardian:value('guardian'),relationship:value('relation'),email:value('email'),phone:value('mobile')||value('home'),den:rawDen,denGroup:group,rank,memberId,sourceRow:i+1,issues};
  result.push(rec);if(issues.length)warnings.push({row:i+1,issues});
 }
 return {records:result,warnings,ignored,headerRow:headerAt+1,columns:heads.length,totalDataRows:rows.length-headerAt-1};
}
export function importPrivacySummary(parsed){return `${parsed.records.length} potential Scouts; ${parsed.warnings.length} rows need review; ${parsed.ignored} empty/section rows skipped. Original values preserved; no automatic merges or reassignment.`}
// Present repeated membership IDs as one Scout while retaining all raw source rows.
// Never combine records whose names disagree or whose IDs are missing.
export function groupScouts(records){
 const map=new Map();
 for(const r of records){
  const identity=r.memberId&&r.name?`${r.memberId}:${normalize(r.name)}`:r.id;
  let target=map.get(identity);
  const contact={name:r.guardian||'',email:r.email||'',phone:r.phone||'',relationship:r.relationship||''};
  if(!target){target={...r,guardianContacts:[],sourceRows:[r.sourceRow],sourceRecordIds:[r.id],issues:[...(r.issues||[])]};map.set(identity,target)}
  else {
   target.sourceRows.push(r.sourceRow);target.sourceRecordIds.push(r.id);
   target.issues=[...new Set([...target.issues,...(r.issues||[])])];
   if(!target.issues.includes('Multiple guardian/contact rows for this Scout'))target.issues.push('Multiple guardian/contact rows for this Scout');
  }
  if((contact.name||contact.email||contact.phone)&&!target.guardianContacts.some(c=>c.name===contact.name&&c.email===contact.email&&c.phone===contact.phone))target.guardianContacts.push(contact);
 }
 return [...map.values()];
}
export const safeCsvValue=value=>{
 let v=String(value??'');
 if(/^[\s]*[=+@-]/.test(v))v="'"+v;
 return '"'+v.replaceAll('"','""')+'"';
};
export function exportRoster(records,fields=['name','den']){
 const allowed={name:'Scout name',den:'Original den',denGroup:'Den group',rank:'Rank',guardian:'Guardian',email:'Guardian email',phone:'Guardian phone',issues:'Review notes'};
 const chosen=fields.filter(k=>allowed[k]);
 if(!chosen.length)throw Error('Select at least one export field');
 const read=(r,key)=>{
  if(key==='issues')return (r.issues||[]).join('; ');
  if(r.guardianContacts?.length&&['guardian','email','phone'].includes(key))return [...new Set(r.guardianContacts.map(c=>c[key==='guardian'?'name':key]).filter(Boolean))].join('; ');
  return r[key];
 };
 return [chosen.map(k=>safeCsvValue(allowed[k])).join(','),...records.map(record=>chosen.map(k=>safeCsvValue(read(record,k))).join(','))].join('\r\n')+'\r\n';
}
