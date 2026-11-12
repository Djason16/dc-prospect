// Search WITHOUT AI (Settings, Moteur, « Recherche sans IA »): the official register gives the businesses that may be
// prospected in a town (web.mjs allowedBusinesses), then the website of each one is found:
//   - with the Brave Search API when its key is typed in the app (free credit of 5 dollars a month, about 1,000 searches);
//   - otherwise, and when the quota is reached, WITHOUT ANY KEY: the usual addresses made from its name
//     (boulangerie-dupont.fr, boulangeriedupont.com...) are tried, and kept only if the page names the business and its town.
// Then the site audit reads the e-mail, the phone and the signs of a need (siteAudit.mjs).
// Same answer as the AI search (claude.mjs findOnTheWeb): { companies: [...] }.
import dns from 'node:dns/promises'
import { log } from './base.mjs'
import { fullName, profile } from './settings.mjs'
import { readSecret, hasSecret } from './vault.mjs'
import { auditSite, levelFrom, DIRECTORY, NO_WEBSITE_SIGNAL } from './siteAudit.mjs'

export const BRAVE_KEY = 'search-brave'
export const searchApiReady = () => hasSecret(BRAVE_KEY)
let braveOff = false // quota reached: the search without key takes over until the app restarts
const pause = (ms) => new Promise((r) => setTimeout(r, ms))
const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
// Words of a name that say something (not the legal form or the trade)
const STOP_WORDS = new Set(['sarl', 'sas', 'sasu', 'eurl', 'sci', 'ets', 'etablissements', 'societe', 'les', 'des', 'chez', 'and', 'the', 'et', 'de', 'du', 'la', 'le'])
const nameWords = (name) => normalize(name).split(' ').filter((w) => w.length > 2 && !STOP_WORDS.has(w))

let lastCall = 0
// Results of the web search API: [{ title, url, description }]
export async function webSearch(query) {
    const key = readSecret(BRAVE_KEY)
    if (!key) throw new Error('Clé de recherche web pas encore enregistrée (Réglages, Moteur)')
    // free plan: 1 search per second
    const wait = 1100 - (Date.now() - lastCall)
    if (wait > 0) await pause(wait)
    lastCall = Date.now()
    const params = new URLSearchParams({ q: query, country: 'FR', search_lang: 'fr', count: '8' })
    const r = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, { headers: { Accept: 'application/json', 'X-Subscription-Token': key }, signal: AbortSignal.timeout(15000) })
    if (r.status === 429) throw new Error('Recherche web : quota atteint (crédit gratuit de 5 $ par mois, environ 1 000 recherches)')
    if (!r.ok) throw new Error(`Recherche web : HTTP ${r.status}`)
    const j = await r.json()
    return (j.web?.results || []).map((x) => ({ title: x.title || '', url: x.url, description: x.description || '' }))
}

// The website of a business: the first result that is not a directory and whose address or title has a word of its name
function pickWebsite(results, name) {
    const words = nameWords(name)
    return results.find((x) => {
        if (DIRECTORY.test(x.url)) return false
        const text = normalize(`${x.url} ${x.title}`)
        return words.length && words.filter((w) => text.includes(w)).length >= Math.min(2, words.length)
    })?.url || null
}

// ---------- Website without any key: the usual addresses made from the name, checked on the page itself ----------
const LEGAL = /\b(sarl|sas|sasu|eurl|sci|snc|ets|etablissements?|societe)\b/g
const slug = (s, sep) => normalize(s).replace(LEGAL, ' ').trim().split(/\s+/).filter(Boolean).join(sep)
async function resolves(host) { try { await dns.lookup(host); return true } catch { return false } }

export async function guessWebsite(name, town, postalCode) {
    const base = [slug(name, '-'), slug(name, '')].filter((x) => x.length >= 4)
    const withTown = base.map((b) => `${b}-${slug(town, '-')}`)
    const hosts = [...new Set([...base, ...withTown].flatMap((b) => [`${b}.fr`, `${b}.com`]))].slice(0, 10)
    const words = nameWords(name), place = normalize(town).split(' ')[0]
    for (const host of hosts) {
        if (!(await resolves(host))) continue
        try {
            const r = await fetch(`https://${host}`, { redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } })
            if (!r.ok || !/html/i.test(r.headers.get('content-type') || '')) continue
            const text = normalize((await r.text()).slice(0, 400_000).replace(/<[^>]+>/g, ' '))
            // its own site: the page names the business and its town (or its postcode); a parked domain does not
            const named = words.filter((w) => text.includes(w)).length >= Math.min(2, words.length)
            if (named && (text.includes(place) || (postalCode && text.includes(postalCode))) && !/domaine.{0,30}(a vendre|est a vendre)|domain.{0,20}for sale|parked/.test(text)) return r.url
        } catch {}
    }
    return null
}

const pack = (audit) => (!audit || !audit.reachable ? 'site autonome' : audit.needScore >= 3 ? 'site autonome' : 'portfolio')

// Up to `max` leads (with an e-mail) among the allowed businesses of a trade in a town, plus a few to call (phone only)
export async function discover({ trade, town, allowed = [], known = new Set(), max = 6 }) {
    const companies = []
    let withEmail = 0, toCall = 0
    for (const b of allowed) {
        if (withEmail >= max) break
        let website = null
        if (searchApiReady() && !braveOff) {
            try { website = pickWebsite(await webSearch(`${b.name} ${b.city || town}`), b.name) } catch (e) { log('Recherche web :', e.message); if (/quota|Clé/.test(e.message)) braveOff = true }
        }
        if (!website && (!searchApiReady() || braveOff)) website = await guessWebsite(b.name, b.city || town, b.postalCode)
        const domain = website ? new URL(website).hostname.replace(/^www\./, '') : null
        if (domain && known.has(domain)) continue
        const audit = website ? await auditSite(website, { town: b.city || town }) : null
        const email = audit?.emails?.[0] || null
        const phone = audit?.phones?.[0] || null
        const signals = audit ? audit.signals : [NO_WEBSITE_SIGNAL]
        const needScore = audit ? audit.needScore : 4
        if (!email && !(phone && toCall < 3)) continue
        if (email) withEmail++; else toCall++
        companies.push({
            name: b.name, city: b.city || town, postalCode: b.postalCode, siren: b.siren,
            email, emailSource: email ? audit.finalUrl : null, website, platform: audit?.platform || 'aucun', usesBooking: audit?.platform === 'Planity' ? 'oui' : 'inconnu',
            signal: signals.join(' ; '), detail: null, contact: b.contact || null, phone, googleRating: null, socials: null,
            score: needScore, level: levelFrom(audit, needScore >= 3 ? 'CHAUD' : 'TIÈDE'), pack: pack(audit), audit,
            callHook: email ? null : `Bonjour, je suis ${fullName() || 'votre interlocuteur'}, ${profile().activity || 'indépendant'} à ${profile().city || 'côté'}. J'ai regardé ${b.name} en ligne : ${signals[0]}. Est-ce que c'est un sujet pour vous en ce moment ?`,
        })
    }
    return { companies }
}
