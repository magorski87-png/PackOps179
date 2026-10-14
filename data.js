export const LINKS={
  packDrive:'https://drive.google.com/drive/folders/1hNLn6KzWZFjm8HyQCo4pemaIym2qv5au',
  calendar:'https://drive.google.com/file/d/1uPTj-jJEHR64LKteZbUFz3gyinsis-Vj/view',
  calendarFolder:'https://drive.google.com/drive/folders/1zAXz3nJUUZFuJsdaSeWfZFM0RTtNHEP0',
  ledger:'https://docs.google.com/spreadsheets/d/1d9_8y2fWBwj4wOXIZcsWsFQXYRoGj3ShOJgPwWL3C00/edit',
  scoutCredits:'https://docs.google.com/spreadsheets/d/1ttivHLcq0bopzuKJrlUM1farkG287dM1Krts3Q-NZYQ/edit',
  receiptRoot:'https://drive.google.com/drive/folders/1fiuNxciwTNglne95DN7tVkil5SjHIXuF',
  receipts2026:'https://drive.google.com/drive/folders/1aBYw8oA0I3fv7dhOO_yVDikjFBx7Uhml',
  operations:'https://docs.google.com/spreadsheets/d/1Ca5fkhF_QxkUW8OOHkBuwEMvDQtet7Nt2wR0Uqyju9c/edit',
  eventTracker:'https://docs.google.com/spreadsheets/d/1KMol03mCe6s-BP7GQOTL2Q5BEwB5rpYVmPw8KFafxeg/edit',
  scoutbook:'https://advancements.scouting.org/',
  flagGuide:'https://www.scouting.org/cub-scout-presentations/traditional-opening-closing-flag-ceremony/',
  googleCloud:'https://console.cloud.google.com/',
};
export const DEN_NAMES=['Lion','Tiger','Wolf','Bear','Webelos','Arrow of Light'];
export const MENU=[
  {id:'calendar',label:'Pack Calendar',sub:'Always one tap away',emoji:'🗓️',tone:'sage'},
  {id:'budget',label:'Pack Finance',sub:'Budget, accounts & reports',emoji:'📊',tone:'gold'},
  {id:'receipts',label:'Upload Receipt',sub:'Camera → Pack Drive',emoji:'🧾',tone:'peach'},
  {id:'meeting',label:'Pack Meeting',sub:'Your live cue sheet',emoji:'🚩',tone:'sky'},
  {id:'volunteers',label:'Volunteers',sub:'Jobs & responsibilities',emoji:'🤝',tone:'lilac'},
  {id:'events',label:'Event Status',sub:'Notes, tasks & files',emoji:'✅',tone:'mint'},
  {id:'roster',label:'Pack Roster',sub:'Authorized contacts',emoji:'📒',tone:'blue'},
  {id:'equipment',label:'Equipment',sub:'Where everything lives',emoji:'🎒',tone:'amber'},
  {id:'den',label:'Den Leader',sub:'Meetings & adventures',emoji:'🧭',tone:'sky'},
  {id:'families',label:'Family RSVPs',sub:'Polls & signups',emoji:'📨',tone:'gold'},
  {id:'assistant',label:'Cubmaster Assistant',sub:'What needs attention?',emoji:'✨',tone:'violet'},
  {id:'library',label:'Pack Library',sub:'Shortcuts & resources',emoji:'📁',tone:'green'},
];
export const MEETING=[
{id:'gather',name:'Gathering & welcome',cue:'Welcome families. Introduce the evening.',full:'Gather Scouts and families. Welcome new families and visitors. Give one or two sentences about the evening. Ask the color guard to prepare.'},
{id:'flags-open',name:'Opening flag ceremony',cue:'Color guard: attention → advance → post colors.',full:'Invite everyone to stand. Example commands: “Color guard, attention.” “Color guard, advance.” “Color guard, halt.” “Color guard, post the colors.” Use your Pack’s chosen ceremony sequence for salutes and indoor or outdoor flags. Refer to the official ceremony guide linked here.'},
{id:'pledge',name:'Pledge, Scout Oath & Law',cue:'Salute for Pledge. Scout sign for Oath & Law.',full:'Lead the Pledge of Allegiance, Scout Oath, and Scout Law. Scout Oath: “On my honor, I will do my best to do my duty to God and my country and to obey the Scout Law; to help other people at all times; to keep myself physically strong, mentally awake, and morally straight.” Scout Law: A Scout is trustworthy, loyal, helpful, friendly, courteous, kind, obedient, cheerful, thrifty, brave, clean, and reverent.'},
{id:'recognition',name:'Recognition & welcome',cue:'Recognize Scouts, ranks, adventures and helpers.',full:'Welcome new Scouts. Recognize confirmed advancement, rank achievements, adventure awards, special efforts, and volunteers as appropriate. Arrange award presenters ahead of time.'},
{id:'activity',name:'Main activity / program',cue:'Introduce activity lead, safety and transitions.',full:'Introduce the activity lead and explain boundaries, safety points, and what each group does first. Keep the transition short and hand off.'},
{id:'announcements',name:'Announcements',cue:'Next event, one ask, important logistics.',full:'Share essential upcoming dates, volunteer needs, and next steps. Direct families to Scoutbook Plus for official events and RSVPs.'},
{id:'minute',name:'Cubmaster minute',cue:'One short reflection. Make it count.',full:'Close with one short, encouraging thought linking the meeting activity to Scouting values, service, friendship, or growth.'},
{id:'flags-close',name:'Closing flag ceremony & dismissal',cue:'Color guard retrieves colors. Thank everyone. Dismiss.',full:'Invite the color guard to retrieve and retire the colors according to the Pack’s flag ceremony. Example commands: “Color guard, attention.” “Color guard, retrieve the colors.” “Color guard, return.” Thank volunteers, dismiss families, and coordinate cleanup.'},
];
export const isoToday=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
export const makeId=()=>crypto.randomUUID();
export const money=n=>Number(n||0).toLocaleString('en-US',{style:'currency',currency:'USD'});
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const safeUrl=u=>{try{const x=new URL(u);return ['https:','http:'].includes(x.protocol)?x.href:null}catch{return null}};
export const niceDate=s=>{if(!s)return 'Date not set';const d=new Date(s+'T12:00:00');return Number.isNaN(d.getTime())?'Date not set':d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})};
export function summary(tasks,today=isoToday()){
 const open=tasks.filter(t=>t.status!=='done');const boundary=new Date(today+'T12:00:00');boundary.setDate(boundary.getDate()+7);
 const end=`${boundary.getFullYear()}-${String(boundary.getMonth()+1).padStart(2,'0')}-${String(boundary.getDate()).padStart(2,'0')}`;
 return {open,overdue:open.filter(t=>t.due&&t.due<today),dueSoon:open.filter(t=>t.due&&t.due>=today&&t.due<=end),unassigned:open.filter(t=>!t.owner?.trim()),high:open.filter(t=>t.priority==='high')};
}
export function completion(tasks){return tasks.length?Math.round(tasks.filter(t=>t.status==='done').length/tasks.length*100):null}
export function csvParse(input){
 const out=[];let row=[],field='',quoted=false;
 for(let i=0;i<input.length;i++){
  const c=input[i];if(c==='"'){if(quoted&&input[i+1]==='"'){field+='"';i++}else quoted=!quoted;}
  else if(c===','&&!quoted){row.push(field);field=''}
  else if((c==='\r'||c==='\n')&&!quoted){if(c==='\r'&&input[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))out.push(row);row=[];field=''}
  else field+=c;
 }
 row.push(field);if(row.some(x=>x.trim()))out.push(row);
 return out;
}
export function brief(tasks,events,today=isoToday()){
 const s=summary(tasks,today);
 const fmt=t=>`• ${t.title} — ${t.owner||'UNASSIGNED'}${t.due?' (due '+t.due+')':''}`;
 const next=events.filter(e=>e.date&&e.date>=today).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5);
 return ['PACK 179 — CUBMASTER WORKING BRIEF','Generated '+today+' • PackOps tasks and currently loaded calendar data',`Open ${s.open.length}  |  Overdue ${s.overdue.length}  |  Unassigned ${s.unassigned.length}`,'','OVERDUE',...(s.overdue.length?s.overdue.map(fmt):['• None recorded']),'','COMING DUE',...(s.dueSoon.length?s.dueSoon.map(fmt):['• None recorded']),'','NEEDS AN OWNER',...(s.unassigned.length?s.unassigned.map(fmt):['• None recorded']),'','UPCOMING EVENTS (loaded data)',...(next.length?next.map(e=>`• ${niceDate(e.date)} — ${e.title}${e.source?' ['+e.source+']':''}`):['• None recorded']),'','Confirm statuses with leaders; Scoutbook Plus remains the official Pack calendar and advancement source.'].join('\n');
}
