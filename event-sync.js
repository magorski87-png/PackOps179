// PackOps calendar-to-workspace bridge. Pure operations for safe, repeatable imports.
// Google Calendar stays the schedule authority; notes/checklists/attachments remain local.
export function linkedWorkspaceId(event){
 if(!event || typeof event.id!=='string' || !event.id.startsWith('google:'))throw Error('Select a Google Calendar event');
 return 'workspace:'+event.id;
}
export function workspaceForCalendarEvent(event,existing=null,time=Date.now()){
 const id=linkedWorkspaceId(event);
 if(!event.date||!event.title)throw Error('The event must have a title and date');
 const base=existing||{id,notes:'',links:'',owner:'',createdAt:time};
 return {...base,id,googleEventId:event.id,calendarId:event.calendarId||'',source:'Google Calendar',
  title:event.title,date:event.date,time:event.time||'',endTime:event.endTime||'',
  location:event.location||'',calendarUrl:event.url||'',description:event.description||'',
  calendarUpdatedAt:time,updatedAt:time};
}
export function matchExistingWorkspace(event,workspaces){
 const id=linkedWorkspaceId(event);
 return workspaces.find(w=>w.id===id || w.googleEventId===event.id) || null;
}
export function workspaceForSync(event,workspaces,time=Date.now()){
 const found=matchExistingWorkspace(event,workspaces);
 return found?workspaceForCalendarEvent(event,found,time):null;
}
export function calendarWorkspaceSummary(events,workspaces){
 const google=events.filter(e=>e.id?.startsWith('google:'));
 return {available:google.length,planned:google.filter(e=>!!matchExistingWorkspace(e,workspaces)).length};
}
