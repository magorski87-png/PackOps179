import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAdventuresCsv,ADVENTURE_TEMPLATE} from '../adventures.js';

test('adventure template imports for an authorized den without silent row loss',()=>{
 const result=parseAdventuresCsv(ADVENTURE_TEMPLATE,['Webelos']);
 assert.equal(result.items.length,2);assert.deepEqual(result.errors,[]);
 assert.equal(result.items[0].kind,'required');
});
test('adventure CSV rejects a foreign den, duplicate and unsafe source before saving',()=>{
 const result=parseAdventuresCsv('Den,Adventure,Type,Source URL\nWebelos,Bobcat,required,https://www.scouting.org/\nLion,Other,elective,\nWebelos,Bobcat,required,\nWebelos,Bad,elective,javascript:alert(1)', ['Webelos']);
 assert.equal(result.items.length,1);assert.equal(result.errors.length,3);
});
