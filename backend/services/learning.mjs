// Internal AI of DC Prospect: it learns from the user's own results, on this PC, without any model to download.
//   - replyModel: a small logistic regression that estimates the chance of a reply of each prospect (trade, site, level...)
//     and orders the batch of the day; retrained each week, it also says what makes people reply (insights).
//   - pickArm: Thompson sampling (a "bandit"): the subject style that makes people reply is used more and more.
//   - replyKind: kind of a reply (interested, question, later, no), rules first, then a naive Bayes trained on the
//     kinds the user confirmed or that his tracking shows (call, client... = interested; declined = no).
//   - bestMoments, sendingHealth: when replies come, and bounces or STOP that rise (the sending slows down by itself).
import { today, daysBetween, log } from './base.mjs'

const WEBMAIL = /@(gmail|googlemail|hotmail|outlook|live|yahoo|orange|wanadoo|free|sfr|laposte|icloud|me|aol|gmx|bbox|neuf)\./i
const BUILDERS = ['Wix', 'Jimdo', 'Google Sites', 'Canva', 'Site Pages Jaunes', 'Webnode', 'Hostinger', 'Squarespace']

// ---------- Outcome of a first e-mail ----------
const contacted = (p) => !!p.steps?.first?.sentOn
// A real answer (not a refusal nor a STOP)
export const goodReply = (p) => !!p.reply && p.reply.kind !== 'no' && p.status !== 'stopped'
// Known outcome: a reply, or 14 days without one (follow-ups included, most replies come before)
const settled = (p, day) => contacted(p) && (!!p.reply || p.status === 'stopped' || daysBetween(p.steps.first.sentOn, day) >= 14)

// ---------- 1. Bandit (Thompson sampling) ----------
function normal() { let u = 0; while (!u) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random()) }
// Gamma(k, 1) by Marsaglia and Tsang
function gamma(k) {
    if (k < 1) return gamma(k + 1) * Math.random() ** (1 / k)
    const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d)
    for (;;) {
        let x, v
        do { x = normal(); v = 1 + c * x } while (v <= 0)
        v = v ** 3
        const u = Math.random()
        if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
    }
}
const beta = (a, b) => { const x = gamma(a), y = gamma(b); return x / (x + y) }

// Per arm: given (drafts made), settled (outcome known), wins (good replies)
export function armStats(state, arms, armOf) {
    const day = today()
    const stats = Object.fromEntries(arms.map((a) => [a, { given: 0, settled: 0, wins: 0 }]))
    for (const p of state.prospects) {
        const s = stats[armOf(p)]
        if (!s) continue
        s.given++
        if (settled(p, day)) { s.settled++; if (goodReply(p)) s.wins++ }
    }
    return stats
}

// The arm to use now: each arm is tried 10 times first, then the one that makes people reply wins more and more often
export function pickArm(state, arms, armOf) {
    const stats = armStats(state, arms, armOf)
    const fresh = arms.filter((a) => stats[a].given < 10)
    if (fresh.length) return fresh.sort((a, b) => stats[a].given - stats[b].given)[0]
    return arms.map((a) => [a, beta(1 + stats[a].wins, 1 + stats[a].settled - stats[a].wins)]).sort((x, y) => y[1] - x[1])[0][0]
}

// ---------- 2. Chance of a reply: logistic regression on the user's own results ----------
export function features(p) {
    const a = p.audit || {}
    const year = new Date().getFullYear()
    const platform = !p.website ? 'aucun site' : BUILDERS.includes(a.platform) ? 'outil gratuit' : a.platform === 'WordPress' ? 'WordPress' : a.platform === 'Planity' ? 'page de réservation' : 'site sur mesure'
    const f = {
        bias: 1, need: (Number(p.score) || 0) / 5, hot: p.level === 'CHAUD' ? 1 : 0, cold: p.level === 'FROID' ? 1 : 0,
        noHttps: a.https === false ? 1 : 0, noMobile: a.mobile === false ? 1 : 0, slow: a.ms > 4000 || a.speed?.performance < 50 ? 1 : 0,
        old: a.copyrightYear && a.copyrightYear <= year - 3 ? 1 : 0, checked: p.emailChecked ? 1 : 0, webmail: WEBMAIL.test(p.email || '') ? 1 : 0,
        named: p.contact ? 1 : 0, styleB: p.drafts?.first?.subjectStyle === 'B' ? 1 : 0, ai: p.drafts?.first?.writer === 'ai' ? 1 : 0,
    }
    f[`trade:${p.trade}`] = 1
    f[`platform:${platform}`] = 1
    return f
}

// Names of the features shown to the user (French)
const LABELS = {
    need: 'score de besoin élevé', hot: 'prospects chauds', cold: 'prospects froids', noHttps: 'site sans https', noMobile: 'site pas adapté au téléphone',
    slow: 'site lent', old: 'site pas mis à jour', checked: 'e-mail vu sur leur site', webmail: 'adresse Gmail, Orange...', named: 'prénom du gérant connu',
    styleB: 'objet style B', ai: 'e-mail écrit par l\'IA',
}
const label = (k) => LABELS[k] || k.replace(/^trade:/, 'métier ').replace(/^platform:/, '')

const sigmoid = (z) => 1 / (1 + Math.exp(-z))
const dot = (w, f) => Object.entries(f).reduce((s, [k, v]) => s + (w[k] || 0) * v, 0)

// Trained when at least 30 outcomes and 3 good replies are known; null before
export function trainReplyModel(state) {
    const day = today()
    const rows = state.prospects.filter((p) => settled(p, day)).map((p) => ({ f: features(p), y: goodReply(p) ? 1 : 0 }))
    const positives = rows.filter((r) => r.y).length
    if (rows.length < 30 || positives < 3) return null
    // Weighted classes: replies are rare (a few %), without weights the model would only say "no reply"
    const wPos = (rows.length - positives) / positives
    const w = {}
    const rate = 0.5, l2 = 0.05
    for (let epoch = 0; epoch < 400; epoch++) {
        const grad = {}
        for (const r of rows) {
            const err = (sigmoid(dot(w, r.f)) - r.y) * (r.y ? wPos : 1)
            for (const [k, v] of Object.entries(r.f)) grad[k] = (grad[k] || 0) + err * v
        }
        const total = rows.length * (1 + wPos) / 2
        for (const k of Object.keys(grad)) w[k] = (w[k] || 0) - rate * (grad[k] / total + (k === 'bias' ? 0 : l2 * (w[k] || 0)))
    }
    // the weighting shifts the bias: put it back so the chance matches the real reply rate
    w.bias -= Math.log(wPos)
    return { weights: w, n: rows.length, positives, baseRate: positives / rows.length, trainedOn: day }
}

// Model kept in the state, retrained each week or after 10 new outcomes
export function replyModel(state) {
    const day = today()
    const m = state.replyModel
    const known = state.prospects.filter((p) => settled(p, day)).length
    if (m && daysBetween(m.trainedOn, day) < 7 && known < m.n + 10) return m
    try {
        state.replyModel = trainReplyModel(state)
        if (state.replyModel) log(`Modèle de réponse réentraîné : ${state.replyModel.n} résultats, ${state.replyModel.positives} réponses`)
    } catch (e) { log('Modèle de réponse non entraîné :', e.message) }
    return state.replyModel
}

// Estimated chance of a good reply (0 to 1), or null without a model
export const replyChance = (model, p) => (model ? sigmoid(dot(model.weights, features(p))) : null)

// What the model learned: what helps and what hurts the most (French sentences for the user)
export function insights(model) {
    if (!model) return null
    const effects = Object.entries(model.weights).filter(([k]) => k !== 'bias' && Math.abs(model.weights[k]) > 0.15).sort((a, b) => b[1] - a[1])
    return {
        n: model.n, positives: model.positives, trainedOn: model.trainedOn,
        helps: effects.filter(([, v]) => v > 0).slice(0, 4).map(([k]) => label(k)),
        hurts: effects.filter(([, v]) => v < 0).slice(-4).reverse().map(([k]) => label(k)),
    }
}

// ---------- 3. Kind of a reply ----------
export function ruleKind(text) {
    const t = String(text || '').toLowerCase()
    if (/pas int[ée]ress|non merci|aucun besoin|pas besoin|d[ée]j[aà] (un|une|quelqu)|on a d[ée]j[aà]|ne m'int[ée]resse/.test(t)) return 'no'
    if (/plus tard|pas pour (le moment|l'instant|maintenant)|dans (quelques|\d+) (mois|semaines)|rentr[ée]e|l'ann[ée]e prochaine|recontact/.test(t)) return 'later'
    if (/int[ée]ress|volontiers|avec plaisir|pourquoi pas|d'accord|ok pour|appel|rendez-vous|rdv|disponible|quand (pouvez|voulez)/.test(t)) return 'interested'
    return 'question'
}

// Kind known for sure: confirmed on the card, or shown by what happened next
export function knownKind(p) {
    if (!p.reply) return null
    if (p.reply.kindConfirmed) return p.reply.kind
    const t = p.tracking || {}
    if (t.client || t.proposal || t.call || t.mockup) return 'interested'
    if (t.result === 'Refus') return 'no'
    return null
}

const tokens = (text) => String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2)

// Naive Bayes on the known kinds; used instead of the rules when it is sure (80 %) and has 15 examples or more
export function replyKind(state, text) {
    const examples = state.prospects.map((p) => [knownKind(p), p.reply?.excerpt]).filter(([k, t]) => k && t)
    const classes = [...new Set(examples.map(([k]) => k))]
    if (examples.length < 15 || classes.length < 2) return ruleKind(text)
    const counts = {}, totals = {}, docs = {}, vocab = new Set()
    for (const [k, t] of examples) {
        docs[k] = (docs[k] || 0) + 1
        counts[k] = counts[k] || {}
        for (const w of tokens(t)) { counts[k][w] = (counts[k][w] || 0) + 1; totals[k] = (totals[k] || 0) + 1; vocab.add(w) }
    }
    const words = tokens(text)
    const scores = classes.map((k) => [k, Math.log(docs[k] / examples.length) + words.reduce((s, w) => s + Math.log(((counts[k][w] || 0) + 1) / ((totals[k] || 0) + vocab.size)), 0)])
    const max = Math.max(...scores.map(([, s]) => s))
    const sum = scores.reduce((s, [, v]) => s + Math.exp(v - max), 0)
    const [best, score] = scores.sort((a, b) => b[1] - a[1])[0]
    return Math.exp(score - max) / sum >= 0.8 ? best : ruleKind(text)
}

// ---------- 4. When replies come, and the health of the sending ----------
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
// Reply rate of the first e-mails by day of the week and part of the day (from 40 known outcomes)
export function bestMoments(state) {
    const day = today()
    const rows = state.prospects.filter((p) => settled(p, day) && p.steps.first.at)
    if (rows.length < 40) return null
    const group = (keyOf) => {
        const g = {}
        for (const p of rows) { const k = keyOf(new Date(p.steps.first.at)); g[k] = g[k] || { moment: k, sent: 0, replies: 0 }; g[k].sent++; if (goodReply(p)) g[k].replies++ }
        return Object.values(g).filter((x) => x.sent >= 8).map((x) => ({ ...x, replyRate: x.replies / x.sent })).sort((a, b) => b.replyRate - a.replyRate)
    }
    return { days: group((d) => DAYS[d.getDay()]), parts: group((d) => (d.getHours() < 12 ? 'le matin' : 'l\'après-midi')) }
}

// Bounces and STOP of the last 50 first e-mails (30 days): too many = the sending slows down by half, the user is told
export function sendingHealth(state) {
    const day = today()
    const recent = state.prospects.filter((p) => contacted(p) && daysBetween(p.steps.first.sentOn, day) <= 30)
        .sort((a, b) => b.steps.first.sentOn.localeCompare(a.steps.first.sentOn)).slice(0, 50)
    const bounces = recent.filter((p) => /adresse invalide/.test(p.reason || '')).length
    const stops = recent.filter((p) => p.status === 'stopped').length
    const n = recent.length
    const health = { sent: n, bounceRate: n ? bounces / n : 0, stopRate: n ? stops / n : 0, slowed: false, advice: [] }
    if (n < 20) return health
    if (health.bounceRate > 0.05) health.advice.push(`${Math.round(health.bounceRate * 100)} % d'e-mails revenus (adresses invalides) : au-delà de 5 %, les messageries te prennent pour un spammeur.`)
    if (health.stopRate > 0.08) health.advice.push(`${Math.round(health.stopRate * 100)} % de STOP : les e-mails semblent trop génériques ou mal ciblés (métiers, zone, constat).`)
    health.slowed = health.advice.length > 0
    if (health.slowed) health.advice.push('DC Prospect envoie deux fois moins d\'e-mails par jour jusqu\'à ce que ça s\'améliore.')
    return health
}
