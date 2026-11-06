// Frame of the app: top bar (logo, tabs, status, "Préparer") and the containers of the views
import { $, $$ } from '../../utils/dom.js'
import { store } from '../../stores/etat.js'
import { IN_APP } from '../../config.js'

export const VUES = [
    ['aujourdhui', 'Aujourd\'hui'],
    ['prospects', 'Prospects'],
    ['reglages', 'Réglages'],
    ['aide', 'Aide'],
]

export function monterAppShell() {
    if (IN_APP) document.body.classList.add('app')
    $('#app').innerHTML = `
    <header class="barre">
        <img src="/assets/images/icone.png" alt="" style="height:32px;border-radius:50%">
        <span class="display display-s" style="-webkit-app-region:drag;font-size:.95rem;letter-spacing:.04em">DC Prospect</span>
        <nav aria-label="Navigation">${VUES.map(([id, nom], i) => `<button class="onglet${i ? '' : ' actif'}" data-vue="${id}">${nom}${id === 'aujourdhui' ? ' <span class="bulle" id="bulle-jour" hidden></span>' : ''}</button>`).join('')}</nav>
        <div class="droite">
            <span class="pastille" id="pastille">Prêt</span>
            <button class="btn petit" id="preparer" title="Lance tout de suite la recherche et la préparation du jour">Préparer</button>
        </div>
    </header>
    <main>${VUES.map(([id], i) => `<section class="vue${i ? '' : ' active'}" id="vue-${id}"></section>`).join('')}</main>
    <div id="toasts" aria-live="polite"></div>`
}

// Status dot, counter and button, from the state of the day
export function rendreAppShell() {
    const E = store.E
    const p = $('#pastille')
    if (!E) { p.className = 'pastille ko'; p.textContent = 'Arrêté'; return }
    p.className = 'pastille' + (E.occupe ? ' attente' : E.erreur ? ' ko' : '')
    p.textContent = E.occupe ? 'Préparation' : E.erreur ? 'À vérifier' : E.sante?.veille ? 'Veille' : 'Prêt'
    $('#preparer').disabled = E.occupe
    const n = E.aValider.length + E.reponses.length
    $('#bulle-jour').hidden = !n
    $('#bulle-jour').textContent = n
}

export function afficherVue(v) {
    store.vue = v
    $$('.onglet').forEach((b) => b.classList.toggle('actif', b.dataset.vue === v))
    $$('.vue').forEach((s) => s.classList.toggle('active', s.id === 'vue-' + v))
    window.scrollTo(0, 0)
}
