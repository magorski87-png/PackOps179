import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('Postgres enforces transaction roles, lifecycle, audit and duplicate prevention',async()=>{
 const db=new PGlite();
 const pack='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 const ids=Object.fromEntries(['admin','treasurer','den_leader','volunteer','outsider'].map((r,i)=>[r,`00000000-0000-4000-8000-00000000000${i+1}`]));
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth,public to authenticated,anon,service_role;
 grant execute on function auth.uid() to authenticated,anon,service_role;
 create schema storage; create table storage.buckets(id text primary key,name text,public boolean); create table storage.objects(id uuid,bucket_id text,name text);`);
 const path=new URL('../supabase/migrations/',import.meta.url);
 for(const name of (await readdir(path)).filter(n=>n.endsWith('.sql')&&!n.includes('004_realtime')).sort()){
  const sql=(await readFile(new URL(name,path),'utf8')).replace('create extension if not exists pgcrypto;','');
  await db.exec(sql);
 }
 for(const [role,id] of Object.entries(ids)){
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,role+'@example.test']);
 }
 await db.query('insert into public.packs(id,name) values($1,$2),($3,$4)',[pack,'Test Pack',other,'Other Pack']);
 for(const [role,id] of Object.entries(ids).filter(([r])=>r!=='outsider'))await db.query('insert into public.pack_members(pack_id,user_id,role,den_scopes) values($1,$2,$3,$4)',[pack,id,role,['Webelos']]);
 const as=async(role)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[role]||'']);await db.exec('set role authenticated')};
 const request='33333333-3333-4333-8333-333333333333',request2='44444444-4444-4444-8444-444444444444';
 const data={year:'2026-27',kind:'expense',direction:'out',amount:24.5,description:'Test supplies',date:'2026-10-13',category:'Pack Meetings',notes:'',receiptUrl:''};
 const submit=(id=request,p=pack)=>db.query('select * from public.pack_submit_transaction($1,$2,$3)',[p,id,data]);
 const review=(id,version,action,note='')=>db.query('select * from public.pack_review_transaction($1,$2,$3,$4,$5)',[pack,id,version,action,note]);
 try{
  await as('outsider');await assert.rejects(submit,/membership/);
  await as('den_leader');await submit();await submit();
  assert.equal((await db.query('select count(*)::int n from public.finance_requests')).rows[0].n,1);
  await assert.rejects(()=>review(request,1,'approve'),/reviewer/);
  await assert.rejects(()=>db.query("update public.finance_requests set status='posted' where id=$1",[request]),/permission denied/);
  await assert.rejects(()=>submit(request2,other),/membership/);
  await as('volunteer');assert.equal((await db.query('select * from public.finance_requests')).rows.length,0);await submit(request2);
  await as('treasurer');assert.equal((await db.query('select * from public.finance_requests')).rows.length,2);
  assert.equal((await db.query('select * from public.finance_notifications')).rows.length,2);
  const snapshot=(rows)=>db.query('select public.pack_replace_ledger_snapshot($1,$2,$3,$4)',[pack,'2026-27',rows,'2026-10-13T12:00:00Z']);
  const opening={id:'ledger:opening',sourceYear:'2026-27',description:'Starting balance',balance:100};
  await snapshot([opening]);
  await assert.rejects(snapshot([{...opening,sourceYear:'2025-26'}]),/wrong-year/);
  assert.equal((await db.query("select count(*)::int n from public.pack_records where table_name='financeLedger'")).rows[0].n,1);
  await assert.rejects(()=>review(request,1,'verify_payment','bank-1'),/Invalid transition/);
  assert.equal((await review(request,1,'approve')).rows[0].status,'approved');
  await assert.rejects(()=>review(request,1,'decline','test'),/changed/);
  assert.equal((await review(request,2,'verify_payment','bank-1')).rows[0].status,'payment_verified');
  await review(request2,1,'approve');await assert.rejects(()=>review(request2,2,'verify_payment','bank-1'),/duplicate key/);
  await assert.rejects(()=>db.query('select public.pack_finish_ledger_post($1,$2,$3,$4)',[pack,request,ids.treasurer,{}]),/permission denied/);
  await as('admin');
  const self='55555555-5555-4555-8555-555555555555';await submit(self);await review(self,1,'approve');
  const audit=(await db.query('select action,actor from public.finance_request_audit where request_id=$1 order by id',[self])).rows;
  assert.deepEqual(audit.map(a=>a.action),['submitted','approve']);assert.ok(audit.every(a=>a.actor===ids.admin));
  await db.exec('reset role');await db.query("update public.pack_members set status='suspended' where user_id=$1",[ids.den_leader]);
  await as('den_leader');assert.equal((await db.query('select * from public.finance_requests')).rows.length,0);await assert.rejects(submit,/membership/);
  await db.exec('reset role');await db.exec('set role service_role');
  const row={id:'packops:'+request,debit:24.5,credit:0,balance:75.5,sourceYear:'2026-27',sourceRow:3,description:'Test supplies',date:'2026-10-13'};
  assert.equal((await db.query('select * from public.pack_finish_ledger_post($1,$2,$3,$4)',[pack,request,ids.treasurer,row])).rows[0].status,'posted');
  assert.equal((await db.query('select * from public.pack_finish_ledger_post($1,$2,$3,$4)',[pack,request,ids.treasurer,row])).rows[0].version,4);
  await as('treasurer');await assert.rejects(snapshot([opening]),/missing a posted/);
  assert.equal((await db.query("select count(*)::int n from public.pack_records where table_name='financeLedger'")).rows[0].n,1);
  await snapshot([opening,row]);
  assert.equal((await db.query("select count(*)::int n from public.pack_records where table_name='financeLedger'")).rows[0].n,2);
  await as('outsider');assert.equal((await db.query('select * from public.finance_request_audit')).rows.length,0);
 }finally{await db.close()}
});
