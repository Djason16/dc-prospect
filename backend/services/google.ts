// Google account of the user (button "Se connecter à Google" in the app): Gmail (send as contact@, read replies),
// Google Sheets (real tracking table), Google Drive (folder "DC Prospect" with the daily reports as Google Docs).
// OAuth for a desktop app: the browser opens Google's own page, the answer comes back to 127.0.0.1 (PKCE). No password goes through the app.
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { simpleParser } from 'mailparser'
import { localFolder, log } from './base.js'
import { storeSecret, readSecret, forgetSecret, hasSecret } from './vault.js'
import type { MailHeader, ReceivedMail } from './mail.js'

// google.json (this PC): the account, the options and the ids of the files created
export interface GoogleOptions { sheets: boolean, docs: boolean }
export interface GoogleInfo {
    email?: string | null
    canRead?: boolean
    connectedAt?: string
    options?: Partial<GoogleOptions>
    folderId?: string
    reportsFolderId?: string
    spreadsheetId?: string
}
export interface GoogleStatus {
    client: boolean
    connected: boolean
    email: string | null
    canRead: boolean
    options: GoogleOptions
    folder: string | null
    spreadsheet: string | null
}
// A tab of the tracking table: [column name, width in characters] and the rows
export interface SheetTab { title: string, columns: [string, number][], rows: (string | number | null | undefined)[][] }

interface OAuthClient { client_id: string, client_secret: string }
// Answers of the Google APIs (outside data): only the fields read here
interface TokenAnswer { access_token?: string, refresh_token?: string, expires_in: number, scope?: string, error?: string, error_description?: string }
interface GmailList { messages?: { id: string }[], nextPageToken?: string }
interface DriveFile { id: string, trashed?: boolean }
interface SheetProperties { title: string, sheetId: number }
interface SpreadsheetInfo { sheets: { properties: SheetProperties }[] }

const infoFile = path.join(localFolder, 'google.json') // not secret: e-mail, options, ids of the files created
const BASE_SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/gmail.send']
const READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'

export function googleInfo(): GoogleInfo {
    try { return JSON.parse(fs.readFileSync(infoFile, 'utf8')) as GoogleInfo } catch { return {} }
}
function updateInfo(changes: GoogleInfo): GoogleInfo {
    const info = { ...googleInfo(), ...changes }
    fs.writeFileSync(infoFile, JSON.stringify(info, null, 1))
    return info
}
export const googleOptions = (): GoogleOptions => ({ sheets: true, docs: true, ...(googleInfo().options || {}) })
export const setGoogleOptions = (options: Partial<GoogleOptions>): GoogleInfo => updateInfo({ options: { ...googleOptions(), ...options } })

// ---------- Client file (created once in Google Cloud, see the documentation) ----------
export function importClientFile(text: string): void {
    // file downloaded from Google Cloud (outside data)
    const j = JSON.parse(text) as { installed?: Partial<OAuthClient>, web?: Partial<OAuthClient> }
    const c = j.installed || j.web
    if (!c?.client_id || !c?.client_secret) throw new Error('Ce fichier n\'est pas un identifiant OAuth Google (type « Application de bureau »)')
    if (!j.installed) throw new Error('Choisis un identifiant de type « Application de bureau », pas « Application Web »')
    storeSecret('google-client', JSON.stringify({ client_id: c.client_id, client_secret: c.client_secret }))
}
const clientFile = (): OAuthClient | null => { const c = readSecret('google-client'); return c ? JSON.parse(c) as OAuthClient : null }

export function googleStatus(): GoogleStatus {
    const i = googleInfo()
    return { client: hasSecret('google-client'), connected: hasSecret('google'), email: i.email || null, canRead: !!i.canRead, options: googleOptions(), folder: i.folderId ? `https://drive.google.com/drive/folders/${i.folderId}` : null, spreadsheet: i.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${i.spreadsheetId}/edit` : null }
}
export const googleActive = () => hasSecret('google') && hasSecret('google-client')

// ---------- Login ----------
const b64url = (b: Buffer): string => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export async function connectGoogle(openExternal: (url: string) => unknown, { canRead = true } = {}): Promise<GoogleStatus> {
    const c = clientFile()
    if (!c) throw new Error('Importe d\'abord le fichier client Google (Réglages, Google)')
    const verifier = b64url(crypto.randomBytes(48))
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest())
    const oauthState = b64url(crypto.randomBytes(16))
    const scopes = [...BASE_SCOPES, ...(canRead ? [READ_SCOPE] : [])]
    const { code, redirectUri } = await new Promise<{ code: string, redirectUri: string }>((resolve, reject) => {
        // port given by Windows: the address of the local server once it listens
        const portOf = (): number => { const a = server.address(); return a && typeof a === 'object' ? a.port : 0 }
        const server = http.createServer((req, res) => {
            const u = new URL(req.url || '/', 'http://127.0.0.1')
            if (u.pathname !== '/') { res.writeHead(404); return res.end() }
            const ok = u.searchParams.get('state') === oauthState && u.searchParams.get('code')
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
            res.end(`<!doctype html><meta charset="utf-8"><title>DC Prospect</title><body style="margin:0;height:100vh;display:grid;place-items:center;background:#111417;color:#eef1f3;font:18px Arial"><div style="text-align:center"><p style="color:#7ee6a8;letter-spacing:4px;font-size:12px;text-transform:uppercase">DC Prospect</p><h1 style="font-size:28px;letter-spacing:1px;text-transform:uppercase">${ok ? 'Google est connecté' : 'Connexion annulée'}</h1><p style="color:#a4b0b8">Tu peux fermer cet onglet et revenir à l'application.</p></div>`)
            clearTimeout(timer)
            server.close()
            if (ok) resolve({ code: ok, redirectUri: `http://127.0.0.1:${portOf() || port}` })
            else reject(new Error(u.searchParams.get('error') === 'access_denied' ? 'Connexion refusée sur la page Google' : 'Connexion Google annulée'))
        })
        let port = 0
        const timer = setTimeout(() => { server.close(); reject(new Error('Connexion Google : délai dépassé (5 minutes)')) }, 5 * 60e3)
        server.listen(0, '127.0.0.1', () => {
            port = portOf()
            const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
                client_id: c.client_id, redirect_uri: `http://127.0.0.1:${port}`, response_type: 'code', scope: scopes.join(' '),
                code_challenge: challenge, code_challenge_method: 'S256', access_type: 'offline', prompt: 'consent', state: oauthState,
            })
            openExternal(url)
        })
    })
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: c.client_id, client_secret: c.client_secret, redirect_uri: redirectUri, grant_type: 'authorization_code', code_verifier: verifier }),
    })
    const j = (await res.json()) as TokenAnswer
    if (!j.refresh_token) throw new Error('Google n\'a pas donné d\'accès durable : ' + (j.error_description || j.error || 'réponse inattendue'))
    storeSecret('google', j.refresh_token)
    tokenCache = { token: j.access_token || '', expires: Date.now() + (j.expires_in - 60) * 1000 }
    const me = await getJson<{ email?: string }>('https://openidconnect.googleapis.com/v1/userinfo')
    const granted = (j.scope || '').split(' ')
    updateInfo({ email: me.email, canRead: granted.includes(READ_SCOPE), connectedAt: new Date().toISOString() })
    log('Google connecté :', me.email || '')
    return googleStatus()
}

export function disconnectGoogle(): void {
    const refresh = readSecret('google')
    if (refresh) fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(refresh), { method: 'POST' }).catch(() => {})
    forgetSecret('google')
    tokenCache = null
    const i = googleInfo()
    updateInfo({ email: null, canRead: false, options: googleOptions(), folderId: i.folderId, spreadsheetId: i.spreadsheetId })
}

// ---------- Access token ----------
let tokenCache: { token: string, expires: number } | null = null
async function accessToken(): Promise<string> {
    if (tokenCache && Date.now() < tokenCache.expires) return tokenCache.token
    const c = clientFile(), refresh = readSecret('google')
    if (!c || !refresh) throw new Error('Google n\'est pas connecté (Réglages, Comptes)')
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: c.client_id, client_secret: c.client_secret, refresh_token: refresh, grant_type: 'refresh_token' }),
    })
    const j = (await res.json()) as TokenAnswer
    if (j.error === 'invalid_grant') { forgetSecret('google'); throw new Error('Connexion Google expirée : reconnecte-toi (Réglages, Comptes)') }
    if (!j.access_token) throw new Error('Google : ' + (j.error_description || j.error))
    tokenCache = { token: j.access_token, expires: Date.now() + (j.expires_in - 60) * 1000 }
    return tokenCache.token
}

async function googleFetch(url: string, options: RequestInit & { headers?: Record<string, string> } = {}): Promise<Response> {
    const res = await fetch(url, { ...options, headers: { Authorization: `Bearer ${await accessToken()}`, ...(options.headers || {}) } })
    if (!res.ok) {
        const t = await res.text()
        throw new Error(`Google ${res.status} : ${t.slice(0, 200)}`)
    }
    return res
}
// Answers of the Google APIs are outside data: each caller names the fields it reads
const getJson = async <T>(url: string): Promise<T> => (await (await googleFetch(url)).json()) as T
const googleJson = async <T = unknown>(url: string, body: unknown, method = 'POST'): Promise<T> => (await (await googleFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json()) as T

// ---------- Gmail ----------
export async function sendWithGmailApi(raw: Buffer | string, threadId?: string): Promise<{ id: string, threadId: string }> {
    const r = await googleJson<{ id: string, threadId: string }>('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', { raw: b64url(Buffer.from(raw)), ...(threadId ? { threadId } : {}) })
    return { id: r.id, threadId: r.threadId }
}

// Same shape as the mailbox reader: [{ id, from, subject, date, inReplyTo, bounce, text }]
export async function readGmailApi(days = 30, keep: (h: MailHeader) => boolean = () => true): Promise<ReceivedMail[]> {
    const result: ReceivedMail[] = []
    let page: string | undefined = ''
    const ids: string[] = []
    do {
        const l: GmailList = await getJson<GmailList>(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=200&q=${encodeURIComponent(`in:inbox newer_than:${days}d`)}${page ? '&pageToken=' + page : ''}`)
        ids.push(...(l.messages || []).map((m) => m.id))
        page = l.nextPageToken
    } while (page && ids.length < 600)
    for (const id of ids) {
        const m = await getJson<{ internalDate: string, payload?: { headers?: { name: string, value: string }[] } }>(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Message-ID&metadataHeaders=In-Reply-To&metadataHeaders=Date`)
        const h: Record<string, string | undefined> = Object.fromEntries((m.payload?.headers || []).map((x) => [x.name.toLowerCase(), x.value]))
        const from = ((h.from || '').match(/<([^>]+)>/)?.[1] || h.from || '').toLowerCase().trim()
        const header: MailHeader = {
            id: h['message-id'] || `gmail-${id}`, from, subject: h.subject || '', date: new Date(Number(m.internalDate)).toISOString(), inReplyTo: h['in-reply-to'] || '',
            bounce: /mailer-daemon|postmaster/i.test(from) || /undeliver|non remis|delivery status|échec de la remise/i.test(h.subject || ''),
        }
        if (!keep(header)) continue
        const raw = await getJson<{ raw: string }>(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=raw`)
        let t = ''
        try { const mail = await simpleParser(Buffer.from(raw.raw, 'base64url')); t = mail.text || (mail.html || '').replace(/<[^>]+>/g, ' ') } catch {}
        result.push({ ...header, text: t.slice(0, 6000) })
    }
    return result
}

export async function sendAsAddresses(): Promise<{ address: string, verified: boolean }[] | null> {
    if (!googleInfo().canRead) return null
    const r = await getJson<{ sendAs?: { sendAsEmail: string, verificationStatus?: string, isPrimary?: boolean }[] }>('https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs')
    return (r.sendAs || []).map((s) => ({ address: s.sendAsEmail.toLowerCase(), verified: s.verificationStatus === 'accepted' || !!s.isPrimary }))
}

// ---------- Drive: app folder, reports as Google Docs ----------
async function driveFolder(name: string, parent?: string): Promise<string> {
    const i = googleInfo()
    const key = parent ? 'reportsFolderId' : 'folderId'
    if (i[key]) {
        try {
            const f = await getJson<DriveFile>(`https://www.googleapis.com/drive/v3/files/${i[key]}?fields=id,trashed`)
            if (!f.trashed) return f.id
        } catch {}
    }
    const f = await googleJson<DriveFile>('https://www.googleapis.com/drive/v3/files?fields=id', { name, mimeType: 'application/vnd.google-apps.folder', ...(parent ? { parents: [parent] } : {}) })
    updateInfo({ [key]: f.id })
    return f.id
}
export const appFolder = (): Promise<string> => driveFolder('DC Prospect')
const reportsFolder = async (): Promise<string> => driveFolder('Rapports', await appFolder())

// Upload or replace a Markdown report, converted to a Google Doc
export async function publishReport(name: string, markdown: string): Promise<void> {
    const parent = await reportsFolder()
    const q = encodeURIComponent(`name = '${name.replace(/'/g, "\\'")}' and '${parent}' in parents and trashed = false`)
    const existing = (await getJson<{ files?: DriveFile[] }>(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`)).files?.[0]
    const boundary = 'prospection' + crypto.randomBytes(8).toString('hex')
    const meta = existing ? {} : { name, mimeType: 'application/vnd.google-apps.document', parents: [parent] }
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: text/markdown; charset=UTF-8\r\n\r\n${markdown}\r\n--${boundary}--`
    const url = existing
        ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart&fields=id`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id'
    await googleFetch(url, { method: existing ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body })
}

// ---------- Sheets: the tracking table ----------
async function spreadsheet(): Promise<string> {
    const i = googleInfo()
    if (i.spreadsheetId) {
        try {
            const f = await getJson<DriveFile>(`https://www.googleapis.com/drive/v3/files/${i.spreadsheetId}?fields=id,trashed`)
            if (!f.trashed) return f.id
        } catch {}
    }
    const parent = await appFolder()
    const f = await googleJson<DriveFile>('https://www.googleapis.com/drive/v3/files?fields=id', { name: 'Suivi prospection', mimeType: 'application/vnd.google-apps.spreadsheet', parents: [parent] })
    updateInfo({ spreadsheetId: f.id })
    return f.id
}

const rgb = (h: string) => ({ red: parseInt(h.slice(1, 3), 16) / 255, green: parseInt(h.slice(3, 5), 16) / 255, blue: parseInt(h.slice(5, 7), 16) / 255 })

// tabs: [{ title, columns: [[name, width]], rows: [[...]] }] ; everything is rewritten (the app holds the data)
export async function writeSpreadsheet(tabs: SheetTab[]): Promise<string> {
    const id = await spreadsheet()
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${id}`
    let info = await getJson<SpreadsheetInfo>(`${base}?fields=sheets.properties`)
    const existing = new Map(info.sheets.map((s) => [s.properties.title, s.properties.sheetId]))
    const additions = tabs.filter((t) => !existing.has(t.title)).map((t) => ({ addSheet: { properties: { title: t.title, gridProperties: { frozenRowCount: 1 } } } }))
    const firstSheet = info.sheets[0]?.properties
    if (additions.length) {
        await googleJson(`${base}:batchUpdate`, { requests: additions })
        info = await getJson<SpreadsheetInfo>(`${base}?fields=sheets.properties`)
        // the blank first tab of a new file goes away
        if (firstSheet && !tabs.some((t) => t.title === firstSheet.title)) await googleJson(`${base}:batchUpdate`, { requests: [{ deleteSheet: { sheetId: firstSheet.sheetId } }] }).catch(() => {})
    }
    const ids = new Map(info.sheets.map((s) => [s.properties.title, s.properties.sheetId]))
    await googleJson(`${base}/values:batchClear`, { ranges: tabs.map((t) => `'${t.title}'`) })
    await googleJson(`${base}/values:batchUpdate`, {
        valueInputOption: 'RAW',
        data: tabs.map((t) => ({ range: `'${t.title}'!A1`, values: [t.columns.map(([n]) => n.toUpperCase()), ...t.rows.map((r) => r.map((v) => v ?? ''))] })),
    })
    const requests: object[] = []
    for (const t of tabs) {
        const sheetId = ids.get(t.title)
        requests.push(
            { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
            { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: rgb('#111417'), textFormat: { foregroundColor: rgb('#7ee6a8'), bold: true, fontFamily: 'Arial', fontSize: 10 }, verticalAlignment: 'MIDDLE', wrapStrategy: 'WRAP' } }, fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)' } },
            { repeatCell: { range: { sheetId, startRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { fontFamily: 'Arial', fontSize: 10 }, verticalAlignment: 'TOP', wrapStrategy: 'WRAP' } }, fields: 'userEnteredFormat(textFormat,verticalAlignment,wrapStrategy)' } },
            ...t.columns.map(([, width], i) => ({ updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: Math.round(width * 7.5) }, fields: 'pixelSize' } })),
            { setBasicFilter: { filter: { range: { sheetId, startRowIndex: 0, endRowIndex: t.rows.length + 1, startColumnIndex: 0, endColumnIndex: t.columns.length } } } },
        )
    }
    await googleJson(`${base}:batchUpdate`, { requests })
    return `https://docs.google.com/spreadsheets/d/${id}/edit`
}
