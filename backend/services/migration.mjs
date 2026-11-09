// Version 1.2.0 put every name of the code in English, the saved data too. The files written by an older version
// (French keys) are converted once, the first time 1.2.0 reads them; the old file is kept next to it as a backup.
// No import from the other services: base.mjs calls these functions while it starts.
import fs from 'node:fs'
import path from 'node:path'

// Renames the keys of an object (only the keys listed; the others stay as they are)
const renameKeys = (object, names) => Object.fromEntries(Object.entries(object || {}).map(([k, v]) => [names[k] || k, v]))
const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null } }
const writeJson = (file, data, spaces = 1) => fs.writeFileSync(file, JSON.stringify(data, null, spaces))
const backup = (file) => { try { fs.copyFileSync(file, file.replace(/\.json$/, '') + '.v1-backup.json') } catch {} }

// ---------- This PC (%APPDATA%\prospection-auto) ----------
const LOCAL_KEYS = { demarrageAuto: 'autoStart', dossierDrive: 'dataFolder', dossierPrompts: 'promptsFolder', envoi: 'sendingMode', mcp: 'mcpDeclaredAt', mcpChemin: 'mcpPath' }

export function migrateLocalFolder(folder) {
    const local = path.join(folder, 'local.json')
    const settings = readJson(local)
    if (settings && Object.keys(settings).some((k) => LOCAL_KEYS[k])) {
        const next = renameKeys(settings, LOCAL_KEYS)
        if (next.sendingMode === 'boite' || next.sendingMode === 'infomaniak') next.sendingMode = 'mailbox'
        writeJson(local, next)
    }
    const oldUsage = path.join(folder, 'consommation-claude.json'), usage = path.join(folder, 'claude-usage.json')
    if (fs.existsSync(oldUsage) && !fs.existsSync(usage)) {
        const days = readJson(oldUsage) || {}
        writeJson(usage, Object.fromEntries(Object.entries(days).map(([day, d]) => [day, { calls: d.appels ?? d.calls ?? 0, usd: d.usd || 0 }])), 0)
        fs.unlinkSync(oldUsage)
    }
    const google = path.join(folder, 'google.json'), info = readJson(google)
    if (info && Object.keys(info).some((k) => ['lecture', 'connecteLe', 'dossierId', 'rapportsId', 'classeurId'].includes(k)))
        writeJson(google, renameKeys(info, { lecture: 'canRead', connecteLe: 'connectedAt', dossierId: 'folderId', rapportsId: 'reportsFolderId', classeurId: 'spreadsheetId' }))
    const oldLogs = path.join(folder, 'journaux'), logs = path.join(folder, 'logs')
    if (fs.existsSync(oldLogs) && !fs.existsSync(logs)) { try { fs.renameSync(oldLogs, logs) } catch {} }
}

// ---------- Settings shared on the data folder (Données\reglages.json -> Données\settings.json) ----------
const PROFILE_KEYS = {
    prenom: 'firstName', nom: 'lastName', entreprise: 'company', activite: 'activity', offre: 'offer', siteWeb: 'website', ville: 'city',
    telephone: 'phone', titre: 'title', besoin: 'need', signaturePrincipale: 'mainSignature', signatureSecondaire: 'secondSignature', nomSignatureSecondaire: 'secondSignatureName',
}
const SETTINGS_KEYS = {
    secteurs: 'trades', maxRecherchesParJour: 'maxSearchesPerDay', reserveProspectsPrets: 'readyReserve', j0ParJour: 'firstEmailsPerDay', maxEmailsParJour: 'maxEmailsPerDay',
    fenetres: 'sendWindows', relances: 'followUpDays', modeleRecherche: 'searchModel', modeleRedaction: 'writingModel', expediteur: 'sender', profil: 'profile',
    joursEnvoi: 'sendDays', joursRecherche: 'searchDays', ecartMinutes: 'gapMinutes', sauterFeries: 'skipHolidays',
}

export function migrateSettings(oldSettings) {
    const s = renameKeys(oldSettings, SETTINGS_KEYS)
    if (s.zones) s.zones = s.zones.map((z) => renameKeys(z, { nom: 'name', departements: 'departments', codesPostaux: 'postalCodes' }))
    if (s.trades) s.trades = s.trades.map((t) => renameKeys(t, { nom: 'name', actif: 'active' }))
    if (s.followUpDays) s.followUpDays = { first: s.followUpDays.r1 ?? s.followUpDays.first, second: s.followUpDays.r2 ?? s.followUpDays.second }
    if (s.sender) s.sender = renameKeys(s.sender, { nom: 'name', adresse: 'address' })
    for (const server of ['smtp', 'imap']) if (s[server]) s[server] = renameKeys(s[server], { hote: 'host' })
    if (s.profile) s.profile = renameKeys(s.profile, PROFILE_KEYS)
    return s
}

export function migrateDataFolder(dataFolder) {
    const oldFile = path.join(dataFolder, 'reglages.json'), file = path.join(dataFolder, 'settings.json')
    if (fs.existsSync(oldFile) && !fs.existsSync(file)) {
        writeJson(file, migrateSettings(readJson(oldFile) || {}))
        backup(oldFile)
        fs.unlinkSync(oldFile)
    }
}

// ---------- Prospects (Données\prospects.json, version 1 -> 2) ----------
const STEP = { j0: 'first', r1: 'followUp1', r2: 'followUp2' }
const PROSPECT_STATUS = { pret: 'ready', en_sequence: 'inSequence', repondu: 'replied', stop: 'stopped', termine: 'finished', ecarte: 'discarded', autre_canal: 'otherChannel', client: 'client' }
const DRAFT_STATUS = { en_reserve: 'reserved', a_valider: 'toApprove', valide: 'approved', envoye: 'sent', rejete: 'rejected', annule: 'cancelled' }
const LOG_TYPE = { recherche: 'search', rebond: 'bounce', reponse: 'reply', lot: 'batch', envoi: 'send', rgpd: 'gdpr', validation: 'review', suivi: 'tracking', reglages: 'settings' }
const PROSPECT_KEYS = {
    entreprise: 'company', raisonSociale: 'legalName', metier: 'trade', ville: 'city', cp: 'postalCode', adresse: 'address', ajouteLe: 'addedOn',
    etapes: 'steps', brouillons: 'drafts', sourceEmail: 'emailSource', siteWeb: 'website', plateforme: 'platform', utiliseReservation: 'usesBooking',
    telephone: 'phone', noteGoogle: 'googleRating', reseaux: 'socials', niveau: 'level', statut: 'status', raison: 'reason', reponse: 'reply',
    stopLe: 'stoppedOn', suivi: 'tracking', accrocheAppel: 'callHook',
}
const byStep = (steps, convert) => Object.fromEntries(Object.entries(steps || {}).map(([k, v]) => [STEP[k] || k, convert(v)]))

export function migrateProspect(old) {
    const p = renameKeys(old, PROSPECT_KEYS)
    p.status = PROSPECT_STATUS[p.status] || p.status
    p.steps = byStep(p.steps, (s) => renameKeys(s, { envoyeLe: 'sentOn', objet: 'subject' }))
    p.drafts = byStep(p.drafts, (d) => {
        const draft = renameKeys(d, { objet: 'subject', corps: 'body', statut: 'status', lot: 'batch', prepareLe: 'preparedOn', problemes: 'problems', valideLe: 'approvedAt' })
        draft.status = DRAFT_STATUS[draft.status] || draft.status
        return draft
    })
    if (p.reply) p.reply = renameKeys(p.reply, { objet: 'subject', extrait: 'excerpt', lu: 'read' })
    if (p.tracking) p.tracking = renameKeys(p.tracking, { appel: 'call', maquette: 'mockup', proposition: 'proposal', traite: 'handled', resultat: 'result' })
    return p
}

export function migrateState(old) {
    if (!old || old.version >= 2) return old
    const s = renameKeys(old, {
        envois: 'sendsPerDay', recherches: 'searchesPerDay', messagesVus: 'seenMessages', journal: 'log', paires: 'searchedPairs',
        dejaVus: 'forgottenIds', dernierEnvoi: 'lastSentAt', derniereJournee: 'lastDay', prochainEcart: 'nextGapMinutes',
    })
    s.version = 2
    s.prospects = (s.prospects || []).map(migrateProspect)
    s.log = (s.log || []).map((entry) => { const e = renameKeys(entry, { texte: 'text' }); e.type = LOG_TYPE[e.type] || e.type; return e })
    return s
}

export function migrateStateFile(file) {
    const data = readJson(file)
    if (!data || data.version >= 2) return
    backup(file)
    writeJson(file, migrateState(data))
}

// Sending log of the MCP server (Données\envois-mcp.jsonl -> mcp-sends.jsonl): kept as it is, only renamed
export function migrateMcpLog(dataFolder) {
    const oldFile = path.join(dataFolder, 'envois-mcp.jsonl'), file = path.join(dataFolder, 'mcp-sends.jsonl')
    if (fs.existsSync(oldFile) && !fs.existsSync(file)) { try { fs.renameSync(oldFile, file) } catch {} }
}
