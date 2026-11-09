// Mail from the pro address of the user (set in the profile), two ways (chosen in Settings):
// - Gmail: the user's Gmail sends "as" contact@ (alias already set in Gmail), with an app password (SMTP and IMAP of Gmail),
//   or through the Google API if Google is connected; the copy lands in the Gmail Sent folder by itself.
// - The pro mailbox itself, whatever the host (Infomaniak today; servers set in Settings, Advanced):
//   SMTP to send, IMAP to file a copy in "Sent" and read replies.
// The password is typed by the user in the app (Settings, Accounts), encrypted by Windows (DPAPI, this user only).
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import nodemailer from 'nodemailer'
import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { cfg, localFolder, log, localSettings, updateLocalSettings, powerShellEnv } from './base.mjs'
import { profile, fullName } from './settings.mjs'
import { googleActive, googleInfo, sendWithGmailApi, readGmailApi } from './google.mjs'
import { storeSecret, readSecret, forgetSecret, hasSecret } from './vault.mjs'

const GMAIL = { smtp: { host: 'smtp.gmail.com', port: 465 }, imap: { host: 'imap.gmail.com', port: 993 } }
// Gmail account and app password; a version before 1.2.0 saved them as { adresse, mdp }
const gmailLogin = () => {
    const saved = readSecret('gmail')
    if (!saved) return null
    const g = JSON.parse(saved)
    return { address: g.address || g.adresse, password: g.password || g.mdp }
}
export const gmailReady = () => hasSecret('gmail') || googleActive()
// Way chosen in the settings ('gmail' or 'mailbox'); by default Gmail as soon as it is set up
export const sendingMode = () => {
    const m = localSettings().sendingMode
    if (m === 'gmail' || m === 'mailbox') return m
    return fs.existsSync(secretFile) && !gmailReady() ? 'mailbox' : 'gmail'
}
export const viaGmail = () => sendingMode() === 'gmail' && gmailReady()
const readsWithGmailApi = () => !hasSecret('gmail') && googleActive() && googleInfo().canRead
export const sendingReady = () => (sendingMode() === 'gmail' ? gmailReady() : fs.existsSync(secretFile))
export const chooseSendingMode = (m) => updateLocalSettings({ sendingMode: m === 'gmail' ? 'gmail' : 'mailbox' })

export const secretFile = path.join(localFolder, 'contact.secret')
// Unsubscribe sentence added under every prospecting e-mail (read by the prospect: in French)
export const STOP = 'Si vous ne souhaitez plus recevoir de message de ma part, répondez simplement STOP.'

function mailboxPassword() {
    if (!fs.existsSync(secretFile)) throw new Error('Mot de passe de contact@ pas encore enregistré (Réglages, Comptes)')
    const ps = `$s = Get-Content -LiteralPath '${secretFile.replace(/'/g, "''")}' | ConvertTo-SecureString; [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))`
    const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { env: powerShellEnv(), encoding: 'utf8', windowsHide: true })
    const password = (r.stdout || '').replace(/\r?\n$/, '')
    if (r.status !== 0 || !password) throw new Error('Impossible de lire le mot de passe enregistré : enregistre-le à nouveau (Réglages, Comptes)')
    return password
}

const mailboxAuth = () => ({ user: cfg.sender.address, pass: mailboxPassword() })
// Port 465: encrypted from the start; 587 (Microsoft 365, Outlook...): plain then STARTTLS, required
const mailboxSmtp = (auth) => ({ host: cfg.smtp.host, port: cfg.smtp.port, secure: Number(cfg.smtp.port) === 465, requireTLS: Number(cfg.smtp.port) !== 465, auth })

// ---------- Signatures (profile): HTML pasted or imported in the settings, otherwise a simple one built from the profile ----------
// type: 'main' (prospecting, follow-up) or 'second' (e.g. accounting); the old French names still work
const signatureType = (t) => (['second', 'secondaire', 'comptabilite'].includes(t) ? 'second' : 'main')
const escapeHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const websiteDomain = () => (profile().website || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '')

export function signatureHtml(type = 'main') {
    const p = profile(), t = signatureType(type)
    const html = t === 'second' ? p.secondSignature || p.mainSignature : p.mainSignature
    if (html) return html
    const line = (v) => (v ? `<div>${v}</div>` : '')
    return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45;color:#111417;border-left:3px solid #7ee6a8;padding-left:12px">
<div style="font-weight:bold">${escapeHtml(fullName(p) || cfg.sender.name)}</div>${line(escapeHtml(t === 'second' ? p.secondSignatureName || p.title : p.title || p.activity))}${line(escapeHtml(p.company !== fullName(p) ? p.company : ''))}
${line(p.phone ? `<a href="tel:${escapeHtml(p.phone.replace(/[^+0-9]/g, ''))}" style="color:#111417;text-decoration:none">${escapeHtml(p.phone)}</a>` : '')}${line(`<a href="mailto:${escapeHtml(cfg.sender.address)}" style="color:#111417;text-decoration:none">${escapeHtml(cfg.sender.address)}</a>`)}${line(p.website ? `<a href="${escapeHtml(p.website)}" style="color:#111417">${escapeHtml(websiteDomain())}</a>` : '')}</div>`
}

function signatureText(type) {
    const p = profile(), t = signatureType(type)
    return [fullName(p) || cfg.sender.name, t === 'second' ? p.secondSignatureName || p.title : p.title || p.activity, p.phone, cfg.sender.address, p.website].filter(Boolean).join('\n')
}

export function compose(body, { signature = 'main', stop = false, quote } = {}) {
    const site = websiteDomain()
    const link = site ? new RegExp('(https?://)?' + site.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(/[\\w\\-/]*)?', 'g') : null
    const paragraphs = body.trim().split(/\n\s*\n/).map((para) => {
        let t = escapeHtml(para.trim()).replace(/\n/g, '<br>')
        if (link) t = t.replace(link, (u) => `<a href="${u.startsWith('http') ? u : 'https://' + u}" style="color:#111417;">${u}</a>`)
        return `<p style="margin:0 0 14px;">${t}</p>`
    }).join('\n')
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#111417;">
${paragraphs}
</div>
<div style="margin:18px 0 0;">${signatureHtml(signature)}</div>
${stop ? `<p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7680;margin:14px 0 0;">${STOP}</p>` : ''}
${quote ? `<div style="margin-top:22px;padding-left:12px;border-left:2px solid #cfd6db;color:#55606a;font-family:Arial,Helvetica,sans-serif;font-size:13px;">${quote.header}<br><br>${escapeHtml(quote.text).replace(/\n/g, '<br>')}</div>` : ''}`
    let text = `${body.trim()}\n\n--\n${signatureText(signature)}`
    if (stop) text += `\n\n${STOP}`
    if (quote) text += `\n\n${quote.header}\n${quote.text.split('\n').map((l) => '> ' + l).join('\n')}`
    return { html, text }
}

// ---------- Send ----------
// options: { to, subject, body, signature, stop, inReplyTo (Message-ID), threadId (Gmail), quote } ; returns { messageId, threadId }
export async function send({ to, subject, body, signature = 'main', stop = false, inReplyTo, references, threadId, quote, cc }) {
    const { html, text } = compose(body, { signature, stop, quote })
    const message = {
        from: { name: cfg.sender.name, address: cfg.sender.address },
        to, cc, subject, text, html,
        headers: stop ? { 'List-Unsubscribe': `<mailto:${cfg.sender.address}?subject=STOP>` } : {},
    }
    if (inReplyTo) { message.inReplyTo = inReplyTo; message.references = references || inReplyTo }
    if (viaGmail() && hasSecret('gmail')) {
        // Gmail SMTP: Gmail checks that contact@ is one of its "send as" addresses and keeps the copy in Sent
        const g = gmailLogin()
        const info = await nodemailer.createTransport({ ...GMAIL.smtp, secure: true, auth: { user: g.address, pass: g.password } }).sendMail(message)
        log(`E-mail envoyé par Gmail à ${to} : ${subject}`)
        return { messageId: info.messageId }
    }
    if (viaGmail()) {
        const messageId = `<${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}@${cfg.sender.address.split('@')[1] || 'dc-prospect.local'}>`
        const raw = await new Promise((res, rej) => nodemailer.createTransport({ streamTransport: true, buffer: true })
            .sendMail({ ...message, messageId, date: new Date() }, (e, i) => (e ? rej(e) : res(i.message))))
        const r = await sendWithGmailApi(raw, threadId)
        log(`E-mail envoyé par Gmail à ${to} : ${subject}`)
        return { messageId, threadId: r.threadId }
    }
    const auth = mailboxAuth()
    const info = await nodemailer.createTransport(mailboxSmtp(auth)).sendMail(message)
    // Most hosts do not keep a copy of SMTP sends: file it in "Sent" so it shows in the mailbox
    try {
        const raw = await new Promise((res, rej) => nodemailer.createTransport({ streamTransport: true, buffer: true })
            .sendMail({ ...message, messageId: info.messageId, date: new Date() }, (e, i) => (e ? rej(e) : res(i.message))))
        await withImap(auth, async (client) => {
            const folders = await client.list()
            const sentFolder = folders.find((f) => f.specialUse === '\\Sent')?.path || 'Sent'
            await client.append(sentFolder, raw, ['\\Seen'])
        })
    } catch (e) { log('Copie dans Envoyés impossible :', e.message) }
    log(`E-mail envoyé à ${to} : ${subject}`)
    return { messageId: info.messageId }
}

async function withImap(auth, work, server = { host: cfg.imap.host, port: cfg.imap.port }) {
    const client = new ImapFlow({ ...server, secure: true, auth, logger: false })
    await client.connect()
    try { return await work(client) } finally { await client.logout().catch(() => {}) }
}

// ---------- Read replies of the last N days ----------
// Returns [{ id, from, subject, date, text, inReplyTo, bounce }]
// keep(header) decides from the envelope alone whether the full message is downloaded
export async function readReplies(days = 30, keep = () => true) {
    let auth, server
    if (sendingMode() === 'gmail' && hasSecret('gmail')) { const g = gmailLogin(); auth = { user: g.address, pass: g.password }; server = GMAIL.imap }
    else if (sendingMode() === 'gmail' && readsWithGmailApi()) return readGmailApi(days, keep)
    else auth = mailboxAuth()
    return withImap(auth, async (client) => {
        const result = []
        const lock = await client.getMailboxLock('INBOX')
        try {
            const since = new Date(Date.now() - days * 864e5)
            const headers = []
            for await (const m of client.fetch({ since }, { envelope: true })) {
                const from = m.envelope.from?.[0]?.address?.toLowerCase() || ''
                const h = {
                    uid: m.uid, id: m.envelope.messageId || `uid-${m.uid}`, from,
                    subject: m.envelope.subject || '', date: m.envelope.date?.toISOString(), inReplyTo: m.envelope.inReplyTo || '',
                    bounce: /mailer-daemon|postmaster/i.test(from) || /undeliver|non remis|delivery status|échec de la remise/i.test(m.envelope.subject || ''),
                }
                if (keep(h)) headers.push(h)
            }
            for (const h of headers) {
                const m = await client.fetchOne(String(h.uid), { source: true }, { uid: true })
                let t = ''
                try { const mail = await simpleParser(m.source, { skipImageLinks: true }); t = mail.text || (mail.html || '').replace(/<[^>]+>/g, ' ') } catch { t = '' }
                delete h.uid
                result.push({ ...h, text: t.slice(0, 6000) })
            }
        } finally { lock.release() }
        return result
    }, server)
}

export async function testConnection() {
    if (viaGmail() && hasSecret('gmail')) return testGmail(gmailLogin())
    if (viaGmail()) { await readGmailApi(1, () => false); return true }
    const auth = mailboxAuth()
    await nodemailer.createTransport(mailboxSmtp(auth)).verify()
    await withImap(auth, async () => {})
    return true
}

// Saves the password typed in the app: sent to Windows on stdin (never on a command line), encrypted with DPAPI
export function saveMailboxPassword(password) {
    if (!password || password.length > 200) throw new Error('Mot de passe vide ou trop long')
    fs.mkdirSync(localFolder, { recursive: true })
    const ps = `$m = [Console]::In.ReadLine(); ConvertTo-SecureString $m -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -LiteralPath '${secretFile.replace(/'/g, "''")}' -Encoding ASCII`
    const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { env: powerShellEnv(), input: password + '\n', encoding: 'utf8', windowsHide: true })
    if (r.status !== 0 || !fs.existsSync(secretFile)) throw new Error('Enregistrement impossible : ' + (r.stderr || '').slice(0, 200))
}

// ---------- Gmail with an app password (myaccount.google.com/apppasswords) ----------
async function testGmail({ address, password }) {
    await nodemailer.createTransport({ ...GMAIL.smtp, secure: true, auth: { user: address, pass: password } }).verify()
    await withImap({ user: address, pass: password }, async () => {}, GMAIL.imap)
    return true
}

export async function saveGmail(address, password) {
    address = String(address || '').trim().toLowerCase()
    password = String(password || '').replace(/\s+/g, '') // Google shows it in 4 blocks of 4 letters
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(address)) throw new Error('Adresse Gmail invalide')
    if (password.length < 16) throw new Error("Le mot de passe d'application fait 16 lettres")
    try { await testGmail({ address, password }) } catch (e) {
        throw new Error(/535|Username and Password|AUTHENTICATIONFAILED|Invalid credentials/i.test(e.message)
            ? "Gmail refuse ce mot de passe : crée un mot de passe d'application (la validation en deux étapes doit être active) et colle-le ici"
            : 'Connexion à Gmail impossible : ' + e.message)
    }
    storeSecret('gmail', JSON.stringify({ address, password }))
    chooseSendingMode('gmail')
}

export function forgetGmail() { forgetSecret('gmail'); if (localSettings().sendingMode === 'gmail' && !googleActive()) chooseSendingMode('mailbox') }
export const gmailStatus = () => ({ configured: hasSecret('gmail'), address: hasSecret('gmail') ? gmailLogin()?.address : null })

// Test e-mail to myself, to check in Gmail that the sender shown is contact@ (button in the settings)
export async function sendTestEmail() {
    const to = gmailStatus().address || cfg.sender.address
    await send({ to, subject: 'Test DC Prospect : expéditeur contact@', body: `Bonjour,

Cet e-mail de test vient de l'application DC Prospect (${viaGmail() ? 'par Gmail' : `directement par la boîte ${cfg.sender.address}`}).

Vérifie que l'expéditeur affiché est bien ${cfg.sender.address}.

Bien à vous,` })
    return to
}
