// Every prospect (search, filters) and the figures of the plan (week, since the start, per zone)
import { $, esc, pct } from '../../utils/dom.js'
import { store } from '../../stores/state.js'

// [label, figure, threshold, goal shown, higher is better, advice, figure it is based on]
const GOALS = [
    ['Taux de réponse', 'replyRate', 8, '8 % ou plus', true, 'Mieux personnaliser l\'accroche, tester un autre objet', 'contacted'],
    ['Taux de rendez-vous', 'meetingRate', 30, '30 % ou plus', true, 'Proposer plus tôt la maquette offerte ou l\'appel de 15 min', 'replies'],
    ['Taux de signature', 'signingRate', 25, '25 % ou plus', true, 'Revoir la proposition et la réponse aux objections', 'proposals'],
    ['STOP', 'stopRate', 2, 'moins de 2 %', false, 'Mieux cibler (le besoin doit être visible)', 'contacted'],
]

export function renderProspects() {
    const { day, settings } = store
    if (!day) return
    const el = $('#view-prospects')
    if (!el.dataset.mounted) {
        el.dataset.mounted = '1'
        el.innerHTML = `
        <div class="page-head"><div><p class="label eyebrow">Suivi et résultats</p><h1 class="display display-l">Prospects</h1></div>
            <p class="muted" id="spreadsheet-link">Le même tableau est dans ton dossier de données (Suivi prospection.xlsx).</p></div>
        <div class="grid g4 section" id="figure-tiles"></div>
        <details class="section"><summary class="label eyebrow" style="cursor:pointer">Objectifs du plan et comparaison des zones</summary><div id="figure-details" style="margin-top:1rem"></div></details>
        <div class="filters"><input type="search" id="search" placeholder="Chercher une entreprise, une ville, un e-mail..."><select id="status-filter"><option value="">Tous les statuts</option></select><select id="zone-filter"><option value="">Toutes les zones</option></select></div>
        <div style="overflow-x:auto"><table class="table" id="tracking-table"></table></div>`
        for (const s of ['#search', '#status-filter', '#zone-filter']) $(s).addEventListener('input', renderTable)
    }
    const { week: w, total: t } = day.stats
    $('#figure-tiles').innerHTML = [['Contactés cette semaine', w.contacted], ['Réponses cette semaine', w.replies], ['Taux de réponse (total)', pct(t.replyRate)], ['Clients (total)', t.clients]]
        .map(([label, n]) => `<div class="tile"><p class="label">${label}</p><div class="figure">${n}</div></div>`).join('')
    $('#figure-details').innerHTML = `<table class="table"><thead><tr><th>Indicateur</th><th>Depuis le début</th><th>Objectif</th><th>Verdict</th></tr></thead><tbody>
        ${GOALS.map(([label, k, threshold, goal, higher, advice, base]) => {
            const v = t[k], enough = t[base] >= 30 || k === 'signingRate', ok = higher ? v >= threshold : v < threshold
            return `<tr><td>${label}</td><td>${pct(v)}</td><td>${goal}</td><td>${!enough ? '<span class="muted">pas encore assez de données (30 minimum)</span>' : ok ? '<span style="color:var(--mint)">OK</span>' : esc(advice)}</td></tr>`
        }).join('')}</tbody></table>
        <table class="table" style="margin-top:1.5rem"><thead><tr><th>Zone</th><th>Contactés</th><th>Réponses</th><th>Taux de réponse</th><th>Clients</th></tr></thead><tbody>
        ${(day.stats.zones || []).map((z) => `<tr><td>${esc(z.zone)}</td><td>${z.contacted}</td><td>${z.replies}</td><td>${pct(z.replyRate)}</td><td>${z.clients}</td></tr>`).join('')}</tbody></table>`
    if (settings?.accounts?.google?.spreadsheet) $('#spreadsheet-link').innerHTML = `Le même tableau est dans <a href="${esc(settings.accounts.google.spreadsheet)}" target="_blank">Google Sheets</a>, toujours à jour.`
    renderTable()
}

function renderTable() {
    const day = store.day
    const fill = (select, list) => { const v = select.value; select.innerHTML = select.options[0].outerHTML + list.map((x) => `<option${x === v ? ' selected' : ''}>${esc(x)}</option>`).join('') }
    fill($('#status-filter'), [...new Set(day.tracked.map((p) => p.status))])
    fill($('#zone-filter'), [...new Set(day.tracked.map((p) => p.zone).filter(Boolean))])
    const q = $('#search').value.toLowerCase(), status = $('#status-filter').value, zone = $('#zone-filter').value
    const rows = day.tracked.filter((p) => (!status || p.status === status) && (!zone || p.zone === zone) && (!q || `${p.company} ${p.city} ${p.email} ${p.trade}`.toLowerCase().includes(q)))
    $('#tracking-table').innerHTML = `<thead><tr><th>Entreprise</th><th>Métier</th><th>Ville</th><th>Statut</th><th>1er e-mail</th><th>Relance 1</th><th>Relance 2</th><th>Prochaine étape</th><th>Réponse</th></tr></thead><tbody>${rows.map((p) => `<tr><td><strong>${esc(p.company)}</strong><br><span class="muted small">${esc(p.email || '')}</span></td><td>${esc(p.trade)}</td><td>${esc(p.city)}</td><td>${esc(p.status)}</td><td>${esc(p.first)}</td><td>${esc(p.followUp1)}</td><td>${esc(p.followUp2)}</td><td>${esc(p.next)}</td><td class="small">${esc(p.reply)}</td></tr>`).join('') || '<tr><td colspan="9" class="muted">Aucun prospect pour l\'instant : DC Prospect en cherche chaque jour ouvré.</td></tr>'}</tbody>`
}
