import {mkdir,copyFile,rm} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const out=path.join(root,'dist');
const files=["index.html","styles.css","app.js","data.js","db.js","drive.js","roster-import.js","calendar-api.js","calendar-import.js","finance.js","finance-ui.js","finance-google.js","finance-template.js","pack-config.js","backup.js","sw.js","manifest.webmanifest","icon.svg","icon-192.png","icon-512.png"];
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
for(const file of files)await copyFile(path.join(root,file),path.join(out,file));
console.log(`PackOps built: ${files.length} static files → dist/`);
