// A real read-only database request. No login, private data, or service-role key.
import {pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {PACK_CLOUD_CONFIG} from '../cloud-config.js';
import {validateCloudConfiguration} from '../cloud-config-validation.js';

export async function heartbeat(config=PACK_CLOUD_CONFIG,{fetchImpl=fetch,sleep=delay}={}) {
 const {projectUrl,publishableKey}=validateCloudConfiguration(config);
 for(let attempt=1;attempt<=3;attempt++) {
  try {
   const response=await fetchImpl(`${projectUrl}/rest/v1/rpc/packops_heartbeat`,{
    method:'GET',headers:{apikey:publishableKey,Accept:'application/json'},
    signal:AbortSignal.timeout(15000),redirect:'error',cache:'no-store'
   });
   if(!response.ok)throw new Error(`Database heartbeat returned HTTP ${response.status}`);
   const result=await response.json();
   if(result?.ok!==true || typeof result.checked_at!=='string' || !Number.isFinite(Date.parse(result.checked_at)))
    throw new Error('Database heartbeat returned an unexpected response');
   return result;
  } catch {
   if(attempt===3)throw new Error('Database heartbeat failed after 3 attempts. Check Supabase project status and the packops_heartbeat migration. A paused project must be resumed in Supabase.');
   await sleep(attempt*2000);
  }
 }
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
 try { const result=await heartbeat(); console.log(`Database heartbeat OK at ${result.checked_at}`); }
 catch(error) { console.error(error.message); process.exitCode=1; }
}
