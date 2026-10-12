// Planning inputs transcribed from user's 2026–27 proposed budget template.
// All values are DRAFT planning values, not actual expenses or cash movements.
export const TEMPLATE_META={year:'2026-27',members:41,registeredAdults:10,annualDues:105,beginningCashAssumption:null,fundraisingProceedsTarget:0,commissionRate:0.35,donationsTarget:0};
export const TEMPLATE_ROWS=[
 ['Insurance & Fees','Adult registration fees',800,'expense'],
 ['Insurance & Fees','Unit charter fee',100,'expense'],
 ['Advancement & Awards','Adventure loops and pins',656,'expense'],
 ['Advancement & Awards','Rank patches',123,'expense'],
 ['Advancement & Awards','Rank cards',82,'expense'],
 ['Advancement & Awards','Neckerchiefs / bridging',450,'expense'],
 ['Advancement & Awards','AOL plaques and photobooks',275,'expense'],
 ['Advancement & Awards','Leader and veteran recognition',250,'expense'],
 ['Blue & Gold','Banquet',410,'expense'],
 ['Pinewood Derby','Derby event',410,'expense'],
 ['Pack Meetings','Parades',50,'expense'],
 ['Recruiting','Join Scout Night',250,'expense'],
 ['Pack Meetings','Den meeting materials',410,'expense'],
 ['Campouts','Den outings',1025,'expense'],
 ['Pack Meetings','Den holiday party',410,'expense'],
 ['Campouts','Winter Pack campout',0,'expense'],
 ['Campouts','Spring Pack campout',0,'expense'],
 ['Equipment & Supplies','Program supplies / ceremonies',205,'expense'],
 ['Training','Leader training',300,'expense'],
 ['Scout Assistance','Assistance for families',500,'expense'],
 ['Administration','Scholarships / reserve fund',205,'expense'],
 ['Administration','Contingency',205,'expense'],
 ['Pack Dues','41 Scouts × $105 annual dues',4305,'income'],
 ['Donations','Optional VFW / community donations (not assumed)',0,'income'],
].map(([category,detail,planned,type])=>({category,detail,planned,type,year:'2026-27',note:'DRAFT from uploaded Budget Planner template; verify before approval.'}));
export const templateTotals=()=>({expenses:TEMPLATE_ROWS.filter(r=>r.type==='expense').reduce((a,b)=>a+b.planned,0),income:TEMPLATE_ROWS.filter(r=>r.type==='income').reduce((a,b)=>a+b.planned,0)});
export function fundraisingTarget(proceeds,commission,members){
 const p=Number(proceeds),r=Number(commission),m=Number(members);
 if(!Number.isFinite(p)||!Number.isFinite(r)||!Number.isFinite(m)||p<0||r<=0||r>1||m<1)return null;
 const gross=Math.round(p/r*100)/100;
 return {gross,perScout:Math.round(gross/m*100)/100,proceeds:p,commission:r,members:m};
}
