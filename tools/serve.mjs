import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const port=Number(process.env.PORT)||4173;
http.createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url||'/', 'http://localhost').pathname);
  const file=path.resolve(root, '.'+pathname,pathname.endsWith('/')?'index.html':'');
  if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end('Forbidden');return;}
  const s=await stat(file);if(s.isDirectory()){res.writeHead(302,{Location:'./index.html'}).end();return;}
  const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);
 }catch{res.writeHead(404).end('Not found');}
}).listen(port,'0.0.0.0',()=>console.log('PackOps available at http://localhost:'+port));
