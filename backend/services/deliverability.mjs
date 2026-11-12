// Deliverability: are the e-mails of the sending address allowed and signed (SPF, DKIM, DMARC of its domain), and a
// progressive start (warm-up) for a new address: few e-mails the first weeks, then up to the daily maximum.
//   await checkDomain('contact@mon-domaine.fr') -> { domain, mx, spf, dkim, dmarc, ok, advice: [French sentences] }
//   dailyLimit() -> e-mails allowed today (warm-up included)
import dns from 'node:dns/promises'
import { cfg, today, daysBetween } from './base.mjs'
import { sendingHealth } from './learning.mjs'

const WEBMAIL = /^(gmail|googlemail|hotmail|outlook|live|yahoo|orange|wanadoo|free|sfr|laposte|icloud|me|aol|gmx)\./i
// Usual DKIM selectors of the hosts and mail services
const SELECTORS = ['google', 'default', 'selector1', 'selector2', 'k1', 'k2', 'mail', 'dkim', 's1', 's2', 'mx', 'ovh', 'infomaniak', 'protonmail', 'zoho', 'smtp', 'sib', 'mailjet', 'brevo']

const txt = async (name) => { try { return (await dns.resolveTxt(name)).map((r) => r.join('')) } catch { return [] } }

export async function checkDomain(address, { viaGmail = false } = {}) {
    const domain = String(address || '').split('@')[1]?.toLowerCase()
    if (!domain) return { ok: false, advice: ['Adresse d\'envoi manquante (profil).'] }
    // a personal webmail address: its provider handles everything, nothing to set
    if (WEBMAIL.test(domain)) return { domain, webmail: true, ok: true, advice: ['Adresse personnelle (Gmail, Outlook, Orange...) : le fournisseur gère SPF, DKIM et DMARC. Pour prospecter, une adresse à ton domaine inspire plus confiance.'] }
    const [mx, root, dmarcRecords] = await Promise.all([
        dns.resolveMx(domain).then((r) => r.length > 0).catch(() => false), txt(domain), txt(`_dmarc.${domain}`),
    ])
    const spfRecord = root.find((r) => /^v=spf1/i.test(r)) || null
    const dmarcRecord = dmarcRecords.find((r) => /^v=DMARC1/i.test(r)) || null
    let dkim = null
    for (const s of SELECTORS) {
        const r = await txt(`${s}._domainkey.${domain}`)
        if (r.some((x) => /v=DKIM1|k=rsa|p=/i.test(x))) { dkim = s; break }
    }
    const advice = []
    if (!mx) advice.push(`Le domaine ${domain} ne reçoit pas d'e-mails (pas d'enregistrement MX) : les réponses n'arriveront pas.`)
    if (!spfRecord) advice.push(`Pas de SPF : ajoute chez l'hébergeur du domaine une entrée TXT « v=spf1 include:... ~all » qui autorise ton serveur d'envoi${viaGmail ? ' (include:_spf.google.com pour Gmail)' : cfg.smtp?.host ? ` (${cfg.smtp.host})` : ''}.`)
    else if (viaGmail && !/_spf\.google\.com/.test(spfRecord)) advice.push('Tu envoies par Gmail « en tant que » cette adresse, mais ton SPF n\'autorise pas Gmail : ajoute include:_spf.google.com à l\'entrée SPF du domaine.')
    if (!dkim) advice.push(`DKIM non trouvé parmi les sélecteurs courants : vérifie chez l'hébergeur de ${domain} que la signature DKIM est active${viaGmail ? ' (avec Gmail « en tant que », les e-mails sont signés par gmail.com, pas par ton domaine : un DKIM à ton domaine et un SPF qui autorise Gmail évitent le spam)' : ''}.`)
    if (!dmarcRecord) advice.push(`Pas de DMARC : ajoute une entrée TXT « _dmarc.${domain} » avec « v=DMARC1; p=none; rua=mailto:${address} » (le minimum, sans risque).`)
    const ok = !advice.length
    // Gmail, Yahoo and Outlook reject mail that fails DMARC alignment, and watch the spam complaints (keep them under 0.1 %, never over 0.3 %)
    advice.push(ok ? 'Tout est en place : SPF, DKIM et DMARC.' : 'Sans SPF, DKIM et DMARC alignés sur ton domaine, Gmail, Yahoo et Outlook classent ou refusent les e-mails.')
    advice.push('Pour suivre ta réputation chez Gmail : postmaster.google.com (gratuit). Si des prospects signalent tes e-mails comme spam, ralentis et rends les messages plus personnels.')
    return { domain, mx, spf: spfRecord, dkim, dmarc: dmarcRecord, ok, advice }
}

// ---------- Mail servers of an address, found from its domain (no technical setting to type) ----------
// [pattern of the MX or of the domain, name shown, SMTP server, SMTP port, IMAP server]  ({domain} = the address's domain)
const MAIL_HOSTS = [
    [/infomaniak/, 'Infomaniak', 'mail.infomaniak.com', 465, 'mail.infomaniak.com'],
    [/ovh\.net/, 'OVHcloud', 'ssl0.ovh.net', 465, 'ssl0.ovh.net'],
    [/google\.com|googlemail\.com/, 'Google Workspace', 'smtp.gmail.com', 465, 'imap.gmail.com'],
    // personal Microsoft addresses before Microsoft 365 (their mail servers are the same)
    [/^(hotmail|live|outlook|msn)\.(fr|com|be|ch)$/, 'Outlook.com', 'smtp-mail.outlook.com', 587, 'outlook.office365.com'],
    [/outlook\.com|office365/, 'Microsoft 365', 'smtp.office365.com', 587, 'outlook.office365.com'],
    [/ionos|1and1|kundenserver/, 'IONOS', 'smtp.ionos.fr', 465, 'imap.ionos.fr'],
    [/o2switch/, 'o2switch', 'mail.{domain}', 465, 'mail.{domain}'],
    [/gandi\.net/, 'Gandi', 'mail.gandi.net', 465, 'mail.gandi.net'],
    [/hostinger/, 'Hostinger', 'smtp.hostinger.com', 465, 'imap.hostinger.com'],
    [/zoho/, 'Zoho Mail', 'smtp.zoho.eu', 465, 'imap.zoho.eu'],
    [/orange\.fr|wanadoo\.fr/, 'Orange', 'smtp.orange.fr', 465, 'imap.orange.fr'],
    [/sfr\.fr|neuf\.fr/, 'SFR', 'smtp.sfr.fr', 465, 'imap.sfr.fr'],
    [/free\.fr/, 'Free', 'smtp.free.fr', 465, 'imap.free.fr'],
    [/laposte\.net/, 'La Poste', 'smtp.laposte.net', 465, 'imap.laposte.net'],
    [/yahoo\./, 'Yahoo', 'smtp.mail.yahoo.com', 465, 'imap.mail.yahoo.com'],
    [/icloud\.com|me\.com/, 'iCloud', 'smtp.mail.me.com', 587, 'imap.mail.me.com'],
]
// { name, smtpHost, smtpPort, imapHost, imapPort, gmail } or null when unknown
export async function detectMailHost(address) {
    const domain = String(address || '').split('@')[1]?.toLowerCase()
    if (!domain) return null
    if (/^(gmail|googlemail)\.com$/.test(domain)) return { name: 'Gmail', gmail: true }
    let mx = ''
    try { mx = (await dns.resolveMx(domain)).sort((a, b) => a.priority - b.priority).map((r) => r.exchange).join(' ').toLowerCase() } catch {}
    // the domain first (gmail.com, hotmail.fr...), then its mail servers
    const found = MAIL_HOSTS.find(([re]) => re.test(domain)) || MAIL_HOSTS.find(([re]) => re.test(mx))
    if (!found) {
        // hosting with cPanel (o2switch, LWS, PlanetHoster...): the mail server carries the domain's own name, mail.domain
        if (mx && mx.split(' ').some((h) => h === domain || h.endsWith('.' + domain))) {
            try { await dns.lookup(`mail.${domain}`); return { name: 'ton hébergeur', smtpHost: `mail.${domain}`, smtpPort: 465, imapHost: `mail.${domain}`, imapPort: 993, gmail: false } } catch {}
        }
        return null
    }
    const [, name, smtp, smtpPort, imap] = found
    return { name, smtpHost: smtp.replace('{domain}', domain), smtpPort, imapHost: imap.replace('{domain}', domain), imapPort: 993, gmail: name === 'Google Workspace' }
}

// What to do to connect MY address, said for MY provider (getting started, step 4)
//   { name, mode: 'gmail' | 'mailbox', servers?, steps: [French sentences], warning? }
export async function mailGuide(address) {
    const h = await detectMailHost(address)
    const domain = String(address || '').split('@')[1] || ''
    if (!h) return { name: null, mode: 'mailbox', steps: [`Choisis ton hébergeur dans Avancé (« Adresse d'envoi et serveur de ta boîte ») : le serveur de ${domain} n'a pas été reconnu.`, 'Puis tape le mot de passe de ton adresse ci-dessous.'] }
    if (h.gmail) return {
        name: h.name, mode: 'gmail',
        steps: [h.name === 'Gmail' ? 'Ton adresse est un Gmail : c\'est le plus simple.' : 'Ton adresse est chez Google Workspace : elle se branche comme un Gmail.',
            'Active la validation en deux étapes de ton compte Google si ce n\'est pas fait (lien ci-dessous).',
            'Crée un mot de passe d\'application nommé « DC Prospect » (lien ci-dessous) et colle les 16 lettres.'],
    }
    const personal = {
        Yahoo: 'Yahoo demande un mot de passe d\'application : Compte Yahoo, Sécurité, « Générer un mot de passe d\'application ». Colle-le ici à la place de ton mot de passe.',
        iCloud: 'iCloud demande un mot de passe pour app : appleid.apple.com, Connexion et sécurité, « Mots de passe pour app ». Colle-le ici.',
        'Outlook.com': 'Microsoft bloque de plus en plus l\'envoi depuis un logiciel pour les adresses Outlook.com et Hotmail : si ton mot de passe est refusé, le plus simple est d\'envoyer depuis un Gmail.',
        'Microsoft 365': 'Chez Microsoft 365, l\'administrateur doit parfois autoriser l\'envoi depuis un logiciel (« SMTP authentifié ») : si le mot de passe est refusé, demande-le à la personne qui gère ta messagerie.',
        Orange: 'Si Orange refuse le mot de passe, vérifie dans ta messagerie Orange que l\'accès depuis un logiciel de messagerie est autorisé.',
    }
    return {
        name: h.name, mode: 'mailbox', servers: { smtpHost: h.smtpHost, smtpPort: h.smtpPort, imapHost: h.imapHost, imapPort: h.imapPort },
        steps: [`Ton adresse est chez ${h.name} : le serveur est déjà rempli.`, `Tape le mot de passe de ${address} (celui de ta messagerie) ci-dessous : DC Prospect vérifie la connexion tout de suite.`],
        warning: personal[h.name] || null,
    }
}

// Warm-up of a new sending address: 5 e-mails a day the first week, +5 each week, up to the daily maximum
export const warmup = () => ({ enabled: false, startedOn: null, ...(cfg.warmup || {}) })
// With the state: halved while bounces or STOP are too many (learning.mjs sendingHealth)
export function dailyLimit(day = today(), state = null) {
    const w = warmup()
    const weeks = Math.max(0, Math.floor(daysBetween(w.startedOn || day, day) / 7))
    const limit = w.enabled && w.startedOn ? Math.min(cfg.maxEmailsPerDay, 5 + 5 * weeks) : cfg.maxEmailsPerDay
    return state && sendingHealth(state).slowed ? Math.max(3, Math.floor(limit / 2)) : limit
}
