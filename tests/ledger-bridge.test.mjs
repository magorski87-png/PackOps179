import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHmac} from 'node:crypto';
import vm from 'node:vm';
import {parseLedgerCsv,ledgerImportReview} from '../finance.js';

const source=readFileSync(new URL('../integrations/ledger-bridge.gs',import.meta.url),'utf8');
const secret='a'.repeat(40),packId='bcf48631-8f33-4c66-b1ca-1573c769fd1b';
const columns=['Item','Date','cost deleted','deposit added','Account Balance Remaining','Receipt image uploaded','PackOps ID'];
const id='27ebd93d-39bf-4d22-9b3a-dc7be1d4d6ba';

function harness(){
 const cells=[columns,['Opening balance',new Date('2026-10-01T12:00:00Z'),'','',100,'',''],['Manual expense',new Date('2026-10-02T12:00:00Z'),25,'','','',''],['Manual deposit',new Date('2026-10-03T12:00:00Z'),'',10,'','','']];
 const sheet={
  getParent(){return {getSpreadsheetTimeZone:()=> 'UTC'}},
  getLastRow(){return cells.length},getMaxRows(){return 1000},insertRowsAfter(){},
  getRange(row,col,height=1,width=1){
   return {
    getDisplayValues(){return Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>String(cells[row+i-1]?.[col+j-1]??'')))},
    getValues(){return Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>sheet.getRange(row+i,col+j).getValue()??''))},
    getValue(){const v=cells[row-1]?.[col-1];if(typeof v==='string'&&v.startsWith('=E')){
     const match=/^=E(\d+)-SUM\(C(\d+):C(\d+)\)\+SUM\(D\d+:D\d+\)$/.exec(v);
     assert.ok(match);let sum=cells[Number(match[1])-1][4];
     for(let n=Number(match[2]);n<=Number(match[3]);n++)sum-=Number(cells[n-1][2]||0)-Number(cells[n-1][3]||0);
     return sum;
    }return v},
    setValues(values){for(let i=0;i<values.length;i++)cells[row+i-1]=values[i];return this},
    copyTo(){return this}
   };
  }
 };
 const context={Date,JSON,String,Number,Math,Error,isFinite,
  PropertiesService:{getScriptProperties:()=>({getProperty:key=>({PACK_ID:packId,BRIDGE_SECRET:secret,LEDGER_TARGETS_JSON:JSON.stringify({'2026-27':{spreadsheetId:'native-sheet',sheetName:'Sheet1',headerRow:1}})}[key])})},
  Utilities:{computeHmacSha256Signature:(m,s)=>[...createHmac('sha256',s).update(m).digest()].map(x=>x>127?x-256:x),formatDate:d=>d.toISOString().slice(0,10)},
  SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),CopyPasteType:{PASTE_FORMAT:1},flush(){}},
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
  ContentService:{MimeType:{JSON:1},createTextOutput:s=>({setMimeType:()=>({getContent:()=>s})})}
 };
 vm.runInNewContext(source,context);
 const call=(action,transaction)=>{const message=JSON.stringify({timestamp:Date.now(),payload:{packId,year:'2026-27',action,transaction}});
  return JSON.parse(context.doPost({postData:{contents:JSON.stringify({message,signature:createHmac('sha256',secret).update(message).digest('hex')})}}).getContent());
 };
 return {cells,call};
}

test('posts to the verified A:G layout and bridges missing historical balances',()=>{
 const {cells,call}=harness(),transaction={id,description:'Event supplies',date:'2026-10-04',debit:8,credit:0,receipt:''};
 const first=call('post',transaction);
 assert.equal(first.ok,true);assert.equal(first.row,5);assert.equal(first.balance,77);
 assert.equal(cells[4][0],'Event supplies');
 assert.equal(cells[4][4],'=E2-SUM(C3:C5)+SUM(D3:D5)');
 assert.equal(cells[4][6],id);
 assert.equal(cells[3][4],'');
 const again=call('post',transaction);
 assert.equal(again.ok,true);assert.equal(again.alreadyPosted,true);assert.equal(cells.length,5);
 assert.match(call('post',{...transaction,description:'Changed'}).error,/edited/);
 const snapshot=call('snapshot');
 const csv=snapshot.values.map(row=>row.map(value=>'"'+String(value??'').replaceAll('"','""')+'"').join(',')).join('\n');
 const parsed=parseLedgerCsv(csv);
 assert.equal(parsed.at(-1).id,'packops:'+id);
 assert.deepEqual(ledgerImportReview(parsed).balanceWarnings,[]);
});

test('refuses a changed header and a nonnumeric intervening money cell',()=>{
 const {cells,call}=harness(),transaction={id,description:'Event supplies',date:'2026-10-04',debit:8,credit:0};
 cells[0][0]='Number';assert.match(call('post',transaction).error,/columns changed/);
 cells[0][0]='Item';cells[2][2]='pending';assert.match(call('post',transaction).error,/money columns need review/);
 assert.equal(cells.length,4);
});
