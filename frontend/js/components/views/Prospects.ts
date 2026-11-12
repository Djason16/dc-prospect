// Every prospect (search, filters) and the figures of the plan (week, since the start, per zone)
import { $, esc, pct, labelCells } from '../../utils/dom.js'
import { store } from '../../stores/state.js'
import type { DayState, Figures, Stats, TrackedProspect } from '../../types.js'

type RateKey = 'replyRate' | 'meetingRate' | 'signingRate' | 'stopRate'

// [label, figure, threshold, goal shown, higher is better, advice, figure it is based on]
const GOALS: [string, RateKey, number, string, boolean, string, keyof Figures][] = [
    ['Taux de réponse', 'replyRate', 8, '8 % ou plus', true, 'Mieux personnaliser l\'accroche, tester un autre objet', 'contacted'],
    ['Taux de rendez-vous', 'meetingRate', 30, '30 % ou plus', true, 'Proposer plus tôt la maquette offerte ou l\'appel de 15 min', 'replies'],
    ['Taux de signature', 'signingRate', 25, '25 % ou plus', true, 'Revoir la proposition et la réponse aux objections', 'proposals'],
    ['STOP', 'stopRate', 2, 'moins de 2 %', false, 'Mieux cibler (le besoin doit être visible)', 'contacted'],
]

// Outcome of a call: [action, button]
const CALL_OUTCOMES: [string, string][] = [['interested', 'Intéressé'], ['noAnswer', 'Pas de réponse'], ['later', 'Rappeler plus tard'], ['no', 'Pas intéressé']]

// the table is rebuilt every 15 s: the open card and the notes being typed stay
export const reopenTable = (): void => renderTable()

export function renderProspects(): void {
    const { day, settings } = store
    if (!day) return
    const el = $('#view-prospects')
    if (!el.dataset.mounted) {
        el.dataset.mounted = '1'
        el.innerHTML = `
        <div class="page-head"><div><p class="label eyebrow">Suivi et résultats</p><h1 class="display display-l">Prospects</h1></div>
            <p class="muted" id="spreadsheet-link">Le même tableau est dans ton dossier de données (Suivi prospection.xlsx).</p></div>
        <div class="grid g4 section" id="figure-tiles"></div>
        <details class="section"><summary class="label eyebrow" style="cursor:pointer">Objectifs du plan, zones, métiers et objets</summary><div id="figure-details" style="margin-top:1rem"></div></details>
        <details class="section" id="call-section" hidden><summary class="label eyebrow" style="cursor:pointer" id="call-title">À appeler</summary><div id="call-list" style="margin-top:1rem"></div></details>
        <details class="section"><summary class="label eyebrow" style="cursor:pointer">Ajouter mes prospects ou exclure des contacts</summary><div class="grid g2" style="margin-top:1rem">
            <div class="tile"><p class="label">Importer ma liste (CSV)</p>
                <p class="muted small">Un fichier exporté d'Excel ou de Google Sheets, avec au moins une colonne « Entreprise », une colonne « Ville » ou « Code postal », et une colonne « E-mail », « Site » ou « Téléphone » (facultatif : Métier, Contact). Chaque entreprise passe les mêmes contrôles : registre, site, e-mail publié, STOP. 300 lignes au plus.</p>
                <input type="file" id="import-file" accept=".csv,text/csv" style="margin:.5rem 0"><div class="actions"><button class="btn small" data-import>Importer</button></div></div>
            <div class="tile"><p class="label">Ne jamais contacter</p>
                <p class="muted small">Tes clients, tes partenaires, tes proches : leurs e-mails ou leurs domaines (exemple : boulangerie-dupont.fr), séparés par des virgules ou des retours à la ligne. DC Prospect ne leur écrira jamais.<span id="blocked-count"></span></p>
                <textarea id="do-not-contact" style="min-height:70px" placeholder="client@exemple.fr, partenaire.fr"></textarea><div class="actions"><button class="btn small" data-do-not-contact>Ajouter</button></div></div>
        </div></details>
        <details class="section" id="discarded-section"><summary class="label eyebrow" style="cursor:pointer" id="discarded-title">Écartés</summary><div id="discarded-list" style="margin-top:1rem"></div></details>
        <div class="filters"><input type="search" id="search" placeholder="Chercher une entreprise, une ville, un e-mail, un mot de ses réponses ou de mes notes..."><select id="status-filter"><option value="">Tous les statuts</option></select><select id="zone-filter"><option value="">Toutes les zones</option></select></div>
        <table class="table wide" id="tracking-table"></table>`
        for (const s of ['#search', '#status-filter', '#zone-filter']) $(s).addEventListener('input', renderTable)
    }
    const { week: w, total: t } = day.stats
    $('#figure-tiles').innerHTML = [['Contactés cette semaine', w.contacted], ['Réponses cette semaine', w.replies], ['Taux de réponse (total)', pct(t.replyRate)], ['Clients (total)', t.clients]]
        .map(([label, n]): string => `<div class="tile"><p class="label">${label}</p><div class="figure">${n}</div></div>`).join('')
    $('#figure-details').innerHTML = `<table class="table"><thead><tr><th>Indicateur</th><th>Depuis le début</th><th>Objectif</th><th>Verdict</th></tr></thead><tbody>
        ${GOALS.map(([label, k, threshold, goal, higher, advice, base]) => {
            const v = t[k], enough = t[base] >= 30 || k === 'signingRate', ok = higher ? v >= threshold : v < threshold
            return `<tr><td>${label}</td><td>${pct(v)}</td><td>${goal}</td><td>${!enough ? '<span class="muted">pas encore assez de données (30 minimum)</span>' : ok ? '<span style="color:var(--mint)">OK</span>' : esc(advice)}</td></tr>`
        }).join('')}</tbody></table>
        <table class="table" style="margin-top:1.5rem"><thead><tr><th>Zone</th><th>Contactés</th><th>Réponses</th><th>Taux de réponse</th><th>Clients</th></tr></thead><tbody>
        ${(day.stats.zones || []).map((z) => `<tr><td>${esc(z.zone)}</td><td>${z.contacted}</td><td>${z.replies}</td><td>${pct(z.replyRate)}</td><td>${z.clients}</td></tr>`).join('')}</tbody></table>
        <p class="muted small" style="margin-top:1.5rem">Par métier : « refusent la prospection » = écartés grâce au registre ; un métier qui ne répond pas après 20 e-mails peut être désactivé (Réglages, Avancé, Métiers).</p>
        <table class="table wide"><thead><tr><th>Métier</th><th>Trouvés</th><th>Refusent la prospection</th><th>Chauds</th><th>À appeler</th><th>Contactés</th><th>Réponses</th><th>Taux de réponse</th><th>Clients</th></tr></thead><tbody>
        ${(day.stats.trades || []).map((r) => `<tr><td>${esc(r.trade)}</td><td>${r.found}</td><td>${r.opposed}</td><td>${r.hot}</td><td>${r.toCall}</td><td>${r.contacted}</td><td>${r.replies}</td><td>${pct(r.replyRate)}</td><td>${r.clients}</td></tr>`).join('') || '<tr><td colspan="9" class="muted">Pas encore de données.</td></tr>'}</tbody></table>
        ${learningBlock(day.stats)}
        <p class="muted small" style="margin-top:1.5rem">Deux styles d'objet : chacun est essayé 10 fois, puis celui qui fait le plus répondre est utilisé de plus en plus souvent.</p>
        <table class="table"><thead><tr><th>Style d'objet</th><th>Contactés</th><th>Réponses</th><th>Taux de réponse</th></tr></thead><tbody>
        ${(day.stats.subjects || []).map((s) => `<tr><td>${s.style} : ${s.style === 'A' ? 'question courte' : 'nom + bénéfice'}</td><td>${s.contacted}</td><td>${s.replies}</td><td>${s.contacted >= 30 ? pct(s.replyRate) : `<span class="muted">${pct(s.replyRate)} (pas encore assez)</span>`}</td></tr>`).join('')}</tbody></table>`
    // Businesses without a published e-mail: by phone, the best first, with a sentence to open the call
    const calls = day.toCall || []
    $('#call-section').hidden = !calls.length
    $('#call-title').textContent = `À appeler (${calls.length} sans e-mail publié)`
    const out = day.discarded || []
    $('#discarded-title').textContent = `Écartés (${out.length}) : pourquoi, et remettre si c'était une erreur`
    $('#discarded-list').innerHTML = out.length ? `<table class="table"><thead><tr><th>Entreprise</th><th>Pourquoi</th><th></th></tr></thead><tbody>${out.map((p) => `<tr><td><strong>${esc(p.company)}</strong><br><span class="muted small">${esc(p.trade || '')}, ${esc(p.city || '')}</span></td><td class="small">${esc(p.reason)}</td>
        <td>${p.restorable ? `<button class="btn link small" data-restore="${esc(p.id)}">Remettre</button>` : '<span class="muted small" title="Refus légal : ne peut pas être remis">définitif</span>'}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small">Personne pour l\'instant.</p>'
    $('#blocked-count').textContent = day.blockedDomains ? ` ${day.blockedDomains} domaines exclus pour l'instant.` : ''
    $('#call-list').innerHTML = `<table class="table"><thead><tr><th>Entreprise</th><th>Téléphone</th><th>Pourquoi</th><th>Pour ouvrir l'appel</th></tr></thead><tbody>
        ${calls.map((c) => `<tr><td><strong>${esc(c.company)}</strong><br><span class="muted small">${esc(c.trade)}, ${esc(c.city)}${c.level ? ' · ' + esc(c.level) : ''}</span>${c.website ? `<br><a class="small" href="${esc(c.website)}" target="_blank" rel="noopener">${esc(c.website.replace(/^https?:\/\//, ''))}</a>` : ''}</td>
            <td>${c.phone ? `<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : '<span class="muted">aucun</span>'}</td><td class="small">${esc(c.signal || '')}</td><td class="small">${c.contact ? `Demander ${esc(c.contact)}. ` : ''}${esc(c.callHook || '')}${c.calls ? `<br><span class="muted">${c.calls} appel(s) déjà</span>` : ''}
            <div class="actions" style="margin-top:.4rem"><button class="btn link small" data-reminder="${esc(c.id)}" data-title="Appeler ${esc(c.company)}" data-details="${esc(`${c.company} (${c.city}) : ${c.phone || ''}. ${c.contact ? 'Demander ' + c.contact + '. ' : ''}${c.callHook || ''}`)}">Rappel agenda</button>${CALL_OUTCOMES.map(([k, t]) => `<button class="btn link small" data-call="${k}" data-id="${esc(c.id)}">${t}</button>`).join('')}</div></td></tr>`).join('')}</tbody></table>`
    if (settings?.accounts?.google?.spreadsheet) $('#spreadsheet-link').innerHTML = `Le même tableau est dans <a href="${esc(settings.accounts.google.spreadsheet)}" target="_blank">Google Sheets</a>, toujours à jour.`
    if (!document.activeElement?.matches?.("[data-notes]")) renderTable() // not while I type my notes
    labelCells($('#figure-details')); labelCells($('#discarded-list')); labelCells($('#call-list'))
}

function renderTable(): void {
    const day = store.day as DayState // the table is only drawn once the state of the day is there
    const fill = (select: HTMLSelectElement, list: string[]): void => { const v = select.value; select.innerHTML = select.options[0].outerHTML + list.map((x) => `<option${x === v ? ' selected' : ''}>${esc(x)}</option>`).join('') }
    fill($<HTMLSelectElement>('#status-filter'), [...new Set(day.tracked.map((p) => p.status))])
    fill($<HTMLSelectElement>('#zone-filter'), [...new Set(day.tracked.map((p) => p.zone).filter((z): z is string => !!z))])
    const q = $<HTMLInputElement>('#search').value.toLowerCase(), status = $<HTMLSelectElement>('#status-filter').value, zone = $<HTMLSelectElement>('#zone-filter').value
    const rows = day.tracked.filter((p) => (!status || p.status === status) && (!zone || p.zone === zone) && (!q || `${p.company} ${p.city} ${p.email} ${p.trade} ${p.reply} ${p.notes} ${p.contact}`.toLowerCase().includes(q)))
    // sort by a column (click on its title; a second click reverses)
    const sort: { key?: string; desc?: boolean } = store.sort || {}
    // columns sorted as text; the dates (dd/mm/yyyy) as yyyymmdd
    const cell = (p: TrackedProspect, key: string): string => String(p[key as keyof TrackedProspect] || '').toLowerCase()
    const dateKey = (d: string): string => (d || '').split('/').reverse().join('')
    if (sort.key) rows.sort((a, b) => { const x = sort.key === 'first' ? dateKey(a.first) : cell(a, sort.key as string), y = sort.key === 'first' ? dateKey(b.first) : cell(b, sort.key as string); return (x < y ? -1 : x > y ? 1 : 0) * (sort.desc ? -1 : 1) })
    const th = (key: string | null, label: string): string => key ? `<th><button class="btn link small" data-sort="${key}" style="padding:0;min-height:0;color:var(--mint)">${label}${sort.key === key ? (sort.desc ? ' ↓' : ' ↑') : ''}</button></th>` : `<th>${label}</th>`
    $('#tracking-table').innerHTML = `<thead><tr>${th('company', 'Entreprise')}${th('trade', 'Métier')}${th('city', 'Ville')}${th('status', 'Statut')}${th('first', '1er e-mail')}<th>Relance 1</th><th>Relance 2</th><th>Prochaine étape</th>${th('reply', 'Réponse')}<th></th></tr></thead><tbody>${rows.map((p) => `<tr><td><button class="btn link small" data-detail="${esc(p.id)}" style="padding:0;min-height:0;letter-spacing:0;text-transform:none;font-size:1rem;color:var(--paper)" title="Voir sa fiche"><strong>${esc(p.company)}</strong></button><br><span class="muted small">${esc(p.email || '')}</span></td><td>${esc(p.trade)}</td><td>${esc(p.city)}</td><td>${esc(p.status)}</td><td>${esc(p.first)}</td><td>${esc(p.followUp1)}</td><td>${esc(p.followUp2)}</td><td>${esc(p.next)}</td><td class="small">${esc(p.reply)}</td><td><button class="btn link small" data-erase="${esc(p.id)}" title="Si la personne demande l'effacement de ses données (RGPD)">Effacer</button></td></tr>${store.openDetail === p.id ? detailRow(p) : ''}`).join('') || '<tr><td colspan="10" class="muted">Aucun prospect pour l\'instant : DC Prospect en cherche chaque jour ouvré.</td></tr>'}</tbody>`
    labelCells($('#tracking-table').parentElement as HTMLElement)
}

// Card of a prospect, under its line: what DC Prospect knows, what was sent, calls, and my notes
function detailRow(p: TrackedProspect): string {
    const link = p.website ? `<a href="${esc(p.website)}" target="_blank" rel="noopener">${esc(p.website.replace(/^https?:\/\//, ''))}</a>` : 'pas de site connu'
    return `<tr><td colspan="10" style="background:var(--panel)"><div class="grid g2" style="padding:.6rem 0">
        <div class="small">
            <p><strong>${esc(p.company)}</strong>${p.contact ? ` · ${esc(p.contact)}` : ''}${p.level ? ` · ${esc(p.level)}` : ''}<br>${link}${p.phone ? ` · <a href="tel:${esc(p.phone)}">${esc(p.phone)}</a>` : ''}${p.email ? ` · ${esc(p.email)}` : ''}</p>
            ${p.facts.length ? `<p class="muted">Vérifié sur son site : ${esc(p.facts.join(' ; '))}</p>` : ''}
            ${p.reason ? `<p class="muted">Écarté : ${esc(p.reason)}</p>` : ''}${p.remindOn ? `<p class="muted">À recontacter le ${esc(p.remindOn)}</p>` : ''}
            ${p.calls.length ? `<p class="muted">Appels : ${esc(p.calls.join(' ; '))}</p>` : ''}
            ${p.sent.map((s) => `<details style="margin:.3rem 0"><summary style="cursor:pointer">${esc(s.step)} envoyé le ${esc(s.on)} : ${esc(s.subject)}</summary><div style="white-space:pre-wrap" class="muted">${esc(s.body)}</div></details>`).join('')}
            ${p.reply ? `<p>Sa réponse : « ${esc(p.reply)} »</p>` : ''}</div>
        <div><label class="label field" for="notes-${esc(p.id)}">Mes notes</label><textarea id="notes-${esc(p.id)}" data-notes style="min-height:110px" placeholder="Ce qu'il t'a dit au téléphone, son budget, quand le rappeler...">${esc(p.notes)}</textarea>
            <div class="actions"><button class="btn small" data-save-notes="${esc(p.id)}">Enregistrer les notes</button></div></div>
    </div></td></tr>`
}

// What the internal AI learned from my results (learning.mjs), when to send, and the health of the sending
function learningBlock(stats: Stats): string {
    const l = stats.learning, m = stats.moments, h = stats.sending
    const list = (items: string[]): string => items.map((x) => esc(x)).join(', ')
    const learned = l
        ? `<p><strong>Ce qui fait répondre</strong> (appris sur ${l.n} e-mails, ${l.positives} réponses, le ${esc(l.trainedOn)}) : ${l.helps.length ? list(l.helps) : 'rien de net pour l\'instant'}.${l.hurts.length ? ` <strong>Ce qui fait moins répondre</strong> : ${list(l.hurts)}.` : ''} Le lot du jour commence par les prospects qui ont le plus de chances de répondre.</p>`
        : '<p class="muted">L\'IA interne apprend de tes résultats dès 30 e-mails envoyés depuis plus de 14 jours et 3 réponses : elle classera alors les prospects par chance de réponse.</p>'
    const moments = m && (m.days.length || m.parts.length)
        ? `<p><strong>Meilleurs moments d'envoi</strong> : ${[...m.days.slice(0, 2), ...m.parts.slice(0, 1)].map((x) => `${esc(x.moment)} (${pct(x.replyRate)} de réponses sur ${x.sent})`).join(', ')}. À reprendre dans Réglages, Calendrier.</p>` : ''
    const health = h?.slowed ? `<p style="color:var(--red)">${h.advice.map(esc).join(' ')}</p>` : h?.sent >= 20 ? `<p class="muted">Envoi en bonne santé : ${pct(h.bounceRate)} d'e-mails revenus, ${pct(h.stopRate)} de STOP sur les ${h.sent} derniers.</p>` : ''
    const b = stats.bodies || {}, tried = (b.standard?.given || 0) + (b.short?.given || 0)
    const rate = (x: Stats['bodies'][string]): string => (x?.settled ? `${pct(x.wins / x.settled)} de réponses sur ${x.settled}` : 'pas encore de résultat')
    const lengths = tried ? `<p><strong>Longueur du 1er e-mail</strong> (modèles) : standard ${rate(b.standard)}, courte ${rate(b.short)}. Chaque version est essayée 10 fois, puis celle qui fait le plus répondre est utilisée de plus en plus.</p>` : ''
    return `<div class="tile" style="margin-top:1.5rem"><p class="label">IA interne</p>${learned}${lengths}${moments}${health}</div>`
}
