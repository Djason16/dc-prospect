// Every prospect (search, filters) and the figures of the plan (week, since the start, per zone)
import { $, esc, pct } from '../../utils/dom.js'
import { store } from '../../stores/etat.js'

const OBJECTIFS = [
    ['Taux de réponse', 'tauxReponse', 8, '8 % ou plus', true, 'Mieux personnaliser l\'accroche, tester un autre objet', 'contactes'],
    ['Taux de rendez-vous', 'tauxRdv', 30, '30 % ou plus', true, 'Proposer plus tôt la maquette offerte ou l\'appel de 15 min', 'reponses'],
    ['Taux de signature', 'tauxSignature', 25, '25 % ou plus', true, 'Revoir la proposition et la réponse aux objections', 'propositions'],
    ['STOP', 'tauxStop', 2, 'moins de 2 %', false, 'Mieux cibler (le besoin doit être visible)', 'contactes'],
]

export function rendreProspects() {
    const { E, R } = store
    if (!E) return
    const el = $('#vue-prospects')
    if (!el.dataset.monte) {
        el.dataset.monte = '1'
        el.innerHTML = `
        <div class="tete"><div><p class="label eyebrow">Suivi et résultats</p><h1 class="display display-l">Prospects</h1></div>
            <p class="muted" id="lien-classeur">Le même tableau est dans ton dossier de données (Suivi prospection.xlsx).</p></div>
        <div class="grille g4 section" id="chiffres-tuiles"></div>
        <details class="section"><summary class="label eyebrow" style="cursor:pointer">Objectifs du plan et comparaison des zones</summary><div id="chiffres-detail" style="margin-top:1rem"></div></details>
        <div class="filtres"><input type="search" id="recherche" placeholder="Chercher une entreprise, une ville, un e-mail..."><select id="filtre-statut"><option value="">Tous les statuts</option></select><select id="filtre-zone"><option value="">Toutes les zones</option></select></div>
        <div style="overflow-x:auto"><table class="tableau" id="table-suivi"></table></div>`
        for (const s of ['#recherche', '#filtre-statut', '#filtre-zone']) $(s).addEventListener('input', rendreTable)
    }
    const { semaine: s, total: t } = E.stats
    $('#chiffres-tuiles').innerHTML = [['Contactés cette semaine', s.contactes], ['Réponses cette semaine', s.reponses], ['Taux de réponse (total)', pct(t.tauxReponse)], ['Clients (total)', t.clients]]
        .map(([l, n]) => `<div class="tuile"><p class="label">${l}</p><div class="chiffre">${n}</div></div>`).join('')
    $('#chiffres-detail').innerHTML = `<table class="tableau"><thead><tr><th>Indicateur</th><th>Depuis le début</th><th>Objectif</th><th>Verdict</th></tr></thead><tbody>
        ${OBJECTIFS.map(([n, k, seuil, obj, haut, conseil, base]) => {
            const v = t[k], assez = t[base] >= 30 || k === 'tauxSignature', ok = haut ? v >= seuil : v < seuil
            return `<tr><td>${n}</td><td>${pct(v)}</td><td>${obj}</td><td>${!assez ? '<span class="muted">pas encore assez de données (30 minimum)</span>' : ok ? '<span style="color:var(--mint)">OK</span>' : esc(conseil)}</td></tr>`
        }).join('')}</tbody></table>
        <table class="tableau" style="margin-top:1.5rem"><thead><tr><th>Zone</th><th>Contactés</th><th>Réponses</th><th>Taux de réponse</th><th>Clients</th></tr></thead><tbody>
        ${(E.stats.zones || []).map((z) => `<tr><td>${esc(z.zone)}</td><td>${z.contactes}</td><td>${z.reponses}</td><td>${pct(z.tauxReponse)}</td><td>${z.clients}</td></tr>`).join('')}</tbody></table>`
    if (R?.comptes?.google?.classeur) $('#lien-classeur').innerHTML = `Le même tableau est dans <a href="${esc(R.comptes.google.classeur)}" target="_blank">Google Sheets</a>, toujours à jour.`
    rendreTable()
}

function rendreTable() {
    const E = store.E
    const remplir = (sel, liste) => { const v = sel.value; sel.innerHTML = sel.options[0].outerHTML + liste.map((x) => `<option${x === v ? ' selected' : ''}>${esc(x)}</option>`).join('') }
    remplir($('#filtre-statut'), [...new Set(E.suivi.map((p) => p.statut))])
    remplir($('#filtre-zone'), [...new Set(E.suivi.map((p) => p.zone).filter(Boolean))])
    const q = $('#recherche').value.toLowerCase(), fs = $('#filtre-statut').value, fz = $('#filtre-zone').value
    const lignes = E.suivi.filter((p) => (!fs || p.statut === fs) && (!fz || p.zone === fz) && (!q || `${p.entreprise} ${p.ville} ${p.email} ${p.metier}`.toLowerCase().includes(q)))
    $('#table-suivi').innerHTML = `<thead><tr><th>Entreprise</th><th>Métier</th><th>Ville</th><th>Statut</th><th>1er e-mail</th><th>Relance 1</th><th>Relance 2</th><th>Prochaine étape</th><th>Réponse</th></tr></thead><tbody>${lignes.map((p) => `<tr><td><strong>${esc(p.entreprise)}</strong><br><span class="muted petit">${esc(p.email || '')}</span></td><td>${esc(p.metier)}</td><td>${esc(p.ville)}</td><td>${esc(p.statut)}</td><td>${esc(p.j0)}</td><td>${esc(p.r1)}</td><td>${esc(p.r2)}</td><td>${esc(p.prochaine)}</td><td class="petit">${esc(p.reponse)}</td></tr>`).join('') || '<tr><td colspan="9" class="muted">Aucun prospect pour l\'instant : DC Prospect en cherche chaque jour ouvré.</td></tr>'}</tbody>`
}
