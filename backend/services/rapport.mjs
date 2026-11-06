// Reports on the Drive: tracking table (xlsx, opens in Google Sheets), daily report, Friday review
import fs from 'node:fs'
import path from 'node:path'
import ExcelJS from 'exceljs'
import { cfg, jour, ajouterJours, dateDe, dateFr, nomJour, semaineIso, prochainJourEnvoi, log } from './base.mjs'
import { prochaineEtape, aValider, fileEnvoi, NOM_ETAPE } from './prospection.mjs'
import { consommation } from './claude.mjs'
import { zoneDeLaSemaine } from './reglages.mjs'
import { googleActif, optionsGoogle, ecrireClasseur, publierRapport } from './google.mjs'

const STATUT = {
    pret: 'Prêt (1er e-mail rédigé)', en_sequence: 'En séquence', repondu: 'A répondu', stop: 'STOP',
    termine: 'Séquence finie sans réponse', ecarte: 'Écarté', autre_canal: 'À contacter autrement', client: 'Client',
}

// Zones of the settings plus those still present in the data (a removed zone keeps its history)
const nomsZones = (etat) => [...new Set([...cfg.zones.map((z) => z.nom), ...etat.prospects.map((p) => p.zone).filter(Boolean)])]

// ---------- Figures (plan, section 6) ----------
export function chiffres(etat, du = '0000-00-00', au = '9999-99-99', zone) {
    const dans = (d) => d && d >= du && d <= au
    const ps = etat.prospects.filter((p) => !zone || p.zone === zone)
    const emails = ps.reduce((n, p) => n + ['j0', 'r1', 'r2'].filter((e) => dans(p.etapes?.[e]?.envoyeLe)).length, 0)
    const contactes = ps.filter((p) => dans(p.etapes?.j0?.envoyeLe)).length
    const reponses = ps.filter((p) => dans(p.reponse?.date)).length
    const stops = ps.filter((p) => dans(p.stopLe)).length
    const appels = ps.filter((p) => dans(p.suivi?.appel)).length
    const propositions = ps.filter((p) => dans(p.suivi?.proposition)).length
    const clients = ps.filter((p) => dans(p.suivi?.client)).length
    const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)
    return {
        emails, contactes, reponses, stops, appels, propositions, clients,
        trouves: ps.filter((p) => dans(p.ajouteLe) && p.statut !== 'ecarte').length,
        tauxReponse: pct(reponses, contactes), tauxRdv: pct(appels, reponses), tauxSignature: pct(clients, propositions), tauxStop: pct(stops, contactes),
    }
}

const OBJECTIFS = [
    ['Taux de réponse', 'tauxReponse', '8 % ou plus', (v) => v >= 8, 'Mieux personnaliser l\'accroche, tester un autre objet'],
    ['Taux de rendez-vous', 'tauxRdv', '30 % ou plus', (v) => v >= 30, 'Proposer plus tôt la maquette offerte ou l\'appel de 15 min'],
    ['Taux de signature', 'tauxSignature', '25 % ou plus', (v) => v >= 25, 'Revoir la proposition et la réponse aux objections'],
    ['Plaintes ou STOP', 'tauxStop', 'moins de 2 %', (v) => v < 2, 'Mieux cibler (le besoin doit être visible)'],
]

const pourcent = (v) => `${String(v).replace('.', ',')} %`

// The three tabs of the tracking table, the same for the Excel file and for Google Sheets
export function onglets(etat) {
    const suivis = etat.prospects.filter((p) => !['ecarte', 'autre_canal'].includes(p.statut))
        .sort((a, b) => (b.etapes?.j0?.envoyeLe || b.ajouteLe).localeCompare(a.etapes?.j0?.envoyeLe || a.ajouteLe))
    const lundi = ajouterJours(jour(), -((dateDe(jour()).getDay() + 6) % 7))
    const lignesChiffres = []
    for (const [titre, du, au] of [['Cette semaine', lundi, ajouterJours(lundi, 6)], ['Depuis le début', '0000', '9999']]) {
        for (const zone of [undefined, ...nomsZones(etat)]) {
            const c = chiffres(etat, du, au, zone)
            lignesChiffres.push([titre, zone || 'Toutes', c.trouves, c.contactes, c.emails, c.reponses, c.appels, c.propositions, c.clients, c.stops,
                pourcent(c.tauxReponse), pourcent(c.tauxRdv), pourcent(c.tauxSignature), pourcent(c.tauxStop)])
        }
    }
    return [
        {
            titre: 'Suivi',
            colonnes: [
                ['Date', 11], ['Entreprise', 26], ['Métier', 18], ['Ville', 16], ['Zone', 12], ['Contact', 18], ['E-mail pro', 28], ['Source', 16],
                ['Signal', 30], ['Score', 7], ['J0', 11], ['Relance 1', 11], ['Relance 2', 11], ['Réponse', 34], ['Maquette envoyée', 11],
                ['Appel', 11], ['Proposition', 11], ['Résultat', 14], ['STOP', 11], ['Statut', 18], ['Site', 26], ['Note Google', 14],
            ],
            lignes: suivis.map((p) => [
                dateFr(p.ajouteLe), p.entreprise, p.metier, p.ville, p.zone, p.contact || '', p.email || '', 'Registre + web',
                p.signal || '', `${p.score ?? ''} ${p.niveau ? '(' + p.niveau + ')' : ''}`.trim(),
                dateFr(p.etapes?.j0?.envoyeLe), dateFr(p.etapes?.r1?.envoyeLe), dateFr(p.etapes?.r2?.envoyeLe),
                p.reponse ? `${dateFr(p.reponse.date)} : ${p.reponse.extrait}` : '', dateFr(p.suivi?.maquette), dateFr(p.suivi?.appel),
                dateFr(p.suivi?.proposition), p.suivi?.client ? 'Client' : (p.suivi?.resultat || ''), dateFr(p.stopLe), STATUT[p.statut] || p.statut,
                p.siteWeb || '', p.noteGoogle || '',
            ]),
        },
        {
            titre: 'À appeler',
            colonnes: [
                ['Trouvé le', 11], ['Entreprise', 26], ['Métier', 18], ['Ville', 16], ['Zone', 12], ['Téléphone', 16], ['Instagram / Facebook', 30],
                ['Signal', 34], ['Note Google', 14], ['Score', 7], ['Adresse', 36], ["Accroche pour l'appel", 60],
            ],
            lignes: etat.prospects.filter((p) => p.statut === 'autre_canal').sort((a, b) => (b.score || 0) - (a.score || 0)).map((p) => [
                dateFr(p.ajouteLe), p.entreprise, p.metier, p.ville, p.zone, p.telephone || '', p.instagram || '', p.signal || '', p.noteGoogle || '', p.score ?? '', p.adresse || '', p.accrocheAppel || '',
            ]),
        },
        {
            titre: 'Chiffres',
            colonnes: [
                ['Période', 16], ['Zone', 14], ['Prospects trouvés', 11], ['Contactés', 11], ['E-mails envoyés', 11], ['Réponses', 10], ['Appels', 9],
                ['Propositions', 12], ['Clients', 9], ['STOP', 8], ['Taux de réponse (obj. 8 %)', 14], ['Taux de RDV (obj. 30 %)', 14],
                ['Taux de signature (obj. 25 %)', 14], ['STOP (obj. < 2 %)', 12],
            ],
            lignes: lignesChiffres,
        },
    ]
}

// ---------- Tracking table: Google Sheets when Google is connected, Excel file in the local folder in any case ----------
export async function ecrireTableau(etat) {
    const tabs = onglets(etat).filter((t) => t.titre !== 'À appeler' || t.lignes.length) // the call list only shows when it has someone
    const wb = new ExcelJS.Workbook()
    wb.creator = 'DC Prospect'
    const encre = 'FF111417', menthe = 'FF7EE6A8', gris = 'FFD9DEE2'
    for (const { titre, colonnes, lignes } of tabs) {
        const ws = wb.addWorksheet(titre, { views: [{ state: 'frozen', ySplit: 1 }] })
        ws.columns = colonnes.map(([header, largeur]) => ({ header: header.toUpperCase(), width: largeur }))
        ws.getRow(1).eachCell((c) => {
            c.font = { bold: true, color: { argb: menthe }, name: 'Arial', size: 10 }
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: encre } }
            c.alignment = { vertical: 'middle', wrapText: true }
        })
        ws.getRow(1).height = 30
        for (const l of lignes) {
            const r = ws.addRow(l)
            r.eachCell({ includeEmpty: true }, (c) => {
                c.font = { name: 'Arial', size: 10 }
                c.alignment = { vertical: 'top', wrapText: true }
                c.border = { bottom: { style: 'thin', color: { argb: gris } }, right: { style: 'thin', color: { argb: gris } } }
            })
        }
        ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colonnes.length } }
    }
    let ok = true
    try { await wb.xlsx.writeFile(path.join(cfg.dossierDrive, 'Suivi prospection.xlsx')) } catch (e) { ok = false; log('Tableau Excel non écrit (ouvert dans Excel ?) :', e.message) }
    if (googleActif() && optionsGoogle().sheets) {
        try { await ecrireClasseur(tabs) } catch (e) { ok = false; log('Google Sheets non mis à jour :', e.message) }
    }
    return ok
}

// ---------- Daily report (and Friday review) ----------
export function ecrireRapport(etat, { infos = [] } = {}) {
    const aujourdhui = jour()
    const zone = zoneDeLaSemaine()
    const c = chiffres(etat, aujourdhui, aujourdhui)
    const evenements = etat.journal.filter((j) => j.date.slice(0, 10) === aujourdhui && j.type !== 'lot')
    const valider = aValider(etat)
    const file = fileEnvoi(etat)
    const reponses = etat.prospects.filter((p) => p.statut === 'repondu' && !p.suivi?.traite)
    const autres = etat.prospects.filter((p) => p.statut === 'autre_canal' && p.ajouteLe === aujourdhui)
    const prets = etat.prospects.filter((p) => p.statut === 'pret' && p.brouillons?.j0?.statut === 'en_reserve').length
    const relancesAVenir = etat.prospects.map((p) => ({ p, n: prochaineEtape(p) })).filter((x) => x.n && x.n.etape !== 'j0')
    const L = []
    L.push(`# DC Prospect : ${nomJour(aujourdhui)}`, '')
    L.push(`Zone de la semaine ${semaineIso()} : **${zone || 'aucune zone active'}**. Page de validation : http://localhost:${cfg.port}`, '')
    L.push('## À faire par moi')
    if (reponses.length) for (const p of reponses) L.push(`- **Répondre à ${p.entreprise}** (${p.ville}, ${p.email}) : « ${p.reponse.extrait.slice(0, 160)} ».`)
    if (valider.length) L.push(`- **Valider ${valider.length} e-mail(s)** sur la page de validation (envoi ensuite tout seul, ${cfg.fenetres.map((f) => f.join('-')).join(' ou ')}).`)
    const aAppeler = etat.prospects.filter((p) => p.statut === 'autre_canal').sort((x, y) => (y.score || 0) - (x.score || 0))
    if (aAppeler.length) {
        L.push(`- **${aAppeler.length} prospect(s) à appeler ou visiter** (pas d'e-mail publié ; liste complète sur la page et dans l'onglet « À contacter autrement »). Les 5 meilleurs :`)
        for (const p of aAppeler.slice(0, 5)) L.push(`  - ${p.entreprise} (${p.metier}, ${p.ville}) : ${p.telephone || 'pas de téléphone, passer à ' + (p.adresse || p.ville)}. ${p.accrocheAppel ? '« ' + p.accrocheAppel + ' »' : ''}`)
    }
    const chauds = etat.prospects.filter((p) => p.etapes?.r1 && !p.etapes?.r2 && p.niveau === 'CHAUD' && !p.suivi?.maquette)
    if (dateDe(aujourdhui).getDay() === 3 && chauds.length) L.push(`- **Maquette offerte** pour les prospects chauds (prompt « 05 - Maquette de prospection ») : ${chauds.map((p) => p.entreprise).join(', ')}.`)
    if (!reponses.length && !valider.length && !aAppeler.length) L.push('- Rien aujourd\'hui.')
    L.push('', '## Ce que l\'outil a fait')
    for (const i of infos) L.push(`- ${i}`)
    for (const e of evenements) L.push(`- ${new Date(e.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} : ${e.texte}`)
    if (!infos.length && !evenements.length) L.push('- Rien.')
    L.push('', '## État')
    L.push(`- E-mails envoyés aujourd'hui : ${c.emails} / ${cfg.maxEmailsParJour}. En attente d'envoi (validés) : ${file.length}.`)
    L.push(`- Prospects prêts en réserve : ${prets} / ${cfg.reserveProspectsPrets}. Prochain jour d'envoi : ${nomJour(prochainJourEnvoi(ajouterJours(aujourdhui, 1)))}.`)
    const conso = consommation(new Date().toISOString().slice(0, 10))
    const rech = etat.prospects.filter((p) => p.ajouteLe === aujourdhui)
    if (rech.length) L.push(`- Recherche du jour : ${rech.length} entreprises étudiées, ${rech.filter((p) => p.statut === 'pret').length} avec e-mail retenues, ${rech.filter((p) => p.statut === 'autre_canal').length} à contacter autrement.`)
    if (conso.appels) L.push(`- Claude : ${conso.appels} appels aujourd'hui (valeur équivalente API : ${String(conso.usd).replace('.', ',')} $, compris dans l'abonnement ; si la limite de l'abonnement est atteinte, baisser maxRecherchesParJour dans config.json).`)
    if (relancesAVenir.length) L.push(`- Relances prévues : ${relancesAVenir.slice(0, 15).map(({ p, n }) => `${p.entreprise} (${NOM_ETAPE[n.etape]}, ${dateFr(n.due)})`).join(' ; ')}${relancesAVenir.length > 15 ? '...' : ''}.`)
    if (dateDe(aujourdhui).getDay() === 5) L.push('', ...bilanSemaine(etat))
    const dossier = path.join(cfg.dossierDrive, 'Rapports', aujourdhui.slice(0, 4))
    fs.mkdirSync(dossier, { recursive: true })
    const fichier = path.join(dossier, `${aujourdhui} - Rapport.md`)
    fs.writeFileSync(fichier, L.join('\n') + '\n')
    if (googleActif() && optionsGoogle().docs) publierRapport(`${aujourdhui} - Rapport`, L.join('\n')).catch((e) => log('Rapport Google Docs non publié :', e.message))
    return fichier
}

function bilanSemaine(etat) {
    const aujourdhui = jour()
    const lundi = ajouterJours(aujourdhui, -4)
    const L = [`## Bilan de la semaine (du ${dateFr(lundi)} au ${dateFr(aujourdhui)})`, '']
    const sem = chiffres(etat, lundi, aujourdhui), tout = chiffres(etat)
    L.push('| | Semaine | Depuis le début |', '|---|---|---|')
    for (const [n, k] of [['Prospects trouvés', 'trouves'], ['Contactés (1er e-mail)', 'contactes'], ['E-mails envoyés', 'emails'], ['Réponses', 'reponses'], ['Appels', 'appels'], ['Propositions', 'propositions'], ['Clients', 'clients'], ['STOP', 'stops']])
        L.push(`| ${n} | ${sem[k]} | ${tout[k]} |`)
    L.push('', '| Indicateur | Depuis le début | Objectif | Verdict |', '|---|---|---|---|')
    for (const [n, k, obj, ok, conseil] of OBJECTIFS) {
        const v = tout[k]
        const base = { tauxReponse: tout.contactes, tauxRdv: tout.reponses, tauxSignature: tout.propositions, tauxStop: tout.contactes }[k]
        L.push(`| ${n} | ${String(v).replace('.', ',')} % | ${obj} | ${base < 30 && k !== 'tauxSignature' ? 'pas encore assez d\'e-mails (30 minimum)' : ok(v) ? 'OK' : conseil} |`)
    }
    const parZone = nomsZones(etat).map((z) => ({ z, c: chiffres(etat, '0000', '9999', z) })).sort((a, b) => b.c.tauxReponse - a.c.tauxReponse)
    L.push('', '**Quelle zone répond le mieux ?**', '', '| Zone | Contactés | Réponses | Taux | Clients |', '|---|---|---|---|---|')
    for (const { z, c } of parZone) L.push(`| ${z} | ${c.contactes} | ${c.reponses} | ${String(c.tauxReponse).replace('.', ',')} % | ${c.clients} |`)
    L.push('', 'Rappel du plan : tester une seule chose à la fois (objet, accroche ou offre) sur au moins 30 e-mails avant de conclure.')
    return L
}
