// Home screen: getting started (if needed), what needs me today, e-mails to approve, e-mails waiting for their time slot
import { $, esc } from '../../utils/dom.js'
import { store } from '../../stores/etat.js'
import { carteEmail } from '../ui/CarteEmail.js'
import { blocClaude, blocEnvoi, blocProfil, blocZoneRapide } from './Reglages.js'

const envoiPret = (R) => (R.comptes?.envoi === 'gmail' ? R.comptes.gmail?.configure || R.comptes.google?.connecte : R.comptes?.messagerie?.motDePasse)
const pret = (R) => R?.profilComplet && R.zonesPretes && R.comptes?.claude?.connecte && envoiPret(R)

export function rendreAujourdhui() {
    const { E, R } = store
    if (!E) return
    const el = $('#vue-aujourdhui')
    // first render: build the frame once, then only refresh the parts (keeps what I am typing)
    if (!el.dataset.monte) {
        el.dataset.monte = '1'
        el.innerHTML = `
        <div class="tete"><div><p class="label eyebrow" id="jour-label"></p><h1 class="display display-l">Aujourd'hui</h1></div>
            <p class="muted">Tu valides, DC Prospect envoie depuis ton adresse aux bons moments, relance et lit les réponses. Rien ne part sans ton accord.</p></div>
        <div id="mise-en-route"></div><div id="bandeaux"></div>
        <div class="grille g4 section" id="tuiles"></div>
        <div class="section" id="bloc-reponses"></div>
        <div class="section"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <p class="label eyebrow" style="margin:0">E-mails à valider</p><button class="btn primaire" id="tout-valider" hidden>Tout valider</button></div>
            <div id="a-valider"></div></div>
        <div class="section"><p class="label eyebrow">Validés, partent au prochain créneau</p><div id="file"></div></div>
        <details class="section"><summary class="label eyebrow" style="cursor:pointer">Ce que DC Prospect a fait</summary><div id="journal" class="petit" style="margin-top:1rem"></div></details>`
    }
    $('#jour-label').textContent = `${E.aujourdhui} · zone de la semaine : ${E.zone}`

    // getting started, right here (no need to go to the settings)
    const etape = !R ? 0 : !R.profilComplet ? 1 : !R.zonesPretes ? 2 : !pret(R) ? 3 : 0
    $('#mise-en-route').innerHTML = etape ? `<div class="carte" style="border-color:rgba(126,230,168,.35)">
        <p class="label eyebrow">Mise en route, étape ${etape} sur 3 : ${['', 'qui tu es', 'où chercher', 'tes comptes'][etape]}</p>
        <div style="margin-top:1rem">${etape === 1 ? blocProfil(R, { complet: false }) : etape === 2 ? blocZoneRapide() : `<div class="grille g2">${blocClaude(R)}${blocEnvoi(R)}</div>`}</div>
        <p class="muted petit" style="margin:.4rem 0 0">Ensuite, DC Prospect cherche tes prospects tout seul. Tout reste modifiable dans Réglages.</p></div>` : ''

    const b = []
    if (E.occupe) b.push(`<div class="bandeau info"><span><span class="pastille attente" style="margin-right:.8rem"></span>${esc(E.avancement || 'Préparation en cours')}</span></div>`)
    if (E.erreur && pret(R)) b.push(`<div class="bandeau erreur"><span>${esc(E.erreur)}</span><button class="btn petit" data-aller="reglages">Réglages</button></div>`)
    if (E.sante?.miseAJour) b.push(`<div class="bandeau"><span>Nouvelle version de DC Prospect : ${esc(E.sante.miseAJour.version)}</span><button class="btn primaire petit" data-hote="installerMiseAJour">Installer</button></div>`)
    $('#bandeaux').innerHTML = b.join('')

    const s = E.stats
    $('#tuiles').innerHTML = [
        ['À valider', E.aValider.length, '', E.aValider.length > 0],
        ['Réponses', E.reponses.length, '', E.reponses.length > 0],
        ['Envoyés aujourd\'hui', E.envoyes, ` / ${E.max}`, false],
        ['Prospects prêts', s.prets, ` / ${s.reserve}`, false],
    ].map(([l, n, suite, accent]) => `<div class="tuile${accent ? ' accent' : ''}"><p class="label">${esc(l)}</p><div class="chiffre">${n}<small>${esc(suite)}</small></div></div>`).join('')

    $('#bloc-reponses').innerHTML = E.reponses.length ? `<p class="label eyebrow">Ils ont répondu</p>${E.reponses.map((r) => `<div class="carte">
        <div class="haut"><div><span class="etiquette">Réponse</span><strong class="display display-s">${esc(r.entreprise)}</strong></div><span class="muted">${esc(r.ville)} · ${esc(r.email)} · ${esc(r.date)}</span></div>
        <blockquote>${esc(r.extrait)}</blockquote>
        <p class="muted petit">Réponds depuis ta messagerie, puis dis à DC Prospect ce qui s'est passé :</p>
        <div class="actions">${[['appel', 'Appel prévu', 'primaire'], ['proposition', 'Proposition envoyée', ''], ['client', 'Devenu client', ''], ['traite', 'Rien d\'autre', ''], ['refus', 'Pas intéressé', 'danger']]
            .map(([a, t, c]) => `<button class="btn petit ${c}" data-suivi="${a}" data-id="${esc(r.id)}">${t}</button>`).join('')}</div></div>`).join('')}` : ''

    if (!store.edition) $('#a-valider').innerHTML = E.aValider.map((x) => carteEmail(x, true)).join('') || `<div class="vide">Rien à valider. ${E.stats.prets ? `${E.stats.prets} prospects sont prêts : ils arriveront ici ${esc(E.prochainEnvoi)}.` : 'DC Prospect cherche des prospects.'}</div>`
    $('#tout-valider').hidden = !E.aValider.length
    $('#file').innerHTML = E.file.map((x) => carteEmail(x, false)).join('') || `<div class="vide">Rien en attente. Créneaux : ${esc(E.fenetres)}, du mardi au jeudi.</div>`
    $('#journal').innerHTML = E.journal.slice(0, 20).map((j) => `<div style="padding:.45rem 0;border-bottom:1px solid var(--line)"><span class="muted">${esc(j.heure)}</span> · ${esc(j.texte)}</div>`).join('') || '<div class="vide">Rien pour l\'instant.</div>'
}
