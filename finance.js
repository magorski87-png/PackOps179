// PackOps Finance: pure, testable business rules. All amounts are US dollars; calculations round to cents.
// IMPORTANT: imported treasurer ledger figures are authoritative. Planning and proposals never alter it.
import {csvParse} from './data.js';

export const EXPENSE_CATEGORIES=['Advancement & Awards','Blue & Gold','Campouts','Pack Meetings','Pinewood Derby','Service Projects','Recruiting','Equipment & Supplies','Training','Insurance & Fees','Scout Assistance','Administration','Other'];
export const INCOME_CATEGORIES=['Pack Dues','Popcorn Fundraising','Other Fundraising','Event Fees','Donations','Other Income'];
export const FINANCE_TABS=['overview','builder','accounts','reimbursements','ledger','reports'];
export const round=n=>Math.round((Number(n)||0)*100)/100;
export function amount(raw){
 if(typeof raw==='number')return Number.isFinite(raw)?round(raw):0;
 const x=String(raw??'').trim();if(!x)return 0;
 const isParens=/^\(.*\)$/.test(x);
 const cleaned=x.replace(/[,$\s()]/g,'').replace(/^\+/,'');
 if(!/^-?\d+(\.\d+)?$/.test(cleaned))return 0;
 return round((isParens?-1:1)*Number(cleaned));
}
export const normal=s=>String(s??'').trim().toLowerCase().replace(/\s+/g,' ');
export const finiteMoney=(v)=>Number.isFinite(Number(v))&&Number(v)>=0&&Number(v)<=1_000_000_000;
const rowValue=(row,headers,...keys)=>{
 const idx=headers.findIndex(x=>keys.some(k=>x===k));return idx<0?'':String(row[idx]??'').trim();
};
export function parseLedgerCsv(content){
 const rows=csvParse(content.replace(/^\uFEFF/,''));
 const at=rows.findIndex(r=>r.some(c=>normal(c)==='item')&&r.some(c=>/account balance|deposit added|cost deleted|withdrawal|expense/i.test(normal(c))));
 if(at<0)throw Error('Ledger CSV needs an Item column and balance/deposit/withdrawal columns. Export the treasurer ledger as CSV.');
 const headers=rows[at].map(normal);const taken=new Map();const parsed=[];
 for(let i=at+1;i<rows.length;i++){
  const r=rows[i],description=rowValue(r,headers,'item','description'),date=rowValue(r,headers,'date'),out=amount(rowValue(r,headers,'cost deleted','withdrawal','debit','expense','money out')),
   input=amount(rowValue(r,headers,'deposit added','deposit','credit','income','money in')),
   rawBalance=rowValue(r,headers,'account balance remaining','balance','running balance');
  if(!description&&!out&&!input)continue;
  if(!finiteMoney(Math.abs(out))||!finiteMoney(Math.abs(input)))throw Error('Transaction amount out of allowed range on row '+(i+1));
  const key=[date,normal(description),out,input,rawBalance].join('|');
  const duplicateIndex=(taken.get(key)||0)+1;taken.set(key,duplicateIndex);
  const id=`ledger:${key}:${duplicateIndex}`;
  const shortDate=/^\d{4}-\d{2}-\d{2}/.exec(date)?.[0]||'';
  const starting=/starting balance|opening balance/i.test(description);
  parsed.push({id,description,date:shortDate,debit:round(out),credit:round(input),balance:rawBalance!==''?amount(rawBalance):null,isOpening:starting,sourceRow:i+1,source:'Treasurer ledger CSV'});
 }
 if(!parsed.length)throw Error('No non-empty ledger transactions found');
 return parsed;
}
export function parseScoutCreditsCsv(content,annualDues=105){
 const rows=csvParse(content.replace(/^\uFEFF/,''));
 const at=rows.findIndex(r=>r.some(c=>normal(c)==='first name')&&r.some(c=>normal(c)==='last name')&&r.some(c=>/carryover|popcorn earnings|credit or dues/i.test(normal(c))));
 if(at<0)throw Error('Scout credit CSV must include First Name, Last Name, and carryover/popcorn/balance columns.');
 const headers=rows[at].map(normal);const scouts=[];let continuation=0;
 for(let i=at+1;i<rows.length;i++){
  const r=rows[i],first=rowValue(r,headers,'first name'),last=rowValue(r,headers,'last name');
  if(!first&&!last){if(r.some(v=>String(v).trim()))continuation++;continue;}
  if(!first||!last)continue;
  const carryover=amount(rowValue(r,headers,'2025-26 carryover','carryover'));
  const earnings=amount(rowValue(r,headers,'2026-27 popcorn earnings','popcorn earnings'));
  const rawBalance=rowValue(r,headers,'positive credit or dues owed','balance','credit balance');
  const balance=rawBalance===''?null:amount(rawBalance),den=rowValue(r,headers,'den');
  const predicted=round(carryover+earnings-annualDues);
  scouts.push({id:`credit:${normal(first)}:${normal(last)}:${normal(den)}:${i+1}`,name:`${first} ${last}`,den,carryover,earnings,balance,calculated:predicted,needsReview:balance!==null&&Math.abs(balance-predicted)>0.011,sourceRow:i+1});
 }
 if(!scouts.length)throw Error('No Scout credit rows found');
 return {scouts,continuationRows:continuation,source:'Scout Credits CSV',duesAssumption:annualDues};
}
export function financialSnapshot({budget=[],ledger=[],tags=[],reimbursements=[],settings={}}){
 const tagById=new Map(tags.map(t=>[t.id,t]));
 const posted=ledger.filter(r=>!r.isOpening);
 const categorized=posted.map(r=>({...r,tag:tagById.get(r.id)}));
 const spent=round(categorized.filter(r=>r.tag?.kind==='expense').reduce((a,r)=>a+Math.max(0,r.debit-r.credit),0));
 const received=round(categorized.filter(r=>r.tag?.kind==='income').reduce((a,r)=>a+Math.max(0,r.credit-r.debit),0));
 const unclassified=categorized.filter(r=>!r.tag?.kind||r.tag.kind==='unclassified');
 const lastBalance=[...ledger].reverse().find(x=>x.balance!==null)?.balance??null;
 const plannedExpenses=round(budget.filter(r=>(r.type||'expense')==='expense').reduce((a,r)=>a+amount(r.planned),0));
 const plannedIncome=round(budget.filter(r=>r.type==='income').reduce((a,r)=>a+amount(r.planned),0));
 const pending=round(reimbursements.filter(r=>!['declined','paid'].includes(r.status)).reduce((a,r)=>a+amount(r.amount),0));
 const categorization=new Map();
 for(const r of categorized.filter(r=>r.tag?.kind==='expense')){const category=r.tag.category||'Uncategorized';categorization.set(category,round((categorization.get(category)||0)+r.debit-r.credit));}
 const combined=new Map();
 for(const b of budget.filter(r=>(r.type||'expense')==='expense')){
  const key=`${b.category||'Uncategorized'}|${b.eventId||''}`;
  const prev=combined.get(key)||{category:b.category||'Uncategorized',eventId:b.eventId||'',planned:0,actual:0};
  prev.planned=round(prev.planned+amount(b.planned));combined.set(key,prev);
 }
 for(const r of categorized.filter(r=>r.tag?.kind==='expense')){
  const key=`${r.tag.category||'Uncategorized'}|${r.tag.eventId||''}`;
  const prev=combined.get(key)||{category:r.tag.category||'Uncategorized',eventId:r.tag.eventId||'',planned:0,actual:0};
  prev.actual=round(prev.actual+r.debit-r.credit);combined.set(key,prev);
 }
 const expenseCats=[...combined.values()];
 const baseline=round(settings.restricted||0),reserve=round(settings.reserve||0);
 // Never label this as cash available to spend; source is ledger, commitments need reconciliation.
 const estimatedHeadroom=lastBalance===null?null:round(lastBalance-pending-baseline-reserve);
 return {spent,received,unclassified:unclassified.length,lastBalance,plannedExpenses,plannedIncome,pending,expenseCats,estimatedHeadroom,reserve,restricted:baseline,ledgerCount:posted.length};
}
export function forecast({startingCash,expectedIncome=0,expectedExpenses=0,reserve=0,restricted=0}){
 if(startingCash===null||!Number.isFinite(Number(startingCash)))return null;
 return round(amount(startingCash)+amount(expectedIncome)-amount(expectedExpenses)-amount(reserve)-amount(restricted));
}
export function reimbursePaidAllowed(request,ledger,tags){
 if(!request?.ledgerId)return false;
 const record=ledger.find(t=>t.id===request.ledgerId);
 const tag=tags.find(t=>t.id===request.ledgerId);
 return !!(record&&tag?.kind==='expense'&&Math.abs(amount(record.debit)-amount(request.amount))<=0.01);
}
export function safeCsvValue(x){
 let text=String(x??'');if(/^[\s]*[=+@\-\t\r]/.test(text))text="'"+text;
 return `"${text.replaceAll('"','""')}"`;
}
export function csvExport(rows,fields){return [fields.map(safeCsvValue).join(','),...rows.map(r=>fields.map(f=>safeCsvValue(r[f])).join(','))].join('\r\n');}
export function reportsRows(s){return s.expenseCats.map(r=>({Category:r.category,Planned:r.planned,Actual:r.actual,Variance:round(r.planned-r.actual)}));}
