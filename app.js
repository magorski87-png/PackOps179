import {TABLES,list,get,put,remove,readSetting,writeSetting,clearEverything} from './db.js';
import {LINKS,MENU,MEETING,DEN_NAMES,isoToday,makeId,money,esc,safeUrl,niceDate,summary,completion,csvParse,brief} from './data.js';
import {authorize,connected,disconnect,selectFolder,uploadReceipt} from './drive.js';
import {parseRoster,importPrivacySummary} from './roster-import.js';

const root=document.getElementById('root');
const dbState=Object.fromEntries(TABLES.map(t=>[t,t==='settings'?[]:[]]));
const ui={page:'home',eventId:'',form:'',editTask:'',meetingMode:'quick',editMeeting:false,rosterFilter:'',toastId:0};
const now=()=>Date.now();
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
const intro=(kicker,title,desc,right='')=>`<div class="page-head"><div><span class="eyebrow">${esc(kicker)}</span><h1>${esc(title)}</h1><p>${esc(desc)}</p></div>${right?`<div class="no-print">${right}</div>`:''}</div>`;
const note=(msg,warning=false)=>`<div class="note${warning?' warn':''}">${msg}</div>`;

async function refresh(){
 const result=await Promise.all(TABLES.map(t=>list(t)));
 TABLES.forEach((t,i)=>dbState[t]=result[i]);
 render();
}
function settings(key){return dbState.settings.find(s=>s.key===key)?.value||'';}
async function saveSetting(key,value){await writeSetting(key,value);await refresh();}
function route(view='home',event=''){
 ui.page=view;ui.eventId=event;ui.form='';ui.editTask='';
 const hash='#'+view+(event?'/'+encodeURIComponent(event):'');
 if(location.hash!==hash)location.hash=hash;
 render();window.scrollTo({top:0,behavior:'instant'});
}
function restoreRoute(){
 const segments=location.hash.slice(1).split('/');
 ui.page=['home',...MENU.map(m=>m.id),'settings'].includes(segments[0])?segments[0]:'home';
 ui.eventId=segments[1]?decodeURIComponent(segments[1]):'';
 render();
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
  <div class="sidebar-footer"><small>Pack 179 · Built for the people making Scouting happen.<br>First version saves working data on this device.</small><button data-nav="settings">⚙ &nbsp; Settings & Drive</button></div></aside>
  <main class="main"><header class="topbar"><div class="topbar-title"><button class="mobile-menu" data-nav="home" aria-label="Dashboard">☷</button><span>✦</span><strong>${active?esc(active.label):ui.page==='settings'?'Settings & Drive':'Pack 179 Leadership'}</strong></div><div class="topbar-right"><span class="pwa-hint">● Local workspace</span>${btn('⚙ Settings','goto-settings','btn btn-ghost btn-small no-print')}<div class="avatar">179</div></div></header>
  <div class="content">${view()}</div></main>
  <nav class="mobile-bottom no-print" aria-label="Mobile navigation">${[{id:'home',emoji:'🏡',name:'Home'},{id:'events',emoji:'✅',name:'Events'},{id:'volunteers',emoji:'🤝',name:'Tasks'},{id:'assistant',emoji:'✨',name:'Assistant'}].map(t=>`<button class="mobile-tab${ui.page===t.id?' active':''}" data-nav="${t.id}"><span class="emoji">${t.emoji}</span>${t.name}</button>`).join('')}</nav>
 </div>`;
}
function view(){switch(ui.page){
 case 'home':return home();case 'calendar':return calendar();case 'budget':return budget();case 'receipts':return receipts();case 'meeting':return meeting();case 'volunteers':return volunteers();case 'events':return events();case 'roster':return roster();case 'equipment':return equipment();case 'assistant':return assistant();case 'library':return library();case 'settings':return settingsPage();default:return home();}}
function home(){
 const s=summary(dbState.tasks);const next=dbState.events.filter(e=>e.date>=isoToday()).sort((a,b)=>a.date.localeCompare(b.date))[0];
 return `<section class="hero"><div class="hero-copy"><span class="eyebrow" style="color:#eed69e">WELCOME TO PACKOPS</span><h2>Less organizing. More Scouting.</h2><p>Your Pack calendar, event planning, meeting guides, records and tools—all in one place, without replacing Scoutbook Plus.</p><div class="hero-action">${btn('✨ Review priorities','goto-assistant','btn btn-gold')}</div></div><div class="hero-symbol">⚜️</div></section>
 <div class="stats"><div class="stat"><div><strong>${dbState.events.length}</strong><span>Planned events</span></div><div class="stat-icon">🗓️</div></div><div class="stat"><div><strong>${s.open.length}</strong><span>Open responsibilities</span></div><div class="stat-icon">📋</div></div><div class="stat"><div><strong>${s.unassigned.length}</strong><span>Need an owner</span></div><div class="stat-icon">🤝</div></div><div class="stat"><div><strong>${s.overdue.length}</strong><span>Overdue in PackOps</span></div><div class="stat-icon">⏳</div></div></div>
 <div class="section-head"><h2>Everything you need</h2><small>Choose a tool to get started</small></div><div class="tool-grid">${MENU.map(m=>`<button class="tool-card" data-nav="${m.id}"><span class="tool-icon tone-${m.tone}">${m.emoji}</span><strong>${esc(m.label)}</strong><small>${esc(m.sub)}</small></button>`).join('')}</div>
 <div class="banner-note"><span style="font-size:18px">💡</span><div><strong>Working version 1</strong><br>Calendar and Pack Drive links open live Pack resources. Event plans, checklists, budgets and roster records are stored locally in this browser until shared synchronization is built. ${next?`Next locally planned event: <strong>${esc(next.title)}</strong> (${niceDate(next.date)}).`:'Add an event to start your own planning workspace.'}</div></div>`;
}
function calendar(){return `${intro('Keep one authoritative calendar','Pack Calendar','Open the current Pack calendar with one click, without maintaining a second version.')}
 <div class="split"><section class="panel stack"><div><span class="kicker">Current document</span><h2 style="margin-top:10px">2026–2027 Pack Calendar</h2><p>Verified file in the Pack 179 master calendar folder. Linked by its Drive file ID, so edits to the same file appear automatically.</p></div>${link(LINKS.calendar,'🗓️ Open current Pack calendar','btn btn-full')}${link(LINKS.calendarFolder,'View master calendar folder','btn btn-ghost btn-full')}<div class="privacy-strip">If the Pack replaces the PDF with a new file ID, update the shortcut in a future app revision. This version does not automatically determine which document is newest.</div></section>
 <section class="panel stack"><span class="kicker">Official system</span><h2>Scoutbook Plus</h2><p>Scoutbook Plus remains your source of truth for official calendar invitations, attendance and advancement. PackOps only manages the behind-the-scenes preparation.</p>${link(LINKS.scoutbook,'Open Scoutbook Plus','btn btn-outline btn-full')}${link(LINKS.eventTracker,'Open Pack event tracker','btn btn-outline btn-full')}</section></div>`}
function budget(){
 const rows=dbState.budget;const planned=rows.reduce((a,r)=>a+Number(r.planned||0),0);const actual=rows.reduce((a,r)=>a+Number(r.actual||0),0);
 return `${intro('Treasurer-friendly','Budget Workspace','A planning dashboard and one-click access to the existing treasurer ledger.',btn('+ Add budget line','show-budget','btn'))}
 ${note('<strong>Important:</strong> The figures below are working estimates entered in PackOps on this device—not the official Pack ledger. Do not treat them as verified balances or paid expenses.',true)}
 <div class="stats" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div class="stat"><div><strong style="font-size:22px">${money(planned)}</strong><span>Planned (local)</span></div></div><div class="stat"><div><strong style="font-size:22px">${money(actual)}</strong><span>Actual entered (local)</span></div></div><div class="stat"><div><strong style="font-size:22px">${money(planned-actual)}</strong><span>Difference (local)</span></div></div></div>
 <div class="split"><div class="stack">${ui.form==='budget'?`<section class="panel">${budgetForm()}</section>`:''}<section class="panel"><div class="row-between"><h2>Planning categories</h2><span class="pill">${rows.length} entries</span></div>${rows.length?rows.map(r=>`<div class="list-item"><div class="row-between"><strong>${esc(r.category)}</strong>${btn('Remove','delete-budget','btn btn-danger btn-small',`data-id="${r.id}"`)}</div><div class="meta" style="margin-top:8px">Planned ${money(r.planned)} · Entered actual ${money(r.actual)}</div>${r.note?`<p>${esc(r.note)}</p>`:''}</div>`).join(''):empty('📊','No working budget lines','Use Add budget line to record planning estimates. No real Pack totals have been inferred.')}</section></div><section class="panel stack"><h2>Official financial records</h2><p>The treasurer maintains the official ledger. Open it without creating or modifying entries from this initial app.</p>${link(LINKS.ledger,'Open 2026–27 treasurer ledger','btn btn-full')}${link(LINKS.receiptRoot,'Open receipts folder','btn btn-ghost btn-full')}<div class="privacy-strip">Financial information should be restricted to authorized leadership. This local demo has no server-side access controls, so avoid sharing this device profile with unauthorized users.</div></section></div>`;
}
function budgetForm(){return `<h3>Add planning entry</h3><form data-form="budget" class="stack"><div class="form-grid">${field('Category','category','text','','required maxlength="100"')}${field('Planned amount ($)','planned','number','0','min="0" step="0.01" required')}${field('Entered actual ($)','actual','number','0','min="0" step="0.01" required')}${field('Notes','note')}</div><div class="form-actions"><button class="btn" type="submit">Save entry</button>${btn('Cancel','cancel-form')}</div></form>`}
function receiptForm(){return `<section class="panel"><h2>Capture a receipt</h2><p>Save a photo or PDF into a local upload queue. Upload to the selected Pack Drive folder when Google access is connected.</p>
 <form data-form="receipt" class="stack"><div class="field"><label for="receiptFile">Receipt image or PDF · 15 MB max</label><input class="input" id="receiptFile" name="file" type="file" accept="image/*,application/pdf" required></div><div class="form-grid">${field('Vendor / store (optional)','vendor')}${field('Amount ($, optional)','amount','number','','min="0" step="0.01"')}${select('Related event','eventId',eventOptions())}${field('Description (optional)','note')}</div><div class="form-actions"><button class="btn" type="submit">🧾 Save receipt to upload queue</button></div></form></section>`}
function receipts(){
 const records=[...dbState.receipts].sort((a,b)=>b.createdAt-a.createdAt);
 return `${intro('Snap • tag • save','Receipt Upload','Take a photo, connect it to an event, and send it to the Pack’s receipts folder.',link(LINKS.receipts2026,'Open 2026–27 receipts','btn btn-outline'))}
 <div class="split"><div class="stack">${receiptForm()}<section class="panel"><div class="row-between"><h2>Saved receipts</h2><span class="pill">${records.length} files</span></div>${records.length?records.map(r=>`<div class="receipt-row"><span class="receipt-emoji">🧾</span><div style="flex:1;min-width:0"><strong style="font-size:12px;overflow-wrap:anywhere">${esc(r.fileName)}</strong><div class="meta">${esc(r.vendor||'No vendor')} ${r.amount!==null?`· ${money(r.amount)}`:''} · ${new Date(r.createdAt).toLocaleDateString()}</div><div class="task-options">${r.state==='uploaded'?`<span class="pill success">Uploaded to Drive</span>${link(`https://drive.google.com/file/d/${encodeURIComponent(r.driveFileId)}/view`,'View file','btn btn-outline btn-small')}`:`<span class="pill ${r.state==='error'?'danger':'warning'}">${r.state==='error'?'Upload error':'Stored locally'}</span>${btn('Upload to Drive','upload-receipt','btn btn-small',`data-id="${r.id}"`)}`}${btn('View local','open-receipt','btn btn-ghost btn-small',`data-id="${r.id}"`)}${btn('Delete','delete-receipt','btn btn-danger btn-small',`data-id="${r.id}"`)}</div>${r.error?`<div class="meta" style="color:#a13c31;margin-top:7px">${esc(r.error)}</div>`:''}</div></div>`).join(''):empty('📷','No receipts yet','Add your first photo above. Files remain on this device until you upload them.')}</section></div>
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
 <div class="split"><div class="stack">${ui.form==='task'||ui.form==='edit-task'?taskForm(ui.editTask?tasks.find(t=>t.id===ui.editTask):null):''}<section class="panel"><div class="row-between"><h2>Responsibilities</h2><span class="pill">${tasks.length} total</span></div>${tasks.length?tasks.map(taskRow).join(''):empty('🤝','Nothing assigned yet','Create jobs, deadlines, and owner requests. Volunteers can still respond by normal email.',btn('+ Add first task','show-task','btn'))}</section></div><section class="panel stack"><h3>How this works</h3><p>Assign a job, add the leader’s email, and use “Draft email.” Your regular mail app opens a prefilled message for review. PackOps does not send anything automatically.</p>${note('Volunteer replies do not automatically change task status in this first version. Update the status here when someone confirms. Personalized response links are a future module.')}<h3>Existing Pack records</h3><p>Your working Operations & Ownership Plan remains available as a reference while we develop synchronized shared task records.</p>${link(LINKS.operations,'Open ownership plan','btn btn-ghost btn-full')}</section></div>`;
}
function eventForm(){return `<section class="panel"><div class="row-between"><h2>Create a local event workspace</h2>${btn('✕ Close','cancel-form','btn btn-ghost btn-small')}</div><p>This does not create an official Scoutbook Plus calendar event.</p><form data-form="event" class="stack"><div class="form-grid">${field('Event title','title','text','','required maxlength="120"')}${field('Date','date','date')}${field('Location','location')}${field('Event lead','owner')}${textarea('Preparation notes','notes','','rows="3"')}${textarea('Related links (one URL per line)','links','','rows="3"')}</div><div class="form-actions"><button class="btn" type="submit">Create event workspace</button></div></form></section>`}
function eventDetail(e){
 const tasks=dbState.tasks.filter(t=>t.eventId===e.id);const rate=completion(tasks);
 const att=dbState.attachments.filter(a=>a.eventId===e.id);
 return `<div class="row-between no-print" style="margin-bottom:20px">${btn('← All events','back-events','btn btn-ghost')}${btn('Delete event','delete-event','btn btn-danger btn-small',`data-id="${e.id}"`)}</div>
 ${intro('Event workspace',e.title,`${niceDate(e.date)} · ${e.location||'Location not recorded'} · Lead: ${e.owner||'Unassigned'}`)}
 <div class="split"><div class="stack"><section class="panel"><div class="row-between"><h2>Preparation checklist</h2>${btn('+ Add checklist task','show-event-task','btn btn-small')}</div>${rate!==null?`<div class="preview-strip" style="margin:12px 0"><strong>${rate}% of recorded tasks complete</strong><span class="pill">${tasks.length} checklist items</span></div><div class="progress" style="margin-bottom:12px"><span style="width:${rate}%"></span></div>`:note('No tasks yet. Readiness is unknown until checklist tasks are entered.',true)}${tasks.length?tasks.map(taskRow).join(''):''}</section>${ui.form==='task'||ui.form==='edit-task'?taskForm(ui.editTask?dbState.tasks.find(t=>t.id===ui.editTask):null,e.id):''}
 <section class="panel"><h2>Event notes & links</h2><form data-form="event-notes" data-id="${e.id}" class="stack">${textarea('Planning notes','notes',e.notes,'rows="8"')}${textarea('Document or Scoutbook URLs, one per line','links',e.links||'','rows="4"')}<div class="form-actions"><button class="btn" type="submit">Save notes</button></div></form>${(e.links||'').split('\n').map(x=>x.trim()).filter(safeUrl).length?`<div class="divider"></div><h3>Linked resources</h3>${(e.links||'').split('\n').map(x=>x.trim()).filter(safeUrl).map(x=>`<p style="overflow-wrap:anywhere">${link(x,short(x,60),'btn btn-outline btn-small')}</p>`).join('')}`:''}</section></div>
 <div class="stack"><section class="panel"><h2>Event attachments</h2><p>Attach photos, PDFs, route maps or reference documents. These are stored locally in this first version.</p><form data-form="attachment" data-id="${e.id}"><div class="field"><input type="file" name="file" class="input" required aria-label="Event attachment" accept="image/*,application/pdf,.doc,.docx,.xlsx,.csv,.txt"></div><div class="form-actions"><button class="btn btn-small" type="submit">Attach file</button></div></form>${att.length?att.map(a=>`<div class="list-item"><div class="row-between"><strong style="font-size:12px;overflow-wrap:anywhere">📎 ${esc(a.fileName)}</strong><div class="row">${btn('Open','open-attachment','btn btn-ghost btn-small',`data-id="${a.id}"`)}${btn('×','delete-attachment','btn btn-danger btn-small',`data-id="${a.id}"`)}</div></div></div>`).join(''):`<p class="muted">No files attached yet.</p>`}</section>
 <section class="panel stack"><h3>Official event</h3><p>Set the official calendar entry and RSVP through Scoutbook Plus. Paste its link into your event notes when available.</p>${link(LINKS.scoutbook,'Open Scoutbook Plus','btn btn-outline btn-full')}${link(LINKS.packDrive,'Open Pack Drive','btn btn-ghost btn-full')}</section></div></div>`;
}
function events(){const chosen=ui.eventId&&findEvent(ui.eventId);if(chosen)return eventDetail(chosen);
 const rows=[...dbState.events].sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
 return `${intro('Everything behind the event','Event Status & Planning','Keep notes, readiness, responsibilities and attachments together—separate from official Scoutbook events.',btn('+ Create event workspace','show-event','btn'))}
 <div class="stack">${ui.form==='event'?eventForm():''}${rows.length?`<div class="cards">${rows.map(e=>{const ts=dbState.tasks.filter(t=>t.eventId===e.id);const rate=completion(ts);return `<article class="event-card"><div class="row-between"><span class="pill info">${niceDate(e.date)}</span><span class="pill">${rate===null?'Not assessed':rate+'% checklist'}</span></div><h3>${esc(e.title)}</h3><div class="small-info">📍 ${esc(e.location||'Location not recorded')}</div><div class="small-info">👤 ${esc(e.owner||'No lead assigned')} · ${ts.length} tasks</div><div class="progress"><span style="width:${rate||0}%"></span></div>${btn('Open event workspace →','open-event','btn btn-full',`data-id="${e.id}"`)}</article>`}).join('')}</div>`:empty('✅','No PackOps event workspaces','Create an internal preparation workspace for an event already scheduled in Scoutbook.',btn('+ Create first workspace','show-event','btn'))}${note('Calendar entries and RSVPs remain in Scoutbook Plus. PackOps event workspaces are local planning records; they do not create or modify official Scoutbook events.','warning')}</div>`;
}

// Functional first-version modules. Youth membership records remain device-local and are never uploaded.
function roster(){
 const q=ui.rosterFilter.toLowerCase();const rows=dbState.roster.filter(r=>(r.name+' '+r.den+' '+r.guardian).toLowerCase().includes(q));
 return `${intro('Private leadership reference','Pack Roster','Search an authorized local copy of the roster. Scoutbook Plus remains the official membership source.',link(LINKS.scoutbook,'Open Scoutbook Plus'))}
 ${note('Youth roster information is sensitive. CSV imports are stored only in this browser, without a central login or encryption; use a trusted leader-only device. Never share an imported roster through a public PackOps deployment.',true)}
 <div class="split"><div class="stack"><section class="panel stack"><div class="row-between"><h2>Import & review</h2><span class="pill">${dbState.roster.length} local entries</span></div><p>Supports Scoutbook-style CSV exports, including reports that begin with a title row before the real column headings. Ambiguous names and missing fields are flagged instead of silently repaired.</p><form data-form="roster" class="stack"><div class="field"><label for="roster-file">Scoutbook roster (.csv)</label><input class="input" type="file" id="roster-file" name="file" accept=".csv,text/csv,text/plain" required></div><div class="form-actions"><button class="btn" type="submit">Preview CSV issues</button>${btn('Clear local roster','clear-roster','btn btn-danger')}</div></form>
 ${ui.rosterPreview?`<div class="preview-strip"><strong>${ui.rosterPreview.records.length} records found</strong><span class="pill warning">${ui.rosterPreview.warnings.length} need review</span></div><p>${esc(importPrivacySummary(ui.rosterPreview))}</p><div class="review-list">${ui.rosterPreview.warnings.slice(0,25).map(w=>`<div class="list-item"><strong>CSV row ${w.row}</strong><div class="meta">${esc(w.issues.join('; '))}</div></div>`).join('')}${ui.rosterPreview.warnings.length>25?`<p>Showing first 25 warnings of ${ui.rosterPreview.warnings.length}.</p>`:''}</div>${btn('Import locally — keep flagged rows','commit-roster','btn btn-full')}`:''}</section>
 <section class="panel"><div class="row-between"><h2>Roster directory</h2><span class="pill">${rows.length} shown</span></div><input class="input" style="margin:10px 0" type="search" name="roster-search" value="${esc(ui.rosterFilter)}" placeholder="Search name, den, guardian…" aria-label="Search roster">${rows.length?rows.slice(0,150).map(r=>`<div class="list-item"><div class="row-between"><strong>${esc(r.name)}</strong><span class="pill ${r.issues?.length?'warning':''}">${esc(r.den||'Den unknown')}</span></div><div class="meta">Guardian: ${esc(r.guardian||'Needs review')}${r.issues?.length?' · ⚠ '+r.issues.length+' flag(s)':''}</div>${r.phone?`<div class="meta">Phone: ${esc(r.phone)}</div>`:''}${r.email?`<div class="meta">Email: ${esc(r.email)}</div>`:''}</div>`).join(''):empty('📒','No matching roster entries','Select an authorized CSV and review its issues before importing.')} ${rows.length>150?'<p class="muted">Showing first 150 matching entries.</p>':''}</section></div>
 <section class="panel stack"><h2>Why import carefully?</h2><p>The Pack may have siblings, duplicate records, multiple guardian rows, incomplete contact information, or inconsistent rank labels. We preserve uncertain entries and show review warnings rather than guessing.</p><p>Imported contacts are not automatically used to send messages or share files.</p>${link(LINKS.packDrive,'Open Pack leadership Drive','btn btn-ghost btn-full')}<div class="privacy-strip">The local copy does not synchronize with Scoutbook. Re-import an authorized new report to refresh it.</div></section></div>`;
}
function equipment(){
 const rows=[...dbState.equipment].sort((a,b)=>a.name.localeCompare(b.name));
 return `${intro('Know what the Pack owns','Equipment & Supplies','Track where supplies are stored, who has them, and what needs attention.',btn('+ Add equipment','show-equipment','btn'))}
 ${ui.form==='equipment'?`<section class="panel"><h2>New equipment item</h2><form data-form="equipment" class="stack"><div class="form-grid">${field('Item / kit name','name','text','','required maxlength="120"')}${field('Storage location','location')}${field('Checked out to (optional)','holder')}${select('Condition','condition',[['ready','Ready'],['verify','Needs verification'],['repair','Repair required']],'ready')}${textarea('Kit contents / notes','notes')}</div><div class="form-actions"><button class="btn" type="submit">Save item</button>${btn('Cancel','cancel-form')}</div></form></section>`:''}
 ${rows.length?`<div class="cards">${rows.map(r=>`<article class="event-card"><div class="row-between"><h3>${esc(r.name)}</h3><span class="pill ${r.condition==='repair'?'danger':r.condition==='ready'?'success':'warning'}">${r.condition==='repair'?'Repair':r.condition==='ready'?'Ready':'Verify'}</span></div><div class="small-info">📍 ${esc(r.location||'Location not specified')}</div><div class="small-info">${r.holder?'👤 With '+esc(r.holder):'Available / holder not specified'}</div>${r.notes?`<p>${esc(r.notes)}</p>`:''}<div class="row">${btn('Change status','equipment-status','btn btn-outline btn-small',`data-id="${r.id}"`)}${btn('Remove','delete-equipment','btn btn-danger btn-small',`data-id="${r.id}"`)}</div></article>`).join('')}</div>`:empty('🎒','Inventory starts here','Add the rocket kit, Pack flags, tents and camp equipment. QR labels can come later.',btn('+ Add first item','show-equipment','btn'))}`;
}
function assistant(){
 const s=summary(dbState.tasks);const issue=[...s.overdue,...s.unassigned.filter(x=>!s.overdue.includes(x)),...s.dueSoon.filter(x=>!s.overdue.includes(x)&&!s.unassigned.includes(x))].slice(0,12);
 return `${intro('A clearer next move','Cubmaster Assistant','Priorities based on the actual tasks you entered in PackOps—not imagined Scoutbook information.',btn('Copy working brief','copy-brief','btn'))}
 <div class="stats"><div class="stat"><div><strong>${s.overdue.length}</strong><span>Overdue</span></div></div><div class="stat"><div><strong>${s.unassigned.length}</strong><span>Need owners</span></div></div><div class="stat"><div><strong>${s.dueSoon.length}</strong><span>Due within seven days</span></div></div></div>
 <div class="split"><section class="panel"><div class="row-between"><h2>What needs attention?</h2><span class="pill">${issue.length} priorities</span></div>${issue.length?issue.map(t=>`<div class="list-item"><div class="row-between"><strong>${esc(t.title)}</strong><span class="pill ${s.overdue.includes(t)?'danger':'warning'}">${s.overdue.includes(t)?'Overdue':!t.owner?'Unassigned':'Coming due'}</span></div><div class="meta">${esc(t.owner||'No owner')} · ${t.due?niceDate(t.due):'No due date'} · ${esc(eventLabel(t.eventId))}</div></div>`).join(''):empty('✨','Nothing urgent recorded','Add tasks and deadlines, and this briefing will start surfacing priorities.')}</section>
 <section class="panel stack"><h2>Working briefing</h2><p>Generated from this device's locally saved events and assignments. Official Scoutbook and shared Google Sheets are not being scanned automatically.</p><pre class="code-example" style="max-height:420px;overflow:auto">${esc(brief(dbState.tasks,dbState.events))}</pre>${btn('Copy briefing text','copy-brief','btn btn-full')}${link(LINKS.operations,'Check official ownership plan','btn btn-outline btn-full')}</section></div>`;
}
function library(){
 const fixed=[['🗓️','Current Pack calendar',LINKS.calendar,'Updated master calendar PDF'],['📁','Leadership Drive',LINKS.packDrive,'Pack documents and folders'],['📊','Treasurer ledger',LINKS.ledger,'Official financial records'],['🧾','Receipts (2026–27)',LINKS.receipts2026,'Current financial uploads'],['📋','Operations & Ownership Plan',LINKS.operations,'Pack work and accountability'],['🏕️','Event Tracker',LINKS.eventTracker,'Existing planning tracker'],['⚜️','Scoutbook Plus',LINKS.scoutbook,'Official Pack management'],['🚩','Flag Ceremony Reference',LINKS.flagGuide,'Scouting America resource']];
 const all=[...fixed.map(x=>({label:x[1],url:x[2],description:x[3],emoji:x[0],fixed:true})),...dbState.bookmarks.map(x=>({...x,emoji:'🔖'}))];
 return `${intro('Find it without hunting','Pack Library','Your Pack Drive and common resources, grouped behind one useful shortcut.',btn('+ Add shortcut','show-bookmark','btn'))}
 ${ui.form==='bookmark'?`<section class="panel"><h2>Add a personal resource shortcut</h2><form data-form="bookmark" class="stack"><div class="form-grid">${field('Name','label','text','','required')}${field('Web address','url','url','','required')}${field('Description','description')}</div><button class="btn" type="submit">Save shortcut</button></form></section>`:''}
 <div class="library-grid">${all.map(item=>`<div class="link-tile"><span class="link-icon">${item.emoji}</span><div style="flex:1;min-width:0"><strong>${esc(item.label)}</strong><small>${esc(item.description||'')}</small><div class="task-options">${link(item.url,'Open','btn btn-small')}${item.fixed?'':btn('Remove','delete-bookmark','btn btn-ghost btn-small',`data-id="${item.id}"`)}</div></div></div>`).join('')}</div>`;
}
function settingsPage(){
 return `${intro('Your device and Drive','Settings','Local privacy controls and optional, user-authorized Google Drive receipt uploads.')}
 <div class="split"><section class="panel stack"><h2>Connect receipt uploading</h2><p>To make direct Google Drive uploads work, create a Google Cloud OAuth web client for your published PackOps site, enable Drive API and Picker API, then supply its client ID and browser API key here. Tokens stay in memory; no credentials are built into the published code.</p>
 <form data-form="google-settings" class="stack">${field('Google OAuth web client ID','googleClientId','text',settings('googleClientId'))}${field('Google Picker API key','googleApiKey','text',settings('googleApiKey'))}<button class="btn" type="submit">Save configuration on this device</button></form>
 <p>Status: <strong>${connected()?'Authorized for this session':'Not connected'}</strong></p>${btn('Sign in to Google','google-sign-in','btn btn-full')}${btn('Choose 2026–27 receipts destination','google-pick-folder','btn btn-outline btn-full')}${settings('googleFolder')?`<p class="setting-kv">Chosen destination: ${esc(settings('googleFolderName'))} (${esc(settings('googleFolder'))})</p>`:''}${btn('Disconnect','google-disconnect','btn btn-ghost btn-full')}
 <div class="privacy-strip">You must explicitly authorize the app and select the proper destination folder. The Drive API only uploads receipts when you click Upload. There is no background access to roster files or finances.</div></section>
 <section class="panel stack"><h2>Data & privacy</h2><p>This first version saves event plans, roster copies, budgets, volunteer tasks, and receipts in this browser's IndexedDB. Clearing browser storage removes local data. Different devices do not yet synchronize these records.</p><p>Never import private youth records onto shared or public devices. This version has no server-based role permissions.</p>${btn('Clear all local working data','clear-local','btn btn-danger btn-full')}${link(LINKS.packDrive,'Open authorized Pack Drive','btn btn-outline btn-full')}</section></div>`;
}

function askDelete(message){return window.confirm(message)}
async function handleAction(action,trigger){
 const id=trigger.dataset.id;
 switch(action){
  case 'goto-settings':route('settings');return;
  case 'goto-assistant':route('assistant');return;
  case 'show-budget':ui.form='budget';render();return;
  case 'show-task':ui.form='task';ui.editTask='';render();return;
  case 'show-event-task':ui.form='task';ui.editTask='';render();return;
  case 'show-event':ui.form='event';render();return;
  case 'show-equipment':ui.form='equipment';render();return;
  case 'show-bookmark':ui.form='bookmark';render();return;
  case 'cancel-form':ui.form='';ui.editTask='';render();return;
  case 'open-event':route('events',id);return;
  case 'back-events':route('events');return;
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
  case 'copy-brief':await navigator.clipboard.writeText(brief(dbState.tasks,dbState.events));notify('Working briefing copied');return;
  case 'clear-roster':if(askDelete('Remove the entire imported roster from this browser?')){for(const r of dbState.roster)await remove('roster',r.id);ui.rosterPreview=null;await refresh()}return;
  case 'commit-roster':if(!ui.rosterPreview)return; if(!askDelete(`Replace the local roster with ${ui.rosterPreview.records.length} entries? Flagged records will remain flagged for review.`))return;for(const r of dbState.roster)await remove('roster',r.id);for(const r of ui.rosterPreview.records)await put('roster',r);ui.rosterPreview=null;await refresh();notify('Local roster imported; official Scoutbook roster unchanged');return;
  case 'open-attachment':{const r=dbState.attachments.find(r=>r.id===id);if(r?.blob)openBlob(r.blob);return;}
  case 'open-receipt':{const r=dbState.receipts.find(r=>r.id===id);if(r?.blob)openBlob(r.blob);return;}
  case 'delete-receipt':if(askDelete('Remove this receipt from the LOCAL queue? Any uploaded Drive file will remain in Google Drive.')){await remove('receipts',id);await refresh()}return;
  case 'upload-receipt':{
   const r=dbState.receipts.find(r=>r.id===id);if(!r)return;
   const folder=settings('googleFolder'),client=settings('googleClientId');
   if(!folder||!client){notify('Configure Google Drive and choose the receipts folder first',true);route('settings');return;}
   trigger.disabled=true;trigger.textContent='Uploading…';
   try{const uploaded=await uploadReceipt(r,folder,client);await put('receipts',{...r,state:'uploaded',driveFileId:uploaded.id,error:'',uploadedAt:now()});await refresh();notify('Receipt uploaded to Google Drive');}
   catch(error){await put('receipts',{...r,state:'error',error:String(error.message||error)});await refresh();notify('Upload failed: '+error.message,true)}return;
  }
  case 'google-sign-in':try{await authorize(settings('googleClientId'));notify('Google authorized for this session');render()}catch(e){notify(String(e.message),true)}return;
  case 'google-pick-folder':try{const folder=await selectFolder(settings('googleApiKey'),settings('googleClientId'));await writeSetting('googleFolder',folder.id);await writeSetting('googleFolderName',folder.name);await refresh();notify('Destination folder selected');}catch(e){notify(String(e.message),true)}return;
  case 'google-disconnect':disconnect();render();notify('Google token cleared from this session');return;
  case 'clear-local':if(askDelete('Permanently clear all LOCAL PackOps records on this device, including roster and queued receipts? This will not delete Google Drive files.')){await clearEverything();dbState.events=[];dbState.roster=[];ui.rosterPreview=null;await refresh();notify('All local PackOps records cleared')}return;
 }
}
function openBlob(blob){const url=URL.createObjectURL(blob);const opened=window.open(url,'_blank','noopener');if(!opened){const a=document.createElement('a');a.href=url;a.download='packops-file';a.click()}setTimeout(()=>URL.revokeObjectURL(url),60_000)}
async function handleForm(form){
 const kind=form.dataset.form;const f=k=>formData(form,k);
 switch(kind){
  case 'budget':await put('budget',{id:makeId(),category:f('category'),planned:Number(f('planned')),actual:Number(f('actual')),note:f('note')});break;
  case 'task':{
   const old=dbState.tasks.find(t=>t.id===form.dataset.editId);
   await put('tasks',{id:old?.id||makeId(),title:f('title'),kind:f('kind'),owner:f('owner'),email:f('email'),due:f('due'),priority:f('priority'),eventId:f('eventId'),status:f('status'),details:f('details'),createdAt:old?.createdAt||now(),updatedAt:now()});break;
  }
  case 'event':{
   const e={id:makeId(),title:f('title'),date:f('date'),location:f('location'),owner:f('owner'),notes:f('notes'),links:f('links'),createdAt:now()};
   await put('events',e);ui.form='';await refresh();route('events',e.id);notify('Event workspace saved on this device');return;
  }
  case 'event-notes':{const old=findEvent(form.dataset.id);if(old)await put('events',{...old,notes:f('notes'),links:f('links'),updatedAt:now()});break;}
  case 'attachment':{
   const file=form.elements.file.files?.[0];if(!file)throw Error('Choose an attachment');if(file.size>15*1024*1024)throw Error('Attachments are limited to 15 MB in this version.');
   await put('attachments',{id:makeId(),eventId:form.dataset.id,fileName:file.name,mimeType:file.type,blob:file,createdAt:now()});break;
  }
  case 'receipt':{
   const file=form.elements.file.files?.[0];if(!file)throw Error('Choose a receipt');if(file.size>15*1024*1024)throw Error('Receipts are limited to 15 MB');
   await put('receipts',{id:makeId(),fileName:file.name,mimeType:file.type,blob:file,createdAt:now(),vendor:f('vendor'),amount:f('amount')===''?null:Number(f('amount')),eventId:f('eventId'),note:f('note'),state:'local'});break;
  }
  case 'meeting':for(const s of MEETING)await writeSetting('meeting:'+s.id,f('section:'+s.id));ui.editMeeting=false;break;
  case 'equipment':await put('equipment',{id:makeId(),name:f('name'),location:f('location'),holder:f('holder'),condition:f('condition'),notes:f('notes')});break;
  case 'bookmark':if(!safeUrl(f('url')))throw Error('Enter a valid HTTP(S) link');await put('bookmarks',{id:makeId(),label:f('label'),url:f('url'),description:f('description')});break;
  case 'google-settings':await writeSetting('googleClientId',f('googleClientId'));await writeSetting('googleApiKey',f('googleApiKey'));notify('Google configuration saved locally');break;
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
 const target=event.target;if(target.dataset.change==='task-status'){
  const task=dbState.tasks.find(t=>t.id===target.dataset.id);if(task){await put('tasks',{...task,status:target.value,updatedAt:now()});await refresh()}
 }
});
root.addEventListener('input',event=>{
 if(event.target.name==='roster-search'){
  const text=event.target.value,index=event.target.selectionStart;ui.rosterFilter=text;render();
  const el=root.querySelector('[name="roster-search"]');if(el){el.focus();el.setSelectionRange(index,index)}
 }
});
window.addEventListener('hashchange',restoreRoute);
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
refresh().then(restoreRoute).catch(err=>{
 console.error('PackOps initialization error:',err);
 root.innerHTML='<main style="padding:30px;max-width:680px;margin:auto"><h1>PackOps could not open local storage</h1><p>Try a normal browser window (not private browsing) and make sure site storage is allowed. No files were changed.</p></main>';
});
