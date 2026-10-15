import test from 'node:test';
import assert from 'node:assert/strict';
import {familyResults,familyResponseCsv,familyPublicPanel} from '../family-ui.js';
test('response rollups do not inflate confirmed headcount with maybe/no replies',()=>{
 const rows={invitations:[{id:'a',recipient_label:'Household A'},{id:'b',recipient_label:'Household B'},{id:'c',recipient_label:'Household C'}],
 responses:[{invitation_id:'a',answer:{status:'yes',adults:2,children:3}},{invitation_id:'b',answer:{status:'maybe',adults:10,children:10}}]};
 const s=familyResults(rows);assert.equal(s.invited,3);assert.equal(s.replied,2);assert.equal(s.unanswered,1);assert.equal(s.adults,2);assert.equal(s.children,3);
 const csv=familyResponseCsv(rows);assert.match(csv,/Not yet responded/);assert.match(csv,/Household A/);
});
test('private invitation note is escaped on the family response page',()=>{
 const html=familyPublicPanel({title:'Camp',description:'',recipientLabel:'Smith family',personalNote:'Bring <script>alert(1)</script>',kind:'rsvp'},
  {field:()=>'',select:()=>'',esc:x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')});
 assert.match(html,/Bring &lt;script&gt;alert\(1\)&lt;\/script&gt;/);
 assert.doesNotMatch(html,/<script>/);
});
