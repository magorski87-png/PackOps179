const clean=value=>String(value||'').trim();
export const contactSort=(a,b)=>clean(a.name).localeCompare(clean(b.name),undefined,{sensitivity:'base'})||clean(a.email).localeCompare(clean(b.email));
export function leaderContactText(row){
 return [clean(row.name),clean(row.den),clean(row.phone),clean(row.email)].join('\n');
}
const quote=value=>'"'+clean(value).replaceAll('"','""')+'"';
export function leaderContactsCsv(rows){
 return [['Name','Den / role','Phone','Email'].map(quote).join(','),...rows.slice().sort(contactSort).map(row=>[row.name,row.den,row.phone,row.email].map(quote).join(','))].join('\r\n');
}
