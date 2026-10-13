import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCloudConfig,resolveCloudConfig} from '../cloud-config-utils.js';
import {cloudSettingsPanel} from '../cloud-panel.js';
const config={projectUrl:'https://example.supabase.co',publishableKey:'sb_publishable_example',packId:'11111111-2222-4333-8444-555555555555'};
const jwt=payload=>[Buffer.from('{}').toString('base64url'),Buffer.from(JSON.stringify(payload)).toString('base64url'),'signature'].join('.');
test('fresh devices receive one complete published configuration',()=>{
 assert.deepEqual(resolveCloudConfig(config,{}),{...config,managed:true});
 assert.deepEqual(resolveCloudConfig(config,{projectUrl:'https://old.supabase.co',publishableKey:'old',packId:'old'}),{...config,managed:true});
 assert.deepEqual(resolveCloudConfig({},config),{...config,managed:false});
 // A broken deployment must not quietly combine a new URL with an old key/Pack.
 assert.throws(()=>normalizeCloudConfig(resolveCloudConfig({projectUrl:config.projectUrl},config)),/publishable/);
});
test('only normalized public values are accepted',()=>{
 assert.deepEqual(normalizeCloudConfig({...config,projectUrl:config.projectUrl+'/',secret:'do-not-copy'}),config);
 assert.equal(normalizeCloudConfig({...config,publishableKey:jwt({role:'anon',ref:'example'})}).packId,config.packId);
 for(const key of ['sb_secret_private','GOCSPX-private','password',jwt({role:'service_role'}),jwt({role:'authenticated'}),jwt({role:'anon',ref:'wrong'})])assert.throws(()=>normalizeCloudConfig({...config,publishableKey:key}),/publishable/);
 for(const url of ['http://example.supabase.co','https://example.supabase.co.evil.test','https://user:pass@example.supabase.co','https://example.supabase.co/path','https://example.supabase.co?secret=x'])assert.throws(()=>normalizeCloudConfig({...config,projectUrl:url}),/HTTPS/);
 assert.throws(()=>normalizeCloudConfig({...config,packId:'Pack 179'}),/Pack UUID/);
});
test('managed Settings shows Google sign-in with no backend form',()=>{
 const helpers={esc:String,btn:(text,action)=>`<button data-action="${action}">${text}</button>`,field:()=>'<input>',select:()=>'<select>',note:String};
 const html=cloudSettingsPanel({...helpers,state:{configured:true},configured:{...config,managed:true}});
 assert.match(html,/Continue with Google/);assert.doesNotMatch(html,/data-form="cloud-config"/);
 const broken=cloudSettingsPanel({...helpers,state:{configured:false},configured:{...config,managed:true},setupError:'Incomplete config'});
 assert.match(broken,/Incomplete config/);assert.doesNotMatch(broken,/data-form="cloud-config"/);
});
