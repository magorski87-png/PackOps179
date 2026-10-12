import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGoogleConfiguration} from '../google-config.js';

const CLIENT='1234567890-abc0123456789.apps.googleusercontent.com';
test('Google Client ID normalizes user-pasted whitespace without changing OAuth identifier',()=>{
 const config=normalizeGoogleConfiguration('  '+CLIENT+'  ','  AIzaSyExamplePickerKey  ');
 assert.equal(config.clientId,CLIENT);
 assert.equal(config.apiKey,'AIzaSyExamplePickerKey');
});
test('Sign-in entry rejects Picker key accidentally pasted as Client ID',()=>{
 assert.throws(()=>normalizeGoogleConfiguration('AIzaSyExamplePickerKey'),/not a Google OAuth Web Client ID/);
 assert.throws(()=>normalizeGoogleConfiguration(''),/Paste the OAuth WEB Client ID/);
 assert.throws(()=>normalizeGoogleConfiguration('secret.apps.googleusercontent.com\/oauth'),/not a Google OAuth/);
});
test('Picker API key is optional for Calendar-only connection',()=>{
 assert.equal(normalizeGoogleConfiguration(CLIENT).apiKey,'');
 assert.throws(()=>normalizeGoogleConfiguration(CLIENT,'a key with spaces'),/cannot contain spaces/);
});
