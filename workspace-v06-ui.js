import {familyRecipients} from './family-invitations.js';
import {familyResults,familyPublicPanel} from './family-ui.js';
export function familyManagerView({roster=[],preview=null,sending=false,forms=[],responses=null,activeId='',lastLink='',query='',events=[],denChoices=[],cloudReady=false,esc,btn,field,select,textarea,intro,note,money}){
 const selected=forms.find(f=>f.id===activeId);
 const recipients=familyRecipients(roster,selected?.den_scope||'');
 const totals=responses?familyResults(responses):null;
 const matching=responses?.invitations?.filter(r=>[r.recipient_label,r.recipient_email].some(s=>String(s||'').toLowerCase().includes(query.trim().toLowerCase())))||[];
 return `${intro('All answers in one workspace','Family RSVPs, Polls & Volunteering','Send private invitation links, see responses together, and export without manually reconciling SignUpGenius.')}
 <section class="panel stack"><span class="kicker">Family invitation notes</span><h2>Send a note to selected families</h2><p>Publish an RSVP, poll, or signup below. It opens automatically so you can select households from the roster or add one manually, write an optional note, and preview each invitation before creating private links.</p><p class="meta">Each household gets its own link. Publishing or previewing does not send email; email delivery requires the Pack sender to be configured.</p></section>
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
 ${forms.length?'<div class="row wrap">'+forms.map(f=>btn(f.title+(f.status==='open'?' · Open':' · '+f.status),'family-open-form',activeId===f.id?'btn':'btn btn-outline',`data-id="${esc(f.id)}"`)).join('')+'</div>':'<p>No forms yet. Use “Publish response form” above; the family selection and note fields appear as soon as it opens.</p>'}</section>
 ${selected?`<section class="panel stack"><div class="row-between"><h2>${esc(selected.title)}</h2><span class="pill info">${esc(selected.kind)} · ${esc(selected.status)}</span></div>
 ${totals?`<div class="finance-metrics"><div class="finance-kpi"><small>Invited</small><strong>${totals.invited}</strong></div><div class="finance-kpi"><small>Responded</small><strong>${totals.replied}</strong></div><div class="finance-kpi"><small>Not answered</small><strong>${totals.unanswered}</strong></div>${selected.kind==='rsvp'?`<div class="finance-kpi"><small>Confirmed (adults + children)</small><strong>${totals.adults+totals.children}</strong></div>`:''}</div>`:''}
 <h3>Choose families from the roster</h3><form data-form="family-roster-invite" class="stack"><input type="hidden" name="formId" value="${esc(selected.id)}"><div class="recipient-list">${recipients.map(r=>`<label class="recipient-choice"><input type="checkbox" name="recipient" value="${esc(r.email)}"><span><strong>${esc(r.names.join(', '))}</strong><br>${esc(r.email)}<br><small>${esc(r.guardians.join(', '))}</small></span></label>`).join('')||'<p>No valid guardian emails found for this form’s den. Add a household manually below.</p>'}</div><p class="meta">One invitation per selected email. Siblings sharing an email are grouped. Each email is sent privately, never as a group CC.</p>${textarea('Note for selected families (optional)','note','','maxlength="1000"')}<label class="review-toggle"><input type="checkbox" name="sendEmail" value="yes"> Send email after preview and confirmation</label><button class="btn" type="submit">Preview selected invitations</button></form>
 <h3>Or add a household manually</h3><form data-form="family-invite" class="stack"><input type="hidden" name="formId" value="${esc(selected.id)}"><div class="form-grid">${field('Household / family label','recipientLabel','text','','required maxlength="120"')}${field('Email address (optional if copying link)','recipientEmail','email','')}</div>${textarea('Note for this household (optional)','note','','maxlength="1000"')}<label class="review-toggle"><input type="checkbox" name="sendEmail" value="yes"> Send through configured email provider (with household consent)</label><button type="submit" class="btn">Preview invitation</button></form>
 ${preview?`<section class="panel stack" aria-label="Invitation preview"><h3>${sending?'Sending…':'Review invitations'}</h3><p>${preview.recipients.length} separate household invitations · ${preview.sendEmail?'Email delivery':'Private links only — no email'}</p><strong>${esc(preview.subject)}</strong><pre class="message-preview">${esc(preview.message)}</pre><ul>${preview.recipients.map(r=>`<li><strong>${esc(r.label)}</strong> — ${esc(r.email||'No email')} · ${esc(r.status)}${r.error?'<p>'+esc(r.error)+'</p>':''}${r.url?'<p style="overflow-wrap:anywhere">Private link: '+esc(r.url)+'</p>':''}</li>`).join('')}</ul>${preview.recipients.some(r=>r.status==='pending')?btn(preview.sendEmail?'Confirm & send invitations':'Confirm & create private links','family-send-preview','btn',sending?'disabled':''):''}${btn('Close preview','family-cancel-preview','btn btn-outline',sending?'disabled':'')}<p class="meta">A provider accepting email does not guarantee inbox delivery. If delivery is not confirmed, check before sending another invitation. Private links belong only to their listed household.</p></section>`:''}
 ${lastLink?`<div class="privacy-strip"><strong>New private invitation link</strong><p style="overflow-wrap:anywhere">${esc(lastLink)}</p>${btn('Copy link','family-copy-link','btn btn-outline')}</div>`:''}
 ${responses?`<div class="row-between"><h3>Responses</h3>${btn('Export full response CSV','family-export','btn btn-outline')}</div>
 <div class="field"><label>Search households</label><input class="input" type="search" name="family-search" value="${esc(query)}" placeholder="Filter invitations and replies"></div>
 <div class="finance-table-wrap"><table class="finance-table"><thead><tr><th>Family / email</th><th>Response</th><th>Adults</th><th>Children</th><th>Choice</th></tr></thead><tbody>${matching.map(inv=>{const reply=responses.responses.find(x=>x.invitation_id===inv.id),a=reply?.answer||{};return `<tr><td>${esc(inv.recipient_label)}<br><small>${esc(inv.recipient_email||'No email')} · ${esc(inv.delivery_status||'link-created')}</small></td><td>${esc(a.status||'No response')}</td><td>${esc(String(a.adults??''))}</td><td>${esc(String(a.children??''))}</td><td>${esc(a.choice||'')}</td></tr>`}).join('')||'<tr><td colspan="5">No matching households</td></tr>'}</tbody></table></div>`:''}
 </section>`:''}
 `}`;
}
export function denWorkspaceView({state,den='',allowed=[],catalog=[],planId='',preview=null,esc,btn,field,select,textarea,intro,note}){
 const plans=state.denPlans.filter(x=>x.den===den).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
 const roster=state.roster.filter(x=>(x.denGroup||x.den)===den);
 const progress=state.adventureProgress.filter(x=>x.den===den);
 const plan=plans.find(x=>x.id===planId);
 const names=ids=>(ids||[]).map(id=>roster.find(r=>r.id===id)?.name).filter(Boolean);
 const adventures=catalog.filter(x=>x.den===den);
 return `${intro('Plan a great den meeting','Den Leader Workspace','Prepare meetings, record attendance and internal adventure progress. Official advancement remains in Scoutbook Plus.')}
 <section class="panel stack"><div class="row-between"><h2>My den</h2><span class="pill">${roster.length} Scouts · ${plans.length} saved meetings</span></div>
 ${select('Den','den-choice',allowed.map(x=>[x,x]),den,'data-change="den-choice"')}
 <div class="row wrap">${btn('New meeting','den-new-plan','btn btn-outline')}${plans.map(x=>btn(x.title+' · '+x.date,'den-open-plan',planId===x.id?'btn':'btn btn-outline btn-small',`data-id="${esc(x.id)}"`)).join('')}</div></section>
 ${den?`<div class="split"><section class="panel stack"><h2>${plan?'Saved meeting details':'Plan a meeting'}</h2>
 <form data-form="den-plan" data-id="${esc(plan?.id||'')}" class="stack">
 <div class="form-grid">${field('Meeting or adventure title','title','text',plan?.title||'','required maxlength="140"')}${field('Date','date','date',plan?.date||'','required')}${field('Location','location','text',plan?.location||'','maxlength="240"')}</div>
 ${textarea('Activities / run of show','agenda',plan?.agenda||'')}${textarea('Equipment & materials','supplies',plan?.supplies||'')}
 <h3>Who attended?</h3><p>Check Scouts who attended; you can return and correct this later.</p>
 <div class="recipient-list">${roster.map(r=>`<label class="recipient-choice"><input type="checkbox" name="attendee" value="${esc(r.id)}" ${plan?.attendeeIds?.includes(r.id)?'checked':''}><span>${esc(r.name||r.id)}</span></label>`).join('')||'<p>No Scouts available in this den roster.</p>'}</div>
 <div class="row wrap"><button class="btn" type="submit">${plan?'Update meeting':'Save meeting'}</button>${btn('Discard unfinished edits','discard-den-draft','btn btn-ghost')}</div><p class="meta">Unfinished edits are saved in this browser session.</p></form>
 ${plan?`<div class="note"><strong>Saved meeting:</strong> ${esc(plan.title)} · ${esc(plan.date)} · ${esc(plan.location||'No location')}<br>Attended: ${esc(names(plan.attendeeIds).join(', ')||'Not recorded')}<br>Adventure records: ${progress.filter(x=>x.planId===plan.id).length}</div>`:''}
 </section><section class="panel stack"><h2>Adventures</h2><p>Select an adventure, then check every Scout who worked on it. Progress stays in PackOps until entered in Scoutbook Plus.</p>
 <form data-form="den-progress" class="stack">${select('Saved meeting (optional)','planId',[['','No linked meeting'],...plans.map(x=>[x.id,x.title+' · '+x.date])],plan?.id||'')}
 <div class="field"><label for="adventure-name">Adventure</label><input class="input" id="adventure-name" name="adventure" list="adventure-names" required maxlength="140"><datalist id="adventure-names">${adventures.map(a=>`<option value="${esc(a.title)}"></option>`).join('')}</datalist></div>
 ${select('Status','status',[['planned','Planned'],['started','Started'],['ready','Ready for Scoutbook review']])}
 <div class="recipient-list">${roster.map(r=>`<label class="recipient-choice"><input type="checkbox" name="scoutId" value="${esc(r.id)}"><span>${esc(r.name||r.id)}</span></label>`).join('')}</div>
 <button class="btn" type="submit">Record for selected Scouts</button></form>
 ${progress.map(p=>`<div class="list-item"><strong>${esc(p.adventure)}</strong><div class="meta">${esc(roster.find(x=>x.id===p.scoutId)?.name||'Scout')} · ${esc(p.status)}${p.planId?' · '+esc(plans.find(x=>x.id===p.planId)?.title||'Meeting'):''}</div></div>`).join('')}
 <div class="divider"></div><h3>Adventure catalog</h3><p>Import a CSV using the sample format. Review rows before saving. <a href="https://www.scouting.org/programs/cub-scouts/adventures/" target="_blank" rel="noopener noreferrer">Check the official adventure directory ↗</a></p>
 <a class="btn btn-outline btn-small" href="./adventure-example.csv" download="PackOps-adventure-example.csv">Download example CSV</a>
 <form data-form="adventure-csv" class="stack"><input class="input" type="file" name="file" accept=".csv,text/csv" required><button class="btn btn-outline" type="submit">Preview adventure CSV</button></form>
 ${preview?`<div class="note"><strong>${preview.items.length} valid rows</strong> · ${preview.errors.length} issues${preview.errors.length?'<br>'+preview.errors.map(esc).join('<br>'):''}</div>${!preview.errors.length?btn('Import reviewed adventures','adventure-import','btn'):''}`:''}
 <p class="meta">${adventures.length} catalog entries for this den. PackOps does not automatically sync or certify the official catalog.</p>
 </section></div>`:note('Assign a den to your approved leader account in Settings before planning.',true)}
 `;
}
export {familyPublicPanel};
