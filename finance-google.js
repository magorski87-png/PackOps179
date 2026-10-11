// Optional, explicitly user-authorized READ-ONLY Google Sheets access.
// Google OAuth browser client ID is public; tokens are held only in memory.
// This does not grant any rights beyond the signed-in account's Google sharing permissions.
let sheetsToken='',expiry=0;
const SCOUT_CREDIT_SHEET='1ttivHLcq0bopzuKJrlUM1farkG287dM1Krts3Q-NZYQ';
function loadGoogle(){
 if(window.google?.accounts?.oauth2)return Promise.resolve();
 return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.onload=resolve;script.onerror=()=>reject(Error('Google sign-in service did not load'));document.head.append(script)});
}
export async function financeAuthorize(clientId){
 if(!clientId?.trim())throw Error('Enter the Google OAuth Web Client ID in Settings first.');
 if(sheetsToken&&Date.now()<expiry-60_000)return sheetsToken;
 await loadGoogle();
 return new Promise((resolve,reject)=>{
  const auth=window.google.accounts.oauth2.initTokenClient({client_id:clientId.trim(),scope:'https://www.googleapis.com/auth/spreadsheets.readonly',callback:r=>{
   if(!r.access_token){reject(Error(r.error_description||r.error||'Google authorization cancelled'));return}
   sheetsToken=r.access_token;expiry=Date.now()+1000*(r.expires_in||3600);resolve(sheetsToken);
  },error_callback:e=>reject(Error(e.message||e.type||'Could not authorize Google Sheets'))});
  auth.requestAccessToken({prompt:'consent'});
 });
}
export function financeDisconnect(){sheetsToken='';expiry=0}
export async function fetchScoutCreditSnapshot(clientId){
 const token=await financeAuthorize(clientId);
 // Fetch disjoint ranges so that guardian names, phone numbers and emails never leave Google via this request.
 const base=`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(SCOUT_CREDIT_SHEET)}/values:batchGet`;
 const params=new URLSearchParams({valueRenderOption:'FORMATTED_VALUE'});
 params.append('ranges',"'Sheet1'!B1:D500");params.append('ranges',"'Sheet1'!I1:K500");
 const r=await fetch(`${base}?${params}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
 const result=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(result.error?.message||`Google Sheets read failed (${r.status})`);
 const names=result.valueRanges?.[0]?.values||[],amounts=result.valueRanges?.[1]?.values||[];
 if(!names.length||!amounts.length)throw Error('Scout credit sheet has no accessible rows');
 const csvRows=[['First Name','Last Name','Den','2025-26 carryover','2026-27 popcorn earnings','positive credit or dues owed']];
 for(let i=1;i<Math.max(names.length,amounts.length);i++){
  const nameRow=names[i]||[],creditRow=amounts[i]||[];
  if(!nameRow[0]&&!nameRow[1])continue;
  csvRows.push([nameRow[0]||'',nameRow[1]||'',nameRow[2]||'',creditRow[0]||'',creditRow[1]||'',creditRow[2]||'']);
 }
 const csv=csvRows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n');
 return {csv,count:csvRows.length-1,syncedAt:new Date().toISOString()};
}
