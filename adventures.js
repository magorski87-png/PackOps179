import {csvParse,DEN_NAMES} from './data.js';
const HEADERS=['Den','Adventure','Type','Source URL'];
export const ADVENTURE_TEMPLATE='Den,Adventure,Type,Source URL\r\nWebelos,Bobcat Webelos,required,https://www.scouting.org/cub-scout-adventures/bobcat-webelos/\r\nWebelos,Aquanaut,elective,https://www.scouting.org/cub-scout-adventures/aquanaut/\r\n';
export function parseAdventuresCsv(csv,allowed=DEN_NAMES){
 const rows=csvParse(csv).filter(row=>row.some(cell=>String(cell).trim()));
 if(!rows.length||HEADERS.some((h,i)=>String(rows[0][i]||'').trim().toLowerCase()!==h.toLowerCase()))throw Error('Use the example headers: '+HEADERS.join(', '));
 const seen=new Set(),items=[],errors=[];
 for(const [i,row] of rows.slice(1).entries()){
  const [den,title,rawKind,sourceUrl]=row.map(v=>String(v||'').trim());const kind=rawKind.toLowerCase();
  const key=den.toLowerCase()+'|'+title.toLowerCase();
  if(!allowed.includes(den)||!title||title.length>140||!['required','elective'].includes(kind)||row.length>4||
    (sourceUrl&&!/^https:\/\//i.test(sourceUrl))||seen.has(key)){
   errors.push('Row '+(i+2)+': check den, adventure, type, URL, or duplicate.');continue;
  }
  seen.add(key);items.push({den,title,kind,source_url:sourceUrl});
 }
 return {items,errors};
}
