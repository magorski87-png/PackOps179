import test from 'node:test';
import assert from 'node:assert/strict';
import {leaderContactText,leaderContactsCsv} from '../leader-contacts.js';
import {csvParse} from '../data.js';

test('leader contact is copyable on four lines and CSV keeps one row per adult',()=>{
 const row={name:'Lee, Alex',den:'Webelos',roles:['Den Leader'],phone:'555-0102',email:'alex@example.test'};
 assert.equal(leaderContactText(row),'Lee, Alex\nWebelos · Den Leader\n555-0102\nalex@example.test');
 assert.deepEqual(csvParse(leaderContactsCsv([row])),[
  ['Name','Den','Roles','Phone','Email'],['Lee, Alex','Webelos','Den Leader','555-0102','alex@example.test']
 ]);
});
