// Settings changed in the app (zones, trades, volumes), saved on the Drive so every PC uses the same ones.
// They override config.json, which only holds the defaults.
import fs from 'node:fs'
import path from 'node:path'
import { cfg, dataFolder, isoWeek } from './base.mjs'

const file = path.join(dataFolder, 'settings.json')
const EDITABLE = ['zones', 'trades', 'maxSearchesPerDay', 'readyReserve', 'firstEmailsPerDay', 'maxEmailsPerDay', 'sendWindows', 'followUpDays', 'searchModel', 'writingModel', 'sender', 'smtp', 'imap', 'profile', 'sendDays', 'searchDays', 'gapMinutes', 'skipHolidays', 'ai', 'searchEngine', 'writingEngine', 'warmup', 'localModel', 'pauseUntil', 'dailyDigest', 'autoApproveFollowUps']

// Profile of the user (whoever uses the app): who writes the e-mails, what is sold, the signatures
export const PROFILE_FIELDS = ['firstName', 'lastName', 'company', 'activity', 'offer', 'website', 'city', 'phone', 'title', 'need', 'bookingUrl', 'mainSignature', 'secondSignature', 'secondSignatureName']
export const profile = () => cfg.profile || {}
// First name and last name are separate fields; the full name is used in the e-mails and the signature
export const fullName = (p = profile()) => [p.firstName, p.lastName].filter(Boolean).join(' ')
export const isProfileComplete = () => { const p = profile(); return !!(fullName(p) && p.activity && p.city && cfg.sender?.address) }
// Signs of a need that the search looks for (the user can write his own for another trade than websites). Read by Claude: in French
export const defaultNeed = 'pas de site, site daté ou lent, pas adapté au téléphone, site sur Wix, Google Sites ou Canva, réservation seulement via une plateforme (Planity, Fresha...), peu de contenu'

// Old config.json format { "Oise": ["60"] } -> [{ name, departments, postalCodes, active }]
const toList = (z) => Array.isArray(z) ? z : Object.entries(z).map(([name, departments]) => ({ name: name === 'IDF' ? 'Île-de-France' : name, departments, postalCodes: [], active: true }))

export function loadSettings() {
    cfg.zones = toList(cfg.zones)
    cfg.trades = cfg.trades.map((t) => ({ active: true, ...t }))
    try {
        const saved = JSON.parse(fs.readFileSync(file, 'utf8'))
        for (const k of EDITABLE) if (saved[k] !== undefined) cfg[k] = saved[k]
        cfg.zones = toList(cfg.zones)
    } catch {}
    return cfg
}

export const activeZones = () => cfg.zones.filter((z) => z.active !== false && (z.departments?.length || z.postalCodes?.length))
export const activeTrades = () => cfg.trades.filter((t) => t.active !== false)
export const zoneByName = (name) => cfg.zones.find((z) => z.name === name)

const cleanList = (v, re) => [...new Set(String(Array.isArray(v) ? v.join(',') : v || '').split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter((x) => re.test(x)))]
const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/

// Validates what comes from the app before saving; returns the error message (shown to the user) or null
export function saveSettings(r) {
    const changes = {}
    if (r.zones) {
        const zones = r.zones.map((z) => ({
            name: String(z.name || '').trim().slice(0, 60),
            departments: cleanList(z.departments, /^(\d{2}|2A|2B|97\d)$/),
            postalCodes: cleanList(z.postalCodes, /^\d{5}$/),
            active: z.active !== false,
        })).filter((z) => z.name)
        if (new Set(zones.map((z) => z.name)).size !== zones.length) return 'Deux zones ont le même nom.'
        if (zones.some((z) => !z.departments.length && !z.postalCodes.length)) return 'Chaque zone a besoin d\'au moins un département ou un code postal.'
        if (!zones.some((z) => z.active)) return 'Garde au moins une zone active.'
        changes.zones = zones
    }
    if (r.trades) {
        const trades = r.trades.map((t) => ({ name: String(t.name || '').trim().slice(0, 60), naf: cleanList(t.naf, /^\d{2}\.\d{2}[A-Z]$/), active: t.active !== false })).filter((t) => t.name && t.naf.length)
        if (!trades.some((t) => t.active)) return 'Garde au moins un métier actif.'
        changes.trades = trades
    }
    if (r.profile) {
        const p = { ...profile() }
        for (const k of PROFILE_FIELDS) if (typeof r.profile[k] === 'string') p[k] = r.profile[k].trim().slice(0, /Signature$/.test(k) ? 60000 : 2000)
        if (p.website && !/^https?:\/\//.test(p.website)) p.website = 'https://' + p.website
        if (p.bookingUrl && !/^https?:\/\//.test(p.bookingUrl)) p.bookingUrl = 'https://' + p.bookingUrl
        changes.profile = p
        if (typeof r.profile.address === 'string') {
            const address = r.profile.address.trim().toLowerCase()
            if (address && !EMAIL.test(address)) return 'Adresse d\'envoi invalide.'
            changes.sender = { name: fullName(p) || cfg.sender.name, address }
        }
    }
    // Sender and mail servers: any host
    if (r.mailbox) {
        const m = r.mailbox, host = (h) => String(h || '').trim().toLowerCase()
        const address = String(m.address || '').trim().toLowerCase()
        if (!EMAIL.test(address)) return 'Adresse d\'envoi invalide.'
        if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host(m.smtpHost)) || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host(m.imapHost))) return 'Serveur d\'envoi ou de réception invalide.'
        changes.sender = { name: String(m.name || cfg.sender.name).trim().slice(0, 80), address }
        changes.smtp = { host: host(m.smtpHost), port: Number(m.smtpPort) || 465 }
        changes.imap = { host: host(m.imapHost), port: Number(m.imapPort) || 993 }
    }
    const number = (k, min, max) => {
        if (r[k] === undefined) return null
        const n = Math.round(Number(r[k]))
        if (!(n >= min && n <= max)) return `${k} doit être entre ${min} et ${max}.`
        changes[k] = n
        return null
    }
    const err = number('maxSearchesPerDay', 0, 300) || number('readyReserve', 5, 200) || number('maxEmailsPerDay', 1, 40)
    if (err) return err
    if (r.firstEmailsPerDay) changes.firstEmailsPerDay = Object.fromEntries(Object.entries(r.firstEmailsPerDay).filter(([d]) => /^[0-6]$/.test(d)).map(([d, n]) => [d, Math.max(0, Math.min(40, Math.round(Number(n) || 0)))]))

    // Calendar: days, time slots, follow-up delays, gap between two e-mails, public holidays
    const days = (v) => [...new Set((v || []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))]
    if (r.searchDays) changes.searchDays = days(r.searchDays)
    if (r.sendDays) {
        changes.sendDays = days(r.sendDays)
        if (!changes.sendDays.length) return 'Choisis au moins un jour d\'envoi.'
    }
    if (r.sendWindows) {
        const hm = /^([01]\d|2[0-3]):[0-5]\d$/
        const windows = r.sendWindows.map(([a, b]) => [String(a || '').trim(), String(b || '').trim()]).filter(([a, b]) => a || b)
        if (!windows.length) return 'Garde au moins un créneau d\'envoi.'
        if (windows.some(([a, b]) => !hm.test(a) || !hm.test(b) || a >= b)) return 'Chaque créneau doit avoir une heure de début avant l\'heure de fin (ex. 08:00 - 10:00).'
        changes.sendWindows = windows.sort((x, y) => x[0].localeCompare(y[0]))
    }
    if (r.followUpDays) {
        const first = Math.round(Number(r.followUpDays.first)), second = Math.round(Number(r.followUpDays.second))
        if (!(first >= 1 && first <= 30) || !(second > first && second <= 60)) return 'Relance 1 : entre 1 et 30 jours ; relance 2 : après la relance 1, 60 jours au plus.'
        changes.followUpDays = { first, second }
    }
    if (r.gapMinutes) {
        const [a, b] = r.gapMinutes.map((x) => Math.round(Number(x)))
        if (!(a >= 1 && b >= a && b <= 60)) return 'Écart entre deux e-mails : de 1 à 60 minutes, le minimum avant le maximum.'
        changes.gapMinutes = [a, b]
    }
    if (typeof r.skipHolidays === 'boolean') changes.skipHolidays = r.skipHolidays

    // Engines (Settings, Moteur): the AI provider and its models, search and writing with or without AI
    if (r.ai) {
        const providers = ['claude-code', 'anthropic', 'openai', 'local', 'gemini']
        if (!providers.includes(r.ai.provider)) return 'Moteur inconnu.'
        const text = (v, max = 200) => String(v || '').trim().slice(0, max)
        const baseUrl = text(r.ai.baseUrl)
        if (baseUrl && !/^https?:\/\/[^\s]+$/.test(baseUrl)) return "Adresse de l'API invalide (https://...)."
        changes.ai = { provider: r.ai.provider, baseUrl, searchModel: text(r.ai.searchModel, 80), writingModel: text(r.ai.writingModel, 80) }
    }
    if (r.searchEngine) changes.searchEngine = r.searchEngine === 'free' ? 'free' : 'ai'
    if (r.writingEngine) changes.writingEngine = r.writingEngine === 'templates' ? 'templates' : 'ai'
    if (r.dailyDigest !== undefined) changes.dailyDigest = !!r.dailyDigest
    if (r.autoApproveFollowUps !== undefined) changes.autoApproveFollowUps = !!r.autoApproveFollowUps
    if (r.pauseUntil !== undefined) { if (r.pauseUntil && !/^\d{4}-\d{2}-\d{2}$/.test(r.pauseUntil)) return 'Date de reprise invalide.'; changes.pauseUntil = r.pauseUntil || null }
    if (r.localModel) { if (!['qwen3-4b', 'ministral-8b'].includes(r.localModel)) return 'Modèle inconnu.'; changes.localModel = r.localModel }
    if (r.warmup) {
        const was = cfg.warmup || {}
        // the warm-up starts the day it is switched on
        changes.warmup = { enabled: !!r.warmup.enabled, startedOn: r.warmup.enabled ? (was.enabled && was.startedOn ? was.startedOn : new Date().toISOString().slice(0, 10)) : null }
    }
    let current = {}
    try { current = JSON.parse(fs.readFileSync(file, 'utf8')) } catch {}
    fs.mkdirSync(dataFolder, { recursive: true })
    fs.writeFileSync(file, JSON.stringify({ ...current, ...changes }, null, 1))
    Object.assign(cfg, changes)
    return null
}

// Zone of the week: the active zones take turns, one per ISO week (equal share)
export function zoneOfTheWeek(d = new Date()) {
    const zones = activeZones()
    if (!zones.length) return null
    const index = d.getFullYear() * 53 + isoWeek(d)
    return zones[index % zones.length].name
}

loadSettings()
