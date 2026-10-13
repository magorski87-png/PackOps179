import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
test('release build requires complete public config, excludes server files, and refreshes PWA cache',async()=>{
 const root=path.resolve(import.meta.dirname,'..'),temp=await mkdtemp(path.join(tmpdir(),'packops-build-'));
 const cwd=path.join(temp,'app');
 try{
  await cp(root,cwd,{recursive:true,filter:source=>!['.git','dist','node_modules'].some(p=>path.relative(root,source).split(path.sep).includes(p))});
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('PACKOPS_')));
  const build=extra=>spawnSync(process.execPath,['tools/build.mjs'],{cwd,env:{...env,...extra},encoding:'utf8'});
  assert.equal(build({}).status,0);
  const original=await readFile(path.join(cwd,'dist/sw.js'),'utf8');
  assert.notEqual(build({PACKOPS_REQUIRE_CLOUD_CONFIG:'true'}).status,0);
  const config={PACKOPS_REQUIRE_CLOUD_CONFIG:'true',PACKOPS_SUPABASE_URL:'https://example.supabase.co',PACKOPS_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_example',PACKOPS_PACK_ID:'11111111-2222-4333-8444-555555555555'};
  const result=build(config);assert.equal(result.status,0,result.stderr);
  const output=await readFile(path.join(cwd,'dist/cloud-config.js'),'utf8');
  assert.match(output,/sb_publishable_example/);assert.match(output,/11111111-2222-4333-8444-555555555555/);
  assert.notEqual(await readFile(path.join(cwd,'dist/sw.js'),'utf8'),original);
  const files=await readdir(path.join(cwd,'dist'));assert.ok(files.includes('cloud-config-utils.js'));assert.ok(!files.includes('supabase'));
  const bad=build({...config,PACKOPS_SUPABASE_PUBLISHABLE_KEY:'sb_secret_DO_NOT_PRINT'});
  assert.notEqual(bad.status,0);assert.doesNotMatch(bad.stderr,/sb_secret_DO_NOT_PRINT/);
  assert.equal(await readFile(path.join(cwd,'dist/cloud-config.js'),'utf8'),output);
  assert.notEqual(build({PACKOPS_SUPABASE_URL:config.PACKOPS_SUPABASE_URL}).status,0);
 }finally{await rm(temp,{recursive:true,force:true})}
});
