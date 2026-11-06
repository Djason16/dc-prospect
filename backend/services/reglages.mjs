// Settings changed in the app (zones, trades, volumes), saved on the Drive so every PC uses the same ones.
// They override config.json, which only holds the defaults.
import fs from 'node:fs'
import path from 'node:path'
import { cfg, dossierDonnees, semaineIso } from './base.mjs'

const fichier = path.join(dossierDonnees, 'reglages.json')
const MODIFIABLES = ['zones', 'secteurs', 'maxRecherchesParJour', 'reserveProspectsPrets', 'j0ParJour', 'maxEmailsParJour', 'fenetres', 'relances', 'modeleRecherche', 'modeleRedaction', 'expediteur', 'smtp', 'imap', 'profil', 'joursEnvoi', 'joursRecherche', 'ecartMinutes', 'sauterFeries']

// Profile of the user (whoever uses the app): who writes the e-mails, what is sold, the signatures
export const CHAMPS_PROFIL = ['prenom', 'nom', 'entreprise', 'activite', 'offre', 'siteWeb', 'ville', 'telephone', 'titre', 'besoin', 'signaturePrincipale', 'signatureSecondaire', 'nomSignatureSecondaire']
export const profil = () => cfg.profil || {}
// First name and last name are separate fields; the full name is used in the e-mails and the signature
export const nomComplet = (p = profil()) => [p.prenom, p.nom].filter(Boolean).join(' ')
export const profilComplet = () => { const p = profil(); return !!(nomComplet(p) && p.activite && p.ville && cfg.expediteur?.adresse) }
// Signs of a need that the search looks for (the user can write his own for another trade than websites)
export const besoinParDefaut = 'pas de site, site daté ou lent, pas adapté au téléphone, site sur Wix, Google Sites ou Canva, réservation seulement via une plateforme (Planity, Fresha...), peu de contenu'

// config.json format { "Oise": ["60"] } -> [{ nom, departements, codesPostaux, active }]
const versListe = (z) => Array.isArray(z) ? z : Object.entries(z).map(([nom, departements]) => ({ nom: nom === 'IDF' ? 'Île-de-France' : nom, departements, codesPostaux: [], active: true }))

export function chargerReglages() {
    cfg.zones = versListe(cfg.zones)
    cfg.secteurs = cfg.secteurs.map((s) => ({ actif: true, ...s }))
    try {
        const r = JSON.parse(fs.readFileSync(fichier, 'utf8'))
        for (const k of MODIFIABLES) if (r[k] !== undefined) cfg[k] = r[k]
        cfg.zones = versListe(cfg.zones)
    } catch {}
    return cfg
}

export const zonesActives = () => cfg.zones.filter((z) => z.active !== false && (z.departements?.length || z.codesPostaux?.length))
export const secteursActifs = () => cfg.secteurs.filter((s) => s.actif !== false)
export const zoneParNom = (nom) => cfg.zones.find((z) => z.nom === nom)

const nettoyerListe = (v, re) => [...new Set(String(Array.isArray(v) ? v.join(',') : v || '').split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter((x) => re.test(x)))]

// Validates what comes from the app before saving; returns the error message or null
export function enregistrerReglages(r) {
    const nouveau = {}
    if (r.zones) {
        const zones = r.zones.map((z) => ({
            nom: String(z.nom || '').trim().slice(0, 60),
            departements: nettoyerListe(z.departements, /^(\d{2}|2A|2B|97\d)$/),
            codesPostaux: nettoyerListe(z.codesPostaux, /^\d{5}$/),
            active: z.active !== false,
        })).filter((z) => z.nom)
        if (new Set(zones.map((z) => z.nom)).size !== zones.length) return 'Deux zones ont le même nom.'
        if (zones.some((z) => !z.departements.length && !z.codesPostaux.length)) return 'Chaque zone a besoin d\'au moins un département ou un code postal.'
        if (!zones.some((z) => z.active)) return 'Garde au moins une zone active.'
        nouveau.zones = zones
    }
    if (r.secteurs) {
        const secteurs = r.secteurs.map((s) => ({ nom: String(s.nom || '').trim().slice(0, 60), naf: nettoyerListe(s.naf, /^\d{2}\.\d{2}[A-Z]$/), actif: s.actif !== false })).filter((s) => s.nom && s.naf.length)
        if (!secteurs.some((s) => s.actif)) return 'Garde au moins un métier actif.'
        nouveau.secteurs = secteurs
    }
    if (r.profil) {
        const p = { ...profil() }
        for (const k of CHAMPS_PROFIL) if (typeof r.profil[k] === 'string') p[k] = r.profil[k].trim().slice(0, k.startsWith('signature') ? 60000 : 2000)
        if (p.siteWeb && !/^https?:\/\//.test(p.siteWeb)) p.siteWeb = 'https://' + p.siteWeb
        nouveau.profil = p
        if (typeof r.profil.adresse === 'string') {
            const adresse = r.profil.adresse.trim().toLowerCase()
            if (adresse && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(adresse)) return 'Adresse d\'envoi invalide.'
            nouveau.expediteur = { nom: nomComplet(p) || cfg.expediteur.nom, adresse }
        }
    }
    // Sender and mail servers: any host
    if (r.messagerie) {
        const m = r.messagerie, hote = (h) => String(h || '').trim().toLowerCase()
        const adresse = String(m.adresse || '').trim().toLowerCase()
        if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(adresse)) return 'Adresse d\'envoi invalide.'
        if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(hote(m.smtpHote)) || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(hote(m.imapHote))) return 'Serveur d\'envoi ou de réception invalide.'
        nouveau.expediteur = { nom: String(m.nom || cfg.expediteur.nom).trim().slice(0, 80), adresse }
        nouveau.smtp = { hote: hote(m.smtpHote), port: Number(m.smtpPort) || 465 }
        nouveau.imap = { hote: hote(m.imapHote), port: Number(m.imapPort) || 993 }
    }
    const nombre = (k, min, max) => {
        if (r[k] === undefined) return null
        const n = Math.round(Number(r[k]))
        if (!(n >= min && n <= max)) return `${k} doit être entre ${min} et ${max}.`
        nouveau[k] = n
        return null
    }
    const err = nombre('maxRecherchesParJour', 0, 300) || nombre('reserveProspectsPrets', 5, 200) || nombre('maxEmailsParJour', 1, 40)
    if (err) return err
    if (r.j0ParJour) nouveau.j0ParJour = Object.fromEntries(Object.entries(r.j0ParJour).filter(([j]) => /^[0-6]$/.test(j)).map(([j, n]) => [j, Math.max(0, Math.min(40, Math.round(Number(n) || 0)))]))

    // Calendar: days, time slots, follow-up delays, gap between two e-mails, public holidays
    const jours = (v) => [...new Set((v || []).map(Number).filter((j) => Number.isInteger(j) && j >= 0 && j <= 6))]
    if (r.joursRecherche) nouveau.joursRecherche = jours(r.joursRecherche)
    if (r.joursEnvoi) {
        nouveau.joursEnvoi = jours(r.joursEnvoi)
        if (!nouveau.joursEnvoi.length) return 'Choisis au moins un jour d\'envoi.'
    }
    if (r.fenetres) {
        const hm = /^([01]\d|2[0-3]):[0-5]\d$/
        const f = r.fenetres.map(([a, b]) => [String(a || '').trim(), String(b || '').trim()]).filter(([a, b]) => a || b)
        if (!f.length) return 'Garde au moins un créneau d\'envoi.'
        if (f.some(([a, b]) => !hm.test(a) || !hm.test(b) || a >= b)) return 'Chaque créneau doit avoir une heure de début avant l\'heure de fin (ex. 08:00 - 10:00).'
        nouveau.fenetres = f.sort((x, y) => x[0].localeCompare(y[0]))
    }
    if (r.relances) {
        const r1 = Math.round(Number(r.relances.r1)), r2 = Math.round(Number(r.relances.r2))
        if (!(r1 >= 1 && r1 <= 30) || !(r2 > r1 && r2 <= 60)) return 'Relance 1 : entre 1 et 30 jours ; relance 2 : après la relance 1, 60 jours au plus.'
        nouveau.relances = { r1, r2 }
    }
    if (r.ecartMinutes) {
        const [a, b] = r.ecartMinutes.map((x) => Math.round(Number(x)))
        if (!(a >= 1 && b >= a && b <= 60)) return 'Écart entre deux e-mails : de 1 à 60 minutes, le minimum avant le maximum.'
        nouveau.ecartMinutes = [a, b]
    }
    if (typeof r.sauterFeries === 'boolean') nouveau.sauterFeries = r.sauterFeries
    let actuel = {}
    try { actuel = JSON.parse(fs.readFileSync(fichier, 'utf8')) } catch {}
    fs.mkdirSync(dossierDonnees, { recursive: true })
    fs.writeFileSync(fichier, JSON.stringify({ ...actuel, ...nouveau }, null, 1))
    Object.assign(cfg, nouveau)
    return null
}

// Zone of the week: the active zones take turns, one per ISO week (equal share)
export function zoneDeLaSemaine(d = new Date()) {
    const zones = zonesActives()
    if (!zones.length) return null
    const indice = d.getFullYear() * 53 + semaineIso(d)
    return zones[indice % zones.length].nom
}

chargerReglages()
