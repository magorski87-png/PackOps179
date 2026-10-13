import test from 'node:test';
import assert from 'node:assert/strict';
import {transactionDraft,combinedLedger} from '../transaction-workflow.js';
import {familyRecipients,invitationPreview} from '../family-invitations.js';
import {prepareAttachment} from '../attachments.js';
import {visibleAccountAdjustments,readWizardExpenses} from '../finance-editing.js';

const base={year:'2026-27',kind:'expense',costDeleted:'12.35',depositAdded:'',description:'  Camp supplies  ',date:'2026-10-13',category:'Campouts',receiptUrl:''};
test('ledger entry uses exactly one money column and stable posting identity',()=>{
 const row=transactionDraft(base);assert.equal(row.amount,12.35);assert.equal(row.direction,'out');assert.equal(row.description,'Camp supplies');
 assert.throws(()=>transactionDraft({...base,depositAdded:'5'}),/either/);
 assert.throws(()=>transactionDraft({...base,kind:'income'}),/money/);
 assert.throws(()=>transactionDraft({...base,kind:'income',costDeleted:'',depositAdded:'4',category:'Popcorn'}),/popcorn/i);
 const request={id:'00000000-0000-4000-8000-000000000001',source_year:'2026-27',status:'posted',kind:'expense',category:'Campouts',event_id:'camp',posted_row:{description:'Camp supplies',debit:12.35,credit:0,balance:87.65,sourceRow:3}};
 const first=combinedLedger([],[],[request]);assert.equal(first.ledger.length,1);assert.equal(first.tags[0].eventId,'camp');
 const fromSheet={...first.ledger[0],source:'Official CSV'};
 const second=combinedLedger([fromSheet],first.tags,[request]);assert.equal(second.ledger.length,1);assert.equal(second.ledger[0].source,'Official CSV');
});
test('family preview groups sibling contacts, displays each guardian and requires confirmation',()=>{
 const roster=[{name:'A Scout',den:'Webelos',guardianContacts:[{name:'Alice',email:'a@example.org'},{name:'Bob',email:'b@example.org'}]},{name:'B Scout',den:'Webelos',guardianContacts:[{name:'Alice',email:'a@example.org'}]},{name:'Other',den:'Wolf',email:'wolf@example.org'}];
 const recipients=familyRecipients(roster,'Webelos');assert.equal(recipients.length,2);assert.deepEqual(recipients.find(r=>r.email==='a@example.org').names,['A Scout','B Scout']);
 const preview=invitationPreview({id:'form',status:'open',title:'Camp RSVP'},recipients,true);assert.equal(preview.recipients.length,2);assert.match(preview.message,/Unique private link/);
 assert.throws(()=>invitationPreview({id:'form',status:'open',title:'Camp RSVP'},[{label:'Missing email',email:''}],true),/valid email/);
});
test('selected mobile document is materialized before the picker context disappears',async()=>{
 const file={name:'route.pdf',type:'application/pdf',size:4,arrayBuffer:async()=>new Uint8Array([1,2,3,4]).buffer};
 const row=await prepareAttachment(file,'event','attachment');assert.equal(row.blob.size,4);assert.equal(row.eventId,'event');
});
test('adjustment and wizard rows preserve the visible selection and edited values',()=>{
 assert.deepEqual(visibleAccountAdjustments([{id:'wolf'}],[{accountId:'wolf'},{accountId:'webelos'}]).map(r=>r.accountId),['wolf']);
 const fakeForm={elements:{namedItem:(name)=>({value:{'category_0':'Camping','detail_0':'Wood','expense_0':'14.50'}[name]})}};
 const rows=readWizardExpenses(fakeForm,[{key:'id',category:'Old',detail:'Old',planned:1}]);assert.equal(rows[0].planned,14.5);assert.equal(rows[0].detail,'Wood');
});
