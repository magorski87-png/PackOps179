export async function prepareAttachment(file,eventId,id){
 if(!file)throw Error('Choose an attachment first');
 if(!eventId)throw Error('Open an event before attaching a file');
 if(file.size>15*1024*1024)throw Error('Choose a file under 15 MB');
 if(file.size===0)throw Error('This file is empty. Download it to your phone and choose it again.');
 // Materialize mobile/document-provider Files while their permission is still valid.
 let bytes;try{bytes=await file.arrayBuffer()}catch{throw Error('The phone could not read this file. Save it to Downloads, then choose it again.')}
 return {id,eventId,fileName:file.name||'attachment',mimeType:file.type||'application/octet-stream',blob:new Blob([bytes],{type:file.type||'application/octet-stream'}),createdAt:Date.now()};
}
export function hasPendingForm(root,pickerOpen=false){
 return pickerOpen||Boolean(root.querySelector('[data-dirty="true"],input:focus,textarea:focus,select:focus'))||[...root.querySelectorAll('input[type="file"]')].some(el=>el.files?.length);
}
