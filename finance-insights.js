// Explainable financial checks. These are prompts to review, not accounting decisions.
import {amount,round} from './finance.js';
export function financeInsights({snapshot,accounts=[],reimbursements=[],ledgerImportedAt='',year=''}){
 const out=[];
 if(snapshot.lastBalance===null)out.push({severity:'warning',title:'No verified balance snapshot',detail:'Import the current treasurer ledger before making spending decisions.'});
 if(snapshot.unclassified>0)out.push({severity:'warning',title:snapshot.unclassified+' ledger rows need classification',detail:'Review transfers, Scout-credit allocations and uncategorized transactions. Do not infer their financial purpose automatically.'});
 const over=snapshot.expenseCats.filter(r=>r.actual>r.planned&&r.actual>0);
 for(const row of over.slice(0,6))out.push({severity:'warning',title:(row.category||'Uncategorized')+' is over its allocation',detail:'Classified spending exceeds this budget line by $'+round(row.actual-row.planned).toFixed(2)+'. Investigate before committing to further purchases.'});
 const open=reimbursements.filter(r=>!['declined','paid'].includes(r.status));
 if(open.length)out.push({severity:'info',title:open.length+' reimbursements need follow-up',detail:'Open requests total $'+round(open.reduce((s,r)=>s+amount(r.amount),0)).toFixed(2)+'. They are not counted as paid until matched to an official ledger entry.'});
 const reviews=accounts.filter(r=>r.needsReview).length;
 if(reviews)out.push({severity:'warning',title:reviews+' Scout accounts need review',detail:'Dues assumptions differ from imported credit-sheet balances. Do not change official credits without treasurer approval.'});
 if(snapshot.lastBalance!==null&&snapshot.estimatedHeadroom!==null&&snapshot.estimatedHeadroom<0)out.push({severity:'warning',title:'Commitments may exceed modeled headroom',detail:'Review earmarked funds, reserves, and reimbursements. This is a screening estimate, not a bank balance.'});
 if(ledgerImportedAt){
  const days=(Date.now()-Date.parse(ledgerImportedAt))/86400000;
  if(Number.isFinite(days)&&days>30)out.push({severity:'warning',title:'Ledger snapshot is '+Math.floor(days)+' days old',detail:'Refresh from Courtney’s latest ledger before relying on actuals.'});
 }
 if(!snapshot.plannedExpenses)out.push({severity:'info',title:'No annual spending plan saved for '+year,detail:'Use the Budget Planning Wizard to create a reviewed draft.'});
 return out;
}
export function forecastSensitivity({startingCash,expectedIncome,expectedExpenses,reserve,restricted}){
 if(startingCash===null)return null;
 const base=round(Number(startingCash)+amount(expectedIncome)-amount(expectedExpenses)-amount(reserve)-amount(restricted));
 const short=round(Number(startingCash)+0.8*amount(expectedIncome)-1.1*amount(expectedExpenses)-amount(reserve)-amount(restricted));
 return {baseline:base,downside:short,assumption:'20% less expected income and 10% higher remaining expenses'};
}
