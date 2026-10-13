import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {resolveCloudConfiguration} from '../cloud-config-validation.js';
import {configureCloud,cloudState,googleCloudLogin,googleCloudLogout,fetchCloudRows} from '../cloud.js';

test('fresh device config drives Google login while membership still controls data access',async()=>{
 const calls=[];
 let currentUser=null,membership=null;
 const mock={
  auth:{
   getUser:async()=>({data:{user:currentUser},error:currentUser?null:{name:'AuthSessionMissingError'}}),
   signInWithOAuth:async options=>{calls.push(['oauth',options]);return {error:null}},
   signOut:async()=>{currentUser=null;return {error:null}}
  },
  rpc:async(name,args)=>{calls.push([name,args]);return {error:null}},
  from:table=>{
   calls.push(['table',table]);
   const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:membership,error:null})};
   return query;
  }
 };
 const config={projectUrl:'https://example.supabase.co',publishableKey:'sb_publishable_test_only',packId:'11111111-2222-4333-8444-555555555555'};
 globalThis.__packopsMockCreateClient=(url,key,options)=>{calls.push(['create',url,key,options]);return mock};
 const hooks=registerHooks({load(url,context,nextLoad){
  if(url==='https://esm.sh/@supabase/supabase-js@2.76.1')return {format:'module',source:'export const createClient=(...args)=>globalThis.__packopsMockCreateClient(...args);',shortCircuit:true};
  return nextLoad(url,context);
 }});
 const previousLocation=globalThis.location;
 globalThis.location={origin:'https://magorski87-png.github.io',pathname:'/PackOps179/'};
 try{
  const chosen=resolveCloudConfiguration(config,{});
  await configureCloud({...chosen,pack:chosen.packId});
  assert.equal(cloudState().configured,true);
  assert.equal(cloudState().authenticated,false);
  assert.equal(calls[0][3].auth.flowType,'pkce');
  await googleCloudLogin();
  assert.deepEqual(calls.find(c=>c[0]==='oauth')[1],{provider:'google',options:{redirectTo:'https://magorski87-png.github.io/PackOps179/#settings'}});
  currentUser={id:'google-user',email:'leader@example.test'};
  await configureCloud({...chosen,pack:chosen.packId});
  assert.equal(cloudState().authenticated,true);
  assert.equal(cloudState().member,null);
  await assert.rejects(()=>fetchCloudRows('roster'),/approved/);
  assert.deepEqual(calls.find(c=>c[0]==='pack_accept_invite')[1],{target_pack:config.packId});
  membership={role:'den_leader',status:'active',den_scopes:['Webelos']};
  await configureCloud({...chosen,pack:chosen.packId});
  assert.equal(cloudState().member.role,'den_leader');
  assert.deepEqual(cloudState().member.den_scopes,['Webelos']);
  membership={...membership,status:'suspended'};
  await configureCloud({...chosen,pack:chosen.packId});
  assert.equal(cloudState().member,null);
  await assert.rejects(()=>fetchCloudRows('roster'),/approved/);
  assert.equal(calls.filter(c=>c[0]==='create').length,1);
  await googleCloudLogout();
  assert.equal(cloudState().authenticated,false);
 }finally{
  hooks.deregister();
  delete globalThis.__packopsMockCreateClient;
  if(previousLocation===undefined)delete globalThis.location;else globalThis.location=previousLocation;
 }
});
