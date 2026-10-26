import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {heartbeat} from '../tools/heartbeat.mjs';

const result={ok:true,checked_at:'2026-10-26T02:00:00Z'};
test('heartbeat requires a database result and retries transient failures',async()=>{
 let calls=0;
 const delays=[];
 const actual=await heartbeat(undefined,{
  fetchImpl:async(url,options)=>{
   assert.ok(url.endsWith('/rest/v1/rpc/packops_heartbeat'));
   assert.equal(options.method,'GET');
   assert.ok(options.headers.apikey);
   assert.equal(options.headers.Authorization,undefined);
   if(++calls===1)throw new Error('network error');
   return Response.json(result);
  },sleep:async(ms)=>delays.push(ms)
 });
 assert.deepEqual(actual,result);
 assert.equal(calls,2);
 assert.deepEqual(delays,[2000]);
});
test('errors and misleading HTTP successes never pass as healthy',async()=>{
 for(const response of [()=>new Response('',{status:401}),()=>new Response('',{status:503}),()=>Response.json({}),()=>Response.json({ok:true,checked_at:'bad'}),()=>new Response('<html>maintenance</html>')]) {
  let calls=0;
  await assert.rejects(()=>heartbeat(undefined,{
   fetchImpl:async()=>{calls++;return response();},sleep:async()=>{}
  }),/failed after 3 attempts/);
  assert.equal(calls,3);
 }
});
test('anonymous heartbeat works in read-only SQL without access to Pack tables',async()=>{
 const db=new PGlite();
 try {
  await db.exec('create role anon; create role authenticated; create table public.private_records(secret text);');
  await db.exec(await readFile(new URL('../supabase/migrations/20261026020757_packops_heartbeat.sql',import.meta.url),'utf8'));
  const fn=(await db.query("select prosecdef, provolatile from pg_proc where oid='public.packops_heartbeat()'::regprocedure")).rows[0];
  assert.equal(fn.prosecdef,false);
  assert.equal(fn.provolatile,'s');
  await db.exec('set role anon; begin read only;');
  const value=(await db.query('select public.packops_heartbeat() as value')).rows[0].value;
  assert.deepEqual(Object.keys(value).sort(),['checked_at','ok']);
  assert.equal(value.ok,true);
  assert.ok(Number.isFinite(Date.parse(value.checked_at)));
  await db.exec('commit;');
  await assert.rejects(()=>db.query('select * from public.private_records'),/permission denied/);
 } finally {await db.close();}
});
