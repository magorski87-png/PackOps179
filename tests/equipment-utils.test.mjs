import test from 'node:test';
import assert from 'node:assert/strict';
import {queryEquipment,equipmentCsv,normalizeEquipment} from '../equipment-utils.js';
const items=[
 {id:'a',name:'Rocket launchers',category:'Rockets & STEM',location:'Garage',quantity:4},
 {id:'b',name:'Rocket manifold',category:'Rockets & STEM',location:'Storage room'},
 {id:'c',name:'Derby Track',category:'Pinewood Derby',location:'Garage'},
 {id:'d',name:'Camp Stove',category:'Camping & Outdoor',location:'Basement'}
];
test('prefix searching progressively narrows across multiple searchable fields',()=>{
 assert.deepEqual(queryEquipment(items,{search:'roc'}).map(x=>x.id),['a','b']);
 assert.deepEqual(queryEquipment(items,{search:'rocket launch'}).map(x=>x.id),['a']);
 assert.deepEqual(queryEquipment(items,{search:'GARAGE'}).map(x=>x.id),['c','a']); // relevance tie sorted by name
 assert.equal(queryEquipment(items,{search:'not here'}).length,0);
});
test('filter and sort compose with search',()=>{
 assert.deepEqual(queryEquipment(items,{category:'Rockets & STEM',search:'rocket',sort:'name-desc'}).map(x=>x.id),['a','b']);
 assert.deepEqual(queryEquipment(items,{sort:'category'}).map(x=>x.id),['d','c','b','a']);
});
test('older equipment defaults and safe CSV export',()=>{
 const old=normalizeEquipment({id:'x',name:'Flags'});
 assert.equal(old.quantity,1);assert.equal(old.category,'General Equipment');
 const csv=equipmentCsv([{name:'=HYPERLINK("bad")',category:'Flags',quantity:2,notes:'Multi-line\n"quoted" value'}]);
 assert.match(csv,/"'=HYPERLINK/);assert.match(csv,/"Multi-line\n""quoted"" value"/);
 assert.equal(csv.split('\r\n').length,2);
});
