// Deploy with --no-verify-jwt; the handler explicitly verifies the bearer user.
// Database reads use the caller's JWT and RLS, never a service_role client.
import {createClient} from 'npm:@supabase/supabase-js@2';
import {leaderInviteHandler} from './handler.js';
Deno.serve(leaderInviteHandler({
 makeClient:(bearer:string)=>createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{
  global:{headers:{Authorization:'Bearer '+bearer}},auth:{persistSession:false,autoRefreshToken:false}
 }),
 publicSite:Deno.env.get('PUBLIC_SITE_ORIGIN')||'https://magorski87-png.github.io',
 sitePath:Deno.env.get('PUBLIC_SITE_PATH')||'/PackOps179/',
 apiKey:Deno.env.get('RESEND_API_KEY')||'',
 from:Deno.env.get('RSVP_FROM_EMAIL')||''
}));
