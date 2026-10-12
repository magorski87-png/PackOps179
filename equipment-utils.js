// Pure inventory model: stable searches, category filters and safe spreadsheet exports.
export const EQUIPMENT_CATEGORIES=['Camping & Outdoor','Pinewood Derby','Rockets & STEM','Flags & Ceremonies','Games & Activities','Cooking & Food Service','Decorations & Events','Administrative Supplies','General Equipment','Other'];
const norm=s=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
export const normalizeEquipment=r=>({
 ...r,name:String(r.name||'').trim(),category:String(r.category||'General Equipment').trim()||'General Equipment',
 quantity:Number.isInteger(Number(r.quantity))&&Number(r.quantity)>=0?Number(r.quantity):1,
 location:String(r.location||''),holder:String(r.holder||''),condition:r.condition||'verify',verifiedAt:r.verifiedAt||'',notes:String(r.notes||'')
});
function score(row,terms){
 const r=normalizeEquipment(row);
 const fields=[r.name,r.category,r.location,r.holder,r.notes].map(norm);
 const text=fields.join(' ');
 let total=0;
 for(const term of terms){
  if(!text.includes(term))return -1;
  if(fields[0]===term)total+=0;
  else if(fields[0].startsWith(term))total+=1;
  else if(fields[0].split(/\W+/).some(word=>word.startsWith(term)))total+=2;
  else if(fields.some(x=>x.split(/\W+/).some(word=>word.startsWith(term))))total+=3;
  else total+=5;
 }
 return total;
}
export function queryEquipment(records,{search='',category='all',sort='name-asc'}={}){
 const terms=norm(search).split(' ').filter(Boolean);
 const rows=records.map(normalizeEquipment).filter(r=>category==='all'||r.category===category).map(r=>({...r,_score:score(r,terms)})).filter(r=>r._score>=0);
 const order=(a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'});
 rows.sort((a,b)=>{
  const aKey=sort==='category'?a.category:sort==='location'?a.location:sort==='condition'?a.condition:sort==='verified'?a.verifiedAt:a.name;
  const bKey=sort==='category'?b.category:sort==='location'?b.location:sort==='condition'?b.condition:sort==='verified'?b.verifiedAt:b.name;
  return (terms.length?a._score-b._score:0)||(sort==='name-desc'?-order(aKey,bKey):order(aKey,bKey))||order(a.name,b.name);
 });
 return rows.map(({_score,...rest})=>rest);
}
export const csvCell=x=>{
 let text=String(x??'');if(/^[\s]*[=+@\-\t\r]/.test(text))text="'"+text;
 return '"'+text.replaceAll('"','""')+'"';
};
export function equipmentCsv(rows){
 const columns=[['name','Name'],['category','Category'],['quantity','Quantity'],['location','Storage location'],['holder','Current holder'],['condition','Condition'],['verifiedAt','Last verified'],['notes','Notes']];
 return [columns.map(([,name])=>csvCell(name)).join(','),...rows.map(r=>columns.map(([key])=>csvCell(normalizeEquipment(r)[key])).join(','))].join('\r\n');
}
