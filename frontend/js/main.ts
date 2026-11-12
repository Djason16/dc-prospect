// Entry point of the interface of DC Prospect: frame, data refresh (every 15 s), clicks
import { $, $$ } from './utils/dom.js'
import { downloadReminder } from './utils/calendar.js'
import { store } from './stores/state.js'
import type { View } from './stores/state.js'
import type { DayState, Step } from './types.js'
import { api, ensureSuccess, hostAction } from './api.js'
import { mountAppShell, renderAppShell, showView } from './components/layout/AppShell.js'
import { runAction, toast, confirmClick } from './components/ui/Toast.js'
import { renderToday } from './components/views/Today.js'
import { renderProspects, reopenTable } from './components/views/Prospects.js'
import { renderSettings, loadSettings, onSettingsClick, onSettingsChange } from './components/views/Settings.js'
import { renderHelp } from './components/views/Help.js'

mountAppShell()

const VIEWS: Record<View, (options: { periodic?: boolean }) => void> = { today: renderToday, prospects: renderProspects, settings: renderSettings, help: renderHelp }

// periodic = the refresh every 15 s: the settings and the help are not redrawn
// (it closed « Avancé » and wiped what was being typed)
function render({ periodic = false }: { periodic?: boolean } = {}): void {
    renderAppShell()
    if (periodic && (store.view === 'settings' || store.view === 'help')) return
    VIEWS[store.view]?.({ periodic })
}

// Start screen: stays until the engine answers (it can take a few seconds when Windows starts)
let started = false
async function start(attempt = 0): Promise<void> {
    const r = await api.get<DayState>('/state')
    if (!r.success && attempt < 60) {
        if (attempt > 2) $('#loading-text').textContent = 'Démarrage du moteur, encore un instant'
        setTimeout(() => start(attempt + 1), 1000)
        return
    }
    store.day = r.success ? r : null
    await loadSettings()
    started = true
    render()
    $('#loading-screen').classList.add('done')
    setTimeout(() => $('#loading-screen')?.remove(), 500)
    setInterval(() => refresh({ periodic: true }), 15000)
}

async function refresh(options: { periodic?: boolean } = {}): Promise<void> {
    if (!started) return
    const r = await api.get<DayState>('/state')
    store.day = r.success ? r : null
    if (!store.settings) await loadSettings()
    render(options)
}

// after an action (save, connect...): everything is redrawn with fresh settings
async function reload(): Promise<true> {
    store.settings = null
    await refresh()
    if (store.view === 'settings') renderSettings()
    return true
}

const waiting = (text: string): string => `<div class="view-loading"><span class="spinner"></span>${text}</div>`

function goTo(view: View): void {
    showView(view)
    if (view === 'settings') {
        // the settings are reloaded each time: a spinner while they come (only if nothing is shown yet)
        const el = $('#view-settings')
        if (!el.innerHTML.trim()) el.innerHTML = waiting('Chargement des réglages')
        loadSettings().then(() => render())
    }
    else render()
}

// while I type in an e-mail or an answer, the refresh does not redraw it
document.addEventListener('focusin', (e) => { const t = e.target as Element; if (t.closest('#to-approve')) store.editing = true; if (t.closest('#replies-block')) store.replying = true })
document.addEventListener('focusout', () => setTimeout(() => { store.editing = !!document.activeElement?.closest?.('#to-approve'); store.replying = !!document.activeElement?.closest?.('#replies-block') }, 50))

document.addEventListener('click', async (ev) => {
    const b = (ev.target as Element).closest('button')
    if (!b) return
    if (b.dataset.view) return goTo(b.dataset.view as View)
    if (b.dataset.go) return goTo(b.dataset.go as View)
    if (b.id === 'prepare') { await runAction(b, () => ensureSuccess(api.post('/prepare')), 'Préparation lancée : la recherche tourne en fond'); return refresh() }
    if (b.dataset.track) {
        if (b.dataset.track === 'declined' && !confirmClick(b, 'Confirmer : ne plus lui écrire')) return
        await runAction(b, () => ensureSuccess(api.post('/tracking', { id: b.dataset.id, action: b.dataset.track })), 'Noté')
        return refresh()
    }
    // Card of a prospect (Prospects): open or close, save my notes
    if (b.dataset.reminder) { downloadReminder({ title: b.dataset.title || '', details: b.dataset.details }); toast('Rappel prêt : ouvre le fichier pour l\'ajouter à ton agenda (demain 10 h, modifiable)'); return }
    if (b.dataset.sort) { const k = b.dataset.sort; store.sort = { key: k, desc: store.sort?.key === k ? !store.sort?.desc : false }; return reopenTable() }
    if (b.dataset.detail) { store.openDetail = store.openDetail === b.dataset.detail ? null : b.dataset.detail; return reopenTable() }
    if (b.dataset.saveNotes) {
        const id = b.dataset.saveNotes
        await runAction(b, () => ensureSuccess(api.post('/notes', { id, text: $<HTMLTextAreaElement>('#notes-' + CSS.escape(id)).value })), 'Notes enregistrées')
        return refresh()
    }
    // A new version of an e-mail to approve
    if (b.hasAttribute('data-rewrite')) {
        const card = b.closest('.card') as HTMLElement
        const r = await runAction(b, () => ensureSuccess(api.post('/drafts/rewrite', { id: card.dataset.id, step: card.dataset.step })), 'Nouvelle version prête : relis-la')
        if (r) { store.editing = false; refresh() }
        return
    }
    // My own list, never contact, erasure, outcome of a call (Prospects)
    if (b.hasAttribute('data-import')) {
        const file = $<HTMLInputElement>('#import-file').files?.[0]
        if (!file) { toast('Choisis d\'abord ton fichier CSV', true); return }
        const csv = await file.text()
        const r = await runAction(b, () => ensureSuccess(api.post<{ rows: number }>('/import', { csv })), (x) => `${x.rows} lignes en cours de vérification : les prospects prêts arrivent dans quelques minutes (historique sur l'accueil)`)
        if (r) $<HTMLInputElement>('#import-file').value = ''
        return
    }
    if (b.hasAttribute('data-do-not-contact')) {
        const r = await runAction(b, () => ensureSuccess(api.post<{ added: number }>('/do-not-contact', { text: $<HTMLTextAreaElement>('#do-not-contact').value })), (x) => `${x.added} ajouté(s) : DC Prospect ne leur écrira jamais`)
        if (r) { $<HTMLTextAreaElement>('#do-not-contact').value = ''; refresh() }
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
        const body = $<HTMLTextAreaElement>('[data-answer]', b.closest('.card') as HTMLElement)?.value || ''
        if (!confirmClick(b, 'Confirmer l\'envoi')) return
        const r = await runAction(b, () => ensureSuccess(api.post('/replies/send', { id: b.dataset.replySend, body })), 'Réponse envoyée')
        if (r) { store.replying = false; refresh() }
        return
    }
    if (b.dataset.draft) {
        const card = b.closest('.card') as HTMLElement
        const d: { id?: string; step?: Step; action: 'approve' | 'cancel' | 'reject'; subject?: string; body?: string } = { id: card.dataset.id, step: card.dataset.step as Step, action: b.dataset.draft as 'approve' | 'cancel' | 'reject' }
        if ($('[data-body]', card)) { d.subject = $<HTMLInputElement>('[data-subject]', card).value; d.body = $<HTMLTextAreaElement>('[data-body]', card).value }
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
            const r = await api.post('/drafts', { id: card.dataset.id, step: card.dataset.step, action: 'approve', subject: $<HTMLInputElement>('[data-subject]', card).value, body: $<HTMLTextAreaElement>('[data-body]', card).value })
            if (r.success) n++; else toast(r.error, true)
        }
        toast(`${n} e-mail(s) validé(s) : ils partiront aux prochains créneaux`)
        b.disabled = false; b.classList.remove('loading'); store.editing = false
        return refresh()
    }
    if (b.dataset.host) {
        const action = b.dataset.host
        await runAction(b, () => hostAction(action), (x) => (typeof x === 'string' ? x : 'Fait'))
        if (['connectClaude', 'installClaude'].includes(action)) setTimeout(reload, 15000)
        return reload()
    }
    if (b.dataset.open) return hostAction('open', b.dataset.open).catch((e) => toast(e.message, true))
    if (await onSettingsClick(b, reload)) return
})

document.addEventListener('change', (ev) => onSettingsChange(ev.target as HTMLInputElement, reload))

start()
