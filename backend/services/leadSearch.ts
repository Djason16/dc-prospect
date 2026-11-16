// Research of new leads: keeps a reserve of ready prospects (first e-mail drafted), town by town and trade by trade in
// the zone of the week, with the AI engine or without AI; every business found is checked (e-mail, register, site).
import { cfg, today, daysBetween, record, log, saveState } from './base.js'
import { towns, hasMx, checkRegister, allowedBusinesses } from './web.js'
import { zoneOfTheWeek, zoneByName, activeTrades, isProfileComplete } from './settings.js'
import { checkText, capitalizeSubject } from './claude.js'
import { findOnTheWeb } from './aiSearch.js'
import { auditSite, levelFrom, pageSpeed, speedSignals } from './siteAudit.js'
import { discover, searchApiReady } from './discovery.js'
import { searchEngine, writingEngine, firstEmail, nextSubjectStyle, nextBodyStyle } from './writers.js'
import type { State, Prospect, Trade, Town, AllowedBusiness, FoundCompany } from '../types.js'

export const WEBMAILS = /@(gmail|googlemail|hotmail|outlook|live|yahoo|orange|wanadoo|free|sfr|laposte|icloud|me|aol|gmx|bbox|neuf)\./i
// STOP, or a domain of « never contact » (leadsTools.ts)
export const isStopped = (state: State, email: string | null | undefined) => !!email && (state.stop.includes(email.toLowerCase()) || (state.blockedDomains || []).includes(email.toLowerCase().split('@')[1]))

/** Where a lead was found: the pair searched and what the search knows */
export interface LeadContext {
    trade: Trade
    town: Pick<Town, 'name' | 'postalCode'>
    zoneName: string
    day: string
    known: Set<string>
    allowed: AllowedBusiness[] | null | undefined
    onProgress: (text: string) => void
}
export type LeadOutcome = 'ready' | 'call' | 'discarded' | null

// ---------- 2. Research: keep a reserve of ready prospects (first e-mail drafted) ----------
// Main way: Claude searches the web for "trade + town" in the zone of the week and keeps small businesses that publish
// an e-mail on their own site. Each e-mail is checked (syntax, domain receives mail, not already known, not STOP),
// the business is looked up in the official register (closed or opposed to prospecting = out), then Sonnet writes the e-mail.
export async function search(state: State, { onProgress = () => {} }: { onProgress?: (text: string) => void } = {}): Promise<{ found: number, attempts: number, errors: number }> {
    const day = today()
    const ready = state.prospects.filter((p) => p.status === 'ready').length
    const budget = cfg.maxSearchesPerDay - (state.searchesPerDay[day] || 0)
    const missing = cfg.readyReserve - ready
    const nothing = { found: 0, attempts: 0, errors: 0 }
    if (missing <= 0 || budget <= 0) return nothing
    if (!isProfileComplete()) return nothing // nothing is searched before the profile is filled
    const zoneName = zoneOfTheWeek()
    const zone = zoneByName(zoneName)
    if (!zone || !zoneName) return nothing
    // (town, trade) pairs not searched in the last 60 days: big towns first, trades that bring the most first
    state.searchedPairs = state.searchedPairs || {}
    const zoneTowns = await towns(zone)
    const weights = yieldPerTrade(state)
    const trades = activeTrades().map((t) => ({ t, k: Math.random() ** (1 / (weights[t.name] || 0.3)) })).sort((a, b) => b.k - a.k).map((x) => x.t)
    const pairs: { town: Town, trade: Trade, key: string }[] = []
    const searchedPairs = state.searchedPairs
    // each town starts with a different trade (otherwise one round over the towns would search a single trade all day);
    // the best trades still come first for the biggest towns
    zoneTowns.forEach((town, i) => trades.slice(i % trades.length).concat(trades.slice(0, i % trades.length)).forEach((trade) => {
        const key = `${town.name}|${trade.name}`
        if (!searchedPairs[key] || daysBetween(searchedPairs[key], day) > 60) pairs.push({ town, trade, key })
    }))
    // spread over towns: one trade per town per round
    pairs.sort((a, b) => zoneTowns.indexOf(a.town) - zoneTowns.indexOf(b.town))
    const order: typeof pairs = []
    while (pairs.length && order.length < budget) {
        const seen = new Set<string>()
        for (let i = 0; i < pairs.length && order.length < budget;) {
            if (seen.has(pairs[i].town.name)) { i++; continue }
            seen.add(pairs[i].town.name); order.push(pairs.splice(i, 1)[0])
        }
    }
    const known = knownSet(state)
    const engine = searchEngine()
    let found = 0, attempts = 0, errors = 0, examined = 0, toCall = 0, skipped = 0, i = 0
    const worker = async () => {
        while (i < order.length && found < missing) {
            const { town, trade, key } = order[i++]
            searchedPairs[key] = day
            // 1. The register first (free): the businesses of this trade in this town that may be prospected. Nobody: no search
            const allowed = await allowedBusinesses(trade.naf, town.postalCode)
            if (allowed && !allowed.length) { skipped++; continue }
            attempts++
            state.searchesPerDay[day] = (state.searchesPerDay[day] || 0) + 1
            onProgress(`Recherche ${attempts}/${order.length} : ${trade.name} à ${town.name}${allowed ? ` (${allowed.length} entreprises autorisées)` : ''}`)
            let result: { companies?: FoundCompany[] }
            try {
                result = engine === 'free'
                    ? await discover({ trade: trade.name, town: town.name, allowed: allowed || [], known, max: 6 })
                    : await findOnTheWeb({ trade: trade.name, town: town.name, postalCode: town.postalCode, known: [...known], allowed })
            } catch (e) { errors++; log('Recherche en échec', key, (e as Error).message); if (errors >= 3 && errors === attempts) i = order.length; continue }
            for (const c of result.companies || []) {
                if (found >= missing) break
                examined++
                const outcome = await addLead(state, c, { trade, town, zoneName, day, known, allowed, onProgress })
                if (outcome === 'ready') found++
                if (outcome === 'call') toCall++
                try { saveState(state) } catch (err) { log('Sauvegarde impossible :', (err as Error).message) } // nothing lost if the PC shuts down
            }
        }
    }
    await Promise.all(Array.from({ length: cfg.parallelSearches }, worker))
    state.lastSearch = { day, engine, attempts, examined, found, toCall, skipped, errors, pairsLeft: order.length - attempts - skipped, brave: searchApiReady() }
    record(state, 'search', `${attempts} recherches (métier + ville) en ${zoneName}${engine === 'free' ? ' sans IA' : ''} : ${examined} entreprises examinées, ${found} prospects prêts${toCall ? `, ${toCall} à appeler` : ''}${skipped ? ` ; ${skipped} villes sans entreprise autorisée, passées sans recherche` : ''}`)
    return { found, attempts, errors }
}

// One business found by the search: checked (e-mail, register, site), then ready (first e-mail written), to call, or set aside.
// Returns 'ready' | 'call' | 'discarded' | null (ignored: already known, invalid e-mail...)
export async function addLead(state: State, c: FoundCompany, { trade, town, zoneName, day, known, allowed, onProgress }: LeadContext): Promise<LeadOutcome> {
    let email = String(c.email || '').trim().toLowerCase().replace(/^mailto:/, '')
    const domain = c.website ? domainOf(c.website) : null
    if (domain && known.has(domain)) return null
    // 2. The site, read without AI: the e-mails really published and the signs of a need (checks what the AI said)
    const audit = c.audit !== undefined ? c.audit : (c.website ? await auditSite(c.website, { town: town.name }) : null)
    if (audit?.emails?.length && email && !audit.emails.includes(email)) {
        // an e-mail of the AI that the site does not show: the one published on the site wins (never a guessed address)
        const own = audit.emails.find((e) => domain && e.endsWith('@' + domain)) || audit.emails[0]
        log(`E-mail de ${c.name} corrigé d'après son site : ${email} -> ${own}`)
        email = own
    }
    if (!email && audit?.emails?.length) email = audit.emails[0]
    const validEmail = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(email) && !/\.(png|jpe?g|gif|webp)$/.test(email) && !/example|exemple|domain|votre|wix|sentry/i.test(email)
    const phone = c.phone || audit?.phones?.[0] || null
    if (!validEmail && !phone) return null
    if (validEmail && (known.has(email) || isStopped(state, email))) return null
    if (validEmail && (await hasMx(email)) === false) { log('E-mail sans serveur de réception, ignoré :', email); if (!phone) return null }
    // 3. The register: the allowed list when the name matches it, otherwise one check by name
    const fromList = c.siren ? allowed?.find((a) => a.siren === c.siren) : matchAllowed(c.name, allowed)
    const register = fromList ? { siren: fromList.siren, closed: false, opposed: false, establishments: 1 } : await checkRegister(c.name, c.postalCode || town.postalCode)
    const id = register?.siren || `web-${domain || email || phone}`
    if (validEmail) known.add(email)
    if (domain) known.add(domain)
    if (state.prospects.some((x) => x.id === id) || (state.forgottenIds || []).includes(id)) return null
    const signals = [...(audit?.signals || []), ...(c.signal ? [c.signal] : [])]
    const p: Prospect = {
        id, status: 'ready', company: c.name, legalName: c.name, trade: trade.name, city: c.city || town.name, postalCode: c.postalCode || town.postalCode, zone: zoneName,
        address: c.city || town.name, source: c.audit !== undefined ? 'Registre + recherche web + site (sans IA)' : 'Recherche web + registre + site', addedOn: day, steps: {}, drafts: {},
        email: validEmail ? email : null, emailSource: validEmail ? (audit?.emails?.includes(email) ? audit.finalUrl : c.emailSource) : null, emailChecked: !!(validEmail && audit?.emails?.includes(email)),
        contact: c.contact || fromList?.contact || null, website: c.website, platform: audit?.platform || c.platform, usesBooking: c.usesBooking,
        phone, signal: [...new Set(signals)].join(' ; '), googleRating: c.googleRating, socials: c.socials, detail: c.detail,
        score: audit ? Math.round(((Number(c.score) || audit.needScore) + audit.needScore) / 2) : Number(c.score) || 0, level: levelFrom(audit, c.level), pack: c.pack,
        siren: register?.siren || null, audit: audit ? { signals: audit.signals, platform: audit.platform, https: audit.https, mobile: audit.mobile, ms: audit.ms, copyrightYear: audit.copyrightYear, checkedOn: audit.checkedOn, tagline: audit.tagline } : null,
    }
    if (register && (register.closed || register.opposed || (register.establishments || 1) > 3)) {
        p.status = 'discarded'; p.reason = register.closed ? 'fermée au registre' : register.opposed ? 'refuse la prospection (registre)' : 'plusieurs établissements (chaîne)'
        state.prospects.push(p)
        return 'discarded'
    }
    // 4. Speed and SEO measured by Google (PageSpeed, optional key): only for the leads that will be written to
    if (validEmail && audit?.reachable && p.audit) {
        const speed = await pageSpeed(audit.finalUrl)
        if (speed) {
            const extra = speedSignals(speed)
            p.audit.speed = speed
            p.audit.signals = [...extra.signals, ...p.audit.signals]
            p.signal = [...new Set([...extra.signals, ...p.signal.split(' ; ').filter(Boolean)])].join(' ; ')
            p.score = Math.min(5, Math.round(p.score + extra.score))
        }
    }
    if (!validEmail) {
        // no published e-mail: on the call list, with an opening sentence
        p.status = 'otherChannel'; p.callHook = c.callHook || null
        state.prospects.push(p)
        return 'call'
    }
    try {
        onProgress(`Rédaction du 1er e-mail : ${c.name} (${p.city})`)
        const subjectStyle = nextSubjectStyle(state), bodyStyle = nextBodyStyle(state)
        const mail = await firstEmail(p, { subjectStyle, bodyStyle: bodyStyle || 'standard' })
        p.status = 'ready'
        p.drafts.first = { subject: capitalizeSubject(mail.subject), body: mail.body, status: 'reserved', preparedOn: day, subjectStyle, ...(bodyStyle ? { bodyStyle } : {}), writer: writingEngine(), problems: checkText(capitalizeSubject(mail.subject), mail.body) }
    } catch (err) { p.status = 'discarded'; p.reason = 'rédaction impossible : ' + (err as Error).message.slice(0, 100) }
    state.prospects.push(p)
    return p.status === 'ready' ? 'ready' : 'discarded'
}

// The business of the allowed list that has the same name (half of its words at least), or null
const words = (s: string | null | undefined) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter((w) => w.length > 2)
function matchAllowed(name: string, allowed: AllowedBusiness[] | null | undefined): AllowedBusiness | null {
    const mine = words(name)
    if (!mine.length || !allowed?.length) return null
    return allowed.find((a) => { const theirs = new Set([...words(a.name), ...words(a.legalName)]); return mine.filter((w) => theirs.has(w)).length >= Math.ceil(mine.length / 2) }) || null
}

// E-mails and domains already known (prospects, and the « never contact » domains): never written to twice
export const knownSet = (state: State) => new Set<string>([...state.prospects.flatMap((p) => [p.email, p.email?.split('@')[1], p.website && domainOf(p.website)]).filter((x): x is string => !!x).filter((x) => x.includes('@') || !WEBMAILS.test('@' + x)), ...(state.blockedDomains || [])])

const domainOf = (u: string) => { try { return new URL(u.startsWith('http') ? u : 'https://' + u).hostname.replace(/^www\./, '').toLowerCase() } catch { return null } }

// Yield of each trade, used to search the best ones first: share of useful leads (e-mail = 1, phone only = 0.4), with a
// prior so new trades get tried; once 10 e-mails of a trade went out, its reply rate counts too (what really matters)
export function yieldPerTrade(state: State): Record<string, number> {
    const result: Record<string, number> = {}
    for (const t of activeTrades()) {
        const ps = state.prospects.filter((p) => p.trade === t.name && p.addedOn)
        const useful = ps.filter((p) => p.status !== 'discarded' && p.status !== 'otherChannel').length + 0.4 * ps.filter((p) => p.status === 'otherChannel').length
        const leads = (useful + 1) / (ps.length + 3)
        const contacted = ps.filter((p) => p.steps?.first).length
        const replies = ps.filter((p) => p.reply && p.reply.kind !== 'no').length
        result[t.name] = Math.max(0.05, contacted >= 10 ? 0.4 * leads + 0.6 * Math.min(1, (replies / contacted) * 6) : leads)
    }
    return result
}
