// Shared by the browser and build. Only explicitly public fields are returned.
export function normalizeCloudConfig(input={}){
 const projectUrl=String(input.projectUrl||'').trim();
 const publishableKey=String(input.publishableKey||'').trim();
 const packId=String(input.packId||'').trim().toLowerCase();
 let endpoint;
 try{endpoint=new URL(projectUrl)}catch{throw Error('Use the HTTPS Supabase project URL from Project Settings.')}
 if(endpoint.protocol!=='https:'||!/^([a-z0-9-]+)\.supabase\.(co|in)$/.test(endpoint.hostname)||endpoint.username||endpoint.password||endpoint.port||endpoint.search||endpoint.hash||!['','/'].includes(endpoint.pathname))throw Error('Use the HTTPS Supabase project URL from Project Settings.');
 let publicKey=/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey);
 if(!publicKey){
  // Legacy keys are JWTs; a service_role claim is base64 encoded, not plain text.
  try{
   const parts=publishableKey.split('.');
   if(parts.length!==3||!parts.every(p=>/^[A-Za-z0-9_-]+$/.test(p)))throw Error();
   const payload=JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
   publicKey=payload.role==='anon'&&(!payload.ref||payload.ref===endpoint.hostname.split('.')[0]);
  }catch{publicKey=false}
 }
 if(!publicKey)throw Error('Use only a Supabase publishable key or legacy anon key. Secret, service_role and Google OAuth credentials are not allowed.');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(packId))throw Error('Use the Pack UUID from public.packs, not an Auth user UUID.');
 return {projectUrl:endpoint.origin,publishableKey,packId};
}
export function hasCloudConfig(input={}){
 return ['projectUrl','publishableKey','packId'].some(k=>String(input[k]||'').trim());
}
export function resolveCloudConfig(published={},device={}){
 // Never mix fields from different backends. Published config wins as a unit.
 const managed=hasCloudConfig(published);
 const source=managed?published:device;
 return {projectUrl:source.projectUrl||'',publishableKey:source.publishableKey||'',packId:source.packId||'',managed};
}
