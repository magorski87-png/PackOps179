// Encrypted, portable PackOps backup. No plaintext Scout data in the download or Drive file.
import {TABLES,list,replaceAllTables} from './db.js';
const KIND='packops179-encrypted-backup', VERSION=1;
const encoder=new TextEncoder(), decoder=new TextDecoder();
const limits={maxBackupBytes:150*1024*1024,maxBlobBytes:30*1024*1024};
function toB64(bytes){
 let out='';for(let i=0;i<bytes.length;i+=8192)out+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return btoa(out);
}
function fromB64(value){
 if(typeof value!=='string'||value.length>limits.maxBackupBytes*2)throw Error('Invalid backup encoding');
 const binary=atob(value),out=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);
 return out;
}
async function serialize(value){
 if(value instanceof Blob){
  if(value.size>limits.maxBlobBytes)throw Error('An attached file is too large for a portable backup (30 MB limit).');
  return {__packopsBlob:true,mime:value.type||'application/octet-stream',base64:toB64(new Uint8Array(await value.arrayBuffer()))};
 }
 if(Array.isArray(value))return Promise.all(value.map(serialize));
 if(value&&typeof value==='object'){
  const out={};for(const [key,val] of Object.entries(value))out[key]=await serialize(val);
  return out;
 }
 return value;
}
function deserialize(value){
 if(Array.isArray(value))return value.map(deserialize);
 if(value&&typeof value==='object'){
  if(value.__packopsBlob===true){
   if(typeof value.base64!=='string'||value.base64.length>limits.maxBlobBytes*2)throw Error('Backup contains an oversized attachment');
   return new Blob([fromB64(value.base64)],{type:String(value.mime||'application/octet-stream')});
  }
  const out={};for(const [key,val] of Object.entries(value))out[key]=deserialize(val);
  return out;
 }
 return value;
}
async function keyFor(passphrase,salt,usage){
 if(typeof passphrase!=='string'||passphrase.length<12)throw Error('Backup passphrase must have at least 12 characters');
 const material=await crypto.subtle.importKey('raw',encoder.encode(passphrase),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:250000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,[usage]);
}
export async function createEncryptedBackup(passphrase,sharedSnapshot=null,cloudWorkflow=null){
 const tables={};
 for(const table of TABLES){
  const records=sharedSnapshot&&Object.hasOwn(sharedSnapshot,table)?sharedSnapshot[table]:await list(table);
  // Google public client configuration should be re-entered on each device.
  const filtered=table==='settings'?records.filter(r=>!/^google(ClientId|ApiKey|Folder|FolderName|BackupFolder|BackupFolderName)$/.test(r.key)):records;
  tables[table]=await serialize(filtered);
 }
 const payload=encoder.encode(JSON.stringify({kind:KIND,version:VERSION,createdAt:new Date().toISOString(),tables,cloudWorkflow:cloudWorkflow?await serialize(cloudWorkflow):null}));
 if(payload.byteLength>limits.maxBackupBytes)throw Error('Backup exceeds 150 MB; move large attachments into Drive first');
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const key=await keyFor(passphrase,salt,'encrypt');
 const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,payload));
 const envelope={kind:KIND,version:VERSION,algorithm:'AES-256-GCM',kdf:'PBKDF2-SHA256-250000',salt:toB64(salt),iv:toB64(iv),ciphertext:toB64(ciphertext)};
 const blob=new Blob([JSON.stringify(envelope)],{type:'application/json'});
 const date=new Date().toISOString().slice(0,10);
 return {blob,fileName:'PackOps179-'+date+'.encrypted.json',recordCounts:Object.fromEntries(Object.entries(tables).map(([k,v])=>[k,v.length]))};
}
export async function readEncryptedBackup(file,passphrase){
 if(!file||file.size>limits.maxBackupBytes*1.5)throw Error('Backup file is too large');
 let e;try{e=JSON.parse(await file.text())}catch{throw Error('Not a valid PackOps backup file')}
 if(e.kind!==KIND||e.version!==VERSION||e.algorithm!=='AES-256-GCM')throw Error('Unsupported PackOps backup format');
 let payload;try{
  const key=await keyFor(passphrase,fromB64(e.salt),'decrypt');
  payload=decoder.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64(e.iv)},key,fromB64(e.ciphertext)));
 }catch{throw Error('Incorrect passphrase or damaged backup')}
 let data;try{data=JSON.parse(payload)}catch{throw Error('Backup contents are invalid')}
 if(data.kind!==KIND||data.version!==VERSION||!data.tables||typeof data.tables!=='object')throw Error('Backup contents do not match PackOps');
 const dataKeys=Object.keys(data.tables);
 if(dataKeys.some(k=>!TABLES.includes(k)))throw Error('Backup includes unsupported tables; update PackOps before importing');
 const rows={};
 for(const table of TABLES){
  // Older v0.5 backups predate the den-record tables; treat ONLY those missing tables as empty.
  const source=data.tables[table]??(['denPlans','adventureProgress','attendance'].includes(table)?[]:null);
  if(!Array.isArray(source))throw Error('Backup missing table: '+table);
  const key=table==='settings'?'key':'id',seen=new Set();
  if(source.length>50000)throw Error('Backup table is unexpectedly large: '+table);
  for(const r of source){
   if(!r||typeof r!=='object'||Array.isArray(r)||typeof r[key]!=='string'||!r[key]||seen.has(r[key]))throw Error('Invalid or duplicate record in '+table);
   seen.add(r[key]);
  }
  rows[table]=deserialize(source);
 }
 return {createdAt:data.createdAt,rows,recordCounts:Object.fromEntries(TABLES.map(t=>[t,rows[t].length]))};
}
export async function restoreBackup(preview){await replaceAllTables(preview.rows);}
