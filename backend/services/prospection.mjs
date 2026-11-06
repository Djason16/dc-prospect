// The plan, step by step: replies and STOP, research, drafts, batch of the day, sending queue
import { cfg, jour, ajouterJours, ecartJours, estOuvre, estJourEnvoi, dansFenetre, dateDe, noter, log, sauverEtat } from './base.mjs'
import { communes, mxValide, verifierRegistre } from './web.mjs'
import { zoneDeLaSemaine, zoneParNom, secteursActifs, nomComplet, profilComplet } from './reglages.mjs'
import { trouverSurLeWeb, redigerPremier, redigerRelance, controlerTexte } from './claude.mjs'
import { envoyer, lireReponses } from './mail.mjs'

const MESSAGERIES = /@(gmail|googlemail|hotmail|outlook|live|yahoo|orange|wanadoo|free|sfr|laposte|icloud|me|aol|gmx|bbox|neuf)\./i
const ETAPES = ['j0', 'r1', 'r2']
export const NOM_ETAPE = { j0: '1er e-mail', r1: 'Relance 1', r2: 'Relance 2' }

export const prospect = (etat, id) => etat.prospects.find((p) => p.id === id)
export const envoyesLe = (etat, j = jour()) => etat.envois[j] || 0
const estStop = (etat, email) => !!email && etat.stop.includes(email.toLowerCase())

// Next step of a prospect in sequence and the day it is due
export function prochaineEtape(p) {
    if (!['pret', 'en_sequence'].includes(p.statut)) return null
    const j0 = p.etapes?.j0?.envoyeLe
    if (!j0) return { etape: 'j0', due: null }
    if (!p.etapes.r1) return { etape: 'r1', due: ajouterJours(j0, cfg.relances.r1) }
    if (!p.etapes.r2) return { etape: 'r2', due: ajouterJours(j0, cfg.relances.r2) }
    return null
}

// ---------- 1. Replies, STOP, bounces ----------
export async function synchroniserReponses(etat) {
    const adresses = new Set(etat.prospects.filter((p) => p.email && p.etapes?.j0).map((p) => p.email.toLowerCase()))
    const domaines = new Set([...adresses].filter((a) => !MESSAGERIES.test(a)).map((a) => a.split('@')[1]))
    if (!adresses.size) return 0
    const messages = await lireReponses(30, (e) => !etat.messagesVus.includes(e.id) && (e.rebond || adresses.has(e.de) || domaines.has(e.de.split('@')[1])))
    let nouveaux = 0
    for (const m of messages) {
        if (etat.messagesVus.includes(m.id)) continue
        etat.messagesVus.push(m.id)
        const actifs = etat.prospects.filter((p) => p.email && p.etapes?.j0)
        if (m.rebond) {
            const p = actifs.find((x) => m.texte.toLowerCase().includes(x.email.toLowerCase()))
            if (p && p.statut !== 'stop') {
                p.statut = 'ecarte'; p.raison = 'adresse invalide (e-mail revenu)'
                noter(etat, 'rebond', `${p.entreprise} : adresse ${p.email} invalide, séquence arrêtée`, { id: p.id })
                nouveaux++
            }
            continue
        }
        const domaine = (e) => e.split('@')[1]
        const p = actifs.find((x) => x.email.toLowerCase() === m.de) ||
            actifs.find((x) => !MESSAGERIES.test(m.de) && domaine(x.email.toLowerCase()) === domaine(m.de))
        if (!p) continue
        if (/réponse automatique|absence|out of office|automatic reply|autoreply/i.test(m.objet)) continue
        // Only the new text, not the quoted e-mail
        const nouveau = m.texte.split(/\n>|\nLe .{5,80}a écrit|\nOn .{5,80}wrote|-----Original/)[0]
        const veutStop = /\bstop\b|d[ée]sinscri|ne (plus|pas) (me |nous )?(contacter|[ée]crire|recevoir|solliciter)/i.test(`${m.objet}\n${nouveau}`)
        p.reponse = { date: m.date?.slice(0, 10) || jour(), objet: m.objet, extrait: nouveau.replace(/\s+/g, ' ').trim().slice(0, 400), lu: false }
        if (veutStop) {
            p.statut = 'stop'; p.stopLe = jour()
            if (!etat.stop.includes(p.email.toLowerCase())) etat.stop.push(p.email.toLowerCase())
            noter(etat, 'stop', `${p.entreprise} a répondu STOP : retiré pour toujours`, { id: p.id })
        } else if (p.statut !== 'stop') {
            p.statut = 'repondu'
            noter(etat, 'reponse', `${p.entreprise} a répondu : à traiter`, { id: p.id })
        }
        for (const e of ETAPES) if (p.brouillons?.[e]?.statut === 'valide' || p.brouillons?.[e]?.statut === 'a_valider') p.brouillons[e].statut = 'annule'
        nouveaux++
    }
    return nouveaux
}

// ---------- 2. Research: keep a reserve of ready prospects (first e-mail drafted) ----------
// Main way: Claude searches the web for "trade + town" in the zone of the week and keeps small businesses that publish
// an e-mail on their own site. Each e-mail is checked (syntax, domain receives mail, not already known, not STOP),
// the business is looked up in the official register (closed or opposed to prospecting = out), then Sonnet writes the e-mail.
export async function rechercher(etat, { surAvancement = () => {} } = {}) {
    const aujourdhui = jour()
    const prets = etat.prospects.filter((p) => p.statut === 'pret').length
    const budget = cfg.maxRecherchesParJour - (etat.recherches[aujourdhui] || 0)
    const manque = cfg.reserveProspectsPrets - prets
    if (manque <= 0 || budget <= 0) return { trouves: 0, essais: 0, erreurs: 0, appels: 0 }
    if (!profilComplet()) return { trouves: 0, essais: 0, erreurs: 0, appels: 0 } // nothing is searched before the profile is filled
    const nomZone = zoneDeLaSemaine()
    const zone = zoneParNom(nomZone)
    if (!zone) return { trouves: 0, essais: 0, erreurs: 0, appels: 0 }
    // (town, trade) pairs not searched in the last 60 days: big towns first, trades that bring the most first
    etat.paires = etat.paires || {}
    const villes = await communes(zone)
    const poids = rendementParMetier(etat)
    const metiers = secteursActifs().map((s) => ({ s, k: Math.random() ** (1 / (poids[s.nom] || 0.3)) })).sort((a, b) => b.k - a.k).map((x) => x.s)
    const paires = []
    for (const v of villes) for (const m of metiers) {
        const cle = `${v.nom}|${m.nom}`
        if (!etat.paires[cle] || ecartJours(etat.paires[cle], aujourdhui) > 60) paires.push({ v, m, cle })
    }
    // spread over towns: one trade per town per round
    paires.sort((a, b) => villes.indexOf(a.v) - villes.indexOf(b.v))
    const ordre = []
    while (paires.length && ordre.length < budget) {
        const vues = new Set()
        for (let i = 0; i < paires.length && ordre.length < budget;) {
            if (vues.has(paires[i].v.nom)) { i++; continue }
            vues.add(paires[i].v.nom); ordre.push(paires.splice(i, 1)[0])
        }
    }
    const connus = new Set(etat.prospects.flatMap((p) => [p.email, p.email?.split('@')[1], p.siteWeb && domaineDe(p.siteWeb)]).filter(Boolean).filter((x) => x.includes('@') || !MESSAGERIES.test('@' + x)))
    let trouves = 0, essais = 0, erreurs = 0, examines = 0, i = 0
    const travailleur = async () => {
        while (i < ordre.length && trouves < manque) {
            const { v, m, cle } = ordre[i++]
            essais++
            etat.recherches[aujourdhui] = (etat.recherches[aujourdhui] || 0) + 1
            etat.paires[cle] = aujourdhui
            surAvancement(`Recherche ${essais}/${ordre.length} : ${m.nom} à ${v.nom}`)
            let r
            try { r = await trouverSurLeWeb({ metier: m.nom, commune: v.nom, cp: v.cp, deja: [...connus] }) } catch (e) { erreurs++; log('Recherche en échec', cle, e.message); if (erreurs >= 3 && erreurs === essais) i = ordre.length; continue }
            for (const e of r.entreprises || []) {
                if (trouves >= manque) break
                examines++
                const email = String(e.email || '').trim().toLowerCase().replace(/^mailto:/, '')
                const domaine = e.siteWeb ? domaineDe(e.siteWeb) : null
                if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(email) || /\.(png|jpe?g|gif|webp)$/.test(email) || /example|exemple|domain|votre|wix|sentry/i.test(email)) continue
                if (connus.has(email) || (domaine && connus.has(domaine)) || estStop(etat, email)) continue
                if ((await mxValide(email)) === false) { log('E-mail sans serveur de réception, ignoré :', email); continue }
                const reg = await verifierRegistre(e.nom, e.codePostal || v.cp)
                const id = reg?.siren || `web-${domaine || email}`
                connus.add(email); if (domaine) connus.add(domaine)
                if (etat.prospects.some((x) => x.id === id) || (etat.dejaVus || []).includes(id)) continue
                const p = {
                    id, entreprise: e.nom, raisonSociale: e.nom, metier: m.nom, ville: e.ville || v.nom, cp: e.codePostal || v.cp, zone: nomZone,
                    adresse: e.ville || v.nom, source: 'Recherche web + registre', ajouteLe: aujourdhui, etapes: {}, brouillons: {},
                    email, sourceEmail: e.sourceEmail, contact: e.contact, siteWeb: e.siteWeb, plateforme: e.plateforme, utiliseReservation: e.utiliseReservation,
                    telephone: e.telephone, signal: e.signal, noteGoogle: e.noteGoogle, reseaux: e.reseaux, detail: e.detail,
                    score: Number(e.score) || 0, niveau: e.niveau, pack: e.pack, siren: reg?.siren || null,
                }
                if (reg?.ferme || reg?.opposition || (reg?.nombreEtablissements || 1) > 3) {
                    p.statut = 'ecarte'; p.raison = reg.ferme ? 'fermée au registre' : reg.opposition ? 'refuse la prospection (registre)' : 'plusieurs établissements (chaîne)'
                } else {
                    try {
                        surAvancement(`Rédaction du 1er e-mail : ${e.nom} (${p.ville})`)
                        const mail = await redigerPremier(p)
                        p.statut = 'pret'
                        p.brouillons.j0 = { objet: mail.objet, corps: mail.corps, statut: 'en_reserve', prepareLe: aujourdhui, problemes: controlerTexte(mail.objet, mail.corps) }
                        trouves++
                    } catch (err) { p.statut = 'ecarte'; p.raison = 'rédaction impossible : ' + err.message.slice(0, 100) }
                }
                etat.prospects.push(p)
                try { sauverEtat(etat) } catch (err) { log('Sauvegarde impossible :', err.message) } // nothing lost if the PC shuts down
            }
            try { sauverEtat(etat) } catch {}
        }
    }
    await Promise.all(Array.from({ length: cfg.rechercheEnParallele }, travailleur))
    noter(etat, 'recherche', `${essais} recherches (métier + ville) en ${nomZone} : ${examines} entreprises avec e-mail examinées, ${trouves} prospects prêts`)
    return { trouves, essais, erreurs, appels: 0 }
}

const domaineDe = (u) => { try { return new URL(u.startsWith('http') ? u : 'https://' + u).hostname.replace(/^www\./, '').toLowerCase() } catch { return null } }

// Share of useful leads per trade (e-mail = 1, phone only = 0.4), with a prior so new trades get tried
export function rendementParMetier(etat) {
    const r = {}
    for (const s of secteursActifs()) {
        const ps = etat.prospects.filter((p) => p.metier === s.nom && p.ajouteLe)
        const utiles = ps.filter((p) => p.statut !== 'ecarte' && p.statut !== 'autre_canal').length + 0.4 * ps.filter((p) => p.statut === 'autre_canal').length
        r[s.nom] = Math.max(0.05, (utiles + 1) / (ps.length + 3))
    }
    return r
}

// ---------- 3. Batch of the day (send days only): follow-ups due, then first e-mails ----------
export async function preparerLot(etat, { surAvancement = () => {} } = {}) {
    const aujourdhui = jour()
    if (!estJourEnvoi(aujourdhui)) return { relances: 0, premiers: 0 }
    // first e-mails not validated on a previous day go back to the reserve
    for (const p of etat.prospects) {
        const b = p.brouillons?.j0
        if (p.statut === 'pret' && b?.statut === 'a_valider' && b.lot !== aujourdhui) { b.statut = 'en_reserve'; delete b.lot }
    }
    const dejaDansLot = etat.prospects.filter((p) => ETAPES.some((e) => p.brouillons?.[e]?.lot === aujourdhui && p.brouillons[e].statut !== 'annule')).length
    let place = cfg.maxEmailsParJour - Math.max(dejaDansLot, envoyesLe(etat))
    let relances = 0
    for (const p of etat.prospects) {
        const n = prochaineEtape(p)
        if (!n || n.etape === 'j0' || n.due > aujourdhui || place <= 0) continue
        if (p.brouillons[n.etape] && p.brouillons[n.etape].statut !== 'rejete') continue
        surAvancement(`Rédaction de la ${NOM_ETAPE[n.etape].toLowerCase()} : ${p.entreprise}`)
        try {
            const r = await redigerRelance(p, n.etape)
            p.brouillons[n.etape] = { objet: reObjet(p.brouillons.j0.objet), corps: r.corps, statut: 'a_valider', lot: aujourdhui, prepareLe: aujourdhui, problemes: controlerTexte('', r.corps) }
            place--; relances++
        } catch (e) { log('Relance non rédigée', p.entreprise, e.message) }
    }
    const quota = Math.min(cfg.j0ParJour[dateDe(aujourdhui).getDay()] || 0, place)
    const zone = zoneDeLaSemaine()
    const choisis = etat.prospects
        .filter((p) => p.statut === 'pret' && p.brouillons?.j0?.statut === 'en_reserve')
        .sort((a, b) => (b.zone === zone) - (a.zone === zone) || b.score - a.score || a.ajouteLe.localeCompare(b.ajouteLe))
        .slice(0, Math.max(0, quota))
    for (const p of choisis) Object.assign(p.brouillons.j0, { statut: 'a_valider', lot: aujourdhui })
    if (relances || choisis.length) noter(etat, 'lot', `Lot du jour : ${choisis.length} premiers e-mails et ${relances} relances à valider`)
    return { relances, premiers: choisis.length }
}

const reObjet = (o) => (/^re\s*:/i.test(o || '') ? o : `Re: ${o}`)

// Drafts waiting for my approval, today's batch first
export function aValider(etat) {
    const liste = []
    for (const p of etat.prospects) for (const e of ETAPES) {
        const b = p.brouillons?.[e]
        if (b?.statut === 'a_valider') liste.push({ p, etape: e, b })
    }
    return liste.sort((x, y) => (x.b.lot || '').localeCompare(y.b.lot || '') || ETAPES.indexOf(y.etape) - ETAPES.indexOf(x.etape) || y.p.score - x.p.score)
}

export function fileEnvoi(etat) {
    const liste = []
    for (const p of etat.prospects) for (const e of ETAPES) if (p.brouillons?.[e]?.statut === 'valide') liste.push({ p, etape: e, b: p.brouillons[e] })
    return liste.sort((x, y) => (x.b.valideLe || '').localeCompare(y.b.valideLe || ''))
}

// ---------- 4. Send one approved e-mail if we are in a sending window ----------
export async function envoyerSuivant(etat) {
    const aujourdhui = jour()
    if (!dansFenetre()) return null
    if (envoyesLe(etat) >= cfg.maxEmailsParJour) return null
    const dernier = etat.dernierEnvoi ? Date.now() - new Date(etat.dernierEnvoi).getTime() : Infinity
    const [mini, maxi] = cfg.ecartMinutes
    if (dernier < (etat.prochainEcart || mini) * 60e3) return null
    const suivant = fileEnvoi(etat).find(({ p }) => ['pret', 'en_sequence'].includes(p.statut) && !estStop(etat, p.email))
    if (!suivant) return null
    const { p, etape, b } = suivant
    const premier = p.etapes.j0
    const envoi = await envoyer({
        a: p.email, objet: b.objet, corps: b.corps, signature: 'principale', stop: true,
        enReponseA: etape === 'j0' ? undefined : premier.messageId,
        threadId: etape === 'j0' ? undefined : premier.threadId,
        citation: etape === 'j0' ? undefined : { entete: `Le ${dateDe(premier.envoyeLe).toLocaleDateString('fr-FR')}, ${nomComplet() || cfg.expediteur.nom} a écrit :`, texte: p.brouillons.j0.corps },
    })
    p.etapes[etape] = { envoyeLe: aujourdhui, messageId: envoi.messageId, threadId: envoi.threadId, objet: b.objet }
    b.statut = 'envoye'
    p.statut = etape === 'r2' ? 'termine' : 'en_sequence'
    etat.envois[aujourdhui] = envoyesLe(etat) + 1
    etat.dernierEnvoi = new Date().toISOString()
    etat.prochainEcart = mini + Math.random() * (maxi - mini)
    noter(etat, 'envoi', `${NOM_ETAPE[etape]} envoyé à ${p.entreprise} (${p.email})`, { id: p.id })
    return suivant
}

// ---------- 5. Data rule of the plan: forget leads without reply after 12 months ----------
export function oublier(etat) {
    const limite = ajouterJours(jour(), -cfg.oublierApresJours)
    etat.dejaVus = etat.dejaVus || []
    const garder = []
    for (const p of etat.prospects) {
        const date = p.etapes?.j0?.envoyeLe || p.ajouteLe
        const ancien = date < limite && ['ecarte', 'termine', 'en_sequence', 'pret'].includes(p.statut) && !p.reponse
        if (ancien) etat.dejaVus.push(p.id); else garder.push(p)
    }
    const n = etat.prospects.length - garder.length
    etat.prospects = garder
    if (n) noter(etat, 'rgpd', `${n} prospects sans réponse depuis 12 mois supprimés`)
}

export { estOuvre, ecartJours }
