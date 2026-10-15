const CACHE='packops-shell-v18';
const ROOT=self.registration.scope;
const FILES=['','index.html','styles.css','app.js','db.js','data.js','drive.js','roster-import.js','calendar-api.js','calendar-import.js','finance.js','finance-ui.js','finance-google.js','finance-template.js','pack-config.js','backup.js','settings-actions.js','event-sync.js','budget-wizard.js','budget-wizard-ui.js','finance-insights.js','google-config.js','equipment-utils.js','roster-sync.js','finance-editing.js','family-invitations.js','attachments.js','transaction-workflow.js','transaction-ui.js','cloud-config.js','cloud-config-validation.js','cloud.js','cloud-panel.js','family-ui.js','workspace-v06-ui.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(x=>new URL(x,ROOT).href))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==location.origin)return;
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request).then(res=>{
      if(res.ok){const cloned=res.clone();caches.open(CACHE).then(cache=>cache.put(ROOT,cloned));}
      return res;
    }).catch(()=>caches.match(ROOT)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(res=>{
    if(res.ok){const copy=res.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
    return res;
  })));
});
