// The plan, step by step: replies and STOP, research, drafts, batch of the day, sending queue
import { cfg, today, addDays, daysBetween, isSendDay, inSendWindow, dateOf, record, log, saveState } from './base.mjs'
import { towns, hasMx, checkRegister } from './web.mjs'
import { zoneOfTheWeek, zoneByName, activeTrades, fullName, isProfileComplete } from './settings.mjs'
import { findOnTheWeb, writeFirstEmail, writeFollowUp, checkText, capitalizeSubject } from './claude.mjs'
import { send, readReplies } from './mail.mjs'

const WEBMAILS = /@(gmail|googlemail|hotmail|outlook|live|yahoo|orange|wanadoo|free|sfr|laposte|icloud|me|aol|gmx|bbox|neuf)\./i
const STEPS = ['first', 'followUp1', 'followUp2']
// Names of the steps shown to the user
export const STEP_NAME = { first: '1er e-mail', followUp1: 'Relance 1', followUp2: 'Relance 2' }

export const findProspect = (state, id) => state.prospects.find((p) => p.id === id)
export const sentOn = (state, day = today()) => state.sendsPerDay[day] || 0
const isStopped = (state, email) => !!email && state.stop.includes(email.toLowerCase())

// Next step of a prospect in sequence and the day it is due
export function nextStep(p) {
    if (!['ready', 'inSequence'].includes(p.status)) return null
    const firstSent = p.steps?.first?.sentOn
    if (!firstSent) return { step: 'first', due: null }
    if (!p.steps.followUp1) return { step: 'followUp1', due: addDays(firstSent, cfg.followUpDays.first) }
    if (!p.steps.followUp2) return { step: 'followUp2', due: addDays(firstSent, cfg.followUpDays.second) }
    return null
}

// ---------- 1. Replies, STOP, bounces ----------
export async function syncReplies(state) {
    const addresses = new Set(state.prospects.filter((p) => p.email && p.steps?.first).map((p) => p.email.toLowerCase()))
    const domains = new Set([...addresses].filter((a) => !WEBMAILS.test(a)).map((a) => a.split('@')[1]))
    if (!addresses.size) return 0
    const messages = await readReplies(30, (e) => !state.seenMessages.includes(e.id) && (e.bounce || addresses.has(e.from) || domains.has(e.from.split('@')[1])))
    let changed = 0
    for (const m of messages) {
        if (state.seenMessages.includes(m.id)) continue
        state.seenMessages.push(m.id)
        const contacted = state.prospects.filter((p) => p.email && p.steps?.first)
        if (m.bounce) {
            const p = contacted.find((x) => m.text.toLowerCase().includes(x.email.toLowerCase()))
            if (p && p.status !== 'stopped') {
                p.status = 'discarded'; p.reason = 'adresse invalide (e-mail revenu)'
                record(state, 'bounce', `${p.company} : adresse ${p.email} invalide, séquence arrêtée`, { id: p.id })
                changed++
            }
            continue
        }
        const domain = (e) => e.split('@')[1]
        const p = contacted.find((x) => x.email.toLowerCase() === m.from) ||
            contacted.find((x) => !WEBMAILS.test(m.from) && domain(x.email.toLowerCase()) === domain(m.from))
        if (!p) continue
        if (/réponse automatique|absence|out of office|automatic reply|autoreply/i.test(m.subject)) continue
        // Only the new text, not the quoted e-mail
        const newText = m.text.split(/\n>|\nLe .{5,80}a écrit|\nOn .{5,80}wrote|-----Original/)[0]
        const wantsStop = /\bstop\b|d[ée]sinscri|ne (plus|pas) (me |nous )?(contacter|[ée]crire|recevoir|solliciter)/i.test(`${m.subject}\n${newText}`)
        p.reply = { date: m.date?.slice(0, 10) || today(), subject: m.subject, excerpt: newText.replace(/\s+/g, ' ').trim().slice(0, 400), read: false }
        if (wantsStop) {
            p.status = 'stopped'; p.stoppedOn = today()
            if (!state.stop.includes(p.email.toLowerCase())) state.stop.push(p.email.toLowerCase())
            record(state, 'stop', `${p.company} a répondu STOP : retiré pour toujours`, { id: p.id })
        } else if (p.status !== 'stopped') {
            p.status = 'replied'
            record(state, 'reply', `${p.company} a répondu : à traiter`, { id: p.id })
        }
        for (const s of STEPS) if (['approved', 'toApprove'].includes(p.drafts?.[s]?.status)) p.drafts[s].status = 'cancelled'
        changed++
    }
    return changed
}

// ---------- 2. Research: keep a reserve of ready prospects (first e-mail drafted) ----------
// Main way: Claude searches the web for "trade + town" in the zone of the week and keeps small businesses that publish
// an e-mail on their own site. Each e-mail is checked (syntax, domain receives mail, not already known, not STOP),
// the business is looked up in the official register (closed or opposed to prospecting = out), then Sonnet writes the e-mail.
export async function search(state, { onProgress = () => {} } = {}) {
    const day = today()
    const ready = state.prospects.filter((p) => p.status === 'ready').length
    const budget = cfg.maxSearchesPerDay - (state.searchesPerDay[day] || 0)
    const missing = cfg.readyReserve - ready
    const nothing = { found: 0, attempts: 0, errors: 0 }
    if (missing <= 0 || budget <= 0) return nothing
    if (!isProfileComplete()) return nothing // nothing is searched before the profile is filled
    const zoneName = zoneOfTheWeek()
    const zone = zoneByName(zoneName)
    if (!zone) return nothing
    // (town, trade) pairs not searched in the last 60 days: big towns first, trades that bring the most first
    state.searchedPairs = state.searchedPairs || {}
    const zoneTowns = await towns(zone)
    const weights = yieldPerTrade(state)
    const trades = activeTrades().map((t) => ({ t, k: Math.random() ** (1 / (weights[t.name] || 0.3)) })).sort((a, b) => b.k - a.k).map((x) => x.t)
    const pairs = []
    for (const town of zoneTowns) for (const trade of trades) {
        const key = `${town.name}|${trade.name}`
        if (!state.searchedPairs[key] || daysBetween(state.searchedPairs[key], day) > 60) pairs.push({ town, trade, key })
    }
    // spread over towns: one trade per town per round
    pairs.sort((a, b) => zoneTowns.indexOf(a.town) - zoneTowns.indexOf(b.town))
    const order = []
    while (pairs.length && order.length < budget) {
        const seen = new Set()
        for (let i = 0; i < pairs.length && order.length < budget;) {
            if (seen.has(pairs[i].town.name)) { i++; continue }
            seen.add(pairs[i].town.name); order.push(pairs.splice(i, 1)[0])
        }
    }
    const known = new Set(state.prospects.flatMap((p) => [p.email, p.email?.split('@')[1], p.website && domainOf(p.website)]).filter(Boolean).filter((x) => x.includes('@') || !WEBMAILS.test('@' + x)))
    let found = 0, attempts = 0, errors = 0, examined = 0, i = 0
    const worker = async () => {
        while (i < order.length && found < missing) {
            const { town, trade, key } = order[i++]
            attempts++
            state.searchesPerDay[day] = (state.searchesPerDay[day] || 0) + 1
            state.searchedPairs[key] = day
            onProgress(`Recherche ${attempts}/${order.length} : ${trade.name} à ${town.name}`)
            let result
            try { result = await findOnTheWeb({ trade: trade.name, town: town.name, postalCode: town.postalCode, known: [...known] }) } catch (e) { errors++; log('Recherche en échec', key, e.message); if (errors >= 3 && errors === attempts) i = order.length; continue }
            for (const c of result.companies || []) {
                if (found >= missing) break
                examined++
                const email = String(c.email || '').trim().toLowerCase().replace(/^mailto:/, '')
                const domain = c.website ? domainOf(c.website) : null
                if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(email) || /\.(png|jpe?g|gif|webp)$/.test(email) || /example|exemple|domain|votre|wix|sentry/i.test(email)) continue
                if (known.has(email) || (domain && known.has(domain)) || isStopped(state, email)) continue
                if ((await hasMx(email)) === false) { log('E-mail sans serveur de réception, ignoré :', email); continue }
                const register = await checkRegister(c.name, c.postalCode || town.postalCode)
                const id = register?.siren || `web-${domain || email}`
                known.add(email); if (domain) known.add(domain)
                if (state.prospects.some((x) => x.id === id) || (state.forgottenIds || []).includes(id)) continue
                const p = {
                    id, company: c.name, legalName: c.name, trade: trade.name, city: c.city || town.name, postalCode: c.postalCode || town.postalCode, zone: zoneName,
                    address: c.city || town.name, source: 'Recherche web + registre', addedOn: day, steps: {}, drafts: {},
                    email, emailSource: c.emailSource, contact: c.contact, website: c.website, platform: c.platform, usesBooking: c.usesBooking,
                    phone: c.phone, signal: c.signal, googleRating: c.googleRating, socials: c.socials, detail: c.detail,
                    score: Number(c.score) || 0, level: c.level, pack: c.pack, siren: register?.siren || null,
                }
                if (register?.closed || register?.opposed || (register?.establishments || 1) > 3) {
                    p.status = 'discarded'; p.reason = register.closed ? 'fermée au registre' : register.opposed ? 'refuse la prospection (registre)' : 'plusieurs établissements (chaîne)'
                } else {
                    try {
                        onProgress(`Rédaction du 1er e-mail : ${c.name} (${p.city})`)
                        const mail = await writeFirstEmail(p)
                        p.status = 'ready'
                        p.drafts.first = { subject: capitalizeSubject(mail.subject), body: mail.body, status: 'reserved', preparedOn: day, problems: checkText(mail.subject, mail.body) }
                        found++
                    } catch (err) { p.status = 'discarded'; p.reason = 'rédaction impossible : ' + err.message.slice(0, 100) }
                }
                state.prospects.push(p)
                try { saveState(state) } catch (err) { log('Sauvegarde impossible :', err.message) } // nothing lost if the PC shuts down
            }
            try { saveState(state) } catch {}
        }
    }
    await Promise.all(Array.from({ length: cfg.parallelSearches }, worker))
    record(state, 'search', `${attempts} recherches (métier + ville) en ${zoneName} : ${examined} entreprises avec e-mail examinées, ${found} prospects prêts`)
    return { found, attempts, errors }
}

const domainOf = (u) => { try { return new URL(u.startsWith('http') ? u : 'https://' + u).hostname.replace(/^www\./, '').toLowerCase() } catch { return null } }

// Share of useful leads per trade (e-mail = 1, phone only = 0.4), with a prior so new trades get tried
export function yieldPerTrade(state) {
    const result = {}
    for (const t of activeTrades()) {
        const ps = state.prospects.filter((p) => p.trade === t.name && p.addedOn)
        const useful = ps.filter((p) => p.status !== 'discarded' && p.status !== 'otherChannel').length + 0.4 * ps.filter((p) => p.status === 'otherChannel').length
        result[t.name] = Math.max(0.05, (useful + 1) / (ps.length + 3))
    }
    return result
}

// ---------- 3. Batch of the day (send days only): follow-ups due, then first e-mails ----------
export async function prepareBatch(state, { onProgress = () => {} } = {}) {
    const day = today()
    if (!isSendDay(day)) return { followUps: 0, firsts: 0 }
    // first e-mails not approved on a previous day go back to the reserve
    for (const p of state.prospects) {
        const d = p.drafts?.first
        if (p.status === 'ready' && d?.status === 'toApprove' && d.batch !== day) { d.status = 'reserved'; delete d.batch }
    }
    const alreadyInBatch = state.prospects.filter((p) => STEPS.some((s) => p.drafts?.[s]?.batch === day && p.drafts[s].status !== 'cancelled')).length
    let room = cfg.maxEmailsPerDay - Math.max(alreadyInBatch, sentOn(state))
    let followUps = 0
    for (const p of state.prospects) {
        const n = nextStep(p)
        if (!n || n.step === 'first' || n.due > day || room <= 0) continue
        if (p.drafts[n.step] && p.drafts[n.step].status !== 'rejected') continue
        onProgress(`Rédaction de la ${STEP_NAME[n.step].toLowerCase()} : ${p.company}`)
        try {
            const r = await writeFollowUp(p, n.step)
            p.drafts[n.step] = { subject: replySubject(capitalizeSubject(p.drafts.first.subject)), body: r.body, status: 'toApprove', batch: day, preparedOn: day, problems: checkText('', r.body) }
            room--; followUps++
        } catch (e) { log('Relance non rédigée', p.company, e.message) }
    }
    const quota = Math.min(cfg.firstEmailsPerDay[dateOf(day).getDay()] || 0, room)
    const zone = zoneOfTheWeek()
    const chosen = state.prospects
        .filter((p) => p.status === 'ready' && p.drafts?.first?.status === 'reserved')
        .sort((a, b) => (b.zone === zone) - (a.zone === zone) || b.score - a.score || a.addedOn.localeCompare(b.addedOn))
        .slice(0, Math.max(0, quota))
    for (const p of chosen) Object.assign(p.drafts.first, { status: 'toApprove', batch: day })
    if (followUps || chosen.length) record(state, 'batch', `Lot du jour : ${chosen.length} premiers e-mails et ${followUps} relances à valider`)
    return { followUps, firsts: chosen.length }
}

const replySubject = (s) => (/^re\s*:/i.test(s || '') ? s : `Re: ${s}`)

// Drafts waiting for my approval, today's batch first
export function toApprove(state) {
    const list = []
    for (const p of state.prospects) for (const s of STEPS) {
        const d = p.drafts?.[s]
        if (d?.status === 'toApprove') list.push({ p, step: s, draft: d })
    }
    return list.sort((x, y) => (x.draft.batch || '').localeCompare(y.draft.batch || '') || STEPS.indexOf(y.step) - STEPS.indexOf(x.step) || y.p.score - x.p.score)
}

export function sendQueue(state) {
    const list = []
    for (const p of state.prospects) for (const s of STEPS) if (p.drafts?.[s]?.status === 'approved') list.push({ p, step: s, draft: p.drafts[s] })
    return list.sort((x, y) => (x.draft.approvedAt || '').localeCompare(y.draft.approvedAt || ''))
}

// ---------- 4. Send one approved e-mail if we are in a sending window ----------
export async function sendNext(state) {
    const day = today()
    if (!inSendWindow()) return null
    if (sentOn(state) >= cfg.maxEmailsPerDay) return null
    const sinceLast = state.lastSentAt ? Date.now() - new Date(state.lastSentAt).getTime() : Infinity
    const [min, max] = cfg.gapMinutes
    if (sinceLast < (state.nextGapMinutes || min) * 60e3) return null
    const next = sendQueue(state).find(({ p }) => ['ready', 'inSequence'].includes(p.status) && !isStopped(state, p.email))
    if (!next) return null
    const { p, step, draft } = next
    const first = p.steps.first
    const sent = await send({
        to: p.email, subject: capitalizeSubject(draft.subject), body: draft.body, signature: 'main', stop: true,
        inReplyTo: step === 'first' ? undefined : first.messageId,
        threadId: step === 'first' ? undefined : first.threadId,
        quote: step === 'first' ? undefined : { header: `Le ${dateOf(first.sentOn).toLocaleDateString('fr-FR')}, ${fullName() || cfg.sender.name} a écrit :`, text: p.drafts.first.body },
    })
    p.steps[step] = { sentOn: day, messageId: sent.messageId, threadId: sent.threadId, subject: draft.subject }
    draft.status = 'sent'
    p.status = step === 'followUp2' ? 'finished' : 'inSequence'
    state.sendsPerDay[day] = sentOn(state) + 1
    state.lastSentAt = new Date().toISOString()
    state.nextGapMinutes = min + Math.random() * (max - min)
    record(state, 'send', `${STEP_NAME[step]} envoyé à ${p.company} (${p.email})`, { id: p.id })
    return next
}

// ---------- 5. Data rule of the plan: forget leads without reply after 12 months ----------
export function forgetOldLeads(state) {
    const limit = addDays(today(), -cfg.forgetAfterDays)
    state.forgottenIds = state.forgottenIds || []
    const keep = []
    for (const p of state.prospects) {
        const date = p.steps?.first?.sentOn || p.addedOn
        const old = date < limit && ['discarded', 'finished', 'inSequence', 'ready'].includes(p.status) && !p.reply
        if (old) state.forgottenIds.push(p.id); else keep.push(p)
    }
    const n = state.prospects.length - keep.length
    state.prospects = keep
    if (n) record(state, 'gdpr', `${n} prospects sans réponse depuis 12 mois supprimés`)
}
