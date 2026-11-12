// What happens after a reply, and small helps for the user:
//   - "later" reminders: a prospect who said "plus tard" comes back on the home screen on the date he gave (or in 3 months),
//     with an answer ready to prepare in the same conversation;
//   - writing hints: what could make an e-mail land in spam or get fewer replies (shown, never blocking);
//   - daily backup of the prospects (Données\Sauvegardes, the last 14 days).
import fs from 'node:fs'
import path from 'node:path'
import { today, addDays, dataFolder, stateFile, record, log } from './base.mjs'

// ---------- 1. "Later" reminders ----------
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
const pad = (n) => String(n).padStart(2, '0')

// Date to come back to a prospect, from what he wrote (« dans 2 mois », « en septembre », « à la rentrée »...)
export function laterDate(text, from = today()) {
    const t = String(text || '').toLowerCase()
    const [y, m] = from.split('-').map(Number)
    const n = t.match(/dans (\d+|un|une|deux|trois|quatre|six) (mois|semaines?)/)
    if (n) {
        const count = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, six: 6 }[n[1]] || Number(n[1])
        return addDays(from, n[2] === 'mois' ? count * 30 : count * 7)
    }
    const plain = (x) => x.normalize('NFD').replace(/[̀-ͯ]/g, '')
    const month = MONTHS.findIndex((name) => new RegExp('(^|[^a-z])' + plain(name) + '([^a-z]|$)').test(plain(t)))
    if (month >= 0) return `${month + 1 > m ? y : y + 1}-${pad(month + 1)}-01`
    if (/rentr[ée]e/.test(t)) return `${m >= 9 ? y + 1 : y}-09-01`
    if (/ann[ée]e prochaine|l'an prochain/.test(t)) return `${y + 1}-01-15`
    if (/printemps/.test(t)) return `${m >= 4 ? y + 1 : y}-04-01`
    if (/[ée]t[ée]/.test(t)) return `${m >= 6 ? y + 1 : y}-06-15`
    return addDays(from, 90)
}

// Called when a "later" reply is handled (answer sent, or "Rien d'autre")
export function scheduleReminder(p) {
    if (p.reply?.kind !== 'later' || p.reply.recontact || p.remindOn) return
    p.remindOn = laterDate(p.reply.excerpt, p.reply.date || today())
}

// Every day: prospects whose date has come are back on the home screen
export function wakeReminders(state) {
    const day = today()
    let n = 0
    for (const p of state.prospects) {
        if (!p.remindOn || p.remindOn > day || p.status === 'stopped' || p.status === 'client') continue
        delete p.remindOn
        p.status = 'replied'
        p.reply = { ...p.reply, recontact: true, answer: null, answered: null }
        p.tracking = { ...(p.tracking || {}), handled: null }
        record(state, 'reminder', `${p.company} t'avait dit « plus tard » : c'est le moment de revenir vers lui`, { id: p.id })
        n++
    }
    return n
}

// ---------- 2. Writing hints (never blocking) ----------
const SPAMMY = /(gratuit|gratuite|promo|promotion|offre spéciale|urgent|dernière chance|cliquez|garanti)|100 ?%|[€$]|!{2,}/i
export function writingHints(subject, body) {
    const hints = []
    const words = String(body || '').split(/\s+/).filter(Boolean).length
    if (words > 170) hints.push(`un peu long (${words} mots) : les e-mails de moins de 150 mots font plus répondre`)
    if (SPAMMY.test(subject || '')) hints.push('évite « gratuit », les prix et les points d\'exclamation dans l\'objet : les filtres anti-spam s\'en méfient')
    if ((String(body).match(/https?:\/\//g) || []).length > 1) hints.push('plusieurs liens : un seul lien (ton site) évite le classement en spam')
    // words written in capitals (« PROMOTION », « OFFRE »), not the acronyms or names (RNCP, MOTRIO): 2 long words or more
    if ((`${subject} ${body}`.replace(/\bSTOP\b/g, '').match(/\b[A-ZÀ-Ý]{6,}\b/g) || []).length >= 2) hints.push('des mots en majuscules : ça fait publicitaire')
    if (!/\?/.test(body || '')) hints.push('finis par une question simple (« Auriez-vous 15 minutes ? ») : on y répond plus facilement')
    return hints
}

// ---------- 3. Why so few prospects: what to change, from the last search (shown on the home screen) ----------
export function searchAdvice(state, { activeTrades = 0, reserve = 0 } = {}) {
    const s = state.lastSearch
    const ready = state.prospects.filter((p) => p.status === 'ready' && p.drafts?.first?.status === 'reserved').length
    if (!s || ready >= Math.min(10, reserve) || s.found >= 3) return null
    const tips = []
    if (s.errors && s.errors >= s.attempts) tips.push('le moteur de recherche n\'a pas répondu (limite atteinte ou connexion) : ça reprendra au prochain jour de recherche')
    if (s.engine === 'free' && !s.brave) tips.push('ajoute une clé Brave (Réglages, Formule, Options : crédit gratuit de 5 $ par mois) : sans elle, DC Prospect ne retrouve que les sites dont l\'adresse ressemble au nom de l\'entreprise')
    if (s.skipped > s.attempts) tips.push('peu d\'entreprises de tes métiers dans ces villes : agrandis ta zone (un rayon plus grand ou une zone de plus)')
    if (activeTrades < 4) tips.push('ajoute des métiers à prospecter (Réglages, Avancé, Métiers) : chacun ouvre de nouvelles entreprises')
    if (s.examined >= 5 && s.found + s.toCall < s.examined / 3) tips.push('beaucoup d\'entreprises ne publient pas d\'e-mail : celles qui ont un téléphone sont dans « À appeler » (écran Prospects)')
    if (!s.pairsLeft && !s.skipped) tips.push('toute la zone de la semaine a été parcourue : la semaine prochaine, la zone suivante prendra le relais (ajoute une zone si tu n\'en as qu\'une)')
    return tips.length ? { found: s.found, examined: s.examined, tips: tips.slice(0, 3) } : null
}

// ---------- 4. Daily backup of the prospects ----------
export function backupState() {
    try {
        const folder = path.join(dataFolder, 'Sauvegardes')
        const file = path.join(folder, `prospects-${today()}.json`)
        if (fs.existsSync(file) || !fs.existsSync(stateFile)) return
        fs.mkdirSync(folder, { recursive: true })
        fs.copyFileSync(stateFile, file)
        const old = fs.readdirSync(folder).filter((f) => /^prospects-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().slice(0, -14)
        for (const f of old) fs.unlinkSync(path.join(folder, f))
    } catch (e) { log('Sauvegarde du jour impossible :', e.message) }
}
