import test from 'node:test';
import assert from 'node:assert/strict';
import {csvParse,summary,completion,brief,MEETING,MENU} from '../data.js';
import {parseRoster} from '../roster-import.js';

test('dashboard retains core ten sections plus Den Leader and family response tools',()=>{
 assert.equal(MENU.length,12);assert.equal(new Set(MENU.map(x=>x.id)).size,12);
});
test('meeting script includes essential elements',()=>{
 for(const component of ['flags-open','pledge','recognition','activity','announcements','minute','flags-close'])assert.ok(MEETING.some(x=>x.id===component));
});
test('CSV accepts embedded commas, newlines, and quoted values',()=>{
 assert.deepEqual(csvParse('Name,Note\n"Jones, A","A note with\nnew line"\n'),[['Name','Note'],['Jones, A','A note with\nnew line']]);
});
test('roster import finds header after report title and flags issues',()=>{
 const text=['" ","YOUTH MEMBERS"','" ","First Name","Last Name","Parent/Guardian Name ","Relationship","Home Phone","Work Phone","Mobile Phone","Email"',',Alex,Sample,Jordan Sample,Father,,,5551234567,alex@example.com',',Alex,Sample,,Mother,,,,not-an-email',',Riley,Scout,Pat Scout,Guardian,,,,pat@example.com'].join('\r\n');
 const data=parseRoster(text);
 assert.equal(data.headerRow,2);assert.equal(data.records.length,3);assert.equal(data.warnings.length,3);
 assert.ok(data.records[1].issues.some(x=>/duplicate/i.test(x)));
 assert.ok(data.records[1].issues.some(x=>/email/i.test(x)));
 assert.ok(data.records.every(r=>!r.issues?.some(x=>/auto-merged/i.test(x))));
});
test('roster invalid header gives human-readable error',()=>{
 assert.throws(()=>parseRoster('Name,Age\nSomeone,10'),/First Name/);
});
test('task summary distinguishes overdue, due soon, and missing owner',()=>{
 const s=summary([{status:'open',due:'2026-10-01',owner:'',priority:'high'},{status:'done',due:'2026-10-10',owner:'Helper'},{status:'open',due:'2026-10-14',owner:'Helper'}],'2026-10-10');
 assert.equal(s.overdue.length,1);assert.equal(s.dueSoon.length,1);assert.equal(s.unassigned.length,1);
});
test('empty event readiness is unknown, not 100 percent',()=>assert.equal(completion([]),null));
test('brief uses stored tasks, not invented statuses',()=>{
 const s=brief([{title:'Confirm bags',owner:'Lead',due:'2026-10-08',status:'open',eventId:''}],[], '2026-10-10');
 assert.match(s,/Confirm bags/);assert.match(s,/Lead/);assert.match(s,/Overdue/i);
});
