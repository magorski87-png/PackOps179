import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveCloudConfiguration as resolve,validateCloudConfiguration as validate,hasCloudConfiguration as has} from '../cloud-config-validation.js';
import {cloudSettingsPanel} from '../cloud-panel.js';
import {readFile} from 'node:fs/promises';
const config={projectUrl:'https://example.supabase.co',publishableKey:'sb_publishable_test_only',packId:'11111111-2222-4333-8444-555555555555'};
const jwt=payload=>Buffer.from('{}').toString('base64url')+'.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.signature';
test('fresh device receives complete deployed configuration without local setup',()=>{
 assert.deepEqual(validate(resolve(config,{})),config);
 assert.equal(resolve(config,{}).managed,true);
});
test('deployment wins atomically over stale device settings without modifying them',()=>{
 const local={projectUrl:'https://old.supabase.co',publishableKey:'sb_publishable_old',packId:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'};
 const before=structuredClone(local);
 assert.deepEqual(validate(resolve(config,local)),config);
 assert.deepEqual(local,before);
 assert.throws(()=>validate(resolve({projectUrl:config.projectUrl},local)),/incomplete/);
});
test('blank deployment preserves existing device setup and local-only mode',()=>{
 assert.deepEqual(validate(resolve({},config)),config);
 assert.equal(resolve({},config).managed,false);
 assert.equal(has(resolve({},{})),false);
 assert.equal(validate({},{allowEmpty:true}),null);
 assert.throws(()=>validate({}),/incomplete/);
});
test('normalizes whitespace and trailing slash',()=>{
 assert.deepEqual(validate({...config,projectUrl:' '+config.projectUrl+'/ ',publishableKey:' '+config.publishableKey+' ',packId:' '+config.packId+' '}),config);
});
test('accepts legacy anon keys but rejects encoded privileged and malformed keys',()=>{
 assert.equal(validate({...config,publishableKey:jwt({role:'anon',ref:'example'})}).projectUrl,config.projectUrl);
 for(const key of ['sb_secret_test','GOCSPX-example','database-password',jwt({role:'service_role'}),jwt({role:'authenticated'}),jwt({role:'anon',ref:'other'}),'eyJ.bad.signature']){
  assert.throws(()=>validate({...config,publishableKey:key}));
 }
});
test('rejects missing fields, invalid pack IDs, unsafe URLs, and URL lookalikes',()=>{
 for(const key of Object.keys(config))assert.throws(()=>validate({...config,[key]:''}));
 for(const projectUrl of ['http://example.supabase.co','https://exampleXsupabaseYco','https://example.supabase.co.evil.test','https://user:password@example.supabase.co','https://example.supabase.co/path','https://example.supabase.co?key=secret']){
  assert.throws(()=>validate({...config,projectUrl}));
 }
 assert.throws(()=>validate({...config,packId:'user-id'}),/Pack UUID/);
});
const panel=(state,configured,setupError='')=>cloudSettingsPanel({
 state,configured,setupError,esc:String,
 btn:(label,action)=>'<button data-action="'+action+'">'+label+'</button>',
 field:label=>'<input aria-label="'+label+'">',select:()=>'',note:String
});
test('managed sign-in hides backend fields from signed-out and approved leaders',()=>{
 for(const state of [{configured:true},{configured:true,authenticated:true,member:{role:'den_leader'},user:{}}]){
  const html=panel(state,{...config,managed:true});
  assert.doesNotMatch(html,/data-form="cloud-config"|Supabase Project URL|Supabase publishable or anon key/);
  assert.match(html,/configured automatically/);
  assert.doesNotMatch(html,/cloud-invite-leader/);
 }
 assert.match(panel({configured:true},{...config,managed:true}),/Continue with Google/);
});
test('pending membership and administrator-only permissions controls are preserved',()=>{
 assert.match(panel({configured:true,authenticated:true},{managed:true}),/awaiting approval/);
 assert.match(panel({configured:true,authenticated:true,member:{role:'admin'},user:{}},{managed:true}),/cloud-invite-leader/);
 assert.match(panel({},{managed:true},'Network unavailable'),/cloud-retry/);
 assert.match(panel({},{managed:false}),/<details>.*Administrator setup/);
});
test('startup, build and offline shell include shared config validation',async()=>{
 const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/resolveCloudConfiguration\(PACK_CLOUD_CONFIG/);
 assert.match(app,/if\(cloudSettings\(\).managed\)throw Error/);
 for(const file of ['../tools/build.mjs','../sw.js']){
  assert.ok((await readFile(new URL(file,import.meta.url),'utf8')).includes('cloud-config-validation.js'));
 }
});
