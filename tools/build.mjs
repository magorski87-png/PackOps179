import {mkdir,copyFile,rm,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PACK_CLOUD_CONFIG} from '../cloud-config.js';
import {hasCloudConfig,normalizeCloudConfig} from '../cloud-config-utils.js';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const out=path.join(root,'dist');
const envConfig={projectUrl:process.env.PACKOPS_SUPABASE_URL,publishableKey:process.env.PACKOPS_SUPABASE_PUBLISHABLE_KEY,packId:process.env.PACKOPS_PACK_ID};
const selected=hasCloudConfig(envConfig)?envConfig:PACK_CLOUD_CONFIG;
// Check before touching dist, never print credentials in build errors.
const config=hasCloudConfig(selected)?normalizeCloudConfig(selected):{projectUrl:'',publishableKey:'',packId:''};
if(process.env.PACKOPS_REQUIRE_CLOUD_CONFIG==='true'&&!hasCloudConfig(config))throw Error('Release blocked: supply all three public PACKOPS_* variables.');
const files=["index.html","styles.css","app.js","data.js","db.js","drive.js","roster-import.js","calendar-api.js","calendar-import.js","finance.js","finance-ui.js","finance-google.js","finance-template.js","pack-config.js","backup.js","settings-actions.js","event-sync.js","budget-wizard.js","budget-wizard-ui.js","finance-insights.js","google-config.js","equipment-utils.js","roster-sync.js","cloud-config.js","cloud.js","cloud-panel.js","family-ui.js","workspace-v06-ui.js","sw.js","manifest.webmanifest","icon.svg","icon-192.png","icon-512.png"];
files.push('cloud-config-utils.js');
if(path.dirname(out)!==root||path.basename(out)!=='dist')throw Error('Unsafe output directory');
await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});
for(const file of files)await copyFile(path.join(root,file),path.join(out,file));
await writeFile(path.join(out,'cloud-config.js'),'// Generated public configuration. No secrets.\nexport const PACK_CLOUD_CONFIG='+JSON.stringify(config)+';\n');
// Config-only and code changes must both invalidate the installed PWA shell.
const hash=createHash('sha256');
for(const file of files)if(file!=='sw.js')hash.update(await readFile(path.join(out,file)));
const worker=await readFile(path.join(out,'sw.js'),'utf8');
await writeFile(path.join(out,'sw.js'),worker.replace(/const CACHE='[^']+';/,"const CACHE='packops-shell-"+hash.digest('hex').slice(0,16)+"';"));
console.log(`PackOps built: ${files.length} static files → dist/`);
