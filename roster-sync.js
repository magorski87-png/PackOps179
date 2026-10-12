// Reconcile Scoutbook roster snapshots without resetting stable Scout row IDs.
const norm=s=>String(s??'').trim().toLowerCase().replace(/\s+/g,' ');
function key(row){
 const member=norm(row.memberId);
 const guardian=norm(row.email)||norm(row.phone)||norm(row.guardian);
 const name=norm(row.name||[row.first,row.last].join(' '));
 return member?'id:'+member+'|'+guardian:'name:'+name+'|'+norm(row.den)+'|'+guardian;
}
export function reconcileRoster(current,incoming){
 const byKey=new Map();
 for(const r of current){const k=key(r);if(!byKey.has(k))byKey.set(k,[]);byKey.get(k).push(r)}
 const incomingIds=new Set(),merged=[];let matched=0,added=0;
 for(const row of incoming){
  const candidates=byKey.get(key(row))||[],old=candidates.find(x=>!incomingIds.has(x.id));
  const newRow={...old,...row,id:old?.id||row.id,missingFromLatestImport:false,updatedAt:Date.now()};
  merged.push(newRow);incomingIds.add(newRow.id);if(old)matched++;else added++;
 }
 const missing=current.filter(r=>!incomingIds.has(r.id)).map(r=>({...r,missingFromLatestImport:true}));
 return {rows:[...merged,...missing],matched,added,missing:missing.length};
}
