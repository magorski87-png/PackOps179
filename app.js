import {TABLES,list as localList,get,put as localPut,remove as localRemove,readSetting,writeSetting as localWriteSetting,clearEverything,replaceAnnualBudget as localReplaceAnnualBudget,replaceAnnualLedger as localReplaceAnnualLedger} from './db.js';
import {LINKS,MENU,MEETING,DEN_NAMES,isoToday,makeId,money,esc,safeUrl,niceDate,summary,completion,csvParse,brief} from './data.js';
import {authorize,connected,disconnect,selectFolder,uploadReceipt,uploadEncryptedBackup} from './drive.js';
import {parseRoster,importPrivacySummary,denGroup,exportRoster,groupScouts,RANKS} from './roster-import.js';
import {calendarAuthorize,calendarList,calendarUpcoming,disconnectCalendar,calendarConnected} from './calendar-api.js';
import {parseIcs,uniqueUpcoming} from './calendar-import.js';
import {linkedWorkspaceId,matchExistingWorkspace,workspaceForCalendarEvent,workspaceForSync} from './event-sync.js';
import {financeView} from './finance-ui.js';
import {parseLedgerCsv,parseScoutCreditsCsv,financialSnapshot,reimbursePaidAllowed,csvExport,reportsRows,amount,EXPENSE_CATEGORIES,ledgerImportReview,suggestLedgerIncome} from './finance.js';
import {fetchScoutCreditSnapshot} from './finance-google.js';
import {TEMPLATE_ROWS,TEMPLATE_META} from './finance-template.js';
import {wizardSeedExpenses,validateWizardSettings,wizardPreview,wizardBudgetLines} from './budget-wizard.js';
import {currentScoutYear,duesForYear,scoutAccountYear,creditDifference,validScoutYear,googleSheetIdFromUrl,officialFileUrl} from './pack-config.js';
import {saveYearConfiguration,exportPackOpsBackup,restorePackOpsFromFile} from './settings-actions.js';
import {normalizeGoogleConfiguration} from './google-config.js';
import {EQUIPMENT_CATEGORIES,normalizeEquipment,queryEquipment,equipmentCsv} from './equipment-utils.js';
import {PACK_CLOUD_CONFIG} from './cloud-config.js';
import {cloudState,sharedTable,configureCloud,syncCloudIdentity,googleCloudLogin,googleCloudLogout,fetchCloudRows,saveCloudRow,deleteCloudRow,migrateLocalRecords,listMembers,listInvites,watchCloudChanges,addLeaderInvite,updateLeaderRole,listFamilyForms,createFamilyForm,getFamilyResponses,inviteFamily,publicFamilyRequest,fetchPackSettings,savePackSetting} from './cloud.js';
import {cloudSettingsPanel} from './cloud-panel.js';
import {familyManagerView,denWorkspaceView,familyPublicPanel} from './workspace-v06-ui.js';
import {familyResponseCsv} from './family-ui.js';
import {reconcileRoster} from './roster-sync.js';

const root=document.getElementById('root');
const PACK_CALENDAR_ID='d274340b6d3d99f84d54263204b8b3b6d76c6cddc609015905749069a5dc3740@group.calendar.google.com';
let pwaInstallPrompt=null;
const dbState=Object.fromEntries(TABLES.map(t=>[t,t==='settings'?[]:[]]));
const ui={page:'home',eventId:'',form:'',editTask:'',meetingMode:'quick',editMeeting:false,rosterFilter:'',rosterDen:'all',rosterRank:'all',rosterSort:'name',rosterReview:false,rosterSelected:new Set(),calendars:[],googleEvents:[],calendarFetchedAt:0,toastId:0,financeTab:'overview',financeForm:'',wizardStep:-1,wizardSource:'template',wizardConfig:null,wizardExpenses:[],reimbursementEventId:'',receiptEventId:'',receiptItemsId:'',accountQuery:'',accountDen:'all',accountSort:'name',equipmentQuery:'',equipmentCategory:'all',equipmentSort:'name-asc',equipmentExport:'filtered',editEquipment:'',cloudError:'',cloudMembers:[],cloudInvites:[],familyForms:[],familyActive:'',familyResults:null,familySearch:'',familyLink:'',familyData:null,familySent:false,denChoice:''};
const now=()=>Date.now();
const cloudActive=()=>Boolean(cloudState().member);
async function writeSetting(key,value){
 const isShared=key==='activeScoutYear'||key.startsWith('finance');
 if(cloudActive()&&isShared&&['admin','cubmaster','treasurer'].includes(cloudState().member.role))await savePackSetting(key,value);
 return localWriteSetting(key,value);
}
const cloudSettings=()=>({projectUrl:settings('supabaseUrl')||PACK_CLOUD_CONFIG.projectUrl,publishableKey:settings('supabasePublishableKey')||PACK_CLOUD_CONFIG.publishableKey,packId:settings('supabasePackId')||PACK_CLOUD_CONFIG.packId});
const cloudConfigured=()=>Boolean(cloudSettings().projectUrl);
async function put(table,row){
 if(table==='receipts'){
  await localPut(table,row);
  if(cloudActive()&&row.driveFileId){const {blob,...metadata}=row;await saveCloudRow(table,metadata)}
  return;
 }
 return cloudActive()&&sharedTable(table)?saveCloudRow(table,row):localPut(table,row);
}
async function remove(table,id){
 if(table==='receipts'){const row=dbState.receipts.find(r=>r.id===id);if(cloudActive()&&row?.driveFileId)await deleteCloudRow(table,id);return localRemove(table,id)}
 return cloudActive()&&sharedTable(table)?deleteCloudRow(table,id):localRemove(table,id)
}
const list=async table=>{
 if(table==='receipts'&&cloudActive()){
  const [remote,local]=await Promise.all([fetchCloudRows(table),localList(table)]);
  const merged=new Map(remote.map(r=>[r.id,r]));
  for(const row of local)if(row.blob||!merged.has(row.id))merged.set(row.id,row);
  return [...merged.values()];
 }
 return cloudActive()&&sharedTable(table)?fetchCloudRows(table):localList(table);
};
async function replaceAnnualBudget(payload){
 if(!cloudActive())return localReplaceAnnualBudget(payload);
 // Cloud writes are separately protected operations; never claim cross-record atomicity.
 for(const prior of payload.existing)await remove('budget',prior.id);
 for(const next of payload.draft)await put('budget',next);
 await put('financeAudit',payload.audit);
 for(const s of payload.settings)await writeSetting(s.key,s.value);
}
async function replaceAnnualLedger({previous=[],next=[],year,importedAt}){
 if(!cloudActive())return localReplaceAnnualLedger({previous,next,year,importedAt});
 for(const prior of previous)await remove('financeLedger',prior.id);
 for(const record of next)await put('financeLedger',record);
 await writeSetting('financeLedgerImportedAt:'+year,importedAt);
}
async function setupCloud(){
 const cfg=cloudSettings();if(!cfg.projectUrl)return;
 try{await configureCloud({projectUrl:cfg.projectUrl,publishableKey:cfg.publishableKey,pack:cfg.packId});ui.cloudError='';ensureRealtime();}
 catch(e){ui.cloudError=e.message;console.error('PackOps Cloud setup',e)}
}
function ensureRealtime(){
 if(!cloudActive())return;
 watchCloudChanges(()=>{
  const typing=root.querySelector('input:focus,textarea:focus,select:focus');
  if(document.hidden||typing){ui.cloudChanged=true;return}
  refresh().catch(e=>console.warn('Realtime refresh failed',e));
 });
}
async function loadCloudAdmin(){
 if(!['admin','cubmaster'].includes(cloudState().member?.role)){ui.cloudMembers=[];ui.cloudInvites=[];return}
 [ui.cloudMembers,ui.cloudInvites]=await Promise.all([listMembers(),listInvites()]);
}
async function loadFamilyForms(){
 if(!cloudActive()){ui.familyForms=[];return}
 ui.familyForms=await listFamilyForms();
}
async function openFamilyForm(id){
 ui.familyActive=id;ui.familyResults=id?await getFamilyResponses(id):null;ui.familyLink='';ui.familySearch='';render();
}
async function loadFamilyToken(token){
 if(!cloudState().configured){ui.cloudError='Family RSVP backend is not configured on this website.';render();return}
 try{ui.familyData=await publicFamilyRequest('get',token);ui.cloudError='';}catch(e){ui.familyData=null;ui.cloudError=e.message;}
 render();
}
const formData=(form,key)=>String(new FormData(form).get(key)||'').trim();
const option=(value,label,current)=>`<option value="${esc(value)}"${String(value)===String(current)?' selected':''}>${esc(label)}</option>`;
const btn=(label,action,klass='btn btn-ghost',extra='')=>`<button type="button" class="${klass}" data-action="${action}" ${extra}>${label}</button>`;
const link=(url,label,klass='btn btn-outline')=>`<a class="${klass}" href="${esc(safeUrl(url)||LINKS.packDrive)}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`;
const field=(label,name,type='text',value='',extra='')=>`<div class="field"><label for="${esc(name)}">${esc(label)}</label><input class="input" id="${esc(name)}" name="${esc(name)}" type="${type}" value="${esc(value)}" ${extra}></div>`;
const textarea=(label,name,value='',extra='')=>`<div class="field"><label for="${esc(name)}">${esc(label)}</label><textarea id="${esc(name)}" class="textarea" name="${esc(name)}" ${extra}>${esc(value)}</textarea></div>`;
const select=(label,name,values,current='',extra='')=>`<div class="field"><label for="${esc(name)}">${esc(label)}</label><select class="select" id="${esc(name)}" name="${esc(name)}" ${extra}>${values.map(x=>option(x[0],x[1],current)).join('')}</select></div>`;
const empty=(emoji,title,desc,button='')=>`<div class="empty"><div class="empty-icon">${emoji}</div><strong>${esc(title)}</strong><p>${esc(desc)}</p>${button}</div>`;
const short=(text,max=120)=>String(text||'').length>max?String(text).slice(0,max)+'…':String(text||'');
const findEvent=id=>dbState.events.find(e=>e.id===id);
const eventLabel=id=>findEvent(id)?.title||'General Pack operations';
const eventOptions=()=>[['','General Pack operations'],...dbState.events.map(e=>[e.id,e.title])];
const packLinkFolder=LINKS.packDrive;
const upcomingRecords=()=>{
 const liveIds=new Set(ui.googleEvents.map(e=>e.id));
 return uniqueUpcoming([...dbState.calendarEvents,...ui.googleEvents,...dbState.events.filter(e=>!e.googleEventId||!liveIds.has(e.googleEventId)).map(e=>({...e,source:'PackOps workspace'}))],isoToday());
};
async function fetchLinkedCalendar(calendarId){
 ui.googleEvents=await calendarUpcoming(settings('googleClientId'),calendarId);
 ui.calendarFetchedAt=now();
 // Only update EXISTING workspaces. Calendar retrieval never creates planning records or overwrites notes.
 for(const event of ui.googleEvents){
  const next=workspaceForSync(event,dbState.events,now());
  if(next){
   const before=matchExistingWorkspace(event,dbState.events);
   if(before && ['title','date','time','endTime','location','calendarUrl','description'].some(k=>(before[k]||'')!==(next[k]||'')))await put('events',next);
  }
 }
 await refresh();
 return ui.googleEvents.length;
}
const rosterRows=()=>{const q=ui.rosterFilter.trim().toLowerCase();return groupScouts(dbState.roster).filter(r=>(ui.rosterDen==='all'||(r.den||'Unassigned')===ui.rosterDen)&&(ui.rosterRank==='all'||r.rank===ui.rosterRank)&&(!ui.rosterReview||(r.issues||[]).length>0)&&[r.name,r.den,r.rank,r.guardian,r.email].some(v=>String(v||'').toLowerCase().includes(q))).sort((a,b)=>{const key=ui.rosterSort;return String(a[key]||'').localeCompare(String(b[key]||''),undefined,{numeric:true,sensitivity:'base'})||a.name.localeCompare(b.name)})};
const intro=(kicker,title,desc,right='')=>`<div class="page-head"><div><span class="eyebrow">${esc(kicker)}</span><h1>${esc(title)}</h1><p>${esc(desc)}</p></div>${right?`<div class="no-print">${right}</div>`:''}</div>`;
const note=(msg,warning=false)=>`<div class="note${warning?' warn':''}">${msg}</div>`;

async function refresh(){
 const result=await Promise.all(TABLES.map(t=>list(t)));
 TABLES.forEach((t,i)=>dbState[t]=result[i]);
 if(cloudActive()&&['admin','cubmaster','treasurer'].includes(cloudState().member.role)){
  const shared=await fetchPackSettings();
  const byKey=new Map(dbState.settings.map(s=>[s.key,s]));
  for(const entry of shared)byKey.set(entry.key,entry);
  dbState.settings=[...byKey.values()];
 }
 render();
}
function settings(key){return dbState.settings.find(s=>s.key===key)?.value||'';}
function activeYear(){return currentScoutYear(dbState.settings);}
function annualDues(){return duesForYear(dbState.settings,activeYear());}
async function saveSetting(key,value){await writeSetting(key,value);await refresh();}
function enteredGoogleConfiguration(){
 const form=root.querySelector('[data-form="google-settings"]');
 const enteredClient=form?.elements.namedItem('googleClientId')?.value;
 const enteredKey=form?.elements.namedItem('googleApiKey')?.value;
 return normalizeGoogleConfiguration(enteredClient??settings('googleClientId'),enteredKey??settings('googleApiKey'));
}
async function persistGoogleConfiguration(config){
 if(config.clientId!==settings('googleClientId'))await writeSetting('googleClientId',config.clientId);
 if(config.apiKey!==settings('googleApiKey'))await writeSetting('googleApiKey',config.apiKey);
}
function route(view='home',event=''){
 ui.page=view;ui.eventId=event;ui.form='';ui.editTask='';
 const hash='#'+view+(event?'/'+encodeURIComponent(event):'');
 if(location.hash!==hash)location.hash=hash;
 render();window.scrollTo({top:0,behavior:'instant'});
}
function restoreRoute(){
 const segments=location.hash.slice(1).split('/');
 ui.page=['home',...MENU.map(m=>m.id),'settings','family'].includes(segments[0])?segments[0]:'home';
 ui.eventId=segments[1]?decodeURIComponent(segments[1]):'';
 render();
 if(ui.page==='family'&&ui.eventId&&(!ui.familyData||ui.familyToken!==ui.eventId)){ui.familyToken=ui.eventId;loadFamilyToken(ui.eventId).catch(e=>notify(e.message,true));}
}
function notify(message,error=false){
 const prior=document.querySelector('.toast');if(prior)prior.remove();
 const node=document.createElement('div');node.className='toast'+(error?' error':'');node.textContent=message;
 document.body.append(node);const n=++ui.toastId;
 setTimeout(()=>{if(n===ui.toastId)node.remove()},4400);
}
function render(){
 const active=MENU.find(m=>m.id===ui.page);
 root.innerHTML=`<div class="app">
  <aside class="sidebar"><div class="brand"><div class="brand-mark">179</div><div><strong>PackOps</strong><small>Leadership hub</small></div></div>
  <nav class="nav-list" aria-label="Main navigation"><button class="nav-link${ui.page==='home'?' active':''}" data-nav="home"><span class="emoji">🏡</span> Dashboard</button><div class="nav-label">Your tools</div>
  ${MENU.map(m=>`<button class="nav-link${ui.page===m.id?' active':''}" data-nav="${m.id}"><span class="emoji">${m.emoji}</span>${esc(m.label)}</button>`).join('')}</nav>
  <div class="sidebar-footer"><small>Pack 179 · Built for the people making Scouting happen.<br>Records sync only after approved Google sign-in and backend setup.</small><button data-nav="settings">⚙ &nbsp; Settings & Drive</button></div></aside>
  <main class="main"><header class="topbar"><div class="topbar-title"><button class="mobile-menu" data-nav="home" aria-label="Dashboard">☷</button><span>✦</span><strong>${active?esc(active.label):ui.page==='settings'?'Settings & Drive':'Pack 179 Leadership'}</strong></div><div class="topbar-right"><span class="pwa-hint">${cloudActive()?('● Shared Pack workspace'+(ui.cloudChanged?' · Refresh recommended':'')):'● Local / setup mode'}</span>${!window.matchMedia('(display-mode: standalone)').matches?btn('⬇ Install','install-pwa','btn btn-ghost btn-small no-print'):''}${btn('⚙ Settings','goto-settings','btn btn-ghost btn-small no-print')}<div class="avatar">179</div></div></header>
  <div class="content">${view()}</div></main>
  <nav class="mobile-bottom no-print" aria-label="Mobile navigation">${[{id:'home',emoji:'🏡',name:'Home'},{id:'calendar',emoji:'🗓️',name:'Calendar'},{id:'budget',emoji:'📊',name:'Finance'},{id:'receipts',emoji:'🧾',name:'Receipts'},{id:'events',emoji:'✅',name:'Events'}].map(t=>`<button class="mobile-tab${ui.page===t.id?' active':''}" data-nav="${t.id}"><span class="emoji">${t.emoji}</span>${t.name}</button>`).join('')}</nav>
 </div>`;
}
function view(){
 if(ui.page==='family')return familyPublicPage();
 if(cloudConfigured()&&!cloudActive()&&ui.page!=='settings')return `${intro('Private Pack workspace','Google sign-in required','This Pack uses a secure shared backend. Sign in with an approved leader account before viewing rosters, financial records, or event workspaces.')}${btn('Open security settings','goto-settings','btn')}`;
 switch(ui.page){
 case 'families':return families();case 'den':return denWorkspace();case 'home':return home();case 'calendar':return calendar();case 'budget':return budget();case 'receipts':return receipts();case 'meeting':return meeting();case 'volunteers':return volunteers();case 'events':return events();case 'roster':return roster();case 'equipment':return equipment();case 'assistant':return assistant();case 'library':return library();case 'settings':return settingsPage();default:return home();}}
function home(){
 const s=summary(dbState.tasks);const next=upcomingRecords()[0];
 return `<section class="hero"><div class="hero-copy"><span class="eyebrow" style="color:#eed69e">WELCOME TO PACKOPS</span><h2>Less organizing. More Scouting.</h2><p>Your Pack calendar, event planning, meeting guides, records and tools—all in one place, without replacing Scoutbook Plus.</p><div class="hero-action">${btn('✨ Review priorities','goto-assistant','btn btn-gold')}</div></div><div class="hero-symbol">⚜️</div></section>
 <div class="stats"><div class="stat"><div><strong>${dbState.events.length}</strong><span>Planned events</span></div><div class="stat-icon">🗓️</div></div><div class="stat"><div><strong>${s.open.length}</strong><span>Open responsibilities</span></div><div class="stat-icon">📋</div></div><div class="stat"><div><strong>${s.unassigned.length}</strong><span>Need an owner</span></div><div class="stat-icon">🤝</div></div><div class="stat"><div><strong>${s.overdue.length}</strong><span>Overdue in PackOps</span></div><div class="stat-icon">⏳</div></div></div>
 <section class="panel next-up-section"><div class="row-between"><div><span class="kicker">AT A GLANCE</span><h2>Upcoming Pack events</h2></div>${btn('See calendar →','goto-calendar','btn btn-outline btn-small')}</div>
 ${upcomingRecords().length?upcomingRecords().slice(0,4).map(e=>`<div class="event-preview-row"><div class="event-date-tile"><strong>${esc(e.date.slice(8,10))}</strong><span>${esc(new Date(e.date+'T12:00:00').toLocaleDateString('en-US',{month:'short'}))}</span></div><div style="flex:1;min-width:0"><strong>${esc(e.title)}</strong><div class="meta">${esc(e.source||'')} · ${niceDate(e.date)}${e.location?' · '+esc(e.location):''}</div></div>${e.id?.startsWith('google:')?btn(matchExistingWorkspace(e,dbState.events)?'Workspace':'Plan','calendar-plan','btn btn-outline btn-small','data-id="'+esc(e.id)+'"'):''}${e.url?link(e.url,'View','btn btn-ghost btn-small'):''}</div>`).join(''):`<p>No upcoming events loaded yet. Connect a Google Calendar or import an .ics calendar snapshot under Pack Calendar.</p>`}
 </section>
 <div class="section-head"><h2>Everything you need</h2><small>Choose a tool to get started</small></div><div class="tool-grid">${MENU.map(m=>`<button class="tool-card" data-nav="${m.id}"><span class="tool-icon tone-${m.tone}">${m.emoji}</span><strong>${esc(m.label)}</strong><small>${esc(m.sub)}</small></button>`).join('')}</div>
 <div class="banner-note"><span style="font-size:18px">💡</span><div><strong>PackOps v0.5 local workspace</strong><br>Calendar and Pack Drive links open live Pack resources. Event plans, checklists, budgets and roster records are stored locally in this browser until shared synchronization is built. ${next?`Next locally planned event: <strong>${esc(next.title)}</strong> (${niceDate(next.date)}).`:'Add an event to start your own planning workspace.'}</div></div>`;
}
function calendar(){
 const current=settings('calendarId');const available=ui.calendars.length?ui.calendars:[...(current?[{id:current,name:settings('calendarName')||'Selected calendar'}]:[])];
 const all=upcomingRecords();
 return `${intro('See what is coming','Pack Calendar & Upcoming Events','Connect an existing Google Calendar or import an iCalendar snapshot. Scoutbook remains the official event system.')}
 <section class="panel"><div class="row-between"><h2>Upcoming events</h2><span class="pill">${all.length} future events</span></div>
 ${all.length?`<div class="events-list">${all.slice(0,30).map(e=>`<div class="event-preview-row"><div class="event-date-tile"><strong>${esc(e.date.slice(8,10))}</strong><span>${esc(new Date(e.date+'T12:00:00').toLocaleDateString('en-US',{month:'short'}))}</span></div><div style="flex:1;min-width:0"><strong>${esc(e.title)}</strong><div class="meta">${niceDate(e.date)}${e.time?' · '+esc(e.time.length===5?e.time:new Date(e.time).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})):''}${e.location?' · '+esc(e.location):''}</div><div class="meta">${esc(e.source||'Local')}</div></div>${e.id?.startsWith('google:')?btn(matchExistingWorkspace(e,dbState.events)?'Open workspace':'Plan this event','calendar-plan','btn btn-small','data-id="'+esc(e.id)+'"'):e.source==='PackOps workspace'?btn('Open workspace','open-event','btn btn-small','data-id="'+esc(e.id)+'"'):''}${e.url?link(e.url,'Google','btn btn-outline btn-small'):''}</div>`).join('')}</div>`:empty('🗓️','No upcoming events loaded','Connect a selected Google Calendar, import an .ics file, or create a local event workspace.')}
 </section>
 <div class="split" style="margin-top:20px"><section class="panel stack"><div><span class="kicker">Read-only calendar connection</span><h2>Google Calendar</h2><p>Read events from one calendar that you choose. This does not create or edit any Google or Scoutbook event.</p></div>
 ${btn('✓ Use Pack 179 Calendar (26–27)','calendar-use-pack','btn btn-outline btn-full')}
 ${btn(calendarConnected()?'↻ Refresh calendar list':'🔗 Connect Google Calendar','calendar-connect','btn btn-full')}
 ${available.length?`<div class="field"><label for="calendar-pick">Calendar to display</label><select id="calendar-pick" class="select" data-change="calendar-pick">${option('','Choose a calendar',current)}${available.map(c=>option(c.id,c.name,current)).join('')}</select></div>`:''}
 ${current?btn('↻ Refresh upcoming events','calendar-refresh','btn btn-outline btn-full'):''}
 ${ui.calendarFetchedAt?`<div class="meta">Last refreshed: ${new Date(ui.calendarFetchedAt).toLocaleString()} · Google events live in memory only.</div>`:''}
 ${!settings('googleClientId')?`<div class="privacy-strip">First enter your OAuth web client ID in Settings and enable Google Calendar API in your Google Cloud project.</div>${btn('Open settings','goto-settings','btn btn-ghost')}`:''}
 <div class="privacy-strip">Access is read-only; Google requires your explicit permission. Only this device sees the selected calendar's private event details.</div></section>
 <section class="panel stack"><span class="kicker">Alternatively</span><h2>Import an .ics snapshot</h2><p>Use a downloaded Scoutbook or other iCalendar (.ics) export. This creates a local snapshot, not a live subscription.</p>
 <form data-form="calendar-ics" class="stack"><div class="field"><label for="ics-file">Choose iCalendar file</label><input id="ics-file" type="file" name="file" accept=".ics,text/calendar" class="input" required></div><button class="btn" type="submit">Import upcoming dates</button></form>
 <div class="row-between"><span class="meta">${dbState.calendarEvents.length} events saved locally from iCalendar</span>${dbState.calendarEvents.length?btn('Clear .ics snapshot','clear-ics','btn btn-danger btn-small'):''}</div>
 <div class="divider"></div><h3>Existing Pack calendar PDF</h3>${link(LINKS.calendar,'Open current Pack calendar PDF','btn btn-outline btn-full')}
 ${link(LINKS.scoutbook,'Open Scoutbook Plus','btn btn-ghost btn-full')}
 <div class="privacy-strip">Best approach: enter official events in Scoutbook and subscribe to its .ics calendar in Google Calendar. Do not duplicate official events in two systems.</div></section></div>`;
}
function budget(){return financeView({state:dbState,ui,esc,money,settings,intro,note,btn,link,field,select,textarea,empty,upcoming:upcomingRecords,year:activeYear(),dues:annualDues(),shared:cloudActive()});}
function budgetForm(){return `<h3>Add planning entry</h3><form data-form="budget" class="stack"><div class="form-grid">${field('Category','category','text','','required maxlength="100"')}${field('Planned amount ($)','planned','number','0','min="0" step="0.01" required')}${field('Entered actual ($)','actual','number','0','min="0" step="0.01" required')}${field('Notes','note')}</div><div class="form-actions"><button class="btn" type="submit">Save entry</button>${btn('Cancel','cancel-form')}</div></form>`}
function receiptForm(){return `<section class="panel"><h2>Capture a receipt</h2><p>Save a photo or PDF into a local upload queue. Upload to the selected Pack Drive folder when Google access is connected.</p>
 <form data-form="receipt" class="stack"><div class="field"><label for="receiptFile">Receipt image or PDF · 15 MB max</label><input class="input" id="receiptFile" name="file" type="file" accept="image/*,application/pdf" required></div><div class="form-grid">${field('Vendor / store (optional)','vendor')}${field('Amount ($, optional)','amount','number','','min="0" step="0.01"')}${select('Related event','eventId',eventOptions(),ui.receiptEventId||'')}${field('Description (optional)','note')}</div><div class="form-actions"><button class="btn" type="submit">🧾 Save receipt to upload queue</button></div></form></section>`}
function receipts(){
 const records=[...dbState.receipts].sort((a,b)=>b.createdAt-a.createdAt);
 return `${intro('Snap • tag • save','Receipt Upload','Take a photo, connect it to an event, and send it to the Pack’s receipts folder.',link(LINKS.receipts2026,'Open 2026–27 receipts','btn btn-outline'))}
 <div class="split"><div class="stack">${receiptForm()}<section class="panel"><div class="row-between"><h2>Saved receipts</h2><span class="pill">${records.length} files</span></div>${records.length?records.map(r=>`<div class="receipt-row"><span class="receipt-emoji">🧾</span><div style="flex:1;min-width:0"><strong style="font-size:12px;overflow-wrap:anywhere">${esc(r.fileName)}</strong><div class="meta">${esc(r.vendor||'No vendor')} ${r.amount!==null?`· ${money(r.amount)}`:''} · ${new Date(r.createdAt).toLocaleDateString()}</div><div class="task-options">${r.state==='uploaded'?`<span class="pill success">Uploaded to Drive</span>${link(`https://drive.google.com/file/d/${encodeURIComponent(r.driveFileId)}/view`,'View file','btn btn-outline btn-small')}`:`<span class="pill ${r.state==='error'?'danger':'warning'}">${r.state==='error'?'Upload error':'Stored locally'}</span>${btn('Upload to Drive','upload-receipt','btn btn-small',`data-id="${r.id}"`)}`}${btn('View local','open-receipt','btn btn-ghost btn-small',`data-id="${r.id}"`)}${btn('Itemize','receipt-itemize','btn btn-outline btn-small',`data-id="${r.id}"`)}${btn('Delete','delete-receipt','btn btn-danger btn-small',`data-id="${r.id}"`)}</div>${r.error?`<div class="meta" style="color:#a13c31;margin-top:7px">${esc(r.error)}</div>`:''}
 ${ui.receiptItemsId===r.id?`<form data-form="receipt-item" data-id="${esc(r.id)}" class="finance-itemize stack"><strong>Receipt line items · Review manually</strong><p>Enter items as printed on the receipt. OCR extraction is not enabled in this version; these items do NOT create separate ledger expenses.</p><div class="form-grid">${field('Item description','itemName','text','','required maxlength="120"')}${field('Quantity','quantity','number','1','min="0.01" step="0.01" required')}${field('Unit price ($)','unitPrice','number','','min="0" step="0.01" required')}${select('Expense category','category',EXPENSE_CATEGORIES.map(c=>[c,c]))}</div><div class="form-actions"><button class="btn" type="submit">Add line item</button>${btn('Close','receipt-itemize-close','btn btn-outline btn-small')}</div>
 ${(r.items||[]).map((item,i)=>`<div class="row-between"><span>${esc(item.name)} · ${esc(item.quantity)} × ${money(item.unitPrice)} · ${esc(item.category)}</span>${btn('Remove','receipt-item-delete','btn btn-ghost btn-small',`data-id="${esc(r.id)}" data-index="${i}"`)}</div>`).join('')}
 <div class="finance-alert"><strong>Item total: ${money((r.items||[]).reduce((t,item)=>t+Number(item.quantity)*Number(item.unitPrice),0))}</strong><small>Receipt total: ${r.amount===null?'Unknown':money(r.amount)}. Compare before submitting a reimbursement. Discounts and tax can be recorded as additional line items.</small></div></form>`:''}
 </div></div>`).join(''):empty('📷','No receipts yet','Add your first photo above. Files remain on this device until you upload them.')}</section></div>
 <div class="stack"><section class="panel stack"><span class="kicker">Destination</span><h2>Pack Drive • Receipts</h2><p>We found the Pack's existing receipts folder with a 2026–27 subfolder.</p>${link(LINKS.receiptRoot,'Browse receipts folder','btn btn-ghost btn-full')}<div class="privacy-strip">${settings('googleFolder')?`Selected upload destination: <strong>${esc(settings('googleFolderName')||settings('googleFolder'))}</strong>`:'To upload directly, open Settings, enter your own Google Cloud OAuth configuration, sign in, and explicitly select the receipts destination using Google Picker.'}</div>${btn('⚙ Configure Drive upload','goto-settings','btn btn-outline btn-full')}</section><section class="panel"><h3>Upload behavior</h3><p>A local copy is preserved after upload. Nothing is uploaded just by adding it here. PackOps does not automatically enter receipts into the treasurer ledger.</p></section></div></div>`;
}
function meeting(){
 const quick=ui.meetingMode==='quick';const meetingItems=MEETING.map((s,i)=>{const text=settings('meeting:'+s.id)||(quick?s.cue:s.full);return `<details class="meeting-step" ${i===0?'open':''}><summary><span class="meeting-count">${String(i+1).padStart(2,'0')}</span><span>${esc(s.name)}</span></summary><div class="step-content">${esc(text)}</div></details>`}).join('');
 return `${intro('Run it with confidence','Pack Meeting Skeleton','Your permanent opening-to-closing meeting reference, ready to use on the phone or print.')}
 <section class="panel stack" style="max-width:930px"><div class="row-between no-print"><div class="meeting-toolbar"><div class="seg">${btn('Quick cues','meeting-quick',`btn btn-small ${quick?'':'btn-ghost'}`)}${btn('Full guidance','meeting-full',`btn btn-small ${quick?'btn-ghost':''}`)}</div></div><div class="meeting-toolbar">${btn('✎ Customize','meeting-edit','btn btn-outline btn-small')}${btn('🖨 Print','print','btn btn-outline btn-small')}</div></div>
 ${note('<strong>Always included:</strong> opening and closing flags, Pledge, Scout Oath, Scout Law, recognition, main activity, announcements, and a Cubmaster minute.')}
 <div class="meeting-list">${meetingItems}</div>
 ${link(LINKS.flagGuide,'Official Scouting America flag ceremony reference','btn btn-outline no-print')}
 ${ui.editMeeting?`<div class="divider no-print"></div><div class="no-print"><h3>Customize your meeting cues</h3><p>Overrides are stored only on this device. Leave a field empty to return to the standard wording for that mode.</p><form data-form="meeting" class="stack">${MEETING.map(s=>textarea(s.name,'section:'+s.id,settings('meeting:'+s.id))).join('')}<div class="form-actions"><button class="btn" type="submit">Save personal cues</button>${btn('Restore defaults','meeting-reset','btn btn-danger')}</div></form></div>`:''}
 <div class="privacy-strip no-print">Tip: When leading, switch to Quick cues. The full guidance version works well as a reference when preparing or delegating ceremonies.</div></section>`;
}
function taskForm(existing=null,eventOverride=''){
 const t=existing||{};return `<section class="panel"><div class="row-between"><h2>${existing?'Edit responsibility':'Add a responsibility'}</h2>${btn('✕ Close','cancel-form','btn btn-ghost btn-small')}</div><form class="stack" data-form="task" data-edit-id="${esc(t.id||'')}"><div class="form-grid">${field('Task or volunteer job','title','text',t.title||'','required maxlength="150"')}${select('Type','kind',[['task','Task / checklist item'],['volunteer','Volunteer position']],t.kind||'task')}${field('Owner / volunteer','owner','text',t.owner||'')}${field('Contact email (optional)','email','email',t.email||'')}${field('Due date','due','date',t.due||'')}${select('Priority','priority',[['normal','Normal'],['high','Important']],t.priority||'normal')}${select('Related event','eventId',eventOptions(),t.eventId||eventOverride)}${select('Status','status',[['open','Open'],['in-progress','In progress'],['done','Completed']],t.status||'open')}${textarea('Instructions / definition of done','details',t.details||'','rows="3"')}</div><div class="form-actions"><button class="btn" type="submit">${existing?'Save changes':'Create responsibility'}</button></div></form></section>`;
}
function taskRow(t){
 const mailTo=t.email&&/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t.email)?`mailto:${encodeURIComponent(t.email)}?subject=${encodeURIComponent('Pack 179 — '+t.title)}&body=${encodeURIComponent('Hi,\n\nCould you help with '+t.title+'?'+(t.due?'\nSuggested deadline: '+niceDate(t.due):'')+'\n\n'+(t.details||'')+'\n\nThanks!\nPack 179')}`:'';
 return `<div class="task-row"><button class="task-check${t.status==='done'?' done':''}" title="Toggle complete" data-action="toggle-task" data-id="${t.id}">${t.status==='done'?'✓':'○'}</button><div class="task-body"><div class="row-between"><span class="task-title" style="${t.status==='done'?'text-decoration:line-through;opacity:.58':''}">${esc(t.title)}</span><span class="pill ${t.status==='done'?'success':t.priority==='high'?'warning':''}">${t.status==='done'?'Done':t.priority==='high'?'Important':t.kind==='volunteer'?'Volunteer':'Task'}</span></div>${t.details?`<div class="task-details">${esc(t.details)}</div>`:''}<div class="meta" style="margin-top:6px">${esc(t.owner||'Unassigned')}${t.due?' · Due '+niceDate(t.due):''} · ${esc(eventLabel(t.eventId))}</div><div class="task-options"><select aria-label="Task status" data-change="task-status" data-id="${t.id}">${[['open','Open'],['in-progress','In progress'],['done','Done']].map(x=>option(x[0],x[1],t.status)).join('')}</select>${btn('Edit','edit-task','btn btn-ghost btn-small',`data-id="${t.id}"`)}${mailTo?`<a class="btn btn-outline btn-small" href="${esc(mailTo)}">Draft email ↗</a>`:''}${btn('Delete','delete-task','btn btn-danger btn-small',`data-id="${t.id}"`)}</div></div></div>`;
}
function volunteers(){
 const tasks=[...dbState.tasks].sort((a,b)=>(a.status==='done')-(b.status==='done')||(a.due||'9999').localeCompare(b.due||'9999'));
 const s=summary(tasks);
 return `${intro('People make it happen','Volunteer Dashboard','Create responsibilities, identify gaps, and prepare email requests—no app required for recipients.',btn('+ New task / role','show-task','btn'))}
 <div class="metric-grid" style="margin-bottom:18px"><div class="metric"><div class="number-big">${s.open.length}</div><span>Open</span></div><div class="metric"><div class="number-big">${s.unassigned.length}</div><span>Need an owner</span></div><div class="metric"><div class="number-big">${tasks.filter(t=>t.status==='done').length}</div><span>Completed</span></div></div>
 <div class="split"><div class="stack">${ui.form==='task'||ui.form==='edit-task'?taskForm(ui.editTask?tasks.find(t=>t.id===ui.editTask):null):''}<section class="panel"><div class="row-between"><h2>Responsibilities</h2><span class="pill">${tasks.length} total</span></div>${tasks.length?tasks.map(taskRow).join(''):empty('🤝','Nothing assigned yet','Create jobs, deadlines, and owner requests. Volunteers can still respond by normal email.',btn('+ Add first task','show-task','btn'))}</section></div><section class="panel stack"><h3>How this works</h3><p>Assign a job, add the leader’s email, and use “Draft email.” Your regular mail app opens a prefilled message for review. PackOps does not send anything automatically.</p>${note('Volunteer replies do not automatically change task status in this first version. Update the status here when someone confirms. For live RSVP/poll links, open Family RSVPs from the left navigation when Supabase is configured.')}<h3>Existing Pack records</h3><p>Your working Operations & Ownership Plan remains available as a reference while we develop synchronized shared task records.</p>${link(LINKS.operations,'Open ownership plan','btn btn-ghost btn-full')}</section></div>`;
}
function eventForm(){return `<section class="panel"><div class="row-between"><h2>Create a local event workspace</h2>${btn('✕ Close','cancel-form','btn btn-ghost btn-small')}</div><p>This does not create an official Scoutbook Plus calendar event.</p><form data-form="event" class="stack"><div class="form-grid">${field('Event title','title','text','','required maxlength="120"')}${field('Date','date','date')}${field('Location','location')}${field('Event lead','owner')}${textarea('Preparation notes','notes','','rows="3"')}${textarea('Related links (one URL per line)','links','','rows="3"')}</div><div class="form-actions"><button class="btn" type="submit">Create event workspace</button></div></form></section>`}
function eventDetail(e){
 const tasks=dbState.tasks.filter(t=>t.eventId===e.id);const rate=completion(tasks);
 const att=dbState.attachments.filter(a=>a.eventId===e.id);
 const allocations=dbState.budget.filter(x=>x.eventId===e.id&&(x.year||'2026-27')===activeYear());
 const planned=allocations.filter(x=>(x.type||'expense')==='expense').reduce((n,x)=>n+Number(x.planned||0),0);
 const tags=dbState.financeTags.filter(x=>x.eventId===e.id&&x.kind==='expense');
 const spent=tags.reduce((n,t)=>n+dbState.financeLedger.filter(x=>x.id===t.id).reduce((z,x)=>z+Number(x.debit||0)-Number(x.credit||0),0),0);
 const requestCount=dbState.financeReimbursements.filter(x=>x.eventId===e.id || (!x.eventId&&x.eventTitle===e.title)).length;
 const receiptCount=dbState.receipts.filter(x=>x.eventId===e.id).length;
 const equipmentNeeded=(e.equipmentIds||[]).map(id=>dbState.equipment.find(x=>x.id===id)).filter(Boolean);
 return `<div class="row-between no-print" style="margin-bottom:20px">${btn('← All events','back-events','btn btn-ghost')}${btn('Delete event','delete-event','btn btn-danger btn-small',`data-id="${e.id}"`)}</div>
 ${intro('Event workspace',e.title,`${niceDate(e.date)} · ${e.location||'Location not recorded'} · Lead: ${e.owner||'Unassigned'}`)}
 ${e.googleEventId?'<section class="panel stack" style="margin-bottom:18px"><div class="row-between"><strong>↻ Linked to Google Calendar</strong>'+(e.calendarUrl?link(e.calendarUrl,'View original event','btn btn-outline btn-small'):'')+'</div><p class="meta">The title, date and location follow Google Calendar on refresh. Notes, tasks, receipts and budgets stay in PackOps.</p>'+(e.description?'<p>'+esc(e.description)+'</p>':'')+'</section>':''}
 <div class="split"><div class="stack"><section class="panel"><div class="row-between"><h2>Preparation checklist</h2>${btn('+ Add checklist task','show-event-task','btn btn-small')}</div>${rate!==null?`<div class="preview-strip" style="margin:12px 0"><strong>${rate}% of recorded tasks complete</strong><span class="pill">${tasks.length} checklist items</span></div><div class="progress" style="margin-bottom:12px"><span style="width:${rate}%"></span></div>`:note('No tasks yet. Readiness is unknown until checklist tasks are entered.',true)}${tasks.length?tasks.map(taskRow).join(''):''}</section>${ui.form==='task'||ui.form==='edit-task'?taskForm(ui.editTask?dbState.tasks.find(t=>t.id===ui.editTask):null,e.id):''}
 <section class="panel"><h2>Event notes & links</h2><form data-form="event-notes" data-id="${e.id}" class="stack">${textarea('Planning notes','notes',e.notes,'rows="8"')}${textarea('Document or Scoutbook URLs, one per line','links',e.links||'','rows="4"')}<div class="form-actions"><button class="btn" type="submit">Save notes</button></div></form>${(e.links||'').split('\n').map(x=>x.trim()).filter(safeUrl).length?`<div class="divider"></div><h3>Linked resources</h3>${(e.links||'').split('\n').map(x=>x.trim()).filter(safeUrl).map(x=>`<p style="overflow-wrap:anywhere">${link(x,short(x,60),'btn btn-outline btn-small')}</p>`).join('')}`:''}</section></div>
 <div class="stack"><section class="panel stack"><div class="row-between"><h2>Event finances</h2>${btn('View budget','event-go-finance','btn btn-outline btn-small')}</div><div class="finance-metrics"><div class="finance-kpi"><small>Budget allocations</small><strong>${money(planned)}</strong></div><div class="finance-kpi"><small>Classified ledger spending</small><strong>${money(spent)}</strong></div><div class="finance-kpi"><small>Reimbursement requests</small><strong>${requestCount}</strong></div><div class="finance-kpi"><small>Linked receipts</small><strong>${receiptCount}</strong></div></div><p class="meta">Only tagged ledger transactions count as actual spending. Requests are not automatically expenses.</p>${btn('Submit event reimbursement','event-reimburse','btn btn-small')}${btn('Add event receipt','event-receipt','btn btn-outline btn-small')}
 <h3>Plan an expense for this event</h3><form data-form="event-budget" data-id="${esc(e.id)}" class="stack"><div class="form-grid">
 ${select('Budget category','category',EXPENSE_CATEGORIES.map(x=>[x,x]))}
 ${field('Item / purpose','detail','text','','required maxlength="120"')}
 ${field('Estimated cost ($)','planned','number','','min="0" step="0.01" required')}
 </div><button class="btn btn-outline" type="submit">Add event budget line</button></form>
 ${allocations.filter(x=>(x.type||'expense')==='expense').length?'<div class="finance-table-wrap"><table class="finance-table"><thead><tr><th>Planned item</th><th>Category</th><th>Amount</th></tr></thead><tbody>'+allocations.filter(x=>(x.type||'expense')==='expense').map(x=>'<tr><td>'+esc(x.detail||x.note||'Event item')+'</td><td>'+esc(x.category)+'</td><td>'+money(x.planned)+'</td></tr>').join('')+'</tbody></table></div>':''}
 </section><section class="panel stack"><div class="row-between"><h2>Equipment needed</h2>${btn('Family RSVPs / Polls','event-open-families','btn btn-outline btn-small')}</div>
 <p>Reference existing Pack inventory rather than maintaining a duplicate list. These links are shared with approved leaders once cloud sync is enabled.</p>
 ${equipmentNeeded.length?equipmentNeeded.map(item=>`<div class="row-between list-item"><div><strong>${esc(item.name)}</strong><div class="meta">${esc(item.category||'General Equipment')} · Qty ${esc(String(item.quantity??1))} · ${esc(item.location||'Location unknown')}</div></div>${btn('Remove','event-remove-equipment','btn btn-danger btn-small',`data-id="${esc(item.id)}"`)} </div>`).join(''):'<p class="meta">No inventory items linked to this event.</p>'}
 <form data-form="event-equipment" data-id="${esc(e.id)}" class="row wrap">${select('Add from inventory','equipmentId',dbState.equipment.map(item=>[item.id,item.name+' · '+(item.location||'Location unknown')]))}<button class="btn btn-small" type="submit" ${dbState.equipment.length?'':'disabled'}>Add equipment</button></form>
 </section><section class="panel"><h2>Event attachments</h2><p>Attach photos, PDFs, route maps or reference documents. These are stored locally in this first version.</p><form data-form="attachment" data-id="${e.id}"><div class="field"><input type="file" name="file" class="input" required aria-label="Event attachment" accept="image/*,application/pdf,.doc,.docx,.xlsx,.csv,.txt"></div><div class="form-actions"><button class="btn btn-small" type="submit">Attach file</button></div></form>${att.length?att.map(a=>`<div class="list-item"><div class="row-between"><strong style="font-size:12px;overflow-wrap:anywhere">📎 ${esc(a.fileName)}</strong><div class="row">${btn('Open','open-attachment','btn btn-ghost btn-small',`data-id="${a.id}"`)}${btn('×','delete-attachment','btn btn-danger btn-small',`data-id="${a.id}"`)}</div></div></div>`).join(''):`<p class="muted">No files attached yet.</p>`}</section>
 <section class="panel stack"><h3>Official event</h3><p>Set the official calendar entry and RSVP through Scoutbook Plus. Paste its link into your event notes when available.</p>${link(LINKS.scoutbook,'Open Scoutbook Plus','btn btn-outline btn-full')}${link(LINKS.packDrive,'Open Pack Drive','btn btn-ghost btn-full')}</section></div></div>`;
}
function events(){const chosen=ui.eventId&&findEvent(ui.eventId);if(chosen)return eventDetail(chosen);
 const rows=[...dbState.events].sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
 return `${intro('Everything behind the event','Event Status & Planning','Keep notes, readiness, responsibilities and attachments together—separate from official Scoutbook events.',btn('+ Create event workspace','show-event','btn'))}
 <div class="stack">${ui.form==='event'?eventForm():''}${rows.length?`<div class="cards">${rows.map(e=>{const ts=dbState.tasks.filter(t=>t.eventId===e.id);const rate=completion(ts);return `<article class="event-card"><div class="row-between"><span class="pill info">${niceDate(e.date)}</span><span class="pill">${rate===null?'Not assessed':rate+'% checklist'}</span></div><h3>${esc(e.title)}</h3><div class="small-info">📍 ${esc(e.location||'Location not recorded')}</div><div class="small-info">👤 ${esc(e.owner||'No lead assigned')} · ${ts.length} tasks</div><div class="progress"><span style="width:${rate||0}%"></span></div>${btn('Open event workspace →','open-event','btn btn-full',`data-id="${e.id}"`)}</article>`}).join('')}</div>`:empty('✅','No PackOps event workspaces','Create an internal preparation workspace for an event already scheduled in Scoutbook.',btn('+ Create first workspace','show-event','btn'))}${note('Calendar entries and RSVPs remain in Scoutbook Plus. PackOps event workspaces can be shared through approved Supabase access. They never create or modify official Scoutbook events.','warning')}</div>`;
}

// Membership records are device-local until deliberate secure cloud connection and approved migration.
function roster(){
 const rows=rosterRows(),scouts=groupScouts(dbState.roster),rawDens=[...new Set(scouts.map(r=>r.den||'Unassigned'))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
 const ranks=[...new Set(scouts.map(r=>r.rank||'Unspecified'))].sort();
 const selected=ui.rosterSelected.size,visibleSelected=rows.filter(r=>ui.rosterSelected.has(r.id)).length;
 return `${intro('Private leadership reference','Pack Roster','Filter by exact den or rank, sort Scout records, and export only the selected fields and Scouts.',link(LINKS.scoutbook,'Official Scoutbook roster'))}
 ${note('<strong>Private roster:</strong> Copies remain in this device’s browser storage. No server-side access control exists in v0.2. Do not use this on shared devices; never commit Scout CSVs or exported contact lists to GitHub.',true)}
 <section class="panel stack"><div class="row-between"><h2>Import & review</h2><span class="pill">${scouts.length} unique Scouts · ${dbState.roster.length} source rows</span></div><p>Supports the October 10 Scoutbook export: den labels such as “Webelos 2,” “Wolf 6” and “1” stay exactly as exported. Den/rank disagreements and ambiguous den numbers are flagged for review, not silently corrected.</p>
 <form data-form="roster" class="row wrap"><div class="field" style="flex:1;min-width:240px"><label for="roster-file">Scoutbook roster (.csv)</label><input class="input" type="file" id="roster-file" name="file" accept=".csv,text/csv,text/plain" required></div><button class="btn" type="submit">Preview CSV issues</button>${dbState.roster.length?btn('Clear local roster','clear-roster','btn btn-danger'):''}</form>
 ${ui.rosterPreview?`<div class="preview-strip"><strong>${ui.rosterPreview.records.length} Scout records found</strong><span class="pill warning">${ui.rosterPreview.warnings.length} flagged rows</span></div><p>${esc(importPrivacySummary(ui.rosterPreview))}</p><div class="review-list">${ui.rosterPreview.warnings.slice(0,20).map(w=>`<div class="list-item"><strong>CSV row ${w.row}</strong><div class="meta">${esc(w.issues.join('; '))}</div></div>`).join('')}</div>${btn('Import working copy — keep flagged rows','commit-roster','btn btn-full')}`:''}</section>
 <section class="panel stack" style="margin-top:20px"><div class="row-between"><h2>Scout directory</h2><span class="pill">${rows.length} matching · <span class="roster-selected-count">${selected}</span> selected</span></div>
 <div class="roster-filters"><div class="field"><label>Search</label><input class="input" type="search" name="roster-search" value="${esc(ui.rosterFilter)}" placeholder="Name, parent, den, email…"></div>
 <div class="field"><label>Den (as exported)</label><select class="select" data-change="roster-den">${option('all','All dens',ui.rosterDen)}${rawDens.map(d=>option(d,d+' ('+scouts.filter(r=>(r.den||'Unassigned')===d).length+')',ui.rosterDen)).join('')}</select></div>
 <div class="field"><label>Rank</label><select class="select" data-change="roster-rank">${option('all','All ranks',ui.rosterRank)}${ranks.map(r=>option(r,r,ui.rosterRank)).join('')}</select></div>
 <div class="field"><label>Sort by</label><select class="select" data-change="roster-sort">${[['name','Scout name'],['den','Den'],['rank','Rank'],['guardian','Guardian'],['issues','Review flags']].map(([v,t])=>option(v,t,ui.rosterSort)).join('')}</select></div></div>
 <label class="review-toggle"><input type="checkbox" data-change="roster-review" ${ui.rosterReview?'checked':''}> Show flagged records only</label>
 <div class="row wrap"><button type="button" data-action="roster-select-all" class="btn btn-outline btn-small">Select all ${rows.length} matching</button>${btn('Clear selection','roster-select-none','btn btn-ghost btn-small')}</div>
 ${rows.length?`<div class="roster-table-wrap"><table class="roster-table"><thead><tr><th scope="col">Select</th><th scope="col">Scout</th><th scope="col">Den</th><th scope="col">Rank</th><th scope="col">Guardian</th><th scope="col">Review</th></tr></thead><tbody>${rows.map(r=>`<tr><td><input type="checkbox" data-change="roster-select" data-id="${esc(r.id)}" aria-label="Select ${esc(r.name)}" ${ui.rosterSelected.has(r.id)?'checked':''}></td><td><strong>${esc(r.name)}</strong></td><td>${esc(r.den||'Unassigned')}</td><td>${esc(r.rank||'—')}</td><td>${esc(r.guardianContacts?.map(g=>g.name).filter(Boolean).join('; ')||r.guardian||'—')}<div class="meta">${esc(r.guardianContacts?.map(g=>g.email||g.phone).filter(Boolean).join('; ')||r.email||r.phone||'Contact not listed')}</div></td><td>${(r.issues||[]).length?`<span class="pill warning" title="${esc(r.issues.join('; '))}">${r.issues.length} flag(s)</span>`:'<span class="pill success">OK</span>'}</td></tr>`).join('')}</tbody></table></div>`:empty('📒','No matching Scouts','Import your authorized CSV, or adjust the search and den/rank filters.')}
 <div class="privacy-strip">Selection persists when you switch filters. ${visibleSelected} selected Scouts match the current view. Unknown den labels are not automatically reassigned to any rank.</div></section>
 <section class="panel stack" style="margin-top:20px"><div class="row-between"><h2>Export selected Scouts</h2><span class="pill"><span class="roster-selected-count">${selected}</span> selected</span></div><p>Export a CSV file for your own authorized Pack work. Choose the minimum necessary information. No export is sent to Google Drive or the public repository.</p>
 <div class="field"><label for="roster-export-fields">Fields to include</label><select id="roster-export-fields" class="select"><option value="names">Scout names + den + rank (no contacts)</option><option value="contacts">Scout name + den + guardian + email + phone</option><option value="review">Scout name + den + rank + review warnings</option></select></div>
 ${btn('Export '+selected+' selected Scouts (.csv)','roster-export','btn',selected?'':'disabled')}
 ${!selected?'<span class="meta">Select Scouts above before exporting.</span>':''}</section>`;
}
function equipment(){
 const categorySet=[...new Set([...EQUIPMENT_CATEGORIES,...dbState.equipment.map(r=>normalizeEquipment(r).category)])].sort((a,b)=>a.localeCompare(b));
 const rows=queryEquipment(dbState.equipment,{search:ui.equipmentQuery,category:ui.equipmentCategory,sort:ui.equipmentSort});
 const editing=dbState.equipment.find(r=>r.id===ui.editEquipment);
 const itemForm=(editing||ui.form==='equipment')?`<section class="panel stack"><h2>${editing?'Edit equipment':'Add equipment'}</h2>
 <form data-form="equipment" data-edit-id="${esc(editing?.id||'')}" class="stack"><div class="form-grid">
 ${field('Item / kit name','name','text',editing?.name||'','required maxlength="120"')}
 <div class="field"><label for="equipment-category-name">Category</label><input id="equipment-category-name" class="input" type="text" name="category" list="equipment-categories" value="${esc(editing?.category||'General Equipment')}" required maxlength="100"><datalist id="equipment-categories">${categorySet.map(x=>`<option value="${esc(x)}"></option>`).join('')}</datalist></div>
 ${field('Quantity','quantity','number',String(editing?.quantity??1),'min="0" max="999999" step="1" required')}
 ${field('Storage location','location','text',editing?.location||'')}
 ${field('Checked out to / held by','holder','text',editing?.holder||'')}
 ${select('Condition','condition',[['ready','Ready'],['verify','Needs verification'],['repair','Repair required']],editing?.condition||'ready')}
 ${field('Last physically verified','verifiedAt','date',editing?.verifiedAt||'')}
 </div>${textarea('Kit contents / notes','notes',editing?.notes||'')}
 <div class="form-actions"><button type="submit" class="btn">${editing?'Save changes':'Add to inventory'}</button>${btn('Cancel','equipment-cancel','btn btn-outline')}</div></form></section>`:'';
 return `${intro('Know what the Pack owns','Equipment & Supplies','Search by item, category, storage location, holder or contents. Export what you see, or your full list.',btn('+ Add equipment','show-equipment','btn'))}
 ${itemForm}
 <section class="panel stack"><div class="row-between"><h2>Equipment inventory</h2><span class="pill">${rows.length} of ${dbState.equipment.length} matching</span></div>
 <div class="equipment-controls">
 <div class="field"><label for="equipment-search">Find equipment</label><input id="equipment-search" class="input" name="equipment-search" type="search" autocomplete="off" placeholder="Try rocket, flags, storage, or a leader…" value="${esc(ui.equipmentQuery)}"></div>
 ${select('Category','equipment-filter', [['all','All categories'],...categorySet.map(x=>[x,x])],ui.equipmentCategory,'data-change="equipment-filter"')}
 ${select('Sort by','equipment-sort',[['name-asc','Name A–Z'],['name-desc','Name Z–A'],['category','Category'],['location','Location'],['condition','Condition'],['verified','Last verified']],ui.equipmentSort,'data-change="equipment-sort"')}
 </div>
 <div class="row wrap">${btn('Export matching ('+rows.length+') CSV','equipment-export','btn btn-outline', 'data-scope="filtered"')}${btn('Export entire inventory CSV','equipment-export','btn btn-outline','data-scope="all"')}${ui.equipmentQuery?btn('Clear search','equipment-clear-search','btn btn-ghost'):''}</div>
 <p class="meta">Search updates as you type, ranking word beginnings before other matches. CSV opens in Excel or Google Sheets. Inventory records remain editable and are not modified by export.</p></section>
 ${rows.length?`<div class="cards">${rows.map(r=>`<article class="event-card"><div class="row-between"><h3>${esc(r.name)}</h3><span class="pill ${r.condition==='repair'?'danger':r.condition==='ready'?'success':'warning'}">${r.condition==='repair'?'Repair':r.condition==='ready'?'Ready':'Verify'}</span></div><div class="row-between"><span class="pill info">${esc(r.category)}</span><strong>Qty ${r.quantity}</strong></div><div class="small-info">📍 ${esc(r.location||'Location not specified')}</div><div class="small-info">${r.holder?'👤 With '+esc(r.holder):'No current holder specified'}</div>${r.verifiedAt?`<div class="meta">Last verified ${esc(r.verifiedAt)}</div>`:''}${r.notes?`<p>${esc(r.notes)}</p>`:''}<div class="row wrap">${btn('Edit','equipment-edit','btn btn-outline btn-small',`data-id="${esc(r.id)}"`)}${btn('Change status','equipment-status','btn btn-outline btn-small',`data-id="${esc(r.id)}"`)}${btn('Remove','delete-equipment','btn btn-danger btn-small',`data-id="${esc(r.id)}"`)}</div></article>`).join('')}</div>`:dbState.equipment.length?empty('🔍','No matches','Change your search or category to find equipment.'):empty('🎒','Inventory starts here','Add the rocket kit, Pack flags, tents and camp equipment.',btn('+ Add first item','show-equipment','btn'))}`;
}
function families(){
 const state=cloudState();
 const denChoices=state.member?.role==='den_leader'?(state.member.den_scopes||[]):DEN_NAMES;
 return familyManagerView({forms:ui.familyForms,responses:ui.familyResults,activeId:ui.familyActive,
 lastLink:ui.familyLink,query:ui.familySearch,events:dbState.events,denChoices,cloudReady:cloudActive(),
 esc,btn,field,select,intro,note,money});
}
function familyPublicPage(){
 if(ui.familySent)return `${intro('Response received','Thank you!','Your RSVP or poll answer was saved securely.')}${note('You can reuse the private invitation link to update your response later.')}`;
 if(ui.cloudError)return `${intro('Pack 179','Invitation unavailable','Please use the original private invitation link, or contact your den leader.')}${note(esc(ui.cloudError),true)}`;
 return familyPublicPanel(ui.familyData,{field,select,esc});
}
function denWorkspace(){
 const role=cloudState().member;
 const allowed=role?.role==='den_leader'?(role.den_scopes||[]):DEN_NAMES;
 const selected=allowed.includes(ui.denChoice)?ui.denChoice:allowed[0]||'';
 ui.denChoice=selected;
 return denWorkspaceView({state:dbState,den:selected,allowed,esc,btn,field,select,textarea,intro,note});
}
function assistant(){
 const s=summary(dbState.tasks);const issue=[...s.overdue,...s.unassigned.filter(x=>!s.overdue.includes(x)),...s.dueSoon.filter(x=>!s.overdue.includes(x)&&!s.unassigned.includes(x))].slice(0,12);
 return `${intro('A clearer next move','Cubmaster Assistant','Priorities based on the actual tasks you entered in PackOps—not imagined Scoutbook information.',btn('Copy working brief','copy-brief','btn'))}
 <div class="stats"><div class="stat"><div><strong>${s.overdue.length}</strong><span>Overdue</span></div></div><div class="stat"><div><strong>${s.unassigned.length}</strong><span>Need owners</span></div></div><div class="stat"><div><strong>${s.dueSoon.length}</strong><span>Due within seven days</span></div></div></div>
 <div class="split"><section class="panel"><div class="row-between"><h2>What needs attention?</h2><span class="pill">${issue.length} priorities</span></div>${issue.length?issue.map(t=>`<div class="list-item"><div class="row-between"><strong>${esc(t.title)}</strong><span class="pill ${s.overdue.includes(t)?'danger':'warning'}">${s.overdue.includes(t)?'Overdue':!t.owner?'Unassigned':'Coming due'}</span></div><div class="meta">${esc(t.owner||'No owner')} · ${t.due?niceDate(t.due):'No due date'} · ${esc(eventLabel(t.eventId))}</div></div>`).join(''):empty('✨','Nothing urgent recorded','Add tasks and deadlines, and this briefing will start surfacing priorities.')}</section>
 <section class="panel stack"><h2>Working briefing</h2><p>Generated from locally recorded assignments plus events currently loaded in the calendar section. Scoutbook and the shared Google Sheets are not scanned automatically.</p><pre class="code-example" style="max-height:420px;overflow:auto">${esc(brief(dbState.tasks,upcomingRecords()))}</pre>${btn('Copy briefing text','copy-brief','btn btn-full')}${link(LINKS.operations,'Check official ownership plan','btn btn-outline btn-full')}</section></div>`;
}
function library(){
 const fixed=[['🗓️','Current Pack calendar',LINKS.calendar,'Updated master calendar PDF'],['📁','Leadership Drive',LINKS.packDrive,'Pack documents and folders'],['📊','Treasurer ledger',LINKS.ledger,'Official financial records'],['🧾','Receipts (2026–27)',LINKS.receipts2026,'Current financial uploads'],['📋','Operations & Ownership Plan',LINKS.operations,'Pack work and accountability'],['🏕️','Event Tracker',LINKS.eventTracker,'Existing planning tracker'],['⚜️','Scoutbook Plus',LINKS.scoutbook,'Official Pack management'],['🚩','Flag Ceremony Reference',LINKS.flagGuide,'Scouting America resource']];
 const all=[...fixed.map(x=>({label:x[1],url:x[2],description:x[3],emoji:x[0],fixed:true})),...dbState.bookmarks.map(x=>({...x,emoji:'🔖'}))];
 return `${intro('Find it without hunting','Pack Library','Your Pack Drive and common resources, grouped behind one useful shortcut.',btn('+ Add shortcut','show-bookmark','btn'))}
 ${ui.form==='bookmark'?`<section class="panel"><h2>Add a personal resource shortcut</h2><form data-form="bookmark" class="stack"><div class="form-grid">${field('Name','label','text','','required')}${field('Web address','url','url','','required')}${field('Description','description')}</div><button class="btn" type="submit">Save shortcut</button></form></section>`:''}
 <div class="library-grid">${all.map(item=>`<div class="link-tile"><span class="link-icon">${item.emoji}</span><div style="flex:1;min-width:0"><strong>${esc(item.label)}</strong><small>${esc(item.description||'')}</small><div class="task-options">${link(item.url,'Open','btn btn-small')}${item.fixed?'':btn('Remove','delete-bookmark','btn btn-ghost btn-small',`data-id="${item.id}"`)}</div></div></div>`).join('')}</div>`;
}
function settingsPage(){
 const panel=cloudSettingsPanel({state:cloudState(),configured:cloudSettings(),setupError:ui.cloudError,members:ui.cloudMembers,invites:ui.cloudInvites,esc,btn,field,select,note});
 if(cloudConfigured()&&!cloudActive())return `${intro('Private Pack data','Security & Google login','Sign in with an approved Pack Google account to access PackOps.')}${panel}`;
 return `${panel}${intro('Your device and Drive','Settings','Local privacy controls and optional, user-authorized Google Drive receipt uploads.')}
 <div class="split"><section class="panel stack"><h2>Connect Google services</h2><p>For receipt uploads, enable Drive API and Picker API. For upcoming events, enable Google Calendar API and grant calendar.readonly access. Use a Google OAuth Web Client ID authorized for your PackOps website. Tokens stay in memory; never enter client secrets.</p><p>Calendar connection status: <strong>${calendarConnected()?'Authorized for this session':'Not connected'}</strong>. Open Pack Calendar to select a calendar.</p>
 <form data-form="google-settings" class="stack">${field('Google OAuth web client ID','googleClientId','text',settings('googleClientId'),'placeholder="12345-abcdef.apps.googleusercontent.com" autocomplete="off"')}${field('Google Picker API key','googleApiKey','text',settings('googleApiKey'),'placeholder="AIza..." autocomplete="off"')}<button class="btn" type="submit">Save configuration on this device</button></form>
 <p class="meta">OAuth Client ID: <strong>${settings('googleClientId')?'Saved on this device':'NOT SAVED'}</strong> · Picker API key: <strong>${settings('googleApiKey')?'Saved on this device':'Not saved'}</strong></p>
 <p class="meta">You can also enter the Client ID above and click Sign in to Google directly; PackOps will save it after successful authorization. Copy the Web Client ID, never the client secret.</p>
 <p>Status: <strong>${connected()?'Authorized for this session':'Not connected'}</strong></p>${btn('Sign in to Google','google-sign-in','btn btn-full')}${btn('Choose 2026–27 receipts destination','google-pick-folder','btn btn-outline btn-full')}${settings('googleFolder')?`<p class="setting-kv">Chosen destination: ${esc(settings('googleFolderName'))} (${esc(settings('googleFolder'))})</p>`:''}${btn('Disconnect','google-disconnect','btn btn-ghost btn-full')}
 <div class="privacy-strip">You must explicitly authorize the app and select the proper destination folder. The Drive API only uploads receipts when you click Upload. There is no background access to roster files or finances.</div></section>
 <section class="panel stack"><h2>Data & privacy</h2><p>This version saves event plans, roster copies, budgets, Scout credit snapshots, reimbursement proposals, volunteer tasks, and receipts in this browser's IndexedDB. Clearing browser storage removes local data. Different devices do not yet synchronize these records.</p><p>Never import private youth records onto shared or public devices. This version has no server-based role permissions.</p>${btn('Clear all local working data','clear-local','btn btn-danger btn-full')}${link(LINKS.packDrive,'Open authorized Pack Drive','btn btn-outline btn-full')}</section></div>
 <section class="panel stack" style="margin-top:20px"><h2>Scout year & Pack dues</h2>
 <p>Configure annual dues separately for every Scout year. Updating dues changes local forecasts and discrepancy checks, but NEVER rewrites Courtney's official Google Sheets formulas or financial records.</p>
 <form data-form="pack-year-config" class="form-grid">
 ${field('Scout year (e.g. 2026-27)','year','text',activeYear(),'pattern="20[0-9]{2}-[0-9]{2}" required')}
 ${field('Annual Pack dues per Scout ($)','dues','number',annualDues()===null?'':String(annualDues()),'step="0.01" min="0" max="10000" required')}
 <div class="field"><label> </label><button class="btn" type="submit">Save Scout-year settings</button></div></form>
 <p class="meta">Current planning year: ${esc(activeYear())} · Official credit records are unchanged.</p></section>
 <section class="panel stack" style="margin-top:20px"><h2>Authoritative Google Drive sources</h2>
 <p>Configure original financial documents separately for each Scout year. These are private Drive links and read-only sources, not files stored in the public PackOps repository.</p>
 <form data-form="drive-year-sources" class="stack">
 ${field('Official Scout credit Google Sheet','creditUrl','url',settings('financeCreditsUrl:'+activeYear())||(activeYear()==='2026-27'?LINKS.scoutCredits:''))}
 ${field('Treasurer ledger workbook','ledgerUrl','url',settings('financeLedgerUrl:'+activeYear())||(activeYear()==='2026-27'?LINKS.ledger:''))}
 ${field('Approved budget / planning document (optional)','budgetUrl','url',settings('financeBudgetUrl:'+activeYear()))}
 ${field('Restricted receipt folder (optional)','receiptsUrl','url',settings('financeReceiptsUrl:'+activeYear())||(activeYear()==='2026-27'?LINKS.receipts2026:''))}
 <button class="btn" type="submit">Save Drive sources for ${esc(activeYear())}</button></form>
 <p class="meta">Authorized native Scout credit Sheets can refresh read-only. For Excel treasurer ledgers, use the CSV import until workbook synchronization is implemented.</p></section>
  <section class="panel stack" style="margin-top:20px"><h2>Encrypted Backup & Rebuild</h2>
 <p>Rebuild PackOps on a new phone or computer by importing one encrypted backup containing all local events, tasks, budgets, Scout account snapshots, reimbursements, categories, and receipts. Google authorization must be reconnected on the new device.</p>
 <div class="privacy-strip">Backups contain sensitive Scout and financial records. Admins can export their authorized cloud snapshot in shared mode; restoration is LOCAL only and does not replace Supabase records. Use a 12+ character passphrase and restricted Drive folder. If the passphrase is lost, the backup cannot be recovered.</div>
 <form data-form="backup-export" class="stack">
 ${field('Backup passphrase','passphrase','password','','minlength="12" autocomplete="new-password" required')}
 ${select('Save backup to','destination',[['download','Download encrypted backup'],['drive','Upload encrypted backup to Drive']],'download')}
 <button class="btn" type="submit">Create encrypted backup</button></form>
 ${btn('Choose restricted Drive backup folder','google-pick-backup-folder','btn btn-outline')}
 ${settings('googleBackupFolder')?'<p class="meta">Backup folder: '+esc(settings('googleBackupFolderName')||settings('googleBackupFolder'))+'</p>':''}
 <div class="divider"></div><h3>Restore PackOps from a backup</h3>
 <p>Download the encrypted file from Drive if needed, then select it here. Restoring replaces ALL local PackOps data on this device after confirmation, and does not modify the original Google files.</p>
 <form data-form="backup-restore" class="stack"><input class="input" type="file" name="backupFile" accept=".json,application/json" required>
 ${field('Backup passphrase','passphrase','password','','autocomplete="current-password" required')}
 <button class="btn btn-outline" type="submit">Review and restore</button></form></section>`;
}

function askDelete(message){return window.confirm(message)}
async function handleAction(action,trigger){
 const id=trigger.dataset.id;
 switch(action){
  case 'cloud-sign-in':await googleCloudLogin();return;
  case 'cloud-sign-out':await googleCloudLogout();ui.cloudMembers=[];ui.cloudInvites=[];await refresh();route('settings');return;
  case 'cloud-refresh':await syncCloudIdentity();ensureRealtime();await loadCloudAdmin();await loadFamilyForms();await refresh();notify('Shared data refreshed from Supabase');return;
  case 'cloud-migrate':{
   if(!cloudActive())throw Error('Sign in as Pack administrator first');
   const tables=Object.fromEntries(await Promise.all(TABLES.filter(sharedTable).map(async name=>[name,await localList(name)])));
   const count=Object.values(tables).reduce((n,rows)=>n+rows.length,0);
   if(!count){notify('There are no earlier device records to migrate.');return;}
   if(!askDelete('Copy '+count+' existing local entries into the Pack shared database? This includes sensitive youth roster and finance records. Use only a trusted computer; confirm you are authorized by Pack 179. Existing cloud IDs will not be overwritten.'))return;
   const totals=await migrateLocalRecords(tables);
   await refresh();notify('Shared import reviewed: '+Object.values(totals).reduce((a,b)=>a+b,0)+' attempted local entries. Originals remain on this device.');return;
  }
  case 'cloud-update-role':{
   const role=root.querySelector('#member-role-'+CSS.escape(id))?.value;
   const dens=(root.querySelector('#member-den-'+CSS.escape(id))?.value||'').split(',').map(x=>x.trim()).filter(Boolean);
   const status=root.querySelector('#member-status-'+CSS.escape(id))?.value;
   if(!askDelete('Update this leader’s Pack access to '+role+' ('+status+')?'))return;
   await updateLeaderRole(id,role,dens,status);await loadCloudAdmin();render();notify('Leader permissions updated');return;
  }
  case 'family-open-form':await openFamilyForm(id);return;
  case 'family-copy-link':await navigator.clipboard.writeText(ui.familyLink);notify('Private invitation link copied. Share only with the intended household.');return;
  case 'family-export':if(!ui.familyResults)throw Error('Open a form first');downloadCsv(familyResponseCsv(ui.familyResults),'Pack179_FamilyResponses_'+isoToday()+'.csv');notify('Response CSV exported');return;
  case 'receipt-itemize':ui.receiptItemsId=id;render();return;
  case 'receipt-itemize-close':ui.receiptItemsId='';render();return;
  case 'receipt-item-delete':{
   const receipt=dbState.receipts.find(r=>r.id===id),i=Number(trigger.dataset.index);
   if(receipt?.items?.[i]&&askDelete('Remove this locally itemized receipt line?')){await put('receipts',{...receipt,items:receipt.items.filter((_,j)=>i!==j)});await refresh()}return;
  }
  case 'finance-tab':ui.financeTab=id;ui.financeForm='';ui.wizardStep=-1;render();return;
  case 'finance-suggest-income':{
   const year=activeYear(),existingIds=new Set(dbState.financeTags.map(t=>t.id));
   const suggestions=dbState.financeLedger.filter(r=>scoutAccountYear(r)===year&&!existingIds.has(r.id))
    .map(r=>({row:r,category:suggestLedgerIncome(r)})).filter(x=>x.category);
   if(!suggestions.length){notify('No obvious deposits found for dues or donations. Review other deposits manually.');return;}
   const summary=suggestions.slice(0,20).map(s=>(s.row.date||'')+' '+s.row.description+' '+money(s.row.credit)+' → '+s.category).join('\n');
   if(!askDelete('REVIEW '+suggestions.length+' suggested income classifications.\n\n'+summary+(suggestions.length>20?'\n... plus '+(suggestions.length-20)+' more. Review manually if uncertain.':'')+'\n\nConfirm these are Pack income and NOT transfers, Scout credits, refunds or reimbursements? This only creates local category tags.'))return;
   for(const s of suggestions)await put('financeTags',{id:s.row.id,kind:'income',category:s.category,eventId:'',reviewedAt:now(),source:'user-reviewed-suggestion'});
   await refresh();notify(suggestions.length+' locally reviewed deposits classified as income');return;
  }
  case 'finance-wizard-start':ui.financeTab='builder';ui.wizardStep=0;ui.wizardSource='template';ui.wizardConfig=null;ui.wizardExpenses=[];render();return;
  case 'finance-wizard-close':ui.wizardStep=-1;render();return;
  case 'finance-wizard-back':ui.wizardStep=Math.max(0,(ui.wizardStep??0)-1);render();return;
  case 'finance-wizard-save':{
   if(ui.wizardStep!==3)throw Error('Complete the budget wizard before saving');
   const config=ui.wizardConfig,expenses=ui.wizardExpenses||[];
   const preview=wizardPreview(config,expenses);
   if(config.year!==activeYear())throw Error('Select the same Scout year in Settings before saving');
   const previous=dbState.budget.filter(b=>(b.year||'2026-27')===activeYear());
   if(!askDelete('Save '+activeYear()+' DRAFT budget with '+expenses.length+' expense lines, '+money(preview.totalExpense)+' expenses and '+money(preview.income)+' projected income? '+previous.length+' existing current-year lines will be archived locally and replaced. No treasurer ledger records are changed.'))return;
   const stamp=now();
   const draft=wizardBudgetLines(config,expenses).map(line=>({...line,id:makeId(),createdAt:stamp}));
   const audit={id:makeId(),type:'budget-revision',year:activeYear(),createdAt:stamp,source:'Budget Wizard',previous:previous.map(x=>({...x})),next:draft.map(x=>({...x})),summary:{expenses:preview.totalExpense,income:preview.income,dues:preview.dues}};
   const year=activeYear(),settingsUpdates=[
    {key:'financeDues:'+year,value:String(preview.dues)},
    {key:'financeFundraisingTarget:'+year,value:'0'},
    {key:'financeDonationEstimate:'+year,value:String(preview.donations)},
    {key:'financeFundraisingScouts:'+year,value:String(preview.scouts)},
    {key:'financeBudgetDraftUpdated:'+year,value:new Date(stamp).toISOString()}
   ];
   await replaceAnnualBudget({existing:previous,draft,audit,settings:settingsUpdates});
   for(const account of dbState.financeAccounts.filter(x=>scoutAccountYear(x)===year)){
    const diff=creditDifference(account,preview.dues);
    await put('financeAccounts',{...account,calculated:Math.round((Number(account.carryover||0)+Number(account.earnings||0)-preview.dues)*100)/100,needsReview:diff!==null&&Math.abs(diff)>0.011});
   }
   ui.wizardStep=-1;await refresh();notify('Annual draft budget saved with revision history; ledger remains unchanged');return;
  }
  case 'finance-seed-template':{
   if(activeYear()!==TEMPLATE_META.year)throw Error('The supplied 2026–27 draft template can only be added to the 2026–27 Scout year.');
   if(dbState.budget.some(b=>(b.year||'2026-27')===activeYear())){notify('Your planning budget is not empty. The template was not loaded, to protect your current work.',true);return;}
   if(!askDelete('Create 24 DRAFT budget lines from your uploaded 2026–27 template? This will NOT alter the treasurer ledger or officially approve a budget.'))return;
   for(const line of TEMPLATE_ROWS)await put('budget',{...line,id:makeId(),createdAt:now()});
   if(settings('financeDues:'+activeYear())==='')await writeSetting('financeDues:'+activeYear(),String(TEMPLATE_META.annualDues));
   await writeSetting('financeFundraisingTarget:'+activeYear(),'0');
   await writeSetting('financeDonationEstimate:'+activeYear(),'0');
   await writeSetting('financeFundraisingScouts:'+activeYear(),String(TEMPLATE_META.members));
   await writeSetting('financeTemplateSource','Budget Planner.xlsx – proposed 2026–27 budget');
   await refresh();notify('Imported template planning lines as unapproved drafts');return;
  }
  case 'finance-goto-builder':ui.financeTab='builder';render();return;
  case 'finance-new-budget':ui.financeForm='budget';render();return;
  case 'finance-close':ui.financeForm='';render();return;
  case 'finance-delete-budget':if(askDelete('Remove this LOCAL planning budget line?')){await remove('budget',id);await refresh()}return;
  case 'finance-baseline':{
   if(!askDelete('Record the current LOCAL budget as your reviewed baseline? This does not constitute committee approval or update Google Drive.'))return;
   const year=activeYear(),ledger=dbState.financeLedger.filter(t=>scoutAccountYear(t)===year);
   const v=financialSnapshot({budget:dbState.budget.filter(t=>(t.year||'2026-27')===year),ledger,
    tags:dbState.financeTags.filter(t=>ledger.some(l=>l.id===t.id)),reimbursements:dbState.financeReimbursements.filter(t=>scoutAccountYear(t)===year)});
   await writeSetting('financeBaselineExpenses:'+year,String(v.plannedExpenses));await writeSetting('financeBaselineDate:'+year,isoToday());await refresh();notify('Reviewed planning baseline recorded locally');return;
  }
  case 'finance-fetch-accounts':{
   if(!window.confirm('Scout credit information is sensitive. Continue ONLY on your private, trusted device? This version stores the imported snapshot locally without centrally enforced roles.'))return;
   trigger.disabled=true;trigger.textContent='Reading authorized Sheet…';
   const sourceUrl=settings('financeCreditsUrl:'+activeYear())||(activeYear()==='2026-27'?LINKS.scoutCredits:'');
   if(!sourceUrl)throw Error('Configure the Scout credit Google Sheet for '+activeYear()+' in Settings first');
   const result=await fetchScoutCreditSnapshot(settings('googleClientId'),googleSheetIdFromUrl(sourceUrl),activeYear());
   const dues=annualDues();if(dues===null)throw Error('Set annual dues for '+activeYear()+' in Settings first');
   const parsed=parseScoutCreditsCsv(result.csv,dues);
   if(!window.confirm(`Refresh ${parsed.scouts.length} Scout credit records on this device? Previous local snapshot will be replaced. The original Google Sheet will not change.`))return;
   for(const row of dbState.financeAccounts.filter(r=>scoutAccountYear(r)===activeYear()))await remove('financeAccounts',row.id);
   for(const row of parsed.scouts)await put('financeAccounts',{...row,id:activeYear()==='2026-27'?row.id:activeYear()+':'+row.id,sourceYear:activeYear()});
   await writeSetting('financeAccountsImportedAt:'+activeYear(),result.syncedAt);
   await refresh();notify(`Refreshed ${parsed.scouts.length} Scout account records from Google (read-only)`);return;
  }
  case 'finance-delete-adjustment':if(askDelete('Delete this local proposed Scout account adjustment?')){await remove('financeAdjustments',id);await refresh()}return;
  case 'finance-export-adjustments':{
   if(!dbState.financeAdjustments.length)throw Error('No proposed adjustments found');
   if(!askDelete('Export Scout financial adjustment proposals for the authorized treasurer? Treat the CSV as confidential.'))return;
   const rows=dbState.financeAdjustments.map(r=>({Scout:dbState.financeAccounts.find(x=>x.id===r.accountId)?.name||'Unmatched',Date:r.date,Amount:r.delta,Reason:r.reason,Status:'Proposed - NOT POSTED'}));
   downloadCsv(csvExport(rows,['Scout','Date','Amount','Reason','Status']),`Pack179_Scout_Adjustment_Proposals_${isoToday()}.csv`);return;
  }
  case 'finance-clear-accounts':if(askDelete('Remove the local Scout credit snapshot from this device? Official Drive records are unchanged.')){for(const item of dbState.financeAccounts)await remove('financeAccounts',item.id);await writeSetting('financeAccountsImportedAt:'+activeYear(),'');await refresh();notify('Local Scout credit copy deleted')}return;
  case 'finance-export-accounts':{
   const q=ui.accountQuery.trim().toLowerCase(),den=ui.accountDen;
   const rows=dbState.financeAccounts.filter(r=>scoutAccountYear(r)===activeYear()&&(den==='all'||r.den===den)&&[r.name,r.den].some(x=>String(x||'').toLowerCase().includes(q))).map(r=>({Scout:r.name,Den:r.den,Carryover:r.carryover,Popcorn:r.earnings,Balance:r.balance??'Needs review'}));
   if(!rows.length)throw Error('No Scout credit records to export.');
   if(!askDelete('This CSV contains individual Scout financial balances. Download only to an access-controlled device and storage location?'))return;
   downloadCsv(csvExport(rows,['Scout','Den','Carryover','Popcorn','Balance']),`Pack179_Scout_Account_Review_${isoToday()}.csv`);notify('Restricted Scout credit CSV downloaded');return;
  }
  case 'finance-review-request':{
   const rec=dbState.financeReimbursements.find(x=>x.id===id);if(rec){await put('financeReimbursements',{...rec,status:'reviewed',updatedAt:now()});await refresh();notify('Marked reviewed locally (not an official approval)')}return;
  }
  case 'finance-decline-request':{
   const rec=dbState.financeReimbursements.find(x=>x.id===id);if(rec&&askDelete('Mark this reimbursement as declined in the LOCAL queue?')){await put('financeReimbursements',{...rec,status:'declined',updatedAt:now()});await refresh()}return;
  }
  case 'finance-pay-request':{
   const rec=dbState.financeReimbursements.find(x=>x.id===id),ledgerId=root.querySelector('[data-ledger-select="'+CSS.escape(id)+'"]')?.value;
   if(!rec)throw Error('Reimbursement not found');
   const matched={...rec,ledgerId};
   if(!reimbursePaidAllowed(matched,dbState.financeLedger,dbState.financeTags))throw Error('Choose a categorized ledger expense with an exact matching amount; payment cannot be verified otherwise.');
   if(dbState.financeReimbursements.some(x=>x.id!==id&&x.status==='paid'&&x.ledgerId===ledgerId))throw Error('This ledger transaction is already matched to another paid reimbursement.');
   if(!askDelete('Mark paid in this LOCAL PackOps working queue after verifying the actual ledger transaction? This will NOT edit the treasurer ledger.'))return;
   await put('financeReimbursements',{...matched,status:'paid',paidAt:now(),updatedAt:now()});await refresh();notify('Payment matched to local copy of the official ledger');return;
  }
  case 'finance-export-report':{
   const year=activeYear(),ledger=dbState.financeLedger.filter(x=>scoutAccountYear(x)===year);
   const tags=dbState.financeTags.filter(x=>ledger.some(row=>row.id===x.id));
   const s=financialSnapshot({budget:dbState.budget.filter(x=>(x.year||'2026-27')===year),ledger,tags,reimbursements:dbState.financeReimbursements.filter(x=>scoutAccountYear(x)===year)});
   downloadCsv(csvExport(reportsRows(s),['Category','Planned','Actual','Variance']),`Pack179_Committee_Budget_${isoToday()}.csv`);notify('Committee category-only report exported');return;
  }
  case 'finance-print-report':{
   document.body.classList.add('print-finance');
   window.addEventListener('afterprint',()=>document.body.classList.remove('print-finance'),{once:true});
   window.print();return;
  }
  case 'goto-settings':route('settings');return;
  case 'goto-calendar':route('calendar');return;
  case 'install-pwa':{
   if(pwaInstallPrompt){pwaInstallPrompt.prompt();await pwaInstallPrompt.userChoice;pwaInstallPrompt=null;render();return;}
   notify('On Android Chrome, open the browser menu (⋮) and choose Install app. If installed already, launch the PackOps icon on your home screen.');return;
  }
  case 'calendar-use-pack':{
   await writeSetting('calendarId',PACK_CALENDAR_ID);await writeSetting('calendarName','Pack 179 Calendar (26–27)');
   ui.calendarFetchedAt=0;ui.googleEvents=[];await refresh();
   if(settings('googleClientId')){try{const count=await fetchLinkedCalendar(PACK_CALENDAR_ID);notify(`Loaded ${count} Pack 179 calendar events and updated linked workspaces`)}catch(e){notify('Pack calendar selected. To fetch events, authorize Google Calendar: '+e.message,true)}}
   else notify('Pack calendar selected. Add your OAuth Client ID in Settings to read events.');return;
  }
  case 'calendar-connect':{
   const clientId=settings('googleClientId');ui.calendars=await calendarList(clientId);
   notify(`Found ${ui.calendars.length} accessible calendars. Choose one below.`);render();return;
  }
  case 'calendar-refresh':{
   const calendarId=settings('calendarId');if(!calendarId)throw Error('Select a calendar first');
   const count=await fetchLinkedCalendar(calendarId);notify(`Loaded ${count} upcoming events and updated linked workspaces`);return;
  }
  case 'clear-ics':if(askDelete('Remove the locally imported iCalendar snapshot? No Google Calendar events will be modified.')){for(const e of dbState.calendarEvents)await remove('calendarEvents',e.id);await refresh();notify('Local calendar snapshot removed')}return;
  case 'roster-select-all':for(const r of rosterRows())ui.rosterSelected.add(r.id);render();return;
  case 'roster-select-none':ui.rosterSelected.clear();render();return;
  case 'roster-export':{
   const rows=groupScouts(dbState.roster).filter(r=>ui.rosterSelected.has(r.id));if(!rows.length)throw Error('Select at least one Scout to export.');
   const mode=root.querySelector('#roster-export-fields')?.value||'names';
   const cols=mode==='contacts'?['name','den','guardian','email','phone']:mode==='review'?['name','den','rank','issues']:['name','den','rank'];
   if(mode==='contacts'&&!window.confirm('This export contains guardian contact details. Save it only in an access-controlled location. Continue?'))return;
   const content=exportRoster(rows,cols),blob=new Blob(['\ufeff'+content],{type:'text/csv;charset=utf-8'});
   const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`Pack179_selected_scouts_${isoToday()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   notify(`Exported ${rows.length} selected Scouts locally`);return;
  }
  case 'goto-assistant':route('assistant');return;
  case 'show-budget':ui.form='budget';render();return;
  case 'show-task':ui.form='task';ui.editTask='';render();return;
  case 'show-event-task':ui.form='task';ui.editTask='';render();return;
  case 'show-event':ui.form='event';render();return;
  case 'show-equipment':ui.form='equipment';ui.editEquipment='';render();return;
  case 'equipment-edit':ui.editEquipment=id;ui.form='equipment';render();return;
  case 'equipment-cancel':ui.editEquipment='';ui.form='';render();return;
  case 'equipment-clear-search':ui.equipmentQuery='';render();return;
  case 'equipment-export':{const rows=trigger.dataset.scope==='all'?queryEquipment(dbState.equipment,{sort:ui.equipmentSort}):queryEquipment(dbState.equipment,{search:ui.equipmentQuery,category:ui.equipmentCategory,sort:ui.equipmentSort});downloadCsv(equipmentCsv(rows),`Pack179_Equipment_${isoToday()}.csv`);notify(`Exported ${rows.length} equipment entries`);return;}
  case 'show-bookmark':ui.form='bookmark';render();return;
  case 'cancel-form':ui.form='';ui.editTask='';render();return;
  case 'calendar-plan':{
   const event=ui.googleEvents.find(e=>e.id===id);
   if(!event){notify('Refresh Google Calendar first to open this event workspace.',true);return;}
   const prior=matchExistingWorkspace(event,dbState.events);
   const workspace=workspaceForCalendarEvent(event,prior,now());
   await put('events',workspace);await refresh();route('events',workspace.id);
   notify(prior?'Opened calendar-linked event workspace':'Created event workspace linked to Google Calendar.');
   return;
  }
  case 'open-event':route('events',id);return;
  case 'back-events':route('events');return;
  case 'event-open-families':ui.familyEventFilter=ui.eventId;await loadFamilyForms();route('families');return;
  case 'event-remove-equipment':{
   const ev=findEvent(ui.eventId);if(!ev)return;
   await put('events',{...ev,equipmentIds:(ev.equipmentIds||[]).filter(x=>x!==id)});
   await refresh();return;
  }
  case 'event-go-finance':ui.financeTab='builder';route('budget');return;
  case 'event-reimburse':ui.financeTab='reimbursements';ui.reimbursementEventId=ui.eventId;route('budget');return;
  case 'event-receipt':ui.receiptEventId=ui.eventId;route('receipts');return;
  case 'edit-task':ui.form='edit-task';ui.editTask=id;render();return;
  case 'toggle-task':{const t=dbState.tasks.find(t=>t.id===id);if(t){await put('tasks',{...t,status:t.status==='done'?'open':'done',updatedAt:now()});await refresh()}return;}
  case 'delete-task':if(askDelete('Delete this local task?')){await remove('tasks',id);await refresh()}return;
  case 'delete-budget':if(askDelete('Delete this local budget entry?')){await remove('budget',id);await refresh()}return;
  case 'delete-event':if(askDelete('Delete this local event, all its local tasks and attachments? This does not affect Scoutbook or Google Drive.')){await Promise.all([remove('events',id),...dbState.tasks.filter(t=>t.eventId===id).map(t=>remove('tasks',t.id)),...dbState.attachments.filter(a=>a.eventId===id).map(a=>remove('attachments',a.id))]);ui.eventId='';await refresh();route('events')}return;
  case 'delete-attachment':if(askDelete('Remove this local attachment?')){await remove('attachments',id);await refresh()}return;
  case 'delete-equipment':if(askDelete('Remove this item from your local inventory?')){await remove('equipment',id);await refresh()}return;
  case 'equipment-status':{const r=dbState.equipment.find(r=>r.id===id);if(r){const states=['ready','verify','repair'];await put('equipment',{...r,condition:states[(states.indexOf(r.condition)+1)%states.length]});await refresh()}return;}
  case 'delete-bookmark':await remove('bookmarks',id);await refresh();return;
  case 'meeting-quick':ui.meetingMode='quick';render();return;
  case 'meeting-full':ui.meetingMode='full';render();return;
  case 'meeting-edit':ui.editMeeting=!ui.editMeeting;render();return;
  case 'meeting-reset':if(askDelete('Reset your personal meeting script overrides?')){for(const s of MEETING)await writeSetting('meeting:'+s.id,'');await refresh()}return;
  case 'print':window.print();return;
  case 'copy-brief':await navigator.clipboard.writeText(brief(dbState.tasks,upcomingRecords()));notify('Working briefing copied');return;
  case 'clear-roster':if(askDelete('Remove the entire imported roster from this browser?')){for(const r of dbState.roster)await remove('roster',r.id);ui.rosterPreview=null;ui.rosterSelected.clear();await refresh()}return;
  case 'commit-roster':{
   if(!ui.rosterPreview)return;
   const review=reconcileRoster(dbState.roster,ui.rosterPreview.records);
   if(!askDelete('Import '+ui.rosterPreview.records.length+' Scoutbook rows?\n'+review.matched+' matched existing records (IDs preserved)\n'+review.added+' new rows\n'+review.missing+' missing from the latest export (FLAGGED, not deleted)\n\nThe official Scoutbook roster remains unchanged. Cloud uploads require your approved Pack Google login.'))return;
   // Existing Scout rows stay put until replacements have been written successfully.
   for(const row of review.rows)await put('roster',row);
   ui.rosterPreview=null;ui.rosterSelected.clear();await refresh();
   notify('Roster updated. '+review.missing+' old records flagged for review; none automatically deleted.');return;
  }
  case 'open-attachment':{const r=dbState.attachments.find(r=>r.id===id);if(r?.blob)openBlob(r.blob);return;}
  case 'open-receipt':{const r=dbState.receipts.find(r=>r.id===id);if(r?.blob)openBlob(r.blob);return;}
  case 'delete-receipt':if(askDelete('Remove this receipt from the LOCAL queue? Any uploaded Drive file will remain in Google Drive.')){await remove('receipts',id);await refresh()}return;
  case 'upload-receipt':{
   const r=dbState.receipts.find(r=>r.id===id);if(!r)return;
   const folder=settings('googleFolder'),client=settings('googleClientId');
   if(!folder||!client){notify('Configure Google Drive and choose the receipts folder first',true);route('settings');return;}
   trigger.disabled=true;trigger.textContent='Uploading…';
   try{
    const uploaded=await uploadReceipt(r,folder,client);
    const updated={...r,state:'uploaded',driveFileId:uploaded.id,error:'',uploadedAt:now()};
    await localPut('receipts',updated);
    let syncWarning='';
    if(cloudActive()){try{const {blob,...metadata}=updated;await saveCloudRow('receipts',metadata)}catch(e){syncWarning=e.message}}
    await refresh();notify(syncWarning?'Uploaded to Drive, but shared receipt index needs retry: '+syncWarning:'Receipt uploaded to Google Drive and indexed for authorized Pack finance');
   }
   catch(error){await put('receipts',{...r,state:'error',error:String(error.message||error)});await refresh();notify('Upload failed: '+error.message,true)}return;
  }
  case 'google-sign-in':try{
    const config=enteredGoogleConfiguration();
    await authorize(config.clientId);
    await persistGoogleConfiguration(config);await refresh();
    notify('Google authorized and Client ID saved on this PC.');
   }catch(e){notify(String(e.message),true)}return;
  case 'google-pick-folder':try{
    const config=enteredGoogleConfiguration();
    const folder=await selectFolder(config.apiKey,config.clientId);
    await persistGoogleConfiguration(config);
    await writeSetting('googleFolder',folder.id);await writeSetting('googleFolderName',folder.name);
    await refresh();notify('Destination folder selected and Google configuration saved.');
   }catch(e){notify(String(e.message),true)}return;
  case 'google-pick-backup-folder':try{
    const config=enteredGoogleConfiguration();
    const folder=await selectFolder(config.apiKey,config.clientId,'Choose restricted PackOps backup folder');
    await persistGoogleConfiguration(config);
    await writeSetting('googleBackupFolder',folder.id);await writeSetting('googleBackupFolderName',folder.name);
    await refresh();notify('Backup folder selected and Google configuration saved.');
   }catch(e){notify(String(e.message),true)}return;
  case 'google-disconnect':disconnect();render();notify('Google token cleared from this session');return;
  case 'clear-local':if(askDelete('Permanently clear all LOCAL PackOps records on this device, including roster and queued receipts? This will not delete Google Drive files.')){await clearEverything();dbState.events=[];dbState.roster=[];ui.rosterPreview=null;await refresh();notify('All local PackOps records cleared')}return;
 }
}
function downloadCsv(content,fileName){
 const blob=new Blob(['\ufeff'+content],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=fileName;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function openBlob(blob){const url=URL.createObjectURL(blob);const opened=window.open(url,'_blank','noopener');if(!opened){const a=document.createElement('a');a.href=url;a.download='packops-file';a.click()}setTimeout(()=>URL.revokeObjectURL(url),60_000)}
async function handleForm(form){
 const kind=form.dataset.form;const f=k=>formData(form,k);
 switch(kind){
  case 'cloud-config':{
   const projectUrl=f('projectUrl'),publishableKey=f('publishableKey'),packId=f('packId');
   if(/service_role|sb_secret_/i.test(publishableKey))throw Error('Never enter a Supabase secret key in a browser');
   await configureCloud({projectUrl,publishableKey,pack:packId});
   await writeSetting('supabaseUrl',projectUrl);await writeSetting('supabasePublishableKey',publishableKey);await writeSetting('supabasePackId',packId);
   ensureRealtime();
   ui.cloudError='';await loadCloudAdmin();await loadFamilyForms();await refresh();notify('Secure backend configured. Use Continue with Google if needed.');return;
  }
  case 'cloud-invite-leader':{
   const denScopes=f('dens').split(',').map(x=>x.trim()).filter(Boolean);
   await addLeaderInvite({email:f('email'),role:f('role'),denScopes});
   await loadCloudAdmin();render();notify('Leader invitation approved. Ask that leader to sign into PackOps with this email.');return;
  }
  case 'family-form-create':{
   if(!cloudActive())throw Error('Sign in and activate the Pack shared database first');
   const kind=f('kind'),options=f('options').split(',').map(s=>s.trim()).filter(Boolean);
   if(!['rsvp','poll','volunteer'].includes(kind))throw Error('Unsupported response type');
   if(kind!=='rsvp'&&(options.length<1||options.length>30))throw Error('Provide the poll choices or volunteer position names separated by commas');
   const member=cloudState().member;
   const den=f('den')||(member?.role==='den_leader'?(member.den_scopes||[])[0]:'');
   const item=await createFamilyForm({title:f('title'),kind,description:f('description'),event_id:f('eventId')||null,den_scope:den||null,questions:kind==='rsvp'?[]:[{label:kind==='poll'?'Choose an option':'Choose a position',options}],status:'open'});
   await loadFamilyForms();await openFamilyForm(item.id);notify('Family response form published. Invite households individually.');return;
  }
  case 'family-invite':{
   const sendEmail=form.elements.sendEmail?.checked||false;
   const result=await inviteFamily(f('formId'),f('recipientLabel'),f('recipientEmail'),sendEmail);
   ui.familyLink=result.url;
   ui.familyResults=await getFamilyResponses(f('formId'));
   render();
   notify(result.emailed?'Invitation email sent':'Private link generated. Copy it and share with the intended household.');return;
  }
  case 'family-public-response':{
   if(!ui.familyToken)throw Error('Open a private invitation link first');
   const answer=ui.familyData?.kind==='rsvp'?{status:f('status'),adults:Number(f('adults')),children:Number(f('children'))}:{choice:f('choice')};
   const result=await publicFamilyRequest('respond',ui.familyToken,answer);
   ui.familySent=!!result.success;render();notify('Family response recorded.');return;
  }
  case 'den-plan':{
   if(!ui.denChoice)throw Error('Choose a den first');
   await put('denPlans',{id:makeId(),den:ui.denChoice,title:f('title'),date:f('date'),agenda:f('agenda'),supplies:f('supplies'),createdAt:now()});
   await refresh();notify('Den meeting plan saved');return;
  }
  case 'den-progress':{
   if(!ui.denChoice||!f('scoutId'))throw Error('Choose an assigned den and Scout first');
   await put('adventureProgress',{id:makeId(),den:ui.denChoice,scoutId:f('scoutId'),adventure:f('adventure'),status:f('status'),createdAt:now()});
   await refresh();notify('Internal advancement progress recorded (not posted to Scoutbook)');return;
  }
  case 'drive-year-sources':{
   const year=activeYear(),credit=f('creditUrl'),ledger=f('ledgerUrl'),budgetUrl=f('budgetUrl'),receipts=f('receiptsUrl');
   if(credit)googleSheetIdFromUrl(credit);
   const rows=[['financeCreditsUrl:'+year,credit?officialFileUrl(credit):''],['financeLedgerUrl:'+year,ledger?officialFileUrl(ledger):''],
    ['financeBudgetUrl:'+year,budgetUrl?officialFileUrl(budgetUrl):''],['financeReceiptsUrl:'+year,receipts?officialFileUrl(receipts):'']];
   if(!askDelete('Update '+year+' Google Drive source links on this device? Original Google files will not be changed.'))return;
   for(const [key,value] of rows)await writeSetting(key,value);
   await refresh();notify('Official Drive source links saved for '+year);return;
  }
  case 'pack-year-config':{
   if(!cloudActive()){
    if(await saveYearConfiguration(form,dbState.financeAccounts)){await refresh();notify('Annual Pack dues saved locally')}
    return;
   }
   const year=f('year'),raw=f('dues'),dues=Number(raw);
   if(!validScoutYear(year)||raw===''||!Number.isFinite(dues)||dues<0||dues>10000)throw Error('Enter a valid year and annual dues');
   if(!askDelete('Update Pack '+year+' dues to '+money(dues)+' for all authorized finance leaders? Official Scoutbook/Google Sheets are not modified.'))return;
   await writeSetting('activeScoutYear',year);await writeSetting('financeDues:'+year,String(dues));
   for(const account of dbState.financeAccounts.filter(x=>scoutAccountYear(x)===year)){
    const diff=creditDifference(account,dues);
    await put('financeAccounts',{...account,calculated:Math.round((Number(account.carryover||0)+Number(account.earnings||0)-dues)*100)/100,needsReview:diff!==null&&Math.abs(diff)>0.011});
   }
   await refresh();notify('Annual dues shared securely with authorized finance leaders');return;
  }
  case 'backup-export':{
   if(cloudActive()&&!['admin','cubmaster'].includes(cloudState().member.role))throw Error('Only Pack administrators can export a shared snapshot containing potentially sensitive youth records');
   const snapshot=cloudActive()?Object.fromEntries(TABLES.map(t=>[t,dbState[t]])):null;
   const message=await exportPackOpsBackup(form,settings,snapshot);
   if(message)notify(message);return;
  }
  case 'backup-restore':if(await restorePackOpsFromFile(form)){ui.rosterSelected.clear();ui.googleEvents=[];ui.calendarFetchedAt=0;await refresh();notify('PackOps restored. Reconnect Google services.')}return;
  case 'wizard-source':{
   const source=f('source');
   if(!['template','prior','blank'].includes(source))throw Error('Choose a valid budget source');
   ui.wizardSource=source;ui.wizardStep=1;render();return;
  }
  case 'wizard-assumptions':{
   const config={year:activeYear(),scouts:Number(f('scouts')),adults:Number(f('adults')),dues:f('dues'),donations:f('donations')};
   validateWizardSettings(config);
   const prevYear=(Number(activeYear().slice(0,4))-1)+'-'+activeYear().slice(2,4);
   ui.wizardExpenses=wizardSeedExpenses({source:ui.wizardSource,scouts:config.scouts,adults:config.adults,
    priorBudget:dbState.budget.filter(b=>(b.year||'2026-27')===prevYear)});
   ui.wizardConfig={...config,source:ui.wizardSource};ui.wizardStep=2;render();return;
  }
  case 'wizard-expenses':{
   if(!ui.wizardConfig||!ui.wizardExpenses?.length)throw Error('Complete the earlier wizard steps first');
   const expenseRows=ui.wizardExpenses.map((line,i)=>{
    const raw=f('expense_'+i),planned=Number(raw);
    if(raw===''||!Number.isFinite(planned)||planned<0||planned>1e9)throw Error('Enter a valid amount for '+line.detail);
    return {...line,planned:Math.round(planned*100)/100};
   });
   wizardPreview(ui.wizardConfig,expenseRows);
   ui.wizardExpenses=expenseRows;ui.wizardStep=3;render();return;
  }
  case 'event-budget':{
   const event=dbState.events.find(x=>x.id===form.dataset.id);
   if(!event)throw Error('Event workspace not found');
   const amount=Number(f('planned'));
   if(!EXPENSE_CATEGORIES.includes(f('category'))||!f('detail')||f('detail').length>120||f('planned')===''||!Number.isFinite(amount)||amount<0||amount>1e8)throw Error('Enter a category, purpose and valid estimated cost');
   await put('budget',{id:makeId(),year:activeYear(),type:'expense',category:f('category'),detail:f('detail'),planned:Math.round(amount*100)/100,eventId:event.id,source:'event-workspace',note:'DRAFT event expense, not posted to the ledger',createdAt:now()});
   await refresh();notify('Event budget item saved as a draft');return;
  }
  case 'finance-budget':{
   const v=Number(f('planned'));if(!Number.isFinite(v)||v<0||v>1e9)throw Error('Enter a valid planning amount');
   await put('budget',{id:makeId(),category:f('category'),type:f('type'),planned:Math.round(v*100)/100,eventId:f('eventId'),year:f('year'),note:f('note'),createdAt:now()});ui.financeForm='';break;
  }
  case 'receipt-item':{
   const receipt=dbState.receipts.find(r=>r.id===form.dataset.id);
   if(!receipt)throw Error('Receipt not found');
   const quantity=Number(f('quantity')),unitPrice=Number(f('unitPrice'));
   if(!Number.isFinite(quantity)||quantity<=0||quantity>10000||!Number.isFinite(unitPrice)||unitPrice<0||unitPrice>1e7)throw Error('Enter valid quantity and unit price');
   const item={id:makeId(),name:f('itemName'),quantity,unitPrice:Math.round(unitPrice*100)/100,category:f('category')};
   await put('receipts',{...receipt,items:[...(receipt.items||[]),item]});break;
  }
  case 'finance-adjustment':{
   const acc=dbState.financeAccounts.find(x=>x.id===f('accountId'));
   if(!acc)throw Error('Select an imported Scout account first');
   const delta=Number(f('delta'));if(!Number.isFinite(delta)||delta===0||Math.abs(delta)>1e6)throw Error('Enter a valid nonzero adjustment amount');
   if(!f('reason'))throw Error('Enter a reason that Courtney can review');
   await put('financeAdjustments',{id:makeId(),accountId:acc.id,delta:Math.round(delta*100)/100,date:f('date'),reason:f('reason'),status:'proposed',createdAt:now()});break;
  }
  case 'finance-reimbursement':{
   const v=Number(f('amount'));if(!Number.isFinite(v)||v<=0||v>1e7)throw Error('Enter a valid reimbursement amount');
   const eventId=f('eventId'),event=dbState.events.find(e=>e.id===eventId);
    await put('financeReimbursements',{id:makeId(),requester:f('requester'),amount:Math.round(v*100)/100,date:f('date'),eventId:event?.id||'',eventTitle:event?.title||'',category:f('category'),notes:f('notes'),receiptId:f('receiptId'),sourceYear:activeYear(),status:'submitted',createdAt:now()});ui.reimbursementEventId='';break;
  }
  case 'finance-donations':{
   const value=Number(f('donations'));
   if(f('donations')===''||!Number.isFinite(value)||value<0||value>1e8)throw Error('Enter a non-negative optional donation estimate');
   await writeSetting('financeDonationEstimate:'+activeYear(),String(Math.round(value*100)/100));
   await refresh();notify('Optional donation estimate saved; official ledger unchanged');return;
  }
  case 'finance-fundraising':{
   const goal=Number(f('target')),rate=Number(f('rate')),members=Number(f('members'));
   if(!Number.isFinite(goal)||goal<0||goal>1e8||!Number.isFinite(rate)||rate<=0||rate>100||!Number.isInteger(members)||members<1||members>2000)throw Error('Enter a valid proceeds target, commission percentage and number of Scouts');
   await writeSetting('financeFundraisingTarget:'+activeYear(),String(goal));await writeSetting('financeFundraisingCommission:'+activeYear(),String(rate/100));await writeSetting('financeFundraisingScouts:'+activeYear(),String(members));break;
  }
  case 'finance-forecast':{
   for(const name of ['futureIncome','futureExpenses','reserve','restricted']){const v=Number(f(name));if(!Number.isFinite(v)||v<0||v>1e9)throw Error('Use non-negative amounts for forecast assumptions.');}
   for(const key of ['futureIncome','futureExpenses','reserve','restricted'])await writeSetting(({futureIncome:'financeFutureIncome',futureExpenses:'financeFutureExpenses',reserve:'financeReserve',restricted:'financeRestricted'})[key]+':'+activeYear(),f(key));break;
  }
  case 'finance-import-ledger':{
   const file=form.elements.file.files?.[0];if(!file||file.size>3*1024*1024)throw Error('Select the treasurer ledger CSV under 3 MB. Export an Excel workbook as CSV first.');
   const raw=parseLedgerCsv(await file.text()),review=ledgerImportReview(raw),year=activeYear();
   const last=review.lastBalance===null?'Not included':money(review.lastBalance);
   const audit=review.balanceWarnings.length?'\nWARNING: '+review.balanceWarnings.length+' running-balance discrepancies; check exported row order.':'';
   if(!askDelete('TREASURER LEDGER IMPORT — '+year+'\n'+review.rows+' rows\nDeposits: '+money(review.deposits)+'\nWithdrawals: '+money(review.withdrawals)+'\nLatest listed balance: '+last+(review.lastBalanceDate?' ('+review.lastBalanceDate+')':'')+'\n\nDeposits include transfers and Scout-credit movements until reviewed. The official Drive ledger will NOT be edited.'+audit+'\n\nReplace only this year’s LOCAL ledger snapshot?'))return;
   const next=raw.map(row=>({...row,id:year==='2026-27'?row.id:year+':'+row.id,sourceYear:year}));
   await replaceAnnualLedger({previous:dbState.financeLedger.filter(r=>scoutAccountYear(r)===year),next,year,importedAt:new Date().toISOString()});
   await refresh();ui.financeTab='ledger';render();notify('Ledger imported. Review deposits as dues, occasional donations, transfers or restricted credits.');return;
  }
  case 'finance-import-accounts':{
   const file=form.elements.file.files?.[0];if(!file||file.size>3*1024*1024)throw Error('Select a Scout credit CSV smaller than 3 MB');
   if(!form.elements.privateDevice?.checked)throw Error('Use a private, trusted device');
   const dues=annualDues();if(dues===null)throw Error('Set the annual dues for '+activeYear()+' in Settings first');
   const parsed=parseScoutCreditsCsv(await file.text(),dues);
   if(!askDelete(`Replace LOCAL Scout credit snapshot with ${parsed.scouts.length} records? ${parsed.continuationRows} guardian continuation rows are intentionally not stored in finance.`))return;
   for(const row of dbState.financeAccounts.filter(r=>scoutAccountYear(r)===activeYear()))await remove('financeAccounts',row.id);
   for(const row of parsed.scouts)await put('financeAccounts',{...row,id:activeYear()==='2026-27'?row.id:activeYear()+':'+row.id,sourceYear:activeYear()});
   await writeSetting('financeAccountsImportedAt:'+activeYear(),new Date().toISOString());
   await refresh();notify(`Imported ${parsed.scouts.length} Scout financial records locally`);return;
  }
  case 'budget':await put('budget',{id:makeId(),category:f('category'),planned:Number(f('planned')),actual:Number(f('actual')),note:f('note')});break;
  case 'task':{
   const old=dbState.tasks.find(t=>t.id===form.dataset.editId);
   await put('tasks',{id:old?.id||makeId(),title:f('title'),kind:f('kind'),owner:f('owner'),email:f('email'),due:f('due'),priority:f('priority'),eventId:f('eventId'),status:f('status'),details:f('details'),createdAt:old?.createdAt||now(),updatedAt:now()});break;
  }
  case 'event':{
   const e={id:makeId(),title:f('title'),date:f('date'),location:f('location'),owner:f('owner'),notes:f('notes'),links:f('links'),createdAt:now()};
   await put('events',e);ui.form='';await refresh();route('events',e.id);notify('Event workspace saved on this device');return;
  }
  case 'event-equipment':{
   const ev=findEvent(form.dataset.id),id=f('equipmentId');
   if(!ev||!dbState.equipment.some(r=>r.id===id))throw Error('Choose equipment already in Pack inventory');
   await put('events',{...ev,equipmentIds:[...new Set([...(ev.equipmentIds||[]),id])],updatedAt:now()});
   await refresh();notify('Equipment linked to event');return;
  }
  case 'event-notes':{const old=findEvent(form.dataset.id);if(old)await put('events',{...old,notes:f('notes'),links:f('links'),updatedAt:now()});break;}
  case 'attachment':{
   const file=form.elements.file.files?.[0];if(!file)throw Error('Choose an attachment');if(file.size>15*1024*1024)throw Error('Attachments are limited to 15 MB in this version.');
   await put('attachments',{id:makeId(),eventId:form.dataset.id,fileName:file.name,mimeType:file.type,blob:file,createdAt:now()});break;
  }
  case 'receipt':{
   const file=form.elements.file.files?.[0];if(!file)throw Error('Choose a receipt');if(file.size>15*1024*1024)throw Error('Receipts are limited to 15 MB');
   await put('receipts',{id:makeId(),fileName:file.name,mimeType:file.type,blob:file,createdAt:now(),vendor:f('vendor'),amount:f('amount')===''?null:Number(f('amount')),eventId:f('eventId'),note:f('note'),state:'local'});ui.receiptEventId='';break;
  }
  case 'meeting':for(const s of MEETING)await writeSetting('meeting:'+s.id,f('section:'+s.id));ui.editMeeting=false;break;
  case 'equipment':{
   const qty=Number(f('quantity'));if(!Number.isInteger(qty)||qty<0||qty>999999)throw Error('Enter a valid whole-number quantity');
   if(!f('category'))throw Error('Category is required');
   const old=dbState.equipment.find(r=>r.id===form.dataset.editId);
   await put('equipment',{...old,id:old?.id||makeId(),name:f('name'),category:f('category'),quantity:qty,location:f('location'),holder:f('holder'),condition:f('condition'),verifiedAt:f('verifiedAt'),notes:f('notes'),updatedAt:now()});
   ui.editEquipment='';break;
  }
  case 'bookmark':if(!safeUrl(f('url')))throw Error('Enter a valid HTTP(S) link');await put('bookmarks',{id:makeId(),label:f('label'),url:f('url'),description:f('description')});break;
  case 'google-settings':{
    const config=normalizeGoogleConfiguration(f('googleClientId'),f('googleApiKey'));
    await persistGoogleConfiguration(config);
    await refresh();
    notify('OAuth Client ID saved on this PC. Click Sign in to Google.');
    return;
   }
  case 'calendar-ics':{
   const file=form.elements.file.files?.[0];if(!file)throw Error('Choose an .ics file');
   if(file.size>2*1024*1024)throw Error('Calendar file is larger than 2 MB');
   const parsed=parseIcs(await file.text());
   const nowdate=isoToday(),future=parsed.filter(e=>e.date>=nowdate);
   if(!window.confirm(`Replace the locally imported calendar snapshot with ${future.length} upcoming events? This won't affect Google Calendar.`))return;
   for(const e of dbState.calendarEvents)await remove('calendarEvents',e.id);
   for(const e of future)await put('calendarEvents',e);
   await refresh();notify(`Imported ${future.length} upcoming calendar dates locally`);return;
  }
  case 'roster':{
   const file=form.elements.file.files?.[0];if(!file)throw Error('Choose a CSV roster');if(file.size>5*1024*1024)throw Error('Roster CSV exceeds 5 MB limit');
   ui.rosterPreview=parseRoster(await file.text());ui.form='';render();notify(importPrivacySummary(ui.rosterPreview));return;
  }
  default:return;
 }
 ui.form='';ui.editTask='';await refresh();notify('Saved locally on this device');
}
root.addEventListener('click',async event=>{
 const nav=event.target.closest('[data-nav]');if(nav){route(nav.dataset.nav);return;}
 const action=event.target.closest('[data-action]');if(!action)return;
 try{await handleAction(action.dataset.action,action)}catch(error){console.error(error);notify(String(error?.message||error),true)}
});
root.addEventListener('submit',async event=>{
 const form=event.target.closest('[data-form]');if(!form)return;
 event.preventDefault();const button=form.querySelector('[type=submit]');if(button)button.disabled=true;
 try{await handleForm(form)}catch(error){console.error(error);notify(String(error?.message||error),true)}finally{if(button?.isConnected)button.disabled=false}
});
root.addEventListener('change',async event=>{
 const target=event.target;
 if(target.dataset.change==='den-choice'){ui.denChoice=target.value;render();return}
 if(target.dataset.change==='finance-account-den'){ui.accountDen=target.value;render();return}
 if(target.dataset.change==='finance-account-sort'){ui.accountSort=target.value;render();return}
 if(['finance-tag-kind','finance-tag-category','finance-tag-event'].includes(target.dataset.change)){
  const id=target.dataset.tagId||target.dataset.tagCategory||target.dataset.tagEvent;
  const old=dbState.financeTags.find(x=>x.id===id)||{id,kind:'unclassified',category:'',eventId:''};
  const key=target.dataset.change==='finance-tag-kind'?'kind':target.dataset.change==='finance-tag-category'?'category':'eventId';
  await put('financeTags',{...old,[key]:target.value,updatedAt:now()});await refresh();return;
 }
 if(target.dataset.change==='calendar-pick'){
  const id=target.value,name=ui.calendars.find(c=>c.id===id)?.name||'Selected calendar';
  await writeSetting('calendarId',id);await writeSetting('calendarName',name);ui.googleEvents=[];ui.calendarFetchedAt=0;
  await refresh();if(id){try{const count=await fetchLinkedCalendar(id);notify(`Loaded ${count} upcoming Google events and updated linked workspaces`)}catch(e){notify(String(e.message),true)}}return;
 }
 if(target.dataset.change==='roster-select'){
  if(target.checked)ui.rosterSelected.add(target.dataset.id);else ui.rosterSelected.delete(target.dataset.id);
  const counts=root.querySelectorAll('.roster-selected-count');for(const c of counts)c.textContent=String(ui.rosterSelected.size);const b=root.querySelector('[data-action="roster-export"]');if(b){b.disabled=ui.rosterSelected.size===0;b.textContent=`Export ${ui.rosterSelected.size} selected Scouts (.csv)`;}
  // Avoid re-rendering while a multi-select operation is underway; other indicators refresh on next filter change.
  return;
 }
 if(target.dataset.change==='equipment-filter'){ui.equipmentCategory=target.value;render();return}
 if(target.dataset.change==='equipment-sort'){ui.equipmentSort=target.value;render();return}
 if(target.dataset.change==='roster-den'){ui.rosterDen=target.value;render();return}
 if(target.dataset.change==='roster-rank'){ui.rosterRank=target.value;render();return}
 if(target.dataset.change==='roster-sort'){ui.rosterSort=target.value;render();return}
 if(target.dataset.change==='roster-review'){ui.rosterReview=target.checked;render();return}
 if(target.dataset.change==='task-status'){
  const task=dbState.tasks.find(t=>t.id===target.dataset.id);if(task){await put('tasks',{...task,status:target.value,updatedAt:now()});await refresh()}
 }
});
root.addEventListener('input',event=>{
 if(event.target.name==='family-search'){
  const val=event.target.value,pos=event.target.selectionStart;ui.familySearch=val;render();const el=root.querySelector('[name="family-search"]');if(el){el.focus();if(pos!==null)el.setSelectionRange(pos,pos)}return;
 }
 if(event.target.name==='equipment-search'){
  const val=event.target.value,pos=event.target.selectionStart;ui.equipmentQuery=val;render();const el=root.querySelector('[name="equipment-search"]');if(el){el.focus();if(pos!==null)el.setSelectionRange(pos,pos)}return;
 }
 if(event.target.name==='finance-account-search'){
  const text=event.target.value,index=event.target.selectionStart;ui.accountQuery=text;render();
  const el=root.querySelector('[name="finance-account-search"]');if(el){el.focus();el.setSelectionRange(index,index)}return;
 }
 if(event.target.name==='roster-search'){
  const text=event.target.value,index=event.target.selectionStart;ui.rosterFilter=text;render();
  const el=root.querySelector('[name="roster-search"]');if(el){el.focus();el.setSelectionRange(index,index)}
 }
});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();pwaInstallPrompt=event;render()});
window.addEventListener('appinstalled',()=>{pwaInstallPrompt=null;render();notify('PackOps installed as a standalone app')});
window.addEventListener('hashchange',restoreRoute);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&cloudActive()&&!root.querySelector('input:focus,textarea:focus')){ui.cloudChanged=false;refresh().catch(e=>console.warn('Refresh while returning to PackOps failed',e))}});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
(async()=>{
 // Read local configuration first, then connect Google/Supabase before rendering private views.
 const rows=await Promise.all(TABLES.map(t=>localList(t)));
 TABLES.forEach((name,i)=>dbState[name]=rows[i]);
 await setupCloud();
 if(cloudActive()){
  await loadCloudAdmin();
  await loadFamilyForms();
 }
 await refresh();restoreRoute();
})().catch(err=>{
 console.error('PackOps initialization error:',err);
 root.innerHTML='<main style="padding:30px;max-width:680px;margin:auto"><h1>PackOps could not open local storage</h1><p>Try a normal browser window (not private browsing) and make sure site storage is allowed. No files were changed.</p></main>';
});
