const DB_NAME='packops-p179-v1';
const DB_VERSION=3;
export const TABLES=['events','tasks','receipts','attachments','equipment','budget','roster','bookmarks','settings','calendarEvents','financeLedger','financeAccounts','financeAdjustments','financeReimbursements','financeTags','financeAudit'];
let instancePromise;
function openDb(){
  if(instancePromise)return instancePromise;
  instancePromise=new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      for(const table of TABLES){if(!db.objectStoreNames.contains(table))db.createObjectStore(table,{keyPath:table==='settings'?'key':'id'});}
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('Could not open local database'));
    request.onblocked=()=>reject(new Error('Close other tabs and try again'));
  }).catch(error=>{instancePromise=undefined;throw error});
  return instancePromise;
}
function transact(table,mode,action){
  return openDb().then(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(table,mode);
    const store=tx.objectStore(table);
    let value;
    try{
      const req=action(store);
      req.onsuccess=()=>{value=req.result};
      req.onerror=()=>reject(req.error||new Error('Local database operation failed'));
    }catch(error){reject(error);tx.abort();return;}
    tx.oncomplete=()=>resolve(value);
    tx.onerror=()=>reject(tx.error||new Error('Local database transaction failed'));
    tx.onabort=()=>reject(tx.error||new Error('Local database transaction cancelled'));
  }));
}
export const list=table=>transact(table,'readonly',s=>s.getAll());
export const get=(table,key)=>transact(table,'readonly',s=>s.get(key));
export const put=(table,value)=>transact(table,'readwrite',s=>s.put(value));
export const remove=(table,key)=>transact(table,'readwrite',s=>s.delete(key));
export async function readSetting(key){return (await get('settings',key))?.value||'';}
export async function writeSetting(key,value){return put('settings',{key,value});}
// One transaction avoids partially restored data if the browser rejects an import.
export async function replaceAllTables(snapshot){
 const db=await openDb();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(TABLES,'readwrite');
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error||new Error('Backup restore failed; original data retained'));
  tx.onabort=()=>reject(tx.error||new Error('Backup restore cancelled'));
  try{
   for(const table of TABLES){
    const store=tx.objectStore(table);
    store.clear();
    for(const row of snapshot[table])store.put(row);
   }
  }catch(error){tx.abort();reject(error);}
 });
}
// One transaction for a reviewed draft replacement, dues settings, and audit snapshot.
export async function replaceAnnualBudget({existing=[],draft=[],audit,settings=[]}){
 const db=await openDb();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(['budget','settings','financeAudit'],'readwrite');
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error||new Error('Budget could not be saved'));
  tx.onabort=()=>reject(tx.error||new Error('Budget update cancelled; no replacement committed'));
  try{
   const budget=tx.objectStore('budget');
   for(const row of existing)budget.delete(row.id);
   for(const row of draft)budget.put(row);
   tx.objectStore('financeAudit').put(audit);
   const opts=tx.objectStore('settings');
   for(const row of settings)opts.put(row);
  }catch(error){tx.abort();reject(error)}
 });
}
// Atomic replacement of one year's read-only ledger snapshot. Never edits official Google files.
export async function replaceAnnualLedger({previous=[],next=[],year,importedAt}){
 const db=await openDb();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(['financeLedger','settings'],'readwrite');
  tx.oncomplete=()=>resolve();
  tx.onerror=()=>reject(tx.error||new Error('Ledger import failed; previous snapshot retained'));
  tx.onabort=()=>reject(tx.error||new Error('Ledger import cancelled; previous snapshot retained'));
  try{
   const ledger=tx.objectStore('financeLedger');
   for(const row of previous)ledger.delete(row.id);
   for(const row of next)ledger.put(row);
   tx.objectStore('settings').put({key:'financeLedgerImportedAt:'+year,value:importedAt});
  }catch(error){tx.abort();reject(error)}
 });
}
export async function clearEverything(){
  const db=await openDb();db.close();instancePromise=undefined;
  await new Promise((resolve,reject)=>{const req=indexedDB.deleteDatabase(DB_NAME);req.onsuccess=resolve;req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error('Close other PackOps tabs before clearing data'))});
}
