// Entry point of the interface of DC Prospect: frame, data refresh (every 15 s), clicks
import { $, $$ } from './utils/dom.js'
import { downloadReminder } from './utils/calendar.js'
import { store } from './stores/state.js'
import { api, ensureSuccess, hostAction } from './api.js'
import { mountAppShell, renderAppShell, showView } from './components/layout/AppShell.js'
import { runAction, toast, confirmClick } from './components/ui/Toast.js'
import { renderToday } from './components/views/Today.js'
import { renderProspects, reopenTable } from './components/views/Prospects.js'
import { renderSettings, loadSettings, onSettingsClick, onSettingsChange } from './components/views/Settings.js'
import { renderHelp } from './components/views/Help.js'

mountAppShell()

const VIEWS = { today: renderToday, prospects: renderProspects, settings: renderSettings, help: renderHelp }

// periodic = the refresh every 15 s: the settings and the help are not redrawn
// (it closed « Avancé » and wiped what was being typed)
function render({ periodic = false } = {}) {
    renderAppShell()
    if (periodic && (store.view === 'settings' || store.view === 'help')) return
    VIEWS[store.view]?.({ periodic })
}

// Start screen: stays until the engine answers (it can take a few seconds when Windows starts)
let started = false
async function start(attempt = 0) {
    const r = await api.get('/state')
    if (!r.success && attempt < 60) {
        if (attempt > 2) $('#loading-text').textContent = 'Démarrage du moteur, encore un instant'
        return setTimeout(() => start(attempt + 1), 1000)
    }
    store.day = r.success ? r : null
    await loadSettings()
    started = true
    render()
    $('#loading-screen').classList.add('done')
    setTimeout(() => $('#loading-screen')?.remove(), 500)
    setInterval(() => refresh({ periodic: true }), 15000)
}

async function refresh(options = {}) {
    if (!started) return
    const r = await api.get('/state')
    store.day = r.success ? r : null
    if (!store.settings) await loadSettings()
    render(options)
}

// after an action (save, connect...): everything is redrawn with fresh settings
async function reload() {
    store.settings = null
    await refresh()
    if (store.view === 'settings') renderSettings()
    return true
}

const waiting = (text) => `<div class="view-loading"><span class="spinner"></span>${text}</div>`

function goTo(view) {
    showView(view)
    if (view === 'settings') {
        // the settings are reloaded each time: a spinner while they come (only if nothing is shown yet)
        const el = $('#view-settings')
        if (!el.innerHTML.trim()) el.innerHTML = waiting('Chargement des réglages')
        loadSettings().then(render)
    }
    else render()
}

// while I type in an e-mail or an answer, the refresh does not redraw it
document.addEventListener('focusin', (e) => { if (e.target.closest('#to-approve')) store.editing = true; if (e.target.closest('#replies-block')) store.replying = true })
document.addEventListener('focusout', () => setTimeout(() => { store.editing = !!document.activeElement?.closest?.('#to-approve'); store.replying = !!document.activeElement?.closest?.('#replies-block') }, 50))

document.addEventListener('click', async (ev) => {
    const b = ev.target.closest('button')
    if (!b) return
    if (b.dataset.view) return goTo(b.dataset.view)
    if (b.dataset.go) return goTo(b.dataset.go)
    if (b.id === 'prepare') { await runAction(b, () => ensureSuccess(api.post('/prepare')), 'Préparation lancée : la recherche tourne en fond'); return refresh() }
    if (b.dataset.track) {
        if (b.dataset.track === 'declined' && !confirmClick(b, 'Confirmer : ne plus lui écrire')) return
        await runAction(b, () => ensureSuccess(api.post('/tracking', { id: b.dataset.id, action: b.dataset.track })), 'Noté')
        return refresh()
    }
    // Card of a prospect (Prospects): open or close, save my notes
    if (b.dataset.reminder) { downloadReminder({ title: b.dataset.title, details: b.dataset.details }); toast('Rappel prêt : ouvre le fichier pour l\'ajouter à ton agenda (demain 10 h, modifiable)'); return }
    if (b.dataset.sort) { const k = b.dataset.sort; store.sort = { key: k, desc: store.sort?.key === k ? !store.sort.desc : false }; return reopenTable() }
    if (b.dataset.detail) { store.openDetail = store.openDetail === b.dataset.detail ? null : b.dataset.detail; return reopenTable() }
    if (b.dataset.saveNotes) {
        await runAction(b, () => ensureSuccess(api.post('/notes', { id: b.dataset.saveNotes, text: $('#notes-' + CSS.escape(b.dataset.saveNotes)).value })), 'Notes enregistrées')
        return refresh()
    }
    // A new version of an e-mail to approve
    if (b.hasAttribute('data-rewrite')) {
        const card = b.closest('.card')
        const r = await runAction(b, () => ensureSuccess(api.post('/drafts/rewrite', { id: card.dataset.id, step: card.dataset.step })), 'Nouvelle version prête : relis-la')
        if (r) { store.editing = false; refresh() }
        return
    }
    // My own list, never contact, erasure, outcome of a call (Prospects)
    if (b.hasAttribute('data-import')) {
        const file = $('#import-file').files?.[0]
        if (!file) { toast('Choisis d\'abord ton fichier CSV', true); return }
        const csv = await file.text()
        const r = await runAction(b, () => ensureSuccess(api.post('/import', { csv })), (x) => `${x.rows} lignes en cours de vérification : les prospects prêts arrivent dans quelques minutes (historique sur l'accueil)`)
        if (r) $('#import-file').value = ''
        return
    }
    if (b.hasAttribute('data-do-not-contact')) {
        const r = await runAction(b, () => ensureSuccess(api.post('/do-not-contact', { text: $('#do-not-contact').value })), (x) => `${x.added} ajouté(s) : DC Prospect ne leur écrira jamais`)
        if (r) { $('#do-not-contact').value = ''; refresh() }
        return
    }
    if (b.dataset.restore) {
        await runAction(b, () => ensureSuccess(api.post('/restore', { id: b.dataset.restore })), 'Remis dans la réserve, avec un nouvel e-mail')
        return refresh()
    }
    if (b.dataset.erase) {
        if (!confirmClick(b, 'Confirmer l\'effacement')) return
        await runAction(b, () => ensureSuccess(api.post('/erase', { id: b.dataset.erase })), 'Données effacées ; son adresse reste seulement dans la liste STOP')
        return refresh()
    }
    if (b.dataset.call) {
        await runAction(b, () => ensureSuccess(api.post('/calls', { id: b.dataset.id, outcome: b.dataset.call })), b.dataset.call === 'interested' ? 'Noté : il est dans « Ils ont répondu »' : 'Noté')
        return refresh()
    }
    // Answer to a prospect who replied: prepared (AI or template), changed if needed, sent in the same thread
    if (b.dataset.replyDraft) {
        const r = await runAction(b, () => ensureSuccess(api.post('/replies/draft', { id: b.dataset.replyDraft })), 'Réponse préparée : relis-la avant de l\'envoyer')
        if (r) { store.replying = false; refresh() }
        return
    }
    if (b.dataset.replyKind) {
        const r = await runAction(b, () => ensureSuccess(api.post('/replies/kind', { id: b.dataset.id, kind: b.dataset.replyKind })), 'Type corrigé : DC Prospect en tient compte')
        if (r) { store.replying = false; refresh() }
        return
    }
    if (b.dataset.replySend) {
        const body = $('[data-answer]', b.closest('.card'))?.value || ''
        if (!confirmClick(b, 'Confirmer l\'envoi')) return
        const r = await runAction(b, () => ensureSuccess(api.post('/replies/send', { id: b.dataset.replySend, body })), 'Réponse envoyée')
        if (r) { store.replying = false; refresh() }
        return
    }
    if (b.dataset.draft) {
        const card = b.closest('.card'), d = { id: card.dataset.id, step: card.dataset.step, action: b.dataset.draft }
        if ($('[data-body]', card)) { d.subject = $('[data-subject]', card).value; d.body = $('[data-body]', card).value }
        if (d.action === 'reject' && !confirmClick(b, 'Confirmer : ne pas lui écrire')) return
        const r = await runAction(b, () => ensureSuccess(api.post('/drafts', d)), { approve: 'Validé : il partira au prochain créneau', reject: 'Prospect retiré', cancel: 'Validation annulée' }[d.action])
        if (r) { store.editing = false; refresh() }
        return
    }
    if (b.id === 'approve-all') {
        b.disabled = true; b.classList.add('loading')
        let n = 0
        for (const card of $$('#to-approve .card')) {
            if ($('.problem', card)) continue
            const r = await api.post('/drafts', { id: card.dataset.id, step: card.dataset.step, action: 'approve', subject: $('[data-subject]', card).value, body: $('[data-body]', card).value })
            if (r.success) n++; else toast(r.error, true)
        }
        toast(`${n} e-mail(s) validé(s) : ils partiront aux prochains créneaux`)
        b.disabled = false; b.classList.remove('loading'); store.editing = false
        return refresh()
    }
    if (b.dataset.host) {
        await runAction(b, () => hostAction(b.dataset.host), (x) => (typeof x === 'string' ? x : 'Fait'))
        if (['connectClaude', 'installClaude'].includes(b.dataset.host)) setTimeout(reload, 15000)
        return reload()
    }
    if (b.dataset.open) return hostAction('open', b.dataset.open).catch((e) => toast(e.message, true))
    if (await onSettingsClick(b, reload)) return
})

document.addEventListener('change', (ev) => onSettingsChange(ev.target, reload))

start()
