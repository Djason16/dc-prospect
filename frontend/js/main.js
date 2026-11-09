// Entry point of the interface of DC Prospect: frame, data refresh (every 15 s), clicks
import { $, $$ } from './utils/dom.js'
import { store } from './stores/state.js'
import { api, ensureSuccess, hostAction } from './api.js'
import { mountAppShell, renderAppShell, showView } from './components/layout/AppShell.js'
import { runAction, toast, confirmClick } from './components/ui/Toast.js'
import { renderToday } from './components/views/Today.js'
import { renderProspects } from './components/views/Prospects.js'
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

// while I type in an e-mail, the refresh does not redraw it
document.addEventListener('focusin', (e) => { if (e.target.closest('#to-approve')) store.editing = true })
document.addEventListener('focusout', () => setTimeout(() => (store.editing = !!document.activeElement?.closest?.('#to-approve')), 50))

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
