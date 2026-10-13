// Draft budget edits never change actual ledger activity or another Scout year.
export function budgetDraft(values,existing,year){
 const planned=Number(values.planned);
 if(values.planned===''||!Number.isFinite(planned)||planned<0||planned>1e9)throw Error('Enter a valid planned amount');
 if(!['income','expense'].includes(values.type))throw Error('Choose income or expense');
 if(!values.category?.trim()||!values.detail?.trim())throw Error('Enter a category and item / purpose');
 if(existing&&(existing.year||'2026-27')!==year)throw Error('This allocation belongs to another Scout year');
 return {...existing,type:values.type,category:values.category.trim().slice(0,100),detail:values.detail.trim().slice(0,120),planned:Math.round(planned*100)/100,eventId:values.eventId||'',note:String(values.note||'').slice(0,1000),year};
}
export function visibleAccountAdjustments(accounts,adjustments){
 const ids=new Set(accounts.map(a=>a.id));return adjustments.filter(a=>ids.has(a.accountId));
}
export function readWizardExpenses(form,expenses){
 return expenses.map((line,i)=>{
  const value=name=>String(form.elements.namedItem(name)?.value??'').trim();
  const category=value('category_'+i),detail=value('detail_'+i),raw=value('expense_'+i),planned=Number(raw);
  if(!category||!detail||raw===''||!Number.isFinite(planned)||planned<0||planned>1e9)throw Error('Each expense needs a category, item and valid amount');
  return {...line,category:category.slice(0,100),detail:detail.slice(0,120),planned:Math.round(planned*100)/100};
 });
}
