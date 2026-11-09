// Home screen: getting started (if needed), what needs me today, e-mails to approve, e-mails waiting for their time slot
import { $, esc } from '../../utils/dom.js'
import { store } from '../../stores/state.js'
import { emailCard } from '../ui/EmailCard.js'
import { claudeBlock, sendingBlock, profileBlock, quickZoneBlock } from './Settings.js'

const sendingReady = (s) => (s.accounts?.sendingMode === 'gmail' ? s.accounts.gmail?.configured || s.accounts.google?.connected : s.accounts?.mailbox?.password)
const ready = (s) => s?.profileComplete && s.zonesReady && s.accounts?.claude?.connected && sendingReady(s)

export function renderToday() {
    const { day, settings } = store
    if (!day) return
    const el = $('#view-today')
    // first render: build the frame once, then only refresh the parts (keeps what I am typing)
    if (!el.dataset.mounted) {
        el.dataset.mounted = '1'
        el.innerHTML = `
        <div class="page-head"><div><p class="label eyebrow" id="day-label"></p><h1 class="display display-l">Aujourd'hui</h1></div>
            <p class="muted">Tu valides, DC Prospect envoie depuis ton adresse aux bons moments, relance et lit les réponses. Rien ne part sans ton accord.</p></div>
        <div id="getting-started"></div><div id="banners"></div>
        <div class="grid g4 section" id="tiles"></div>
        <div class="section" id="replies-block"></div>
        <div class="section"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <p class="label eyebrow" style="margin:0">E-mails à valider</p><button class="btn primary" id="approve-all" hidden>Tout valider</button></div>
            <div id="to-approve"></div></div>
        <div class="section"><p class="label eyebrow">Validés, partent au prochain créneau</p><div id="queue"></div></div>
        <details class="section"><summary class="label eyebrow" style="cursor:pointer">Ce que DC Prospect a fait</summary><div id="log" class="small" style="margin-top:1rem"></div></details>`
    }
    $('#day-label').textContent = `${day.today} · zone de la semaine : ${day.zone}`

    // getting started, right here (no need to go to the settings)
    // redrawn only when the step changes (the 15 s refresh must not wipe the fields being filled)
    const step = !settings ? 0 : !settings.profileComplete ? 1 : !settings.zonesReady ? 2 : !ready(settings) ? 3 : 0
    const key = `${step}|${JSON.stringify(settings?.accounts || {})}`
    const box = $('#getting-started')
    if (box.dataset.key !== key) box.dataset.key = key, box.innerHTML = step ? `<div class="card" style="border-color:rgba(126,230,168,.35)">
        <p class="label eyebrow">Mise en route, étape ${step} sur 3 : ${['', 'qui tu es', 'où chercher', 'tes comptes'][step]}</p>
        <div style="margin-top:1rem">${step === 1 ? profileBlock(settings, { full: false }) : step === 2 ? quickZoneBlock() : `<div class="grid g2">${claudeBlock(settings)}${sendingBlock(settings)}</div>`}</div>
        <p class="muted small" style="margin:.4rem 0 0">Ensuite, DC Prospect cherche tes prospects tout seul. Tout reste modifiable dans Réglages.</p></div>` : ''

    const banners = []
    if (day.busy) banners.push(`<div class="banner info"><span><span class="status-dot pending" style="margin-right:.8rem"></span>${esc(day.progress || 'Préparation en cours')}</span></div>`)
    if (day.error && ready(settings)) banners.push(`<div class="banner error"><span>${esc(day.error)}</span><button class="btn small" data-go="settings">Réglages</button></div>`)
    if (day.health?.update) banners.push(`<div class="banner"><span>Nouvelle version de DC Prospect : ${esc(day.health.update.version)}</span><button class="btn primary small" data-host="installUpdate">Installer</button></div>`)
    $('#banners').innerHTML = banners.join('')

    const s = day.stats
    $('#tiles').innerHTML = [
        ['À valider', day.toApprove.length, '', day.toApprove.length > 0],
        ['Réponses', day.replies.length, '', day.replies.length > 0],
        ['Envoyés aujourd\'hui', day.sent, ` / ${day.max}`, false],
        ['Prospects prêts', s.ready, ` / ${s.reserve}`, false],
    ].map(([label, n, suffix, accent]) => `<div class="tile${accent ? ' accent' : ''}"><p class="label">${esc(label)}</p><div class="figure">${n}<small>${esc(suffix)}</small></div></div>`).join('')

    // [action, button text, style]
    const TRACK_BUTTONS = [['call', 'Appel prévu', 'primary'], ['proposal', 'Proposition envoyée', ''], ['client', 'Devenu client', ''], ['handled', 'Rien d\'autre', ''], ['declined', 'Pas intéressé', 'danger']]
    $('#replies-block').innerHTML = day.replies.length ? `<p class="label eyebrow">Ils ont répondu</p>${day.replies.map((r) => `<div class="card">
        <div class="top"><div><span class="tag">Réponse</span><strong class="display display-s">${esc(r.company)}</strong></div><span class="muted">${esc(r.city)} · ${esc(r.email)} · ${esc(r.date)}</span></div>
        <blockquote>${esc(r.excerpt)}</blockquote>
        <p class="muted small">Réponds depuis ta messagerie, puis dis à DC Prospect ce qui s'est passé :</p>
        <div class="actions">${TRACK_BUTTONS.map(([a, t, c]) => `<button class="btn small ${c}" data-track="${a}" data-id="${esc(r.id)}">${t}</button>`).join('')}</div></div>`).join('')}` : ''

    if (!store.editing) $('#to-approve').innerHTML = day.toApprove.map((x) => emailCard(x, true)).join('') || `<div class="empty">Rien à valider. ${day.stats.ready ? `${day.stats.ready} prospects sont prêts : ils arriveront ici ${esc(day.nextSendDay)}.` : 'DC Prospect cherche des prospects.'}</div>`
    $('#approve-all').hidden = !day.toApprove.length
    $('#queue').innerHTML = day.queue.map((x) => emailCard(x, false)).join('') || `<div class="empty">Rien en attente. Créneaux : ${esc(day.windows)}, le ${esc(day.sendDays)} (Réglages, Avancé, Calendrier).</div>`
    $('#log').innerHTML = day.log.slice(0, 20).map((e) => `<div style="padding:.45rem 0;border-bottom:1px solid var(--line)"><span class="muted">${esc(e.time)}</span> · ${esc(e.text)}</div>`).join('') || '<div class="empty">Rien pour l\'instant.</div>'
}
