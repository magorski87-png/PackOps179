// User-initiated Scout-year configuration and secure, encrypted recovery actions.
import {put,writeSetting} from './db.js';
import {validScoutYear,scoutAccountYear,creditDifference} from './pack-config.js';
import {createEncryptedBackup,readEncryptedBackup,restoreBackup} from './backup.js';
import {uploadEncryptedBackup} from './drive.js';
const field=(form,name)=>String(new FormData(form).get(name)||'').trim();
export async function saveYearConfiguration(form,accounts){
 const year=field(form,'year'),raw=field(form,'dues'),dues=Number(raw);
 if(!validScoutYear(year))throw Error('Scout year must look like 2026-27');
 if(raw===''||!Number.isFinite(dues)||dues<0||dues>10000)throw Error('Pack dues must be between 0 and 10000 dollars');
 if(!window.confirm('Save the annual Pack dues for '+year+' as '+dues.toFixed(2)+' dollars? This does NOT update Courtney\'s official credit sheet.'))return false;
 await writeSetting('activeScoutYear',year);
 await writeSetting('financeDues:'+year,String(Math.round(dues*100)/100));
 for(const row of accounts.filter(r=>scoutAccountYear(r)===year)){
  const diff=creditDifference(row,dues);
  await put('financeAccounts',{...row,calculated:Math.round((Number(row.carryover||0)+Number(row.earnings||0)-dues)*100)/100,needsReview:diff!==null&&Math.abs(diff)>0.011});
 }
 return true;
}
export async function exportPackOpsBackup(form,getSetting,sharedSnapshot=null){
 const pass=field(form,'passphrase'),destination=field(form,'destination');
 if(pass.length<12)throw Error('Use a passphrase at least 12 characters long');
 if(!window.confirm('Create an ENCRYPTED backup of the available PackOps records? In shared mode this contains the current authorized cloud snapshot plus locally queued files. Save only in a restricted location.'))return '';
 const backup=await createEncryptedBackup(pass,sharedSnapshot);
 if(destination==='drive'){
  if(!getSetting('googleBackupFolder'))throw Error('Select a restricted Drive backup folder in Settings first');
  const result=await uploadEncryptedBackup(backup,getSetting('googleBackupFolder'),getSetting('googleClientId'));
  return 'Encrypted backup saved to Drive: '+result.name;
 }
 if(destination!=='download')throw Error('Unknown backup destination');
 const url=URL.createObjectURL(backup.blob),a=document.createElement('a');
 a.href=url;a.download=backup.fileName;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);
 return 'Encrypted backup downloaded; keep the file and passphrase safe';
}
export async function restorePackOpsFromFile(form){
 const file=form.elements.backupFile.files?.[0];
 if(!file)throw Error('Choose an encrypted backup file');
 const restored=await readEncryptedBackup(file,field(form,'passphrase'));
 const counts=Object.entries(restored.recordCounts).filter(([,n])=>n>0).map(([k,n])=>k+': '+n).join(', ');
 if(!window.confirm('RESTORE BACKUP from '+(restored.createdAt||'unknown date')+'? This REPLACES ALL local PackOps records on this device (Scout roster, budgets, receipts, events and settings). The official Google Drive files will remain unchanged. Imported records: '+counts+'. Continue?'))return false;
 await restoreBackup(restored);
 return true;
}
