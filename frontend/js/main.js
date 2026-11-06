// Entry point of the interface of DC Prospect: frame, data refresh (every 15 s), clicks
import { $, $$ } from './utils/dom.js'
import { store } from './stores/etat.js'
import { api, exiger, hote } from './api.js'
import { monterAppShell, rendreAppShell, afficherVue } from './components/layout/AppShell.js'
import { action, toast, confirmer } from './components/ui/Toast.js'
import { rendreAujourdhui } from './components/views/Aujourdhui.js'
import { rendreProspects } from './components/views/Prospects.js'
import { rendreReglages, chargerReglages, clicReglages, changeReglages } from './components/views/Reglages.js'
import { rendreAide } from './components/views/Aide.js'

monterAppShell()

const VUES = { aujourdhui: rendreAujourdhui, prospects: rendreProspects, reglages: rendreReglages, aide: rendreAide }

function rendre() {
    rendreAppShell()
    VUES[store.vue]?.()
}

async function charger() {
    const r = await api.get('/etat')
    store.E = r.success ? r : null
    if (!store.R) await chargerReglages()
    rendre()
}

async function recharger() {
    store.R = null
    await charger()
    return true
}

function aller(v) {
    afficherVue(v)
    if (v === 'reglages') chargerReglages().then(rendre)
    else rendre()
}

// while I type in an e-mail, the refresh does not redraw it
document.addEventListener('focusin', (e) => { if (e.target.closest('#a-valider')) store.edition = true })
document.addEventListener('focusout', () => setTimeout(() => (store.edition = !!document.activeElement?.closest?.('#a-valider')), 50))

document.addEventListener('click', async (ev) => {
    const b = ev.target.closest('button')
    if (!b) return
    if (b.dataset.vue) return aller(b.dataset.vue)
    if (b.dataset.aller) return aller(b.dataset.aller)
    if (b.id === 'preparer') { await action(b, () => exiger(api.post('/preparation')), 'Préparation lancée : la recherche tourne en fond'); return charger() }
    if (b.dataset.suivi) {
        if (b.dataset.suivi === 'refus' && !confirmer(b, 'Confirmer : ne plus lui écrire')) return
        await action(b, () => exiger(api.post('/suivi', { id: b.dataset.id, action: b.dataset.suivi })), 'Noté')
        return charger()
    }
    if (b.dataset.brouillon) {
        const c = b.closest('.carte'), d = { id: c.dataset.id, etape: c.dataset.etape, action: b.dataset.brouillon }
        if ($('[data-corps]', c)) { d.objet = $('[data-objet]', c).value; d.corps = $('[data-corps]', c).value }
        if (d.action === 'rejeter' && !confirmer(b, 'Confirmer : ne pas lui écrire')) return
        const r = await action(b, () => exiger(api.post('/brouillons', d)), { valider: 'Validé : il partira au prochain créneau', rejeter: 'Prospect retiré', annuler: 'Validation annulée' }[d.action])
        if (r) { store.edition = false; charger() }
        return
    }
    if (b.id === 'tout-valider') {
        b.disabled = true
        let n = 0
        for (const c of $$('#a-valider .carte')) {
            if ($('.pb', c)) continue
            const r = await api.post('/brouillons', { id: c.dataset.id, etape: c.dataset.etape, action: 'valider', objet: $('[data-objet]', c).value, corps: $('[data-corps]', c).value })
            if (r.success) n++; else toast(r.error, true)
        }
        toast(`${n} e-mail(s) validé(s) : ils partiront aux prochains créneaux`)
        b.disabled = false; store.edition = false
        return charger()
    }
    if (b.dataset.hote) {
        await action(b, () => hote(b.dataset.hote), (x) => (typeof x === 'string' ? x : 'Fait'))
        if (['connecterClaude', 'installerClaude'].includes(b.dataset.hote)) setTimeout(recharger, 15000)
        return recharger()
    }
    if (b.dataset.ouvrir) return hote('ouvrir', b.dataset.ouvrir).catch((e) => toast(e.message, true))
    if (await clicReglages(b, recharger)) return
})

document.addEventListener('change', (ev) => changeReglages(ev.target, recharger))

charger()
setInterval(charger, 15000)
