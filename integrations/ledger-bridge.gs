/** Pack-controlled Apps Script. Install on a REVIEWED NATIVE Google Sheet, never an .xlsx.
 * Script properties: PACK_ID, BRIDGE_SECRET (>=32 chars), LEDGER_TARGETS_JSON.
 * Targets: {"2026-27":{"spreadsheetId":"...","sheetName":"...","headerRow":1}}
 * Column G has header "PackOps ID". Existing columns A:F are unchanged.
 * Web app executes as the Pack account. The URL is server-only; HMAC authenticates callers.
 */
function doPost(e){
 try{
  var properties=PropertiesService.getScriptProperties(),secret=properties.getProperty('BRIDGE_SECRET');
  if(!secret||secret.length<32)throw Error('Bridge secret is not configured');
  if(!e.postData||e.postData.contents.length>20000)throw Error('Invalid request');
  var envelope=JSON.parse(e.postData.contents),message=String(envelope.message||'');
  var expected=Utilities.computeHmacSha256Signature(message,secret).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2)}).join('');
  var actual=String(envelope.signature||''),different=expected.length^actual.length;
  for(var i=0;i<expected.length;i++)different|=expected.charCodeAt(i)^(actual.charCodeAt(i)||0);
  if(different)throw Error('Invalid signature');
  var decoded=JSON.parse(message),payload=decoded.payload;
  if(Math.abs(Date.now()-Number(decoded.timestamp))>120000)throw Error('Expired request');
  if(payload.packId!==properties.getProperty('PACK_ID'))throw Error('Wrong Pack');
  var target=JSON.parse(properties.getProperty('LEDGER_TARGETS_JSON')||'{}')[payload.year];
  if(!target)throw Error('No reviewed ledger target for this Scout year');
  var sheet=SpreadsheetApp.openById(target.spreadsheetId).getSheetByName(target.sheetName);
  if(!sheet)throw Error('Ledger tab not found');
  var header=Number(target.headerRow||1),head=sheet.getRange(header,1,1,7).getDisplayValues()[0];
  var required=['item','date','cost deleted','deposit added','account balance remaining','receipt image uploaded','packops id'];
  for(var c=0;c<7;c++)if(String(head[c]).trim().toLowerCase()!==required[c])throw Error('Ledger columns changed. Review mapping before posting.');
  if(sheet.getLastRow()-header>10000)throw Error('Ledger exceeds supported 10,000 rows');
  var lock=LockService.getScriptLock();if(!lock.tryLock(25000))throw Error('Ledger is busy. Retry the same request.');
  try{
   var count=Math.max(0,sheet.getLastRow()-header),rows=count?sheet.getRange(header+1,1,count,7).getValues():[];
   if(payload.action==='snapshot'){
    return ledgerResponse_({ok:true,values:[head].concat(rows.map(function(row){return row.map(function(value){return value instanceof Date?Utilities.formatDate(value,sheet.getParent().getSpreadsheetTimeZone(),'yyyy-MM-dd'):value})}))});
   }
   if(payload.action!=='post')throw Error('Unknown action');
   var t=payload.transaction;
   if(!t||! /^[0-9a-f-]{36}$/i.test(t.id)||!t.description||t.description.length>240||!/^\d{4}-\d{2}-\d{2}$/.test(t.date))throw Error('Invalid transaction fields');
   var debit=Number(t.debit),credit=Number(t.credit);
   if(!isFinite(debit)||!isFinite(credit)||debit<0||credit<0||Math.max(debit,credit)>1000000000||((debit>0)===(credit>0)))throw Error('Enter exactly one money-in or money-out amount');
   if(t.receipt&&!/^https:\/\/(drive|docs)\.google\.com\//.test(t.receipt))throw Error('Receipt must be a Google Drive link');
   var duplicate=-1;
   for(var n=0;n<rows.length;n++)if(String(rows[n][6])===t.id){if(duplicate!==-1)throw Error('Duplicate PackOps IDs exist in the ledger');duplicate=n;}
   if(duplicate!==-1){
    var prior=rows[duplicate],priorDate=prior[1] instanceof Date?Utilities.formatDate(prior[1],sheet.getParent().getSpreadsheetTimeZone(),'yyyy-MM-dd'):String(prior[1]);
    if(String(prior[0])!==String(t.description)||priorDate!==t.date||Number(prior[2]||0)!==debit||Number(prior[3]||0)!==credit||String(prior[5]||'')!==String(t.receipt||''))throw Error('This posted row was edited. Refresh/reconcile it; do not submit a duplicate.');
    if(typeof prior[4]!=='number'||!isFinite(prior[4]))throw Error('Ledger balance needs review');
    return ledgerResponse_({ok:true,id:t.id,row:header+1+duplicate,balance:prior[4],alreadyPosted:true});
   }
   var last=-1;for(var j=0;j<rows.length;j++)if(String(rows[j][0]).trim())last=j;
   var anchor=-1;for(var a=last;a>=0;a--)if(typeof rows[a][4]==='number'&&isFinite(rows[a][4])){anchor=a;break}
   if(last<0||anchor<0)throw Error('Ledger needs a valid starting/running balance');
   var next=last+1,rowNumber=header+1+next,existing=rows[next];
   if(existing&&existing.some(function(value){return String(value||'').trim()!==''}))throw Error('The next ledger row contains data. Review it before posting.');
   for(var k=anchor+1;k<=last;k++)for(var m=2;m<=3;m++)if(rows[k][m]!==''&&rows[k][m]!==null&&(typeof rows[k][m]!=='number'||!isFinite(rows[k][m])))throw Error('Ledger money columns need review before calculating balance');
   // Write exactly one row; keep all historical rows and subsequent formulas intact.
   if(rowNumber>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),1);
   sheet.getRange(rowNumber-1,1,1,7).copyTo(sheet.getRange(rowNumber,1,1,7),SpreadsheetApp.CopyPasteType.PASTE_FORMAT,false);
   var safeText=function(s){s=String(s||'');return /^[=+@\-\t\r]/.test(s)?"'"+s:s};
   var anchorRow=header+1+anchor;
   sheet.getRange(rowNumber,1,1,7).setValues([[safeText(t.description),new Date(t.date+'T12:00:00Z'),debit||'',credit||'','=E'+anchorRow+'-SUM(C'+(anchorRow+1)+':C'+rowNumber+')+SUM(D'+(anchorRow+1)+':D'+rowNumber+')',t.receipt||'',t.id]]);
   SpreadsheetApp.flush();
   var balance=sheet.getRange(rowNumber,5).getValue();
   if(typeof balance!=='number'||!isFinite(balance))throw Error('Row written but balance needs review. Retry this same transaction ID after correcting the formula.');
   return ledgerResponse_({ok:true,id:t.id,row:rowNumber,balance:balance});
  }finally{lock.releaseLock()}
 }catch(error){return ledgerResponse_({ok:false,error:String(error.message||error)})}
}
function ledgerResponse_(body){return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON)}
