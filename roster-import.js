import {csvParse,makeId} from './data.js';
const normalize=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const col=(headers,...names)=>{for(const key of names){const exact=headers.findIndex(h=>h===key);if(exact>=0)return exact;}for(const key of names){const fuzzy=headers.findIndex(h=>h.includes(key));if(fuzzy>=0)return fuzzy;}return -1};
export function parseRoster(text){
 const rows=csvParse(String(text||'').replace(/^\ufeff/,''));
 const headerAt=rows.findIndex(row=>{
  const headers=row.map(normalize);return headers.includes('first name')&&headers.includes('last name')&&headers.some(h=>h.includes('email')||h.includes('phone')||h.includes('guardian'));
 });
 if(headerAt<0)throw Error('Could not identify First Name / Last Name header columns. Expected a Scoutbook-style CSV roster. Please export the report as CSV.');
 const heads=rows[headerAt].map(normalize);const index={first:col(heads,'first name','given name'),last:col(heads,'last name','surname','family name'),guardian:col(heads,'parent guardian name','parent name','guardian name'),relation:col(heads,'relationship','guardian relationship'),email:col(heads,'email','email address'),mobile:col(heads,'mobile phone','cell phone','phone number','phone'),home:col(heads,'home phone'),den:col(heads,'den','den name'),rank:col(heads,'rank','program level'),id:col(heads,'member id','membership id','bsa member id'),location:col(heads,'address','street address')};
 const result=[],warnings=[];const keys=new Set();let ignored=0;
 for(let i=headerAt+1;i<rows.length;i++){
  const row=rows[i];const value=k=>index[k]<0?'':String(row[index[k]]||'').trim();
  const first=value('first'),last=value('last'),memberId=value('id');
  if(!first&&!last){ignored++;continue;}
  if(/^(youth|adult|summary|total|members|unit|first name)$/i.test(first)&&!last){ignored++;continue;}
  const personName=`${first} ${last}`.trim();const issues=[];
  if(!first||!last)issues.push('Missing first or last name');
  if(!value('guardian'))issues.push('Guardian information missing');
  if(!value('email')&&!value('mobile')&&!value('home'))issues.push('No contact method');
  if(value('email')&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value('email')))issues.push('Email appears invalid');
  const den=value('den')||value('rank');if(!den)issues.push('Den/rank not included in export');
  const key=memberId?'id:'+normalize(memberId):'name:'+normalize(first+' '+last);
  if(keys.has(key))issues.push('Possible duplicate Scout — review before importing');else keys.add(key);
  const rec={id:makeId(),first,last,name:personName,guardian:value('guardian'),relationship:value('relation'),email:value('email'),phone:value('mobile')||value('home'),den,memberId,sourceRow:i+1,issues};
  result.push(rec);
  if(issues.length)warnings.push({row:i+1,issues});
 }
 return {records:result,warnings,ignored,headerRow:headerAt+1,columns:heads.length,totalDataRows:rows.length-headerAt-1};
}
export function importPrivacySummary(parsed){
 return `${parsed.records.length} potential people; ${parsed.warnings.length} rows need review; ${parsed.ignored} empty/section rows skipped. No guesses or automatic merges.`;
}
