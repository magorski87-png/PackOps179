import {familyRecipients} from './family-invitations.js';
import {familyResults,familyPublicPanel} from './family-ui.js';
export function familyManagerView({roster=[],preview=null,sending=false,forms=[],responses=null,activeId='',lastLink='',query='',events=[],denChoices=[],cloudReady=false,esc,btn,field,select,intro,note,money}){
 const selected=forms.find(f=>f.id===activeId);
 const recipients=familyRecipients(roster,selected?.den_scope||'');
 const totals=responses?familyResults(responses):null;
 const matching=responses?.invitations?.filter(r=>[r.recipient_label,r.recipient_email].some(s=>String(s||'').toLowerCase().includes(query.trim().toLowerCase())))||[];
 return `${intro('All answers in one workspace','Family RSVPs, Polls & Volunteering','Send private invitation links, see responses together, and export without manually reconciling SignUpGenius.')}
 ${!cloudReady?note('A Pack-approved Google login and secure Supabase backend are required for live family invitations. Configure them in Settings first.',true):`
 <section class="panel stack"><h2>Create an RSVP, poll, or volunteer signup</h2>
 <form data-form="family-form-create" class="stack"><div class="form-grid">
 ${field('Response form title','title','text','','required maxlength="150"')}
 ${select('Type','kind',[['rsvp','Event RSVP'],['poll','One-question poll'],['volunteer','Volunteer position']], 'rsvp')}
 ${select('Linked event','eventId',[['','Pack-wide'],...events.map(x=>[x.id,x.title])])}
 ${select('Den (optional)','den',[['','Whole Pack'],...denChoices.map(d=>[d,d])])}
 </div>${field('Description / instructions','description','text','','maxlength="1000"')}
 ${field('Poll choices or volunteer slots (separated by commas)','options','text','','placeholder="Friday, Saturday, Either" maxlength="2000"')}
<p class="meta">Example: <strong>Setup crew, Food service, Cleanup</strong> creates three choices. Use a comma between choices, not inside a choice. For an RSVP, leave this blank.</p>
 <button class="btn" type="submit">Publish response form</button></form>
 <p class="meta">Responses are visible only to authorized leaders. Parents can reply through personal, time-limited links without an account. Send email requires separately configured provider credentials.</p></section>
 <section class="panel stack"><h2>Active and past forms</h2>
 ${forms.length?'<div class="row wrap">'+forms.map(f=>btn(f.title+(f.status==='open'?' · Open':' · '+f.status),'family-open-form',activeId===f.id?'btn':'btn btn-outline',`data-id="${esc(f.id)}"`)).join('')+'</div>':'<p>Start with your next Pack meeting or campout RSVP.</p>'}</section>
 ${selected?`<section class="panel stack"><div class="row-between"><h2>${esc(selected.title)}</h2><span class="pill info">${esc(selected.kind)} · ${esc(selected.status)}</span></div>
 ${totals?`<div class="finance-metrics"><div class="finance-kpi"><small>Invited</small><strong>${totals.invited}</strong></div><div class="finance-kpi"><small>Responded</small><strong>${totals.replied}</strong></div><div class="finance-kpi"><small>Not answered</small><strong>${totals.unanswered}</strong></div>${selected.kind==='rsvp'?`<div class="finance-kpi"><small>Confirmed (adults + children)</small><strong>${totals.adults+totals.children}</strong></div>`:''}</div>`:''}
 <h3>Choose families from the roster</h3><form data-form="family-roster-invite" class="stack"><input type="hidden" name="formId" value="${esc(selected.id)}"><div class="recipient-list">${recipients.map(r=>`<label class="recipient-choice"><input type="checkbox" name="recipient" value="${esc(r.email)}"><span><strong>${esc(r.names.join(', '))}</strong><br>${esc(r.email)}<br><small>${esc(r.guardians.join(', '))}</small></span></label>`).join('')||'<p>No valid guardian emails found for this form’s den. Add a household manually below.</p>'}</div><p class="meta">One invitation per selected email. Siblings sharing an email are grouped. Each email is sent privately, never as a group CC.</p><label class="review-toggle"><input type="checkbox" name="sendEmail" value="yes"> Send email after preview and confirmation</label><button class="btn" type="submit">Preview selected invitations</button></form>
 <h3>Or add a household manually</h3><form data-form="family-invite" class="stack"><input type="hidden" name="formId" value="${esc(selected.id)}"><div class="form-grid">${field('Household / family label','recipientLabel','text','','required maxlength="120"')}${field('Email address (optional if copying link)','recipientEmail','email','')}</div><label class="review-toggle"><input type="checkbox" name="sendEmail" value="yes"> Send through configured email provider (with household consent)</label><button type="submit" class="btn">Preview invitation</button></form>
 ${preview?`<section class="panel stack" aria-label="Invitation preview"><h3>${sending?'Sending…':'Review invitations'}</h3><p>${preview.recipients.length} separate household invitations · ${preview.sendEmail?'Email delivery':'Private links only — no email'}</p><strong>${esc(preview.subject)}</strong><pre class="message-preview">${esc(preview.message)}</pre><ul>${preview.recipients.map(r=>`<li><strong>${esc(r.label)}</strong> — ${esc(r.email||'No email')} · ${esc(r.status)}${r.error?'<p>'+esc(r.error)+'</p>':''}${r.url?'<p style="overflow-wrap:anywhere">Private link: '+esc(r.url)+'</p>':''}</li>`).join('')}</ul>${preview.recipients.some(r=>r.status==='pending')?btn(preview.sendEmail?'Confirm & send invitations':'Confirm & create private links','family-send-preview','btn',sending?'disabled':''):''}${btn('Close preview','family-cancel-preview','btn btn-outline',sending?'disabled':'')}<p class="meta">A provider accepting email does not guarantee inbox delivery. If delivery is not confirmed, check before sending another invitation. Private links belong only to their listed household.</p></section>`:''}
 ${lastLink?`<div class="privacy-strip"><strong>New private invitation link</strong><p style="overflow-wrap:anywhere">${esc(lastLink)}</p>${btn('Copy link','family-copy-link','btn btn-outline')}</div>`:''}
 ${responses?`<div class="row-between"><h3>Responses</h3>${btn('Export full response CSV','family-export','btn btn-outline')}</div>
 <div class="field"><label>Search households</label><input class="input" type="search" name="family-search" value="${esc(query)}" placeholder="Filter invitations and replies"></div>
 <div class="finance-table-wrap"><table class="finance-table"><thead><tr><th>Family / email</th><th>Response</th><th>Adults</th><th>Children</th><th>Choice</th></tr></thead><tbody>${matching.map(inv=>{const reply=responses.responses.find(x=>x.invitation_id===inv.id),a=reply?.answer||{};return `<tr><td>${esc(inv.recipient_label)}<br><small>${esc(inv.recipient_email||'No email')} · ${esc(inv.delivery_status||'link-created')}</small></td><td>${esc(a.status||'No response')}</td><td>${esc(String(a.adults??''))}</td><td>${esc(String(a.children??''))}</td><td>${esc(a.choice||'')}</td></tr>`}).join('')||'<tr><td colspan="5">No matching households</td></tr>'}</tbody></table></div>`:''}
 </section>`:''}
 `}`;
}
export function denWorkspaceView({state,den='',allowed=[],esc,btn,field,select,textarea,intro,note}){
 const plans=state.denPlans.filter(x=>x.den===den).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
 const roster=state.roster.filter(x=>(x.denGroup||x.den)===den);
 const progress=state.adventureProgress.filter(x=>x.den===den);
 const attendees=state.attendance.filter(x=>x.den===den);
 return `${intro('Plan a great den meeting','Den Leader Workspace','Den meetings, preparation and internal adventure progress—all in one place, without pretending to post to Scoutbook Plus.')}
 <section class="panel stack"><div class="row-between"><h2>My den</h2><span class="pill">${roster.length} roster entries · ${plans.length} meeting plans</span></div>
 ${select('Den','den-choice',allowed.map(x=>[x,x]),den,'data-change="den-choice"')}
 <div class="finance-metrics"><div class="finance-kpi"><small>Meetings recorded</small><strong>${plans.length}</strong></div><div class="finance-kpi"><small>Adventure progress items</small><strong>${progress.length}</strong></div><div class="finance-kpi"><small>Attendance checkoffs</small><strong>${attendees.length}</strong></div></div></section>
 ${den?`<div class="split"><section class="panel stack"><h2>Meeting preparation</h2><form data-form="den-plan" class="stack"><div class="form-grid">${field('Meeting or adventure title','title','text','','required')}${field('Date','date','date','','required')}</div>${textarea('Meeting activities / simple run of show','agenda','')}${textarea('Equipment & materials needed','supplies','')}<button class="btn" type="submit">Save den meeting plan</button></form>
 ${plans.map(x=>`<div class="list-item"><strong>${esc(x.title)}</strong><p class="meta">${esc(x.date)}</p><p>${esc(x.agenda||'')}</p><p class="meta">Supplies: ${esc(x.supplies||'Not specified')}</p></div>`).join('')}
 </section><section class="panel stack"><h2>Internal adventure checklist</h2><p>Choose an adventure title and a Scout to record working progress. This is not an official Scoutbook advancement entry.</p>
 <form data-form="den-progress" class="stack">${field('Cub Scout adventure','adventure','text','','required maxlength="140"')}${select('Scout','scoutId',roster.map(x=>[x.id,(x.name||((x.firstName||'')+' '+(x.lastName||'')))||x.id]))}${select('Status','status',[['planned','Planned'],['started','Started'],['ready','Ready for Scoutbook review']])}<button class="btn" type="submit">Record progress</button></form>
 ${progress.map(p=>`<div class="list-item"><strong>${esc(p.adventure)}</strong><div class="meta">${esc(roster.find(x=>x.id===p.scoutId)?.name||'Scout')} · ${esc(p.status)}</div></div>`).join('')}
 </section></div>`:note('Assign a den to your approved leader account in Settings before planning.',true)}
 `;
}
export {familyPublicPanel};
