// Google Calendar is read only. OAuth tokens remain in memory, never persisted or shipped.
let token='',expires=0;
let scriptPromise;
function googleLib(){
 if(window.google?.accounts?.oauth2)return Promise.resolve();
 if(scriptPromise)return scriptPromise;
 scriptPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
  script.onload=()=>window.google?.accounts?.oauth2?resolve():reject(Error('Google sign-in script failed'));
  script.onerror=()=>reject(Error('Could not load Google sign-in'));
  document.head.append(script);
 }).catch(e=>{scriptPromise=undefined;throw e});
 return scriptPromise;
}
export async function calendarAuthorize(clientId){
 if(!clientId?.trim())throw Error('Enter a Google OAuth Web Client ID under Settings first.');
 if(token && Date.now()<expires-60000)return token;
 await googleLib();
 return new Promise((resolve,reject)=>{
  const client=window.google.accounts.oauth2.initTokenClient({
   client_id:clientId.trim(),
   scope:'https://www.googleapis.com/auth/calendar.readonly',
   callback:result=>{
    if(!result.access_token){reject(Error(result.error_description||result.error||'Authorization cancelled'));return;}
    token=result.access_token;expires=Date.now()+1000*(result.expires_in||3600);resolve(token);
   },
   error_callback:err=>reject(Error(err.message||err.type||'Google authorization failed'))
  });
  client.requestAccessToken({prompt:''});
 });
}
async function request(endpoint,clientId){
 const auth=await calendarAuthorize(clientId);
 const res=await fetch('https://www.googleapis.com/calendar/v3/'+endpoint,{headers:{Authorization:'Bearer '+auth}});
 const value=await res.json().catch(()=>({}));
 if(!res.ok)throw Error(value.error?.message||`Google Calendar error ${res.status}`);
 return value;
}
export async function calendarList(clientId){
 const list=[];let page='';
 for(let i=0;i<5;i++){
  const params=new URLSearchParams({maxResults:'250',minAccessRole:'reader'});
  if(page)params.set('pageToken',page);
  const r=await request('users/me/calendarList?'+params,clientId);
  for(const c of r.items||[])list.push({id:c.id,name:c.summary||c.id,primary:!!c.primary});
  page=r.nextPageToken||'';if(!page)break;
 }
 return list;
}
export function simplifyGoogleEvent(e,calendarId=''){
 const date=e.start?.date||e.start?.dateTime?.slice(0,10)||'';
 if(!date)return null;
 return {id:'google:'+calendarId+':'+e.id,calendarId,googleId:e.id,title:e.summary||'(Untitled)',date,
   location:e.location||'',time:e.start?.dateTime||'',endTime:e.end?.dateTime||'',description:e.description||'',url:e.htmlLink||'',source:'Google Calendar'};
}
export async function calendarUpcoming(clientId,calendarId){
 if(!calendarId)throw Error('Choose a calendar.');
 const start=new Date();start.setDate(start.getDate()-1);
 const stop=new Date();stop.setDate(stop.getDate()+430);
 const rows=[];let page='';
 for(let i=0;i<8;i++){
  const params=new URLSearchParams({timeMin:start.toISOString(),timeMax:stop.toISOString(),singleEvents:'true',orderBy:'startTime',maxResults:'250',fields:'items(id,summary,location,start,end,description,htmlLink,status),nextPageToken'});
  if(page)params.set('pageToken',page);
  const data=await request('calendars/'+encodeURIComponent(calendarId)+'/events?'+params,clientId);
  for(const event of data.items||[])if(event.status!=='cancelled'){const row=simplifyGoogleEvent(event,calendarId);if(row)rows.push(row)}
  page=data.nextPageToken||'';if(!page)break;
 }
 return rows;
}
export function disconnectCalendar(){token='';expires=0}
export function calendarConnected(){return Boolean(token&&Date.now()<expires-60000)}
