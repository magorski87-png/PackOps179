import test from 'node:test';
import assert from 'node:assert/strict';
import {financeInsights,forecastSensitivity} from '../finance-insights.js';
import {googleSheetIdFromUrl,officialFileUrl} from '../pack-config.js';
import {parseScoutCreditsCsv,financialSnapshot} from '../finance.js';
test('Forecast stress scenario respects income and expense uncertainty',()=>{
 const value=forecastSensitivity({startingCash:6000,expectedIncome:1000,expectedExpenses:2000,reserve:500,restricted:300});
 assert.equal(value.baseline,4200);
 assert.equal(value.downside,3800);
 assert.equal(forecastSensitivity({startingCash:null,expectedIncome:100,expectedExpenses:0}),null);
});
test('Financial insights avoid claiming unclassified transfers are actual expenses',()=>{
 const sum=financialSnapshot({budget:[{type:'expense',category:'Derby',planned:100}],
 ledger:[{id:'a',balance:2000,debit:200,credit:0,description:'storefront cash to credit'}],
 tags:[],reimbursements:[]});
 assert.equal(sum.spent,0);
 assert.equal(sum.unclassified,1);
 const notices=financeInsights({snapshot:sum,year:'2026-27'});
 assert.ok(notices.some(x=>x.title.includes('classification')));
});
test('Future Scout credits can be parsed with renamed year headers',()=>{
 const csv='First Name,Last Name,Den,2026-27 carryover,2027-28 popcorn earnings,positive credit or dues owed\nA,Example,Wolf,140,20,35';
 const parsed=parseScoutCreditsCsv(csv,125);
 assert.equal(parsed.scouts[0].carryover,140);
 assert.equal(parsed.scouts[0].earnings,20);
 assert.equal(parsed.scouts[0].needsReview,false);
});
test('Official sources accept only Google Sheets and Google Drive',()=>{
 const valid='https://docs.google.com/spreadsheets/d/1ttivHLcq0bopzuKJrlUM1farkG287dM1Krts3Q-NZYQ/edit';
 assert.equal(googleSheetIdFromUrl(valid),'1ttivHLcq0bopzuKJrlUM1farkG287dM1Krts3Q-NZYQ');
 assert.equal(officialFileUrl(valid),valid);
 assert.throws(()=>officialFileUrl('https://evil.example/data'),/Google/);
 assert.throws(()=>googleSheetIdFromUrl('https://drive.google.com/file/d/abc'),/Google Sheets/);
});
