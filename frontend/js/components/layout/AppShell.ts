// Frame of the app: top bar (logo, tabs, status, "Préparer"), the update notice and the containers of the views
import { $, $$, esc } from '../../utils/dom.js'
import { store } from '../../stores/state.js'
import { IN_APP } from '../../config.js'
import { OS, UPDATE_HINT } from '../../utils/os.js'
import type { View } from '../../stores/state.js'

// [id, label shown]
export const VIEWS: [View, string][] = [
    ['today', 'Aujourd\'hui'],
    ['prospects', 'Prospects'],
    ['settings', 'Réglages'],
    ['help', 'Aide'],
]

export function mountAppShell(): void {
    if (IN_APP) document.body.classList.add('in-app')
    // macOS: the window buttons are on the left of the top bar (app-shell.css)
    if (IN_APP && OS === 'mac') document.body.classList.add('mac')
    $('#app').innerHTML = `
    <header class="topbar">
        <img src="/assets/images/icon.png" alt="" style="height:32px;border-radius:50%">
        <span class="display display-s" style="-webkit-app-region:drag;font-size:.95rem;letter-spacing:.04em">DC Prospect</span>
        <nav aria-label="Navigation">${VIEWS.map(([id, name], i) => `<button class="tab${i ? '' : ' active'}" data-view="${id}">${name}${id === 'today' ? ' <span class="badge" id="today-badge" hidden></span>' : ''}</button>`).join('')}</nav>
        <div class="right">
            <span class="status-dot" id="status">Prêt</span>
            <button class="btn small" id="prepare" title="Lance tout de suite la recherche et la préparation du jour">Préparer</button>
        </div>
    </header>
    <main><div id="update-bar"></div>${VIEWS.map(([id], i) => `<section class="view${i ? '' : ' active'}" id="view-${id}"></section>`).join('')}</main>
    <div id="toasts" aria-live="polite"></div>`
}

// Status dot, counter and button, from the state of the day
export function renderAppShell(): void {
    const day = store.day
    const status = $('#status')
    if (!day) { status.className = 'status-dot error'; status.textContent = 'Arrêté'; return }
    status.className = 'status-dot' + (day.busy ? ' pending' : day.error ? ' error' : '')
    status.textContent = day.busy ? 'Préparation' : day.error ? 'À vérifier' : day.health?.standby ? 'Veille' : 'Prêt'
    $<HTMLButtonElement>('#prepare').disabled = day.busy
    const n = day.toApprove.length + day.replies.length
    $('#today-badge').hidden = !n
    $('#today-badge').textContent = String(n)
    renderUpdateBar()
}

// A newer version (data folder or GitHub release): shown on every screen until it is installed
function renderUpdateBar(): void {
    const update = store.day?.health?.update
    const bar = $('#update-bar')
    const key = update?.version || ''
    if (bar.dataset.key === key) return // redrawn only when it changes: the button keeps its spinner while downloading
    bar.dataset.key = key
    bar.innerHTML = update ? `<div class="banner update"><span><strong>Une mise à jour est disponible : ${esc(update.version)}</strong> <span class="muted small">${esc(UPDATE_HINT)}</span></span>
        <span class="actions"><button class="btn small" data-open="${esc(update.page || 'https://github.com/Djason16/dc-prospect/releases/latest')}">Voir les nouveautés</button><button class="btn primary small" data-host="installUpdate">Mettre à jour</button></span></div>` : ''
}

export function showView(view: View): void {
    store.view = view
    $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.view === view))
    $$('.view').forEach((s) => s.classList.toggle('active', s.id === 'view-' + view))
    window.scrollTo(0, 0)
}
