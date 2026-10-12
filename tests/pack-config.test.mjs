import test from 'node:test';
import assert from 'node:assert/strict';
import {currentScoutYear,validScoutYear,duesForYear,scoutAccountYear,creditDifference} from '../pack-config.js';
import {parseScoutCreditsCsv} from '../finance.js';

test('Scout years follow adjacent-year naming',()=>{
 assert.equal(validScoutYear('2026-27'),true);
 assert.equal(validScoutYear('2027-28'),true);
 assert.equal(validScoutYear('2027-29'),false);
 assert.equal(validScoutYear('bad'),false);
});
test('Dues are individually configurable, future years have no implicit dues',()=>{
 const rows=[{key:'activeScoutYear',value:'2027-28'},{key:'financeDues:2026-27',value:'105'},{key:'financeDues:2027-28',value:'125'}];
 assert.equal(currentScoutYear(rows),'2027-28');
 assert.equal(duesForYear(rows,'2026-27'),105);
 assert.equal(duesForYear(rows,'2027-28'),125);
 assert.equal(duesForYear(rows,'2028-29'),null);
 assert.equal(duesForYear([{key:'financeDues:2026-27',value:'0'}],'2026-27'),0);
});
test('Older local Pack credit snapshots remain in their year',()=>{
 assert.equal(scoutAccountYear({name:'Example Scout'}),'2026-27');
 assert.equal(scoutAccountYear({sourceYear:'2027-28'}),'2027-28');
 assert.equal(creditDifference({carryover:100,earnings:50,balance:45},105),0);
 assert.equal(creditDifference({carryover:100,earnings:50,balance:45},125),-20);
});
test('Scout credit import requires explicitly passed dues and detects mismatches',()=>{
 const csv=['First Name,Last Name,Den,2025-26 carryover,2026-27 popcorn earnings,positive credit or dues owed','Jane,Example,Wolf,100,50,45'].join('\n');
 assert.throws(()=>parseScoutCreditsCsv(csv,undefined),/dues/i);
 assert.equal(parseScoutCreditsCsv(csv,105).scouts[0].needsReview,false);
 assert.equal(parseScoutCreditsCsv(csv,125).scouts[0].needsReview,true);
});
