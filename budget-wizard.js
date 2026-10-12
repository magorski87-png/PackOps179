// Guided annual budget planning. Everything here is a DRAFT, not a ledger entry.
// Source assumptions: the 2026–27 planning template or imported prior-year PackOps budget.
import {TEMPLATE_ROWS,TEMPLATE_META} from './finance-template.js';
const cents=n=>Math.round((Number(n)||0)*100)/100;
const scale=(value,ratio)=>cents(Number(value||0)*ratio);
const adultCosts=new Set(['Adult registration fees','Leader and veteran recognition']);
const scoutCosts=new Set([
 'Adventure loops and pins','Rank patches','Rank cards','Neckerchiefs / bridging','AOL plaques and photobooks',
 'Banquet','Derby event','Den meeting materials','Den outings','Den holiday party',
 'Program supplies / ceremonies','Scholarships / reserve fund','Contingency'
]);
export function wizardSeedExpenses({source='template',scouts=TEMPLATE_META.members,adults=TEMPLATE_META.registeredAdults,priorBudget=[]}={}){
 if(!Number.isInteger(scouts)||scouts<0||scouts>2000||!Number.isInteger(adults)||adults<0||adults>500)throw Error('Enter valid expected Scout and adult counts');
 const rows=source==='prior'?priorBudget.filter(r=>(r.type||'expense')==='expense'):TEMPLATE_ROWS.filter(r=>r.type==='expense');
 if(source==='prior'&&!rows.length)throw Error('There is no previous-year budget on this device. Use the template or start blank.');
 if(!['prior','template','blank'].includes(source))throw Error('Unknown budget source');
 return rows.map((row,index)=>{
  const category=row.category||'Other',detail=row.detail||row.category||'Other';
  const baseline=Number(row.planned)||0;
  const amount=source==='blank'?0:source==='prior'?cents(baseline):
   scale(baseline,adultCosts.has(detail)?adults/TEMPLATE_META.registeredAdults:
     scoutCosts.has(detail)?scouts/TEMPLATE_META.members:1);
  return {key:String(index),category,detail,planned:amount,origin:source==='prior'?'prior-year budget':'2026–27 planning template'};
 });
}
export function validateWizardSettings(x){
 const year=String(x.year||'');
 if(!/^20\d\d-\d\d$/.test(year)||Number(year.slice(5))!==(Number(year.slice(0,4))+1)%100)throw Error('Choose a valid Scout year');
 const scouts=Number(x.scouts),adults=Number(x.adults),dues=Number(x.dues),fundraising=Number(x.fundraising),commission=Number(x.commission);
 if(!Number.isInteger(scouts)||scouts<0||scouts>2000)throw Error('Expected Scouts must be 0–2000');
 if(!Number.isInteger(adults)||adults<0||adults>500)throw Error('Registered adults must be 0–500');
 if(!Number.isFinite(dues)||dues<0||dues>10000||x.dues==='')throw Error('Set dues for the Scout year');
 if(!Number.isFinite(fundraising)||fundraising<0||fundraising>1e8)throw Error('Enter a valid fundraising proceeds target');
 if(!Number.isFinite(commission)||commission<=0||commission>100)throw Error('Commission must be greater than 0% and at most 100%');
 return {year,scouts,adults,dues:cents(dues),fundraising:cents(fundraising),commission:commission/100};
}
export function wizardPreview(config,expenses){
 const x=validateWizardSettings(config);
 if(!Array.isArray(expenses)||!expenses.length)throw Error('Add or review at least one expense category');
 const sum=expenses.reduce((a,row)=>{
  const v=Number(row.planned);
  if(!Number.isFinite(v)||v<0||v>1e9)throw Error('All planned expenses must be nonnegative amounts');
  return a+v;
 },0);
 const projectedDues=cents(x.scouts*x.dues),totalExpense=cents(sum),income=cents(projectedDues+x.fundraising);
 return {...x,projectedDues,totalExpense,income,net:cents(income-totalExpense),
  grossSalesTarget:cents(x.fundraising/x.commission)};
}
export function wizardBudgetLines(config,expenses){
 const p=wizardPreview(config,expenses);
 return [
  ...expenses.map(e=>({year:p.year,type:'expense',category:e.category,detail:e.detail,planned:cents(e.planned),note:'DRAFT: annual budget wizard ('+e.origin+'). Verify quantities and cost assumptions before approval.',source:'budget-wizard'})),
  {year:p.year,type:'income',category:'Pack Dues',detail:p.scouts+' Scouts × $'+p.dues.toFixed(2)+' annual dues',planned:p.projectedDues,note:'DRAFT projection; not received cash.',source:'budget-wizard'},
  {year:p.year,type:'income',category:'Popcorn Fundraising',detail:'Projected Pack proceeds',planned:p.fundraising,note:'DRAFT goal, not received cash. Commission assumption '+(p.commission*100).toFixed(1)+'%.',source:'budget-wizard'}
 ];
}
