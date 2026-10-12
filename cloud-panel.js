// PackOps secure cloud connection controls. Browser keys are public publishable keys only.
export function cloudSettingsPanel({state,configured,setupError='',members=[],invites=[],esc,btn,field,select,note}){
 const role=state.member?.role;
 const admin=['admin','cubmaster'].includes(role);
 const text=state.authenticated?state.member?'Approved · '+role:'Google sign-in successful; your Pack membership is awaiting approval':'Not signed in';
 return `<section class="panel stack"><div class="row-between"><div><h2>Secure shared PackOps · Supabase + Google</h2><p>Approved leaders share one database, rather than maintaining separate phone and PC records. Parents can respond to private RSVP links without opening the leadership app.</p></div><span class="pill ${state.member?'success':'warning'}">${esc(text)}</span></div>
 ${setupError?note('Connection issue: '+esc(setupError),true):''}
 <form data-form="cloud-config" class="stack"><div class="form-grid">
 ${field('Supabase Project URL (public)','projectUrl','url',configured.projectUrl||'','required placeholder="https://PROJECT.supabase.co"')}
 ${field('Supabase publishable or anon key (public)','publishableKey','text',configured.publishableKey||'','required autocomplete="off"')}
 ${field('Pack UUID','packId','text',configured.packId||'','required')}
 </div><div class="form-actions"><button class="btn" type="submit">Connect to Pack backend</button></div></form>
 <p class="meta">These are public browser connection identifiers, never service_role credentials. Google login is configured separately in Supabase Auth and does not replace your existing read-only Google Calendar OAuth.</p>
 ${state.configured?`<div class="row wrap">${!state.authenticated?btn('Continue with Google','cloud-sign-in','btn'):btn('Sign out of PackOps','cloud-sign-out','btn btn-outline')}${state.member?btn('Refresh shared records','cloud-refresh','btn btn-outline'):''}</div>`:''}
 ${state.member?`<div class="privacy-strip">Shared Pack: ${esc(state.packId)} · Signed in as ${esc(state.user?.email||'approved leader')}. Your approved role and den permissions are enforced in PostgreSQL.</div>`:''}
 ${admin?`<section class="stack"><h3>Users & permissions</h3><p>Invite a leader by the email they use with Google. Only an administrator can grant access. After that person signs in, their invitation is activated for the assigned role and den.</p>
 <form data-form="cloud-invite-leader" class="stack"><div class="form-grid">
 ${field('Leader Google email','email','email','','required')}
 ${select('Role','role',[['den_leader','Den Leader'],['volunteer','Volunteer'],['treasurer','Treasurer'],['cubmaster','Cubmaster'],['admin','Administrator']])}
 ${field('Den assignments (comma-separated)','dens','text','','placeholder="Webelos, Bear"')}
 </div><button class="btn" type="submit">Approve / invite leader</button></form>
 ${invites.length?`<div class="meta">Pending invitations: ${invites.map(x=>esc(x.email)+' ('+esc(x.role)+')').join(' · ')}</div>`:''}
 ${members.length?`<div class="finance-table-wrap"><table class="finance-table"><thead><tr><th>Account ID</th><th>Role</th><th>Dens</th><th>Status</th><th>Save</th></tr></thead><tbody>${members.map(m=>`<tr><td><small>${esc(m.user_id)}</small></td><td><select class="select" id="member-role-${esc(m.user_id)}">${[['admin','Admin'],['cubmaster','Cubmaster'],['treasurer','Treasurer'],['den_leader','Den Leader'],['volunteer','Volunteer']].map(([v,t])=>`<option value="${v}" ${m.role===v?'selected':''}>${t}</option>`).join('')}</select></td><td><input class="input" id="member-den-${esc(m.user_id)}" value="${esc((m.den_scopes||[]).join(', '))}"></td><td><select class="select" id="member-status-${esc(m.user_id)}"><option value="active" ${m.status==='active'?'selected':''}>Active</option><option value="suspended" ${m.status==='suspended'?'selected':''}>Suspended</option></select></td><td>${btn('Save','cloud-update-role','btn btn-small',`data-id="${esc(m.user_id)}"`)}</td></tr>`).join('')}</tbody></table></div>`:''}
 <h3>Migrate existing device data</h3><p>Copies your existing local Pack records into the shared database without erasing them. Existing server records with matching IDs are preserved. Review your roster first and migrate only from a trusted device.</p>${btn('Copy existing local records to Pack cloud','cloud-migrate','btn btn-outline')}
 </section>`:''}</section>`;
}
