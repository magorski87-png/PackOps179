// Browser-only configuration normalization. Do not put OAuth client secrets here.
// OAuth web Client IDs and restricted Picker API keys are public browser identifiers.
export function normalizeGoogleConfiguration(clientId,apiKey=''){
 const id=String(clientId||'').trim();
 const key=String(apiKey||'').trim();
 if(!id)throw Error('Paste the OAuth WEB Client ID (not the Picker API key) in Settings. It ends in .apps.googleusercontent.com.');
 if(!/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(id))throw Error('That is not a Google OAuth Web Client ID. Copy the CLIENT ID from Google Cloud → Google Auth Platform → Clients. It should end in .apps.googleusercontent.com (not start with AIza).');
 if(key&&/\s/.test(key))throw Error('The Google Picker API key cannot contain spaces or line breaks. Copy the API key again.');
 return {clientId:id,apiKey:key};
}
