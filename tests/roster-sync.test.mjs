import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileRoster} from '../roster-sync.js';
test('revised Scoutbook export retains original identities and flags absent records rather than erasing them',()=>{
 const old=[{id:'s1',memberId:'123',name:'One Scout',email:'parent@example.com',den:'Webelos',notes:'Reviewed'},{id:'s2',memberId:'456',name:'Two Scout',email:'other@example.com',den:'Wolf'}];
 const result=reconcileRoster(old,[{id:'new1',memberId:'123',name:'One Scout',email:'parent@example.com',den:'Webelos',rank:'Webelos'},{id:'new3',memberId:'789',name:'Three Scout',email:'third@example.com',den:'Wolf'}]);
 assert.deepEqual([result.matched,result.added,result.missing],[1,1,1]);
 assert.equal(result.rows[0].id,'s1');
 assert.equal(result.rows[0].notes,'Reviewed');
 assert.equal(result.rows[2].missingFromLatestImport,true);
});
