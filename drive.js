// Optional, user-authorized Google Drive uploading. Tokens stay in memory only.
// With drive.file scope, users must explicitly select the destination folder through Google Picker.
let token='';let expiresAt=0;
function loadScript(src,globalTest){
 if(globalTest())return Promise.resolve();
 return new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=src;script.async=true;
  script.onload=()=>globalTest()?resolve():reject(new Error('Google library did not load'));
  script.onerror=()=>reject(new Error('Unable to load Google. Check connection or content blockers.'));
  document.head.append(script);
 });
}
export async function authorize(clientId){
 if(!clientId?.trim())throw Error('Enter your Google OAuth Client ID in Settings first.');
 if(token&&Date.now()<expiresAt-60000)return token;
 await loadScript('https://accounts.google.com/gsi/client',()=>Boolean(window.google?.accounts?.oauth2));
 return new Promise((resolve,reject)=>{
  const client=window.google.accounts.oauth2.initTokenClient({
   client_id:clientId.trim(),scope:'https://www.googleapis.com/auth/drive.file',
   callback(response){
    if(response.error||!response.access_token){reject(Error(response.error_description||response.error||'Google sign-in cancelled'));return;}
    token=response.access_token;expiresAt=Date.now()+(response.expires_in||3600)*1000;resolve(token);
   },
   error_callback(error){reject(Error(error.message||error.type||'Could not sign into Google'));}
  });
  client.requestAccessToken({prompt:'consent'});
 });
}
export function disconnect(){token='';expiresAt=0}
export function connected(){return Boolean(token&&Date.now()<expiresAt-60000)}
export async function selectFolder(apiKey,clientId,title='Choose the Pack receipts folder (2026–27)'){
 if(!apiKey?.trim())throw Error('Enter your Google Picker API key in Settings first.');
 const accessToken=await authorize(clientId);
 await loadScript('https://apis.google.com/js/api.js',()=>Boolean(window.gapi));
 await new Promise((resolve,reject)=>window.gapi.load('picker',{callback:resolve,onerror:()=>reject(Error('Google Picker failed to load'))}));
 return new Promise((resolve,reject)=>{
  const pickerApi=window.google.picker;
  const view=new pickerApi.DocsView(pickerApi.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true);
  const picker=new pickerApi.PickerBuilder().addView(view).setOAuthToken(accessToken).setDeveloperKey(apiKey.trim())
   .setTitle(title)
   .setCallback(data=>{
    if(data.action===pickerApi.Action.PICKED){const doc=data.docs?.[0];if(!doc?.id){reject(Error('No folder selected'));return;}resolve({id:doc.id,name:doc.name||doc.id});}
    if(data.action===pickerApi.Action.CANCEL)reject(Error('Folder selection cancelled'));
   }).build();
  picker.setVisible(true);
 });
}
export async function uploadReceipt(record,folderId,clientId){
 if(!folderId)throw Error('Select a destination folder in Settings first.');
 const accessToken=await authorize(clientId);
 const boundary='packops'+crypto.randomUUID().replaceAll('-','');
 const metadata={name:record.fileName,parents:[folderId],description:`PackOps receipt${record.vendor?' — '+record.vendor:''}${record.amount!=null?' — $'+Number(record.amount).toFixed(2):''}`};
 const body=new Blob([
  `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
  `--${boundary}\r\nContent-Type: ${record.mimeType||'application/octet-stream'}\r\n\r\n`,
  record.blob,
  `\r\n--${boundary}--`,
 ]);
 const response=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',{
  method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':`multipart/related; boundary=${boundary}`},body
 });
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(result.error?.message||`Google Drive upload failed (${response.status})`);
 if(!result.id)throw Error('Google Drive did not return a file ID');
 return result;
}

export async function uploadEncryptedBackup(backup,folderId,clientId){
 if(!folderId)throw Error('Select your restricted PackOps Backup folder first');
 const accessToken=await authorize(clientId);
 const boundary='packops'+crypto.randomUUID().replaceAll('-','');
 const metadata={name:backup.fileName,parents:[folderId],description:'Encrypted PackOps restore point. Passphrase required; no plaintext Scout records.'};
 const body=new Blob([
  `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
  `--${boundary}\r\nContent-Type: application/json\r\n\r\n`,
  backup.blob,
  `\r\n--${boundary}--`
 ]);
 const response=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',{
  method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':`multipart/related; boundary=${boundary}`},body
 });
 const result=await response.json().catch(()=>({}));
 if(!response.ok||!result.id)throw Error(result.error?.message||'Encrypted backup upload failed');
 return result;
}
