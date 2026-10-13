import test from 'node:test';
import assert from 'node:assert/strict';
import {authorize,disconnect} from '../drive.js';
import {calendarAuthorize} from '../calendar-api.js';
test('Calendar and Drive reuse session tokens and avoid forced repeated consent',async()=>{
 const calls=[];
 globalThis.window={google:{accounts:{oauth2:{initTokenClient:config=>({requestAccessToken:options=>{
  calls.push({config,options});config.callback({access_token:'test-token',expires_in:3600});
 }})}}}};
 try{
  await authorize('test-client');await authorize('test-client');
  await calendarAuthorize('test-client');await calendarAuthorize('test-client');
  assert.equal(calls.length,2);assert.ok(calls.every(c=>c.options.prompt==='select_account'));
  assert.deepEqual(calls.map(c=>c.config.scope),['https://www.googleapis.com/auth/drive.file','https://www.googleapis.com/auth/calendar.readonly']);
 }finally{disconnect();delete globalThis.window}
});
