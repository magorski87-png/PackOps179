import {validateCloudConfiguration} from './cloud-config-validation.js';
// PackOps v0.6 shared backend. Browser gets ONLY Supabase publishable/anon key.
// Never put service_role keys, Google OAuth secrets or email credentials here.
export const SHARED_TABLES=['events','tasks','equipment','roster','budget','financeLedger','financeAccounts','financeAdjustments','financeReimbursements','financeTags','financeAudit','receipts','denPlans','adventureProgress','attendance'];
export const CLOUD_ROLES=['admin','cubmaster','treasurer','den_leader','volunteer'];
let client=null,packId='',user=null,member=null,url='',clientKey='';
let remoteLoad=null;let changesChannel=null;
export function cloudState(){return {configured:!!client,packId,authenticated:!!user,member,user:{email:user?.email||'',id:user?.id||''},url};}
export function sharedTable(name){return SHARED_TABLES.includes(name)}
const fail=({error},context)=>{if(error)throw Error(context+': '+error.message);};
export async function configureCloud({projectUrl,publishableKey,pack}){
 const validated=validateCloudConfiguration({projectUrl,publishableKey,packId:pack});
 const endpoint=new URL(validated.projectUrl);
 publishableKey=validated.publishableKey;pack=validated.packId;
 if(!remoteLoad)remoteLoad=import('https://esm.sh/@supabase/supabase-js@2.76.1').catch(e=>{remoteLoad=null;throw Error('Could not load Supabase library. '+e.message)});
 const {createClient}=await remoteLoad;
 if(client&&url===endpoint.origin&&packId===pack&&clientKey===publishableKey){return syncCloudIdentity()}
 await stopCloudChanges();user=null;member=null;
 client=createClient(endpoint.origin,publishableKey.trim(),{auth:{flowType:'pkce',autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});
 url=endpoint.origin;packId=pack;clientKey=publishableKey;return syncCloudIdentity();
}
export async function syncCloudIdentity(){
 if(!client)return cloudState();
 const {data,error}=await client.auth.getUser();
 if(error&&error.name!=='AuthSessionMissingError')throw Error('Google session: '+error.message);
 user=data?.user||null;member=null;
 if(user){
  // May only activate a previously created invitation. No public self-approval.
  const activation=await client.rpc('pack_accept_invite',{target_pack:packId});
  if(activation.error&&activation.error.code!=='42883')throw Error('Invitation lookup: '+activation.error.message);
  const res=await client.from('pack_members').select('role,den_scopes,status').eq('pack_id',packId).eq('user_id',user.id).maybeSingle();
  fail(res,'Membership');member=res.data?.status==='active'?res.data:null;
 }
 return cloudState();
}
export async function googleCloudLogin(){
 if(!client)throw Error('Configure Supabase first');
 const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname+'#settings'}});
 if(error)throw Error(error.message);
}
export async function googleCloudLogout(){await stopCloudChanges();if(client){const {error}=await client.auth.signOut();fail({error},'Sign out')}user=null;member=null}
function requireMember(){if(!client||!member||!user)throw Error('An approved PackOps Google login is required.');}
export async function fetchCloudRows(table){
 requireMember();if(!sharedTable(table))throw Error('Table is not configured for shared storage.');
 const out=[];
 for(let from=0;from<100000;from+=500){
  const res=await client.from('pack_records').select('payload').eq('pack_id',packId).eq('table_name',table).order('record_id').range(from,from+499);
  fail(res,'Loading '+table);out.push(...(res.data||[]).map(x=>x.payload));if((res.data||[]).length<500)break;
 }
 return out;
}
export async function saveCloudRow(table,record){
 requireMember();if(!sharedTable(table))throw Error('Only shared records can be saved to Supabase.');
 if(!record?.id)throw Error('Cloud record requires an ID.');
 const den=record.den||null;
 const response=await client.from('pack_records').upsert({pack_id:packId,table_name:table,record_id:String(record.id),den_scope:den,payload:record},{onConflict:'pack_id,table_name,record_id'});
 fail(response,'Saving '+table);
}
export async function deleteCloudRow(table,id){
 requireMember();if(!sharedTable(table))throw Error('Not shared');
 fail(await client.from('pack_records').delete().eq('pack_id',packId).eq('table_name',table).eq('record_id',String(id)),'Removing '+table);
}
export async function migrateLocalRecords(localData){
 requireMember();if(!['admin','cubmaster'].includes(member.role))throw Error('Only Pack administrators may import existing local Pack records.');
 const totals={};
 for(const table of SHARED_TABLES){
  const records=table==='receipts'?(localData[table]||[]).filter(row=>row.driveFileId).map(({blob,...r})=>r):(localData[table]||[]);let added=0;
  for(let k=0;k<records.length;k+=50){
   const batch=records.slice(k,k+50).filter(row=>row?.id).map(row=>({pack_id:packId,table_name:table,record_id:String(row.id),den_scope:row.den||null,payload:row}));
   if(!batch.length)continue;
   const result=await client.from('pack_records').upsert(batch,{onConflict:'pack_id,table_name,record_id',ignoreDuplicates:true});
   fail(result,'Migration '+table);added+=batch.length;
  }
  totals[table]=added;
 }
 return totals;
}
export async function listMembers(){requireMember();const res=await client.from('pack_members').select('user_id,role,den_scopes,status,created_at').eq('pack_id',packId);fail(res,'Leader access');return res.data||[]}
export async function listInvites(){requireMember();const res=await client.from('member_invites').select('email,role,den_scopes,created_at').eq('pack_id',packId);fail(res,'Pending invites');return res.data||[]}
export async function addLeaderInvite({email,role,denScopes=[]}){
 requireMember();if(!['admin','cubmaster'].includes(member.role))throw Error('Only Pack admins may invite leaders');
 if(!/^\S+@\S+\.\S+$/.test(email))throw Error('Use an email address');
 if(!CLOUD_ROLES.includes(role))throw Error('Unknown role');
 const res=await client.from('member_invites').upsert({pack_id:packId,email:email.trim().toLowerCase(),role,den_scopes:denScopes},{onConflict:'pack_id,email'});
 fail(res,'Inviting leader');
}
export async function updateLeaderRole(uid,role,denScopes,status='active'){
 requireMember();if(!['admin','cubmaster'].includes(member.role))throw Error('Only Pack admins may change permissions');
 if(uid===user.id&&status==='suspended')throw Error('Do not suspend your own account.');
 const res=await client.from('pack_members').update({role,den_scopes:denScopes,status}).eq('pack_id',packId).eq('user_id',uid);
 fail(res,'Changing permission');
}
export async function listFamilyForms(){requireMember();const res=await client.from('family_forms').select('*').eq('pack_id',packId).order('created_at',{ascending:false});fail(res,'Family forms');return res.data||[]}
export async function createFamilyForm(row){
 requireMember();const res=await client.from('family_forms').insert({...row,pack_id:packId,created_by:user.id}).select().single();
 fail(res,'Creating RSVP or poll');return res.data;
}
export async function getFamilyResponses(formId){
 requireMember();
 const [a,b]=await Promise.all([
  client.from('family_invitations').select('id,recipient_label,recipient_email,delivery_status,expires_at').eq('pack_id',packId).eq('form_id',formId),
  client.from('family_responses').select('invitation_id,answer,submitted_at').eq('pack_id',packId).eq('form_id',formId)
 ]);
 fail(a,'Family invitations');fail(b,'Family replies');return {invitations:a.data||[],responses:b.data||[]};
}
export async function inviteFamily(formId,recipientLabel,recipientEmail='',sendEmail=false,note=''){
 requireMember();
 const {data,error}=await client.functions.invoke('family-rsvp',{body:{action:'invite',packId,formId,recipientLabel,recipientEmail,sendEmail,note}});
 fail({error},'Creating family invitation');if(data?.error)throw Error(data.error);return data;
}
export async function publicFamilyRequest(action,token,answer={}){
 if(!client)throw Error('PackOps backend is not configured on this device. Open the regular PackOps link with cloud settings configured.');
 const {data,error}=await client.functions.invoke('family-rsvp',{body:{action,token,answer}});
 fail({error},'Family response');if(data?.error)throw Error(data.error);return data;
}

export function watchCloudChanges(callback){
 requireMember();
 if(changesChannel)return;
 changesChannel=client.channel('packops-records-'+packId).on('postgres_changes',{
  event:'*',schema:'public',table:'pack_records',filter:'pack_id=eq.'+packId
 },()=>callback()).on('postgres_changes',{
  event:'*',schema:'public',table:'finance_notifications',filter:'pack_id=eq.'+packId
 },()=>callback()).on('postgres_changes',{
  event:'*',schema:'public',table:'finance_requests',filter:'pack_id=eq.'+packId
 },()=>callback()).subscribe();
}
export async function stopCloudChanges(){
 if(client&&changesChannel){await client.removeChannel(changesChannel);changesChannel=null}
}

export async function fetchPackSettings(){
 requireMember();
 if(!['admin','cubmaster','treasurer'].includes(member.role))return [];
 const result=await client.from('pack_settings').select('setting_key,setting_value').eq('pack_id',packId);
 fail(result,'Loading Pack finance settings');
 return (result.data||[]).map(r=>({key:r.setting_key,value:r.setting_value}));
}
export async function savePackSetting(key,value){
 requireMember();
 if(!['admin','cubmaster','treasurer'].includes(member.role))throw Error('Only an authorized finance leader can change Pack finance configuration');
 if(!(key==='activeScoutYear'||key.startsWith('finance')))throw Error('This setting is personal to this device, not shared');
 fail(await client.from('pack_settings').upsert({pack_id:packId,setting_key:key,setting_value:String(value)},{onConflict:'pack_id,setting_key'}),'Saving Pack finance setting');
}
export async function replaceCloudLedgerSnapshot(year,rows,importedAt){
 requireMember();
 const result=await client.rpc('pack_replace_ledger_snapshot',{p_pack:packId,p_year:year,p_rows:rows,p_imported_at:importedAt});
 fail(result,'Refreshing reviewed ledger snapshot');return result.data;
}

async function workflowInvoke(name,body){
 requireMember();
 const {data,error}=await client.functions.invoke(name,{body:{...body,packId}});
 if(error){
  let detail='';try{detail=(await error.context?.json())?.error||''}catch{}
  throw Error(detail||'This service is unavailable. Ask the Pack administrator to check its deployment and configuration.');
 }
 if(data?.error)throw Error(data.error);return data;
}
export async function loadTransactionWorkflow(){
 requireMember();
 const readAll=async(table,order,ascending=true,filter=null)=>{
  const rows=[];
  for(let from=0;from<100000;from+=500){
   let query=client.from(table).select('*').eq('pack_id',packId).order(order,{ascending}).range(from,from+499);
   if(filter)query=query.eq('user_id',filter);
   const result=await query;
   if(result.error)return {rows,error:result.error};
   rows.push(...(result.data||[]));if((result.data||[]).length<500)break;
  }
  return {rows};
 };
 const requests=await readAll('finance_requests','created_at',false);
 if(requests.error){
  if(['42P01','PGRST205'].includes(requests.error.code))return {available:false,requests:[],audit:[],notifications:[],error:'The secure transaction workflow needs the one-time backend update.'};
  fail(requests,'Transaction requests');
 }
 const audit=await readAll('finance_request_audit','id');fail(audit,'Transaction audit');
 const notifications=await readAll('finance_notifications','created_at',true,user.id);fail(notifications,'Review notifications');
 return {available:true,requests:requests.rows,audit:audit.rows,notifications:notifications.rows};
}
export async function submitTransaction(id,data){
 requireMember();const result=await client.rpc('pack_submit_transaction',{p_pack:packId,p_id:id,p_data:data});fail(result,'Submitting transaction');return result.data;
}
export async function reviewTransaction(id,version,action,note){
 requireMember();const result=await client.rpc('pack_review_transaction',{p_pack:packId,p_id:id,p_version:version,p_action:action,p_note:note});fail(result,'Reviewing transaction');return result.data;
}
export const notifyTransaction=id=>workflowInvoke('finance-workflow',{action:'notify',requestId:id});
export const postTransaction=id=>workflowInvoke('finance-workflow',{action:'post',requestId:id});
export const fetchOfficialLedger=year=>workflowInvoke('finance-workflow',{action:'snapshot',year});
export const sendLeaderInvite=email=>workflowInvoke('leader-invite',{email});
export async function markTransactionNotificationsRead(){requireMember();fail(await client.rpc('pack_mark_finance_notifications_seen',{p_pack:packId}),'Reading notifications')}
