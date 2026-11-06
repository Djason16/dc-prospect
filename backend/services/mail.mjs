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
import { cfg, racine, dossierLocal, log, reglagesLocaux, majReglagesLocaux, envPowerShell } from './base.mjs'
import { profil, nomComplet } from './reglages.mjs'
import { googleActif, infosGoogle, envoyerGmail, lireGmail } from './google.mjs'
import { ranger, lireCoffre, oublierCoffre, dansCoffre } from './coffre.mjs'

const GMAIL = { smtp: { host: 'smtp.gmail.com', port: 465 }, imap: { host: 'imap.gmail.com', port: 993 } }
const gmailMdp = () => { const g = lireCoffre('gmail'); return g ? JSON.parse(g) : null }
export const gmailPret = () => dansCoffre('gmail') || googleActif()
// Way chosen in the settings; by default Gmail as soon as it is set up
export const modeEnvoi = () => { const m = reglagesLocaux().envoi; return m === 'gmail' ? 'gmail' : m === 'boite' || m === 'infomaniak' ? 'boite' : fs.existsSync(fichierSecret) && !gmailPret() ? 'boite' : 'gmail' }
export const parGmail = () => modeEnvoi() === 'gmail' && gmailPret()
const lectureGmailApi = () => !dansCoffre('gmail') && googleActif() && infosGoogle().lecture
export const envoiBranche = () => (modeEnvoi() === 'gmail' ? gmailPret() : fs.existsSync(fichierSecret))
export const choisirModeEnvoi = (m) => majReglagesLocaux({ envoi: m === 'gmail' ? 'gmail' : 'boite' })

export const fichierSecret = path.join(dossierLocal, 'contact.secret')
export const STOP = 'Si vous ne souhaitez plus recevoir de message de ma part, répondez simplement STOP.'

function motDePasse() {
    if (!fs.existsSync(fichierSecret)) throw new Error('Mot de passe de contact@ pas encore enregistré (Réglages, Comptes)')
    const ps = `$s = Get-Content -LiteralPath '${fichierSecret.replace(/'/g, "''")}' | ConvertTo-SecureString; [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))`
    const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { env: envPowerShell(), encoding: 'utf8', windowsHide: true })
    const mdp = (r.stdout || '').replace(/\r?\n$/, '')
    if (r.status !== 0 || !mdp) throw new Error('Impossible de lire le mot de passe enregistré : enregistre-le à nouveau (Réglages, Comptes)')
    return mdp
}

const auth = () => ({ user: cfg.expediteur.adresse, pass: motDePasse() })
// Port 465: encrypted from the start; 587 (Microsoft 365, Outlook...): plain then STARTTLS, required
const smtpBoite = (auth) => ({ host: cfg.smtp.hote, port: cfg.smtp.port, secure: Number(cfg.smtp.port) === 465, requireTLS: Number(cfg.smtp.port) !== 465, auth })

// ---------- Signatures (profile): HTML pasted or imported in the settings, otherwise a simple one built from the profile ----------
// type: 'principale' (prospecting, follow-up) or 'secondaire' (e.g. accounting); old names 'developpeur' / 'comptabilite' still work
const typeSignature = (t) => (t === 'secondaire' || t === 'comptabilite' ? 'secondaire' : 'principale')
const echapper = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const domaineSite = () => (profil().siteWeb || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '')

export function signatureHtml(type = 'principale') {
    const p = profil(), t = typeSignature(type)
    const html = t === 'secondaire' ? p.signatureSecondaire || p.signaturePrincipale : p.signaturePrincipale
    if (html) return html
    const ligne = (v) => (v ? `<div>${v}</div>` : '')
    return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.45;color:#111417;border-left:3px solid #7ee6a8;padding-left:12px">
<div style="font-weight:bold">${echapper(nomComplet(p) || cfg.expediteur.nom)}</div>${ligne(echapper(t === 'secondaire' ? p.nomSignatureSecondaire || p.titre : p.titre || p.activite))}${ligne(echapper(p.entreprise !== nomComplet(p) ? p.entreprise : ''))}
${ligne(p.telephone ? `<a href="tel:${echapper(p.telephone.replace(/[^+0-9]/g, ''))}" style="color:#111417;text-decoration:none">${echapper(p.telephone)}</a>` : '')}${ligne(`<a href="mailto:${echapper(cfg.expediteur.adresse)}" style="color:#111417;text-decoration:none">${echapper(cfg.expediteur.adresse)}</a>`)}${ligne(p.siteWeb ? `<a href="${echapper(p.siteWeb)}" style="color:#111417">${echapper(domaineSite())}</a>` : '')}</div>`
}

function signatureTexte(type) {
    const p = profil(), t = typeSignature(type)
    return [nomComplet(p) || cfg.expediteur.nom, t === 'secondaire' ? p.nomSignatureSecondaire || p.titre : p.titre || p.activite, p.telephone, cfg.expediteur.adresse, p.siteWeb].filter(Boolean).join('\n')
}

export function composer(corps, { signature = 'principale', stop = false, citation } = {}) {
    const site = domaineSite()
    const lien = site ? new RegExp('(https?://)?' + site.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(/[\\w\\-/]*)?', 'g') : null
    const paragraphes = corps.trim().split(/\n\s*\n/).map((p) => {
        let t = echapper(p.trim()).replace(/\n/g, '<br>')
        if (lien) t = t.replace(lien, (u) => `<a href="${u.startsWith('http') ? u : 'https://' + u}" style="color:#111417;">${u}</a>`)
        return `<p style="margin:0 0 14px;">${t}</p>`
    }).join('\n')
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#111417;">
${paragraphes}
</div>
<div style="margin:18px 0 0;">${signatureHtml(signature)}</div>
${stop ? `<p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7680;margin:14px 0 0;">${STOP}</p>` : ''}
${citation ? `<div style="margin-top:22px;padding-left:12px;border-left:2px solid #cfd6db;color:#55606a;font-family:Arial,Helvetica,sans-serif;font-size:13px;">${citation.entete}<br><br>${echapper(citation.texte).replace(/\n/g, '<br>')}</div>` : ''}`
    let texte = `${corps.trim()}\n\n--\n${signatureTexte(signature)}`
    if (stop) texte += `\n\n${STOP}`
    if (citation) texte += `\n\n${citation.entete}\n${citation.texte.split('\n').map((l) => '> ' + l).join('\n')}`
    return { html, texte }
}

// ---------- Send ----------
// options: { a, objet, corps, signature, stop, enReponseA (Message-ID), threadId (Gmail), citation } ; returns { messageId, threadId }
export async function envoyer({ a, objet, corps, signature = 'principale', stop = false, enReponseA, references, threadId, citation, cc }) {
    const { html, texte } = composer(corps, { signature, stop, citation })
    const message = {
        from: { name: cfg.expediteur.nom, address: cfg.expediteur.adresse },
        to: a, cc, subject: objet, text: texte, html,
        headers: stop ? { 'List-Unsubscribe': `<mailto:${cfg.expediteur.adresse}?subject=STOP>` } : {},
    }
    if (enReponseA) { message.inReplyTo = enReponseA; message.references = references || enReponseA }
    if (parGmail() && dansCoffre('gmail')) {
        // Gmail SMTP: Gmail checks that contact@ is one of its "send as" addresses and keeps the copy in Sent
        const g = gmailMdp()
        const info = await nodemailer.createTransport({ ...GMAIL.smtp, secure: true, auth: { user: g.adresse, pass: g.mdp } }).sendMail(message)
        log(`E-mail envoyé par Gmail à ${a} : ${objet}`)
        return { messageId: info.messageId }
    }
    if (parGmail()) {
        const messageId = `<${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}@${cfg.expediteur.adresse.split("@")[1] || "dc-prospect.local"}>`
        const brut = await new Promise((res, rej) => nodemailer.createTransport({ streamTransport: true, buffer: true })
            .sendMail({ ...message, messageId, date: new Date() }, (e, i) => (e ? rej(e) : res(i.message))))
        const r = await envoyerGmail(brut, threadId)
        log(`E-mail envoyé par Gmail à ${a} : ${objet}`)
        return { messageId, threadId: r.threadId }
    }
    const identifiants = auth()
    const transport = nodemailer.createTransport(smtpBoite(identifiants))
    const info = await transport.sendMail(message)
    // Most hosts do not keep a copy of SMTP sends: file it in "Sent" so it shows in the mailbox
    try {
        const brut = await new Promise((res, rej) => nodemailer.createTransport({ streamTransport: true, buffer: true })
            .sendMail({ ...message, messageId: info.messageId, date: new Date() }, (e, i) => (e ? rej(e) : res(i.message))))
        await avecImap(identifiants, async (client) => {
            const dossiers = await client.list()
            const envoyes = dossiers.find((d) => d.specialUse === '\\Sent')?.path || 'Sent'
            await client.append(envoyes, brut, ['\\Seen'])
        })
    } catch (e) { log('Copie dans Envoyés impossible :', e.message) }
    log(`E-mail envoyé à ${a} : ${objet}`)
    return { messageId: info.messageId }
}

async function avecImap(identifiants, travail, serveur = { host: cfg.imap.hote, port: cfg.imap.port }) {
    const client = new ImapFlow({ ...serveur, secure: true, auth: identifiants, logger: false })
    await client.connect()
    try { return await travail(client) } finally { await client.logout().catch(() => {}) }
}

// ---------- Read replies of the last N days ----------
// Returns [{ id, de, objet, date, texte, enReponseA, rebond }]
// garder(entete) decides from the envelope alone whether the full message is downloaded
export async function lireReponses(jours = 30, garder = () => true) {
    let identifiants, serveur
    if (modeEnvoi() === 'gmail' && dansCoffre('gmail')) { const g = gmailMdp(); identifiants = { user: g.adresse, pass: g.mdp }; serveur = GMAIL.imap }
    else if (modeEnvoi() === 'gmail' && lectureGmailApi()) return lireGmail(jours, garder)
    else identifiants = auth()
    return avecImap(identifiants, async (client) => {
        const sortie = []
        const verrou = await client.getMailboxLock('INBOX')
        try {
            const depuis = new Date(Date.now() - jours * 864e5)
            const entetes = []
            for await (const m of client.fetch({ since: depuis }, { envelope: true })) {
                const de = m.envelope.from?.[0]?.address?.toLowerCase() || ''
                const e = {
                    uid: m.uid, id: m.envelope.messageId || `uid-${m.uid}`, de,
                    objet: m.envelope.subject || '', date: m.envelope.date?.toISOString(), enReponseA: m.envelope.inReplyTo || '',
                    rebond: /mailer-daemon|postmaster/i.test(de) || /undeliver|non remis|delivery status|échec de la remise/i.test(m.envelope.subject || ''),
                }
                if (garder(e)) entetes.push(e)
            }
            for (const e of entetes) {
                const m = await client.fetchOne(String(e.uid), { source: true }, { uid: true })
                let t = ''
                try { const mail = await simpleParser(m.source, { skipImageLinks: true }); t = mail.text || (mail.html || '').replace(/<[^>]+>/g, ' ') } catch { t = '' }
                delete e.uid
                sortie.push({ ...e, texte: t.slice(0, 6000) })
            }
        } finally { verrou.release() }
        return sortie
    }, serveur)
}

export async function testerConnexion() {
    if (parGmail() && dansCoffre('gmail')) return testerGmail(gmailMdp())
    if (parGmail()) { await lireGmail(1, () => false); return true }
    const identifiants = auth()
    await nodemailer.createTransport(smtpBoite(identifiants)).verify()
    await avecImap(identifiants, async () => {})
    return true
}

// Saves the password typed in the app: sent to Windows on stdin (never on a command line), encrypted with DPAPI
export function enregistrerMotDePasse(mdp) {
    if (!mdp || mdp.length > 200) throw new Error('Mot de passe vide ou trop long')
    fs.mkdirSync(dossierLocal, { recursive: true })
    const ps = `$m = [Console]::In.ReadLine(); ConvertTo-SecureString $m -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -LiteralPath '${fichierSecret.replace(/'/g, "''")}' -Encoding ASCII`
    const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { env: envPowerShell(), input: mdp + '\n', encoding: 'utf8', windowsHide: true })
    if (r.status !== 0 || !fs.existsSync(fichierSecret)) throw new Error('Enregistrement impossible : ' + (r.stderr || '').slice(0, 200))
}

// ---------- Gmail with an app password (myaccount.google.com/apppasswords) ----------
async function testerGmail({ adresse, mdp }) {
    await nodemailer.createTransport({ ...GMAIL.smtp, secure: true, auth: { user: adresse, pass: mdp } }).verify()
    await avecImap({ user: adresse, pass: mdp }, async () => {}, GMAIL.imap)
    return true
}

export async function enregistrerGmail(adresse, mdp) {
    adresse = String(adresse || '').trim().toLowerCase()
    mdp = String(mdp || '').replace(/\s+/g, '') // Google shows it in 4 blocks of 4 letters
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(adresse)) throw new Error('Adresse Gmail invalide')
    if (mdp.length < 16) throw new Error("Le mot de passe d'application fait 16 lettres")
    try { await testerGmail({ adresse, mdp }) } catch (e) {
        throw new Error(/535|Username and Password|AUTHENTICATIONFAILED|Invalid credentials/i.test(e.message)
            ? "Gmail refuse ce mot de passe : crée un mot de passe d'application (la validation en deux étapes doit être active) et colle-le ici"
            : 'Connexion à Gmail impossible : ' + e.message)
    }
    ranger('gmail', JSON.stringify({ adresse, mdp }))
    choisirModeEnvoi('gmail')
}

export function oublierGmail() { oublierCoffre('gmail'); if (reglagesLocaux().envoi === 'gmail' && !googleActif()) choisirModeEnvoi('boite') }
export const statutGmail = () => ({ configure: dansCoffre('gmail'), adresse: dansCoffre('gmail') ? gmailMdp()?.adresse : null })

// Test e-mail to myself, to check in Gmail that the sender shown is contact@ (button in the settings)
export async function envoyerTest() {
    const a = statutGmail().adresse || cfg.expediteur.adresse
    await envoyer({ a, objet: 'Test DC Prospect : expéditeur contact@', corps: `Bonjour,

Cet e-mail de test vient de l'application DC Prospect (${parGmail() ? 'par Gmail' : `directement par la boîte ${cfg.expediteur.adresse}`}).

Vérifie que l'expéditeur affiché est bien ${cfg.expediteur.adresse}.

Bien à vous,` })
    return a
}
