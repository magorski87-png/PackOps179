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
export async function clearEverything(){
  const db=await openDb();db.close();instancePromise=undefined;
  await new Promise((resolve,reject)=>{const req=indexedDB.deleteDatabase(DB_NAME);req.onsuccess=resolve;req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error('Close other PackOps tabs before clearing data'))});
}
