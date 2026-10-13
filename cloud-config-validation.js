// Pure configuration checks shared by the browser and build. Never log key values.
const fields=['projectUrl','publishableKey','packId'];
export function hasCloudConfiguration(config={}){
 return fields.some(key=>String(config[key]||'').trim());
}
export function resolveCloudConfiguration(deployed={},local={}){
 // A deployment is one atomic configuration; never mix it with stale device values.
 const managed=hasCloudConfiguration(deployed);
 return {...Object.fromEntries(fields.map(key=>[key,String((managed?deployed:local)[key]||'').trim()])),managed};
}
export function validateCloudConfiguration(config,{allowEmpty=false}={}){
 const normalized=resolveCloudConfiguration(config);
 if(allowEmpty&&!hasCloudConfiguration(normalized))return null;
 if(!fields.every(key=>normalized[key]))throw Error('Pack backend setup is incomplete. Ask the Pack administrator to configure the website.');
 let endpoint;
 try{endpoint=new URL(normalized.projectUrl)}catch{throw Error('Use the HTTPS Supabase project URL.')}
 if(endpoint.protocol!=='https:'||!/^[-a-z0-9]+\.supabase\.(co|in)$/i.test(endpoint.hostname)||endpoint.username||endpoint.password||endpoint.port||endpoint.search||endpoint.hash||endpoint.pathname!=='/')
  throw Error('Use the HTTPS Supabase project URL without a path, password, or query.');
 const key=normalized.publishableKey;
 if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)){
  let payload;
  try{
   const parts=key.split('.');
   if(parts.length!==3||!parts.every(part=>/^[A-Za-z0-9_-]+$/.test(part)))throw Error();
   payload=JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
  }catch{throw Error('Use only a Supabase publishable key or legacy anon key. Never use a secret, service-role key, OAuth secret, or password.')}
  // Decoding checks key TYPE only; Supabase verifies the signature and authorizes requests.
  if(payload.role!=='anon')throw Error('Only a legacy anon key is allowed in the browser; privileged keys are forbidden.');
  if(payload.ref&&payload.ref!==endpoint.hostname.split('.')[0])throw Error('The anon key belongs to a different Supabase project.');
 }
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized.packId))
  throw Error('Use the Pack UUID from public.packs, not a user ID.');
 return {projectUrl:endpoint.origin,publishableKey:key,packId:normalized.packId};
}
