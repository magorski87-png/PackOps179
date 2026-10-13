// Manual iCalendar imports are optional snapshots and are not live subscriptions.
function unescapeText(s){return String(s||'').replace(/\\n/gi,' ').replace(/\\,/g,',').replace(/\\;/g,';').replace(/\\\\/g,'\\')}
export function parseIcs(text){
 const lines=String(text||'').replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').reduce((acc,line)=>{
  if(/^\s/.test(line) && acc.length)acc[acc.length-1]+=line.slice(1);else acc.push(line);return acc;
 },[]);
 const result=[];let current=null;
 for(const line of lines){
  if(line==='BEGIN:VEVENT'){current={};continue}
  if(line==='END:VEVENT'){
   if(current?.date&&current.title)result.push({id:'ics:'+String(current.uid||current.title).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,90)+':'+current.date,...current,source:'iCalendar import'});
   current=null;continue;
  }
  if(!current)continue;
  const idx=line.indexOf(':');if(idx<0)continue;
  const field=line.slice(0,idx).split(';')[0].toUpperCase(),value=line.slice(idx+1);
  if(field==='SUMMARY')current.title=unescapeText(value);
  if(field==='UID')current.uid=value;
  if(field==='LOCATION')current.location=unescapeText(value);
  if(field==='URL' && /^https?:\/\//i.test(value))current.url=value;
  if(field==='DTSTART'){
   if(!/^\d{8}/.test(value))continue;
   current.date=value.slice(0,4)+'-'+value.slice(4,6)+'-'+value.slice(6,8);
   current.time=/T(\d{2})(\d{2})/.test(value)?`${value.slice(9,11)}:${value.slice(11,13)}`:'';
  }
 }
 if(!result.length)throw Error('No events found. Choose a valid .ics calendar export.');
 return result;
}
export function uniqueUpcoming(rows,today){
 const map=new Map(),weight={'Google Calendar':3,'iCalendar import':2,'PackOps workspace':1};
 for(const row of rows){
  if(!row.date||row.date<today||!row.title)continue;
  const key=row.date+'|'+row.title.toLowerCase().replace(/[^a-z0-9]+/g,'');
  if(!map.has(key)||(weight[row.source]||0)>(weight[map.get(key).source]||0))map.set(key,row);
 }
 return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date)||String(a.time||'').localeCompare(String(b.time||''))||a.title.localeCompare(b.title));
}
