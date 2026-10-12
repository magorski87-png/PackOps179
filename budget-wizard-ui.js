// Lightweight, mobile-friendly UI for the PackOps guided budget wizard.
import {wizardPreview} from './budget-wizard.js';
export function budgetWizardPanel({ui,year,dues,settings,budget,esc,money,field,select,btn}){
 const step=ui.wizardStep;
 if(step===undefined||step<0)return '';
 const config=ui.wizardConfig||{};
 const expenses=ui.wizardExpenses||[];
 const name=['Choose a starting point','Membership and income','Review expense allocations','Review and save'][step];
 let result='<section class="panel stack budget-wizard"><div class="row-between mobile-stack"><div><span class="kicker">BUDGET PLANNING WIZARD</span><h2>'+esc(name)+'</h2><p>Step '+(step+1)+' of 4 · '+esc(year)+' · draft planning only</p></div>'+btn('Close wizard','finance-wizard-close','btn btn-ghost')+'</div>';
 result+='<div class="finance-process"><div><strong>1</strong><small>Source</small></div><span>→</span><div><strong>2</strong><small>Membership</small></div><span>→</span><div><strong>3</strong><small>Expenses</small></div><span>→</span><div><strong>4</strong><small>Review</small></div></div>';
 if(step===0){
  const last=(Number(year.slice(0,4))-1)+'-'+year.slice(2,4);
  const history=budget.filter(b=>(b.year||'2026-27')===last&&(b.type||'expense')==='expense');
  result+='<p>Choose where to start. An existing budget will NEVER be silently replaced.</p><form data-form="wizard-source" class="stack">';
  result+=select('Budget starting point','source',[['template','Scale the 2026–27 planning template'],['prior','Copy prior-year PackOps expense plan ('+last+'; '+history.length+' lines)'],['blank','Start a blank budget with suggested categories']],config.source||'template');
  result+='<div class="privacy-strip">The template and last-year values are suggestions, not verified costs. Official ledger transactions are not altered.</div><button class="btn" type="submit">Continue →</button></form>';
 }else if(step===1){
  result+='<p>Set your enrollment and income assumptions. Dues for '+esc(year)+' are saved separately from all other Scout years.</p><form data-form="wizard-assumptions" class="stack"><div class="form-grid">';
  result+=field('Expected Scouts','scouts','number',String(config.scouts??Number(settings('financeFundraisingScouts')||41)),'min="0" max="2000" step="1" required');
  result+=field('Registered adults','adults','number',String(config.adults??10),'min="0" max="500" step="1" required');
  result+=field('Pack annual dues per Scout ($)','dues','number',String(config.dues??dues??''),'min="0" max="10000" step="0.01" required');
  result+=field('Optional VFW / community donations ($)','donations','number',String(config.donations??Number(settings('financeDonationEstimate')||0)),'min="0" step="0.01" required');
  result+='<p class="privacy-strip">Pack popcorn proceeds are $0. Scouts may still earn individual popcorn credits; those are not Pack income. Donations are optional, never guaranteed.</p>';
  result+='</div><div class="row">'+btn('← Back','finance-wizard-back','btn btn-outline')+'<button class="btn" type="submit">Generate expense draft →</button></div></form>';
 }else if(step===2){
  result+='<p>Adjust every annual expense below. Amounts are draft estimates based on the selected source. Zero-dollar lines are allowed.</p><form data-form="wizard-expenses" class="stack">';
  let previous='';
  for(let i=0;i<expenses.length;i++){
   const e=expenses[i];
   if(e.category!==previous){result+='<h3>'+esc(e.category)+'</h3>';previous=e.category;}
   result+='<div class="row-between mobile-stack"><label for="expense_'+i+'">'+esc(e.detail)+'</label><div style="min-width:135px"><input class="input" type="number" id="expense_'+i+'" name="expense_'+i+'" min="0" max="1000000000" step="0.01" value="'+esc(String(e.planned))+'" required></div></div>';
  }
  result+='<div class="row">'+btn('← Back','finance-wizard-back','btn btn-outline')+'<button class="btn" type="submit">Review full-year budget →</button></div></form>';
 }else{
  const p=wizardPreview(config,expenses);
  const existing=budget.filter(b=>(b.year||'2026-27')===year);
  result+='<div class="finance-metrics"><div class="finance-kpi"><small>Planned spending</small><strong>'+money(p.totalExpense)+'</strong></div><div class="finance-kpi"><small>Projected income</small><strong>'+money(p.income)+'</strong></div><div class="finance-kpi"><small>Funding difference</small><strong>'+money(p.net)+'</strong></div><div class="finance-kpi"><small>Optional donations</small><strong>'+money(p.donations)+'</strong></div></div>';
  result+='<p>Projected dues: '+money(p.projectedDues)+' for '+p.scouts+' Scouts at '+money(p.dues)+' each. Optional VFW/community donations: '+money(p.donations)+'. Pack popcorn income: $0.</p>';
  result+='<div class="privacy-strip">Forecast excludes existing cash and liabilities. A positive funding difference is NOT confirmed available cash. Actual receipts and spending come only from the treasurer ledger.</div>';
  result+='<p><strong>'+existing.length+' current-year budget lines</strong> will be archived to a LOCAL revision history and replaced when you confirm. Other Scout years remain unchanged.</p>';
  result+='<div class="row">'+btn('← Change expenses','finance-wizard-back','btn btn-outline')+btn('Save reviewed DRAFT budget','finance-wizard-save','btn')+'</div>';
 }
 return result+'</section>';
}
