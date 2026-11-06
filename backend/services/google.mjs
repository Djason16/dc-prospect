// Google account of the user (button "Se connecter à Google" in the app): Gmail (send as contact@, read replies),
// Google Sheets (real tracking table), Google Drive (folder "DC Prospect" with the daily reports as Google Docs).
// OAuth for a desktop app: the browser opens Google's own page, the answer comes back to 127.0.0.1 (PKCE). No password goes through the app.
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { simpleParser } from 'mailparser'
import { dossierLocal, log } from './base.mjs'
import { ranger, lireCoffre, oublierCoffre, dansCoffre } from './coffre.mjs'

const fichierInfos = path.join(dossierLocal, 'google.json') // not secret: e-mail, options, ids of the files created
const SCOPES_BASE = ['openid', 'email', 'https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/gmail.send']
const SCOPE_LECTURE = 'https://www.googleapis.com/auth/gmail.readonly'

export function infosGoogle() {
    try { return JSON.parse(fs.readFileSync(fichierInfos, 'utf8')) } catch { return {} }
}
function majInfos(maj) {
    const i = { ...infosGoogle(), ...maj }
    fs.writeFileSync(fichierInfos, JSON.stringify(i, null, 1))
    return i
}
export const optionsGoogle = () => ({ sheets: true, docs: true, ...(infosGoogle().options || {}) })
export const reglerGoogle = (options) => majInfos({ options: { ...optionsGoogle(), ...options } })

// ---------- Client file (created once in Google Cloud, see the documentation) ----------
export function importerClient(texte) {
    const j = JSON.parse(texte)
    const c = j.installed || j.web
    if (!c?.client_id || !c?.client_secret) throw new Error('Ce fichier n\'est pas un identifiant OAuth Google (type « Application de bureau »)')
    if (!j.installed) throw new Error('Choisis un identifiant de type « Application de bureau », pas « Application Web »')
    ranger('google-client', JSON.stringify({ client_id: c.client_id, client_secret: c.client_secret }))
}
const client = () => { const c = lireCoffre('google-client'); return c ? JSON.parse(c) : null }

export function statutGoogle() {
    const i = infosGoogle()
    return { client: dansCoffre('google-client'), connecte: dansCoffre('google'), email: i.email || null, lecture: !!i.lecture, options: optionsGoogle(), dossier: i.dossierId ? `https://drive.google.com/drive/folders/${i.dossierId}` : null, classeur: i.classeurId ? `https://docs.google.com/spreadsheets/d/${i.classeurId}/edit` : null }
}
export const googleActif = () => dansCoffre('google') && dansCoffre('google-client')

// ---------- Login ----------
const b64url = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export async function connecterGoogle(ouvrirExterne, { lecture = true } = {}) {
    const c = client()
    if (!c) throw new Error('Importe d\'abord le fichier client Google (Réglages, Google)')
    const verificateur = b64url(crypto.randomBytes(48))
    const defi = b64url(crypto.createHash('sha256').update(verificateur).digest())
    const etatOauth = b64url(crypto.randomBytes(16))
    const scopes = [...SCOPES_BASE, ...(lecture ? [SCOPE_LECTURE] : [])]
    const { code, redirection } = await new Promise((resolve, reject) => {
        const serveur = http.createServer((req, res) => {
            const u = new URL(req.url, 'http://127.0.0.1')
            if (u.pathname !== '/') { res.writeHead(404); return res.end() }
            const ok = u.searchParams.get('state') === etatOauth && u.searchParams.get('code')
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(`<!doctype html><meta charset="utf-8"><title>DC Prospect</title><body style="margin:0;height:100vh;display:grid;place-items:center;background:#111417;color:#eef1f3;font:18px Arial"><div style="text-align:center"><p style="color:#7ee6a8;letter-spacing:4px;font-size:12px;text-transform:uppercase">DC Prospect</p><h1 style="font-size:28px;letter-spacing:1px;text-transform:uppercase">${ok ? 'Google est connecté' : 'Connexion annulée'}</h1><p style="color:#a4b0b8">Tu peux fermer cet onglet et revenir à l'application.</p></div>`)
            clearTimeout(minuteur)
            serveur.close()
            if (ok) resolve({ code: u.searchParams.get('code'), redirection: `http://127.0.0.1:${serveur.address()?.port || port}` })
            else reject(new Error(u.searchParams.get('error') === 'access_denied' ? 'Connexion refusée sur la page Google' : 'Connexion Google annulée'))
        })
        let port
        const minuteur = setTimeout(() => { serveur.close(); reject(new Error('Connexion Google : délai dépassé (5 minutes)')) }, 5 * 60e3)
        serveur.listen(0, '127.0.0.1', () => {
            port = serveur.address().port
            const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
                client_id: c.client_id, redirect_uri: `http://127.0.0.1:${port}`, response_type: 'code', scope: scopes.join(' '),
                code_challenge: defi, code_challenge_method: 'S256', access_type: 'offline', prompt: 'consent', state: etatOauth,
            })
            ouvrirExterne(url)
        })
    })
    const rep = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: c.client_id, client_secret: c.client_secret, redirect_uri: redirection, grant_type: 'authorization_code', code_verifier: verificateur }),
    })
    const j = await rep.json()
    if (!j.refresh_token) throw new Error('Google n\'a pas donné d\'accès durable : ' + (j.error_description || j.error || 'réponse inattendue'))
    ranger('google', j.refresh_token)
    cache = { jeton: j.access_token, expire: Date.now() + (j.expires_in - 60) * 1000 }
    const moi = await (await gfetch('https://openidconnect.googleapis.com/v1/userinfo')).json()
    const accordes = (j.scope || '').split(' ')
    majInfos({ email: moi.email, lecture: accordes.includes(SCOPE_LECTURE), connecteLe: new Date().toISOString() })
    log('Google connecté :', moi.email)
    return statutGoogle()
}

export function deconnecterGoogle() {
    const r = lireCoffre('google')
    if (r) fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(r), { method: 'POST' }).catch(() => {})
    oublierCoffre('google')
    cache = null
    const i = infosGoogle()
    majInfos({ email: null, lecture: false, options: optionsGoogle(), dossierId: i.dossierId, classeurId: i.classeurId })
}

// ---------- Access token ----------
let cache = null
async function jeton() {
    if (cache && Date.now() < cache.expire) return cache.jeton
    const c = client(), r = lireCoffre('google')
    if (!c || !r) throw new Error('Google n\'est pas connecté (Réglages, Comptes)')
    const rep = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: c.client_id, client_secret: c.client_secret, refresh_token: r, grant_type: 'refresh_token' }),
    })
    const j = await rep.json()
    if (j.error === 'invalid_grant') { oublierCoffre('google'); throw new Error('Connexion Google expirée : reconnecte-toi (Réglages, Comptes)') }
    if (!j.access_token) throw new Error('Google : ' + (j.error_description || j.error))
    cache = { jeton: j.access_token, expire: Date.now() + (j.expires_in - 60) * 1000 }
    return cache.jeton
}

async function gfetch(url, options = {}) {
    const rep = await fetch(url, { ...options, headers: { Authorization: `Bearer ${await jeton()}`, ...(options.headers || {}) } })
    if (!rep.ok) {
        const t = await rep.text()
        throw new Error(`Google ${rep.status} : ${t.slice(0, 200)}`)
    }
    return rep
}
const gjson = async (url, corps, methode = 'POST') => (await gfetch(url, { method: methode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })).json()

// ---------- Gmail ----------
export async function envoyerGmail(brut, threadId) {
    const r = await gjson('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { raw: b64url(Buffer.from(brut)), ...(threadId ? { threadId } : {}) })
    return { id: r.id, threadId: r.threadId }
}

// Same shape as the mailbox reader: [{ id, de, objet, date, enReponseA, rebond, texte }]
export async function lireGmail(jours = 30, garder = () => true) {
    const sortie = []
    let page = ''
    const ids = []
    do {
        const l = await (await gfetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=200&q=${encodeURIComponent(`in:inbox newer_than:${jours}d`)}${page ? '&pageToken=' + page : ''}`)).json()
        ids.push(...(l.messages || []).map((m) => m.id))
        page = l.nextPageToken
    } while (page && ids.length < 600)
    for (const id of ids) {
        const m = await (await gfetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Message-ID&metadataHeaders=In-Reply-To&metadataHeaders=Date`)).json()
        const h = Object.fromEntries((m.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]))
        const de = ((h.from || '').match(/<([^>]+)>/)?.[1] || h.from || '').toLowerCase().trim()
        const e = {
            id: h['message-id'] || `gmail-${id}`, de, objet: h.subject || '', date: new Date(Number(m.internalDate)).toISOString(), enReponseA: h['in-reply-to'] || '',
            rebond: /mailer-daemon|postmaster/i.test(de) || /undeliver|non remis|delivery status|échec de la remise/i.test(h.subject || ''),
        }
        if (!garder(e)) continue
        const brut = await (await gfetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=raw`)).json()
        let t = ''
        try { const mail = await simpleParser(Buffer.from(brut.raw, 'base64url')); t = mail.text || (mail.html || '').replace(/<[^>]+>/g, ' ') } catch {}
        sortie.push({ ...e, texte: t.slice(0, 6000) })
    }
    return sortie
}

export async function adressesEnvoi() {
    if (!infosGoogle().lecture) return null
    const r = await (await gfetch('https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs')).json()
    return (r.sendAs || []).map((s) => ({ adresse: s.sendAsEmail.toLowerCase(), verifiee: s.verificationStatus === 'accepted' || s.isPrimary }))
}

// ---------- Drive: app folder, reports as Google Docs ----------
async function dossier(nom, parent) {
    const i = infosGoogle()
    const cle = parent ? 'rapportsId' : 'dossierId'
    if (i[cle]) {
        try {
            const f = await (await gfetch(`https://www.googleapis.com/drive/v3/files/${i[cle]}?fields=id,trashed`)).json()
            if (!f.trashed) return f.id
        } catch {}
    }
    const f = await gjson('https://www.googleapis.com/drive/v3/files?fields=id', { name: nom, mimeType: 'application/vnd.google-apps.folder', ...(parent ? { parents: [parent] } : {}) })
    majInfos({ [cle]: f.id })
    return f.id
}
export const dossierApp = () => dossier('DC Prospect')
const dossierRapports = async () => dossier('Rapports', await dossierApp())

// Upload or replace a Markdown report, converted to a Google Doc
export async function publierRapport(nom, markdown) {
    const parent = await dossierRapports()
    const q = encodeURIComponent(`name = '${nom.replace(/'/g, "\\'")}' and '${parent}' in parents and trashed = false`)
    const existant = (await (await gfetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`)).json()).files?.[0]
    const limite = 'prospection' + crypto.randomBytes(8).toString('hex')
    const meta = existant ? {} : { name: nom, mimeType: 'application/vnd.google-apps.document', parents: [parent] }
    const corps = `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${limite}\r\nContent-Type: text/markdown; charset=UTF-8\r\n\r\n${markdown}\r\n--${limite}--`
    const url = existant
        ? `https://www.googleapis.com/upload/drive/v3/files/${existant.id}?uploadType=multipart&fields=id`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id'
    await gfetch(url, { method: existant ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${limite}` }, body: corps })
}

// ---------- Sheets: the tracking table ----------
async function classeur() {
    const i = infosGoogle()
    if (i.classeurId) {
        try {
            const f = await (await gfetch(`https://www.googleapis.com/drive/v3/files/${i.classeurId}?fields=id,trashed`)).json()
            if (!f.trashed) return f.id
        } catch {}
    }
    const parent = await dossierApp()
    const f = await gjson('https://www.googleapis.com/drive/v3/files?fields=id', { name: 'Suivi prospection', mimeType: 'application/vnd.google-apps.spreadsheet', parents: [parent] })
    majInfos({ classeurId: f.id })
    return f.id
}

const rgb = (h) => ({ red: parseInt(h.slice(1, 3), 16) / 255, green: parseInt(h.slice(3, 5), 16) / 255, blue: parseInt(h.slice(5, 7), 16) / 255 })

// onglets: [{ titre, colonnes: [[nom, largeur]], lignes: [[...]] }] ; everything is rewritten (the app holds the data)
export async function ecrireClasseur(onglets) {
    const id = await classeur()
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${id}`
    let info = await (await gfetch(`${base}?fields=sheets.properties`)).json()
    const existants = new Map(info.sheets.map((s) => [s.properties.title, s.properties.sheetId]))
    const ajouts = onglets.filter((o) => !existants.has(o.titre)).map((o) => ({ addSheet: { properties: { title: o.titre, gridProperties: { frozenRowCount: 1 } } } }))
    const premier = info.sheets[0]?.properties
    if (ajouts.length) {
        await gjson(`${base}:batchUpdate`, { requests: ajouts })
        info = await (await gfetch(`${base}?fields=sheets.properties`)).json()
        // the blank first tab of a new file goes away
        if (premier && !onglets.some((o) => o.titre === premier.title)) await gjson(`${base}:batchUpdate`, { requests: [{ deleteSheet: { sheetId: premier.sheetId } }] }).catch(() => {})
    }
    const ids = new Map(info.sheets.map((s) => [s.properties.title, s.properties.sheetId]))
    await gjson(`${base}/values:batchClear`, { ranges: onglets.map((o) => `'${o.titre}'`) })
    await gjson(`${base}/values:batchUpdate`, {
        valueInputOption: 'RAW',
        data: onglets.map((o) => ({ range: `'${o.titre}'!A1`, values: [o.colonnes.map(([n]) => n.toUpperCase()), ...o.lignes.map((l) => l.map((v) => v ?? ''))] })),
    })
    const requests = []
    for (const o of onglets) {
        const sheetId = ids.get(o.titre)
        requests.push(
            { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
            { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: rgb('#111417'), textFormat: { foregroundColor: rgb('#7ee6a8'), bold: true, fontFamily: 'Arial', fontSize: 10 }, verticalAlignment: 'MIDDLE', wrapStrategy: 'WRAP' } }, fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)' } },
            { repeatCell: { range: { sheetId, startRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { fontFamily: 'Arial', fontSize: 10 }, verticalAlignment: 'TOP', wrapStrategy: 'WRAP' } }, fields: 'userEnteredFormat(textFormat,verticalAlignment,wrapStrategy)' } },
            ...o.colonnes.map(([, largeur], i) => ({ updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: Math.round(largeur * 7.5) }, fields: 'pixelSize' } })),
            { setBasicFilter: { filter: { range: { sheetId, startRowIndex: 0, endRowIndex: o.lignes.length + 1, startColumnIndex: 0, endColumnIndex: o.colonnes.length } } } },
        )
    }
    await gjson(`${base}:batchUpdate`, { requests })
    return `https://docs.google.com/spreadsheets/d/${id}/edit`
}
