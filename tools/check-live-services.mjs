// Read-only deployment probe. Public identifiers only; never prints the key.
import {PACK_CLOUD_CONFIG} from '../cloud-config.js';
import {validateCloudConfiguration} from '../cloud-config-validation.js';

const {projectUrl,publishableKey}=validateCloudConfiguration(PACK_CLOUD_CONFIG);
const targets=[
 ['Finance request table','/rest/v1/finance_requests?select=id&limit=0','table'],
 ['Family RSVP function','/functions/v1/family-rsvp','function'],
 ['Finance workflow function','/functions/v1/finance-workflow','function'],
 ['Leader invitation function','/functions/v1/leader-invite','function'],
];
let missing=false;
for(const [name,path,kind] of targets){
 try{
  const response=await fetch(projectUrl+path,{headers:{apikey:publishableKey},signal:AbortSignal.timeout(10000)});
  const body=await response.text();
  // An existing protected table refuses an anonymous read; a deployed function
  // returns its own POST-required response to an unauthenticated GET.
  const available=kind==='table'?(response.status===401||response.status===403||response.ok)&&!body.includes('PGRST205'):
   response.status===405&&body.includes('POST required');
  console.log(`${name}: ${available?'present':'missing or not verified'} (HTTP ${response.status})`);
  if(!available)missing=true;
 }catch(e){console.log(`${name}: unreachable (${e.name||'network error'})`);missing=true}
}
if(missing){console.error('Live services are incomplete. No database changes were made.');process.exitCode=1}
else console.log('Endpoints are present. Verify sign-in, RLS, email and Sheet posting with authorized test accounts before release.');
