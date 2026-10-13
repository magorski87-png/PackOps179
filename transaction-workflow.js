export const isFinanceReviewer=role=>['admin','cubmaster','treasurer'].includes(role);
export function transactionDraft(data){
 if(Object.hasOwn(data,'costDeleted')||Object.hasOwn(data,'depositAdded')){
  const out=Number(data.costDeleted||0),incoming=Number(data.depositAdded||0);
  if(!Number.isFinite(out)||!Number.isFinite(incoming)||out<0||incoming<0||((out>0)===(incoming>0)))throw Error('Enter either cost deleted or deposit added, not both');
  data={...data,amount:out||incoming,direction:out>0?'out':'in'};
 }
 if(data.receiptUrl&&!/^https:\/\/(drive|docs)\.google\.com\//.test(data.receiptUrl))throw Error('Use a Google Drive receipt link');
 const amount=Number(data.amount),year=String(data.year||'');
 if(!Number.isFinite(amount)||amount<=0||amount>1e9||!data.amount)throw Error('Enter a positive amount');
 if(!/^20\d\d-\d\d$/.test(year)||Number(year.slice(5))!==(Number(year.slice(0,4))+1)%100)throw Error('Choose the current Scout year');
 if(!['expense','income','transfer','restricted'].includes(data.kind))throw Error('Choose a transaction type');
 if(!['in','out'].includes(data.direction))throw Error('Choose money in or money out');
 if((data.kind==='expense'&&data.direction!=='out')||(data.kind==='income'&&data.direction!=='in'))throw Error('Expenses are money out; income is money in');
 if(!data.description?.trim()||!data.category?.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(data.date||''))throw Error('Enter a description, category and transaction date');
 if(data.kind==='income'&&/popcorn/i.test(data.category))throw Error('Scout popcorn credits are not Pack income. Use restricted allocation.');
 return {...data,amount:Math.round(amount*100)/100,description:data.description.trim().slice(0,240),category:data.category.trim().slice(0,100),notes:String(data.notes||'').slice(0,2000)};
}
export function combinedLedger(ledger,tags,requests){
 // A stable PackOps ID travels through the official Sheet/CSV so refreshes cannot double-count.
 const rows=new Map(ledger.map(r=>[r.id,r])),classifications=new Map(tags.map(t=>[t.id,t]));
 for(const r of requests.filter(r=>r.status==='posted'&&r.posted_row).sort((a,b)=>a.source_year.localeCompare(b.source_year)||Number(a.posted_row.sourceRow)-Number(b.posted_row.sourceRow))){
  const id='packops:'+r.id;
  if(!rows.has(id))rows.set(id,{...r.posted_row,id,sourceYear:r.source_year,isOpening:false,source:'Verified Google ledger posting'});
  if(!classifications.has(id))classifications.set(id,{id,kind:r.kind,category:r.category,eventId:r.event_id||''});
 }
 return {ledger:[...rows.values()],tags:[...classifications.values()]};
}
