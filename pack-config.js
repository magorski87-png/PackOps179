// Year-specific configuration: every future Scout year needs an explicit dues decision.
import {TEMPLATE_META} from './finance-template.js';
export const DEFAULT_SCOUT_YEAR='2026-27';
export function validScoutYear(year){
 const m=/^(20\d{2})-(\d{2})$/.exec(String(year||''));
 return Boolean(m&&Number(m[2])===(Number(m[1])+1)%100);
}
export function currentScoutYear(records){
 const value=records.find(r=>r.key==='activeScoutYear')?.value;
 return validScoutYear(value)?value:DEFAULT_SCOUT_YEAR;
}
export function duesForYear(records,year){
 if(!validScoutYear(year))return null;
 const exact=records.find(r=>r.key==='financeDues:'+year)?.value;
 const legacy=year===DEFAULT_SCOUT_YEAR?records.find(r=>r.key==='financeDues')?.value:undefined;
 const fallback=year===DEFAULT_SCOUT_YEAR?String(TEMPLATE_META.annualDues):undefined;
 const value=exact!==undefined?exact:legacy!==undefined?legacy:fallback;
 if(value===undefined||value===null||String(value).trim()==='')return null;
 const n=Number(value);
 return Number.isFinite(n)&&n>=0&&n<=10000?Math.round(n*100)/100:null;
}
export function scoutAccountYear(record){return record.sourceYear||DEFAULT_SCOUT_YEAR;}
export function creditDifference(record,dues){
 if(dues===null||record.balance===null||record.balance===undefined)return null;
 return Math.round((Number(record.carryover||0)+Number(record.earnings||0)-dues-Number(record.balance))*100)/100;
}
