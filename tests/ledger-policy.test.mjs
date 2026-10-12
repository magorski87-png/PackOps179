import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLedgerCsv,financialSnapshot,ledgerImportReview,suggestLedgerIncome} from '../finance.js';
import {wizardPreview,wizardBudgetLines,wizardSeedExpenses} from '../budget-wizard.js';

const sample=[
 'Item,Date,Cost Deleted,Deposit Added,Account Balance Remaining',
 'Opening Balance,2026-09-01,0,0,1000',
 'Pack annual dues,2026-09-02,0,105,1105',
 'VFW donation support,2026-09-03,0,50,1155',
 'Internal transfer,2026-09-04,0,75,1230',
 'Advancement purchases,2026-09-05,30,0,1200'
].join('\n');

test('ledger CSV imports opening balance and exposes money movements, but does not invent income',()=>{
 const rows=parseLedgerCsv(sample),review=ledgerImportReview(rows);
 assert.equal(rows.length,5);
 assert.equal(review.opening,1000);
 assert.equal(review.lastBalance,1200);
 assert.equal(review.deposits,230);
 assert.equal(review.withdrawals,30);
 assert.deepEqual(review.balanceWarnings,[]);
 const s=financialSnapshot({ledger:rows,tags:[],budget:[]});
 assert.equal(s.lastBalance,1200);
 assert.equal(s.cashDeposits,230);
 assert.equal(s.cashWithdrawals,30);
 assert.equal(s.received,0);
 assert.equal(s.unclassified,4);
});
test('reviewed dues and VFW donations count; transfer and popcorn deposit do not',()=>{
 const rows=parseLedgerCsv(sample);
 assert.equal(suggestLedgerIncome(rows[1]),'Pack Dues');
 assert.equal(suggestLedgerIncome(rows[2]),'VFW / Community Donations');
 assert.equal(suggestLedgerIncome(rows[3]),null);
 assert.equal(suggestLedgerIncome({...rows[1],description:'Scout popcorn credit'}),null);
 assert.equal(suggestLedgerIncome({...rows[2],debit:50,credit:0}),null);
 const tags=[{id:rows[1].id,kind:'income',category:'Pack Dues'},{id:rows[2].id,kind:'income',category:'VFW / Community Donations'}];
 assert.equal(financialSnapshot({ledger:rows,tags}).received,155);
});
test('legacy popcorn-budget income is excluded without deleting source records',()=>{
 const budget=[{type:'income',category:'Pack Dues',planned:4305},{type:'income',category:'Popcorn Fundraising',planned:3000},{type:'income',category:'Donations',planned:0}];
 const s=financialSnapshot({budget,ledger:[]});
 assert.equal(s.plannedIncome,4305);
 assert.equal(s.obsoletePopcornIncome,3000);
 assert.equal(budget[1].planned,3000);
});
test('wizard permits optional donation planning and never synthesizes Pack popcorn revenue',()=>{
 const settings={year:'2026-27',scouts:41,adults:10,dues:105,donations:200};
 const rows=wizardBudgetLines(settings,wizardSeedExpenses({source:'template',scouts:41,adults:10}));
 assert.equal(rows.find(x=>x.category==='Pack Dues')?.planned,4305);
 assert.equal(rows.find(x=>x.category==='Donations')?.planned,200);
 assert.equal(rows.some(x=>x.category==='Popcorn Fundraising'),false);
 assert.equal(wizardPreview(settings,rows.filter(x=>x.type==='expense')).income,4505);
});
test('ledger import review flags inconsistent running balances',()=>{
 const rows=parseLedgerCsv(sample);
 rows[3].balance+=10;
 assert.ok(ledgerImportReview(rows).balanceWarnings.length>0);
});
