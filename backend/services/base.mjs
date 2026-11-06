// Shared helpers: config, state file on Drive, dates, log
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// project folder (backend/services/ -> two levels up)
export const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const cfg = JSON.parse(fs.readFileSync(path.join(racine, 'config.json'), 'utf8'))

// Local folder for secrets and logs (never on Drive)
export const dossierLocal = path.join(process.env.APPDATA || os.homedir(), 'prospection-auto')
fs.mkdirSync(path.join(dossierLocal, 'journaux'), { recursive: true })

// Settings of this PC only (folder of the data chosen in the app), in %APPDATA%\prospection-auto\local.json
export const fichierLocal = path.join(dossierLocal, 'local.json')
export function reglagesLocaux() { try { return JSON.parse(fs.readFileSync(fichierLocal, 'utf8')) } catch { return {} } }
export function majReglagesLocaux(maj) { const r = { ...reglagesLocaux(), ...maj }; fs.writeFileSync(fichierLocal, JSON.stringify(r, null, 1)); return r }
const local = reglagesLocaux()
if (local.dossierDrive) cfg.dossierDrive = local.dossierDrive
if (local.dossierPrompts) cfg.dossierPrompts = local.dossierPrompts
if (local.signature) cfg.signature = local.signature
// No Google Drive for desktop on this PC: the data stay on the PC (Google Sheets and Docs still work once Google is connected)
// Default data folder (first start, or chosen folder no longer reachable): Documents\DC Prospect
if (!cfg.dossierDrive || !fs.existsSync(path.dirname(cfg.dossierDrive))) cfg.dossierDrive = path.join(os.homedir(), 'Documents', 'DC Prospect')
// Test mode: another folder and port, so tests never touch the real data
if (process.env.PROSPECTION_DRIVE) cfg.dossierDrive = process.env.PROSPECTION_DRIVE
if (process.env.PROSPECTION_PORT) cfg.port = Number(process.env.PROSPECTION_PORT)
fs.mkdirSync(cfg.dossierDrive, { recursive: true })

export const dossierDonnees = path.join(cfg.dossierDrive, 'Données')
export const fichierEtat = path.join(dossierDonnees, 'prospects.json')

const etatVide = () => ({ version: 1, prospects: [], stop: [], envois: {}, recherches: {}, messagesVus: [], journal: [] })

export function chargerEtat() {
    try {
        return { ...etatVide(), ...JSON.parse(fs.readFileSync(fichierEtat, 'utf8')) }
    } catch (e) {
        if (e.code === 'ENOENT') return etatVide()
        throw e
    }
}

export function sauverEtat(etat) {
    fs.mkdirSync(dossierDonnees, { recursive: true })
    etat.messagesVus = etat.messagesVus.slice(-2000)
    etat.journal = etat.journal.slice(-3000)
    const tmp = fichierEtat + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(etat, null, 1))
    fs.renameSync(tmp, fichierEtat)
}

export function noter(etat, type, texte, extra = {}) {
    etat.journal.push({ date: new Date().toISOString(), type, texte, ...extra })
    log(`${type} : ${texte}`)
}

export function log(...args) {
    const ligne = `[${new Date().toLocaleString('fr-FR')}] ${args.join(' ')}`
    console.error(ligne)
    fs.appendFileSync(path.join(dossierLocal, 'journaux', jour() + '.log'), ligne + '\n')
}

// ---------- Dates (local time) ----------
const z = (n) => String(n).padStart(2, '0')
export const jour = (d = new Date()) => `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
export const dateDe = (s) => new Date(s + 'T12:00:00')
export const ajouterJours = (s, n) => { const d = dateDe(s); d.setDate(d.getDate() + n); return jour(d) }
export const ecartJours = (a, b) => Math.round((dateDe(b) - dateDe(a)) / 864e5)
export const dateFr = (s) => s ? s.split('-').reverse().join('/') : ''

export function semaineIso(d = new Date()) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    const n = t.getUTCDay() || 7
    t.setUTCDate(t.getUTCDate() + 4 - n)
    const an = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
    return Math.ceil(((t - an) / 864e5 + 1) / 7)
}


export function joursFeries(annee) {
    const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
    const mois = Math.floor((h + l - 7 * m + 114) / 31), j = ((h + l - 7 * m + 114) % 31) + 1
    const paques = `${annee}-${z(mois)}-${z(j)}`
    return new Set([
        `${annee}-01-01`, `${annee}-05-01`, `${annee}-05-08`, `${annee}-07-14`, `${annee}-08-15`,
        `${annee}-11-01`, `${annee}-11-11`, `${annee}-12-25`,
        ajouterJours(paques, 1), ajouterJours(paques, 39), ajouterJours(paques, 50),
    ])
}

export const estOuvre = (s) => { const n = dateDe(s).getDay(); return n >= 1 && n <= 5 && !joursFeries(+s.slice(0, 4)).has(s) }
export const estJourEnvoi = (s) => estOuvre(s) && cfg.joursEnvoi.includes(dateDe(s).getDay())

export function prochainJourEnvoi(depuis = jour()) {
    let s = depuis
    for (let i = 0; i < 30; i++) { if (estJourEnvoi(s)) return s; s = ajouterJours(s, 1) }
    return s
}

const minutes = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
export function dansFenetre(d = new Date()) {
    const t = d.getHours() * 60 + d.getMinutes()
    return estJourEnvoi(jour(d)) && cfg.fenetres.some(([a, b]) => t >= minutes(a) && t < minutes(b))
}

export const nomJour = (s) => dateDe(s).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

// Environment for Windows PowerShell 5.1: without the module path of PowerShell 7 (inherited when the app is started
// from pwsh), otherwise ConvertTo-SecureString fails to load ("Coffre : écriture impossible")
export const envPowerShell = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => k.toUpperCase() !== 'PSMODULEPATH'))
