import test from 'node:test';
import assert from 'node:assert/strict';
import {simplifyGoogleEvent} from '../calendar-api.js';
import {linkedWorkspaceId,workspaceForCalendarEvent,workspaceForSync,calendarWorkspaceSummary} from '../event-sync.js';
import {wizardSeedExpenses,validateWizardSettings,wizardPreview,wizardBudgetLines} from '../budget-wizard.js';

test('Calendar workspace ID is stable when event title/date change',()=>{
 const calendarId='pack@example.com',g={id:'google:'+calendarId+':abc123',calendarId,title:'Scouting for Food',date:'2026-11-03',url:'https://calendar.google.com/example',location:'Hillside'};
 const w=workspaceForCalendarEvent(g);
 assert.equal(w.id,linkedWorkspaceId(g));
 const newGoogle={...g,title:'Scouting for Food - Bag Drop',date:'2026-11-04',location:'Commons'};
 const modified=workspaceForSync(newGoogle,[{...w,owner:'Volunteer',notes:'Bring bags',links:'https://example.com'}]);
 assert.equal(modified.id,w.id);
 assert.equal(modified.date,'2026-11-04');
 assert.equal(modified.title,newGoogle.title);
 assert.equal(modified.owner,'Volunteer');
 assert.equal(modified.notes,'Bring bags');
 assert.equal(modified.links,'https://example.com');
 assert.equal(calendarWorkspaceSummary([g], [w]).planned,1);
 assert.equal(workspaceForSync(g,[]),null);
});
test('Calendar conversion uses selected calendar ID and start/end details',()=>{
 const e=simplifyGoogleEvent({id:'123',summary:'Pack Meeting',start:{dateTime:'2027-03-02T19:00:00-05:00'},end:{dateTime:'2027-03-02T20:00:00-05:00'},location:'Hillside',description:'Meet at gym'},'pack@example.com');
 assert.equal(e.id,'google:pack@example.com:123');
 assert.equal(e.endTime,'2027-03-02T20:00:00-05:00');
 assert.equal(e.description,'Meet at gym');
});
test('Wizard scales expenses by headcount and uses dues and optional donations without Pack popcorn income',()=>{
 const expenses=wizardSeedExpenses({source:'template',scouts:41,adults:10});
 const config={year:'2026-27',scouts:41,adults:10,dues:'105',donations:'0'};
 const p=wizardPreview(config,expenses);
 assert.equal(p.projectedDues,4305);
 assert.equal(p.income,4305);assert.equal(p.grossSalesTarget,0);
 const rows=wizardBudgetLines(config,expenses);
 assert.equal(rows.filter(x=>x.type==='income').length,2);
 assert.equal(rows.find(x=>x.category==='Pack Dues').planned,4305);assert.equal(rows.find(x=>x.category==='Donations').planned,0);assert.equal(rows.some(x=>/popcorn/i.test(x.category)),false);
 assert.equal(rows.some(x=>x.note.includes('DRAFT')),true);
 assert.equal(expenses.find(x=>x.detail==='Adult registration fees').planned,800);
 const scaled=wizardSeedExpenses({source:'template',scouts:82,adults:20});
 assert.equal(scaled.find(x=>x.detail==='Adult registration fees').planned,1600);
 assert.equal(scaled.find(x=>x.detail==='Rank patches').planned,246);
});
test('Prior-year copy and blank Wizard do not invent authorized actuals',()=>{
 assert.throws(()=>wizardSeedExpenses({source:'prior',priorBudget:[]}),/previous-year/);
 const prior=wizardSeedExpenses({source:'prior',priorBudget:[{type:'expense',category:'Campouts',detail:'Cabin',planned:235}]});
 assert.equal(prior[0].planned,235);
 assert.equal(wizardSeedExpenses({source:'blank'}).every(x=>x.planned===0),true);
 assert.throws(()=>validateWizardSettings({year:'2027-28',scouts:40,adults:10,dues:'',fundraising:0,commission:35}),/dues/);
});
