// PUBLIC deployment configuration. Set these ONCE for every leader/device.
// This file is served by both branch-based GitHub Pages and npm run build.
// Confirm packId with: select id, name from public.packs;
// Never use an Auth user UUID as the Pack UUID. Values remain blank until confirmed.
// Only the project URL, publishable (or legacy anon) key and Pack UUID belong here.
// Google OAuth secrets stay in Supabase Auth; service keys/passwords stay server-side.
export const PACK_CLOUD_CONFIG={projectUrl:'',publishableKey:'',packId:''};
