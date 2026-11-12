// Audit of a prospect's website WITHOUT AI: fetched directly (home, then the contact and legal notice pages), it gives the
// e-mails and phones really published, the platform, and the visible signs of a need (no https, slow, not made for phones,
// old copyright, no page of its own...). Used to check what the AI found, to rank the leads (score, level) and to give the
// writer true and concrete facts. Also the base of the search without AI (discovery.ts).
//   const audit = await auditSite('https://boulangerie-dupont.fr')
//   audit.emails, audit.phones, audit.platform, audit.signals (French sentences), audit.needScore (0 to 5)
import { log } from './base.js'
import { readSecret, hasSecret } from './vault.js'
import type { SiteAudit, PageSpeedResult } from '../types.js'

type Page = { ok: true, url: string, html: string, bytes: number, ms: number } | { ok: false, status?: number, error?: string, url: string, ms: number, bytes?: undefined }
// answers of the PageSpeed API: only the fields read here
interface PageSpeedAnswer {
    error?: { message?: string }
    lighthouseResult?: { categories?: Record<string, { score?: unknown }>, audits?: Record<string, { numericValue?: number }> }
}

const TIMEOUT = 9000
const MAX_BYTES = 1_500_000
const AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
// Pages where a business shows its e-mail
const CONTACT_LINK = /contact|mentions|legal|a-propos|about|nous-trouver|coordonn|informations|impressum/i
// Addresses that are never the business (tools, examples, the agency that made the site)
const NOT_THE_BUSINESS = /example|exemple|domain\.|votre|your|sentry|wixpress|wix\.com|godaddy|noreply|no-reply|@2x|\.(png|jpe?g|gif|webp|svg)$|jimdo|squarespace|webflow|hostinger|ovh\.net|o2switch|planity|fresha|treatwell/i

// Platforms recognised in the HTML: [name, pattern]
const PLATFORMS: [string, RegExp][] = [
    ['Wix', /wix\.com|wixstatic|_wix/i], ['Jimdo', /jimdo/i], ['Google Sites', /sites\.google\.com|googleusercontent\.com\/sites/i],
    ['Canva', /canva\.site|my\.canva\.site|canva\.com/i], ['Squarespace', /squarespace/i], ['Webflow', /webflow/i],
    ['Shopify', /cdn\.shopify|myshopify/i], ['WordPress', /wp-content|wp-includes|wordpress/i], ['Planity', /planity\.com/i],
    ['Site Pages Jaunes', /solocal|pagesjaunes\.fr\/pros/i], ['Hostinger', /zyro|hostinger/i], ['Webnode', /webnode/i],
]
// Directories and social networks: not a website of the business itself
export const DIRECTORY = /pagesjaunes|facebook\.com|instagram\.com|linkedin\.com|societe\.com|pappers|infogreffe|verif\.com|annuaire|118712|google\.com\/maps|tripadvisor|yelp|planity\.com|fresha|treatwell|doctolib|thefork|lafourchette|ubereats|deliveroo|justeat|mappy|kompass|manageo|wikipedia|youtube|tiktok|x\.com|twitter\.com/i

const decodeEntities = (s: string) => s.replace(/&#64;|&commat;/gi, '@').replace(/&#46;|&period;/gi, '.').replace(/&amp;/g, '&').replace(/\s*\[\s*(at|arobase)\s*\]\s*|\s+\(\s*(at|arobase)\s*\)\s+/gi, '@').replace(/\s*\[\s*(dot|point)\s*\]\s*/gi, '.')

async function fetchPage(url: string): Promise<Page> {
    const started = Date.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT)
    try {
        const r = await fetch(url, { headers: { 'User-Agent': AGENT, 'Accept-Language': 'fr-FR,fr;q=0.9' }, redirect: 'follow', signal: controller.signal })
        const type = r.headers.get('content-type') || ''
        if (!r.ok || !/html/i.test(type) || !r.body) return { ok: false, status: r.status, url: r.url, ms: Date.now() - started }
        const reader = r.body.getReader()
        const chunks: Uint8Array[] = []
        let size = 0
        for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            size += value.length
            chunks.push(value)
            if (size > MAX_BYTES) { controller.abort(); break }
        }
        return { ok: true, url: r.url, html: Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8'), bytes: size, ms: Date.now() - started }
    } catch (e) {
        return { ok: false, error: (e as Error).name === 'AbortError' ? 'délai dépassé' : (e as Error).message, url, ms: Date.now() - started }
    } finally { clearTimeout(timer) }
}

const textOf = (html: string) => decodeEntities(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ')

export function emailsIn(html: string): string[] {
    const found = new Set<string>()
    for (const [, e] of html.matchAll(/mailto:([^"'?>\s]+)/gi)) found.add(decodeURIComponent(e).toLowerCase())
    for (const [e] of textOf(html).matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) found.add(e.toLowerCase())
    return [...found].map((e) => e.replace(/\.$/, '')).filter((e) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e) && !NOT_THE_BUSINESS.test(e))
}

export function phonesIn(html: string): string[] {
    const found = new Set<string>()
    for (const [, p] of html.matchAll(/tel:([+0-9 ().-]{9,20})/gi)) found.add(p.replace(/[^+0-9]/g, ''))
    for (const [p] of textOf(html).matchAll(/(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}/g)) found.add(p.replace(/[^+0-9]/g, ''))
    return [...found].map((p) => p.replace(/^\+33/, '0')).filter((p) => /^0[1-9]\d{8}$/.test(p))
}

const domainOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase() } catch { return '' } }

// Links of the same site that lead to the contact or legal notice pages (2 at most)
function contactLinks(html: string, base: string): string[] {
    const links = new Set<string>()
    for (const [, href] of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
        try {
            const u = new URL(href, base)
            if (domainOf(u.href) !== domainOf(base) || !/^https?:$/.test(u.protocol)) continue
            if (CONTACT_LINK.test(u.pathname)) links.add(u.href.split('#')[0])
        } catch {}
        if (links.size >= 2) break
    }
    return [...links]
}

const plain = (s: string | null | undefined) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const cleanText = (s: string | null | undefined) => decodeEntities((s || '').replace(/<[^>]+>/g, ' ')).replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim()

// What the business says of itself (description or main title), when it is a real sentence: a true detail for the e-mail
function taglineOf(html: string): string | null {
    const meta = (name: string) => html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']+)`, 'i'))?.[1]
    const candidates = [meta('og:description'), meta('description'), html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]].map(cleanText)
    return candidates.find((t) => t.length >= 25 && t.length <= 160 && t.split(' ').length >= 4 && !/cookie|bienvenue sur (le|notre) site|accueil|javascript|lorem|wix|jimdo|\[|\]|—|–/i.test(t)) || null
}

// Audit of a site; null when the address is empty. Never throws: an unreachable site is itself a signal.
// town (optional): the town of the business, looked for in the title of the home page (local SEO)
export async function auditSite(website: string | null | undefined, { town }: { town?: string } = {}): Promise<SiteAudit | null> {
    if (!website) return null
    const start = /^https?:\/\//i.test(website) ? website : 'https://' + website
    let home = await fetchPage(start)
    // some old sites only answer in http
    if (!home.ok && start.startsWith('https://')) {
        const plain = await fetchPage(start.replace(/^https:/, 'http:'))
        if (plain.ok) home = plain
    }
    const audit: SiteAudit = { website: start, reachable: home.ok, finalUrl: home.url || start, https: false, ms: home.ms, bytes: home.bytes || 0, platform: null,
        mobile: null, copyrightYear: null, title: '', emails: [], phones: [], hasForm: false, signals: [], needScore: 0, checkedOn: new Date().toISOString().slice(0, 10) }
    if (!home.ok) {
        audit.signals.push(home.status ? `son site répond par une erreur (${home.status})` : 'son site ne s\'ouvre pas')
        audit.needScore = 4
        return audit
    }
    const html = home.html
    audit.https = audit.finalUrl.startsWith('https://')
    audit.title = cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]).slice(0, 120)
    audit.platform = PLATFORMS.find(([, re]) => re.test(html))?.[0] || 'custom'
    audit.mobile = /<meta[^>]+name=["']viewport["']/i.test(html)
    const years = [...textOf(html).matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?((?:19|20)\d{2})/gi)].map((m) => Number(m[1]))
    audit.copyrightYear = years.length ? Math.max(...years) : null
    audit.hasForm = /<form\b/i.test(html)
    audit.description = /<meta[^>]+name=["']description["'][^>]*content=["'][^"']{20,}/i.test(html)
    audit.wordpress = html.match(/<meta[^>]+name=["']generator["'][^>]*content=["']WordPress (\d+\.\d+)/i)?.[1] || null
    audit.tagline = taglineOf(html)
    const emails = new Set(emailsIn(html)), phones = new Set(phonesIn(html))
    for (const link of contactLinks(html, audit.finalUrl)) {
        const page = await fetchPage(link)
        if (!page.ok) continue
        for (const e of emailsIn(page.html)) emails.add(e)
        for (const p of phonesIn(page.html)) phones.add(p)
        if (/<form\b/i.test(page.html)) audit.hasForm = true
    }
    // e-mails of the site's own domain first
    const own = domainOf(audit.finalUrl)
    audit.emails = [...emails].sort((a, b) => (Number(b.endsWith('@' + own)) - Number(a.endsWith('@' + own))))
    audit.phones = [...phones]

    // Visible signs of a need (sentences read by the writer and by the user: in French)
    const year = new Date().getFullYear()
    let score = 0
    if (!audit.https) { audit.signals.push('son site n\'est pas sécurisé (pas de cadenas https)'); score += 1.5 }
    if (!audit.mobile) { audit.signals.push('son site n\'est pas adapté au téléphone'); score += 1.5 }
    if (audit.ms > 4000) { audit.signals.push(`son site met ${Math.round(audit.ms / 1000)} secondes à s'ouvrir`); score += 1 }
    if (audit.bytes > 900_000 && audit.ms > 2500) { audit.signals.push('sa page d\'accueil est lourde'); score += 0.5 }
    if (audit.copyrightYear && audit.copyrightYear <= year - 3) { audit.signals.push(`son site affiche « © ${audit.copyrightYear} » (pas mis à jour depuis)`); score += 1 }
    if (['Wix', 'Jimdo', 'Google Sites', 'Canva', 'Site Pages Jaunes', 'Webnode'].includes(audit.platform || '')) { audit.signals.push(`son site est fait avec ${audit.platform}`); score += 1 }
    if (audit.platform === 'Planity') { audit.signals.push('sa seule page en ligne est sa page de réservation Planity'); score += 2 }
    if (!audit.title) { audit.signals.push('sa page d\'accueil n\'a pas de titre pour Google'); score += 0.5 }
    else if (town && !plain(audit.title).includes(plain(town).split(/[ -]/)[0])) { audit.signals.push(`le titre de sa page d'accueil ne mentionne pas ${town}, ce qui la rend moins visible dans les recherches locales`); score += 0.5 }
    if (!audit.description) { audit.signals.push('sa page d\'accueil n\'a pas de description pour Google (le texte affiché sous le lien dans les résultats)'); score += 0.5 }
    if (audit.wordpress && Number(audit.wordpress) < 6) { audit.signals.push(`son site tourne sur une ancienne version de WordPress (${audit.wordpress})`); score += 1 }
    if (!audit.emails.length && !audit.hasForm) { audit.signals.push('son site ne donne ni e-mail ni formulaire de contact'); score += 0.5 }
    audit.needScore = Math.min(5, Math.round(score))
    return audit
}

// Level of a lead from its audit (and the AI's own level when there is one): CHAUD needs strong and checked signs
export function levelFrom(audit: Pick<SiteAudit, 'needScore'> | null | undefined, aiLevel?: string): string {
    if (!audit) return aiLevel || 'TIÈDE'
    if (audit.needScore >= 3) return 'CHAUD'
    if (audit.needScore >= 1) return aiLevel === 'CHAUD' ? 'CHAUD' : 'TIÈDE'
    return aiLevel === 'CHAUD' ? 'TIÈDE' : aiLevel || 'FROID'
}

// Lead with no website at all: the strongest sign, said simply
export const NO_WEBSITE_SIGNAL = 'pas de site internet à son nom (seulement des fiches d\'annuaire ou des réseaux sociaux)'

// ---------- Speed and SEO measured by Google (PageSpeed Insights API, free key: console.cloud.google.com) ----------
export const PAGESPEED_KEY = 'pagespeed'
let pageSpeedOffUntil = 0
// { performance, seo (0 to 100), lcp (seconds, phone) } or null (no key, quota reached, site not measured)
export async function pageSpeed(url: string): Promise<PageSpeedResult | null> {
    if (!hasSecret(PAGESPEED_KEY) || Date.now() < pageSpeedOffUntil) return null
    const params = new URLSearchParams({ url, strategy: 'mobile', key: readSecret(PAGESPEED_KEY) || '' })
    params.append('category', 'performance'); params.append('category', 'seo')
    try {
        const r = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`, { signal: AbortSignal.timeout(60000) })
        if (r.status === 429) { pageSpeedOffUntil = Date.now() + 3600e3; log('PageSpeed : quota atteint, reprise dans une heure'); return null }
        if (!r.ok) { const j = (await r.json().catch(() => ({}))) as PageSpeedAnswer; log(`PageSpeed : HTTP ${r.status} ${j.error?.message || ''}`); return null }
        const l = ((await r.json()) as PageSpeedAnswer).lighthouseResult
        const pct = (c: { score?: unknown } | undefined) => (typeof c?.score === 'number' ? Math.round(c.score * 100) : null)
        const lcp = l?.audits?.['largest-contentful-paint']?.numericValue
        return { performance: pct(l?.categories?.performance), seo: pct(l?.categories?.seo), lcp: lcp ? Math.round(lcp / 100) / 10 : null }
    } catch (e) { log('PageSpeed :', (e as Error).message); return null }
}

// Check of a key just typed (no measure kept): null when Google accepts it, otherwise its reason in French.
// A page that Lighthouse cannot measure (error 400 or 500 about the page) still means the key is accepted.
export async function checkPageSpeedKey(key: string): Promise<string | null> {
    const params = new URLSearchParams({ url: 'https://www.google.com', strategy: 'mobile', key })
    try {
        const r = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`, { signal: AbortSignal.timeout(90000) })
        if (r.ok) return null
        const j = (await r.json().catch(() => ({}))) as PageSpeedAnswer
        const message = j.error?.message || `HTTP ${r.status}`
        if (r.status === 429) return null // quota of the day reached: the key itself is valid
        if ((r.status === 400 || r.status >= 500) && /lighthouse|FAILED_DOCUMENT|NO_FCP|ERRORED_DOCUMENT/i.test(message)) return null
        if (/API key not valid|invalid/i.test(message)) return 'Google dit que cette clé n\'est pas valide : vérifie qu\'elle est copiée en entier.'
        if (/has not been used|is disabled|SERVICE_DISABLED/i.test(message)) return 'L\'API PageSpeed Insights n\'est pas activée dans le projet de cette clé (ou vient de l\'être : attends 5 minutes).'
        if (/blocked|API_KEY_SERVICE_BLOCKED|restrict/i.test(message)) return 'Cette clé n\'a pas le droit d\'appeler PageSpeed : dans ses restrictions, coche « PageSpeed Insights API » (une nouvelle clé peut mettre 5 minutes à fonctionner).'
        return `Google a répondu : ${message.slice(0, 200)}`
    } catch (e) { return 'Google ne répond pas pour l\'instant (' + (e as Error).message + ') : réessaie dans un moment.' }
}

// Sentences and extra need score from a PageSpeed measure
export function speedSignals(s: PageSpeedResult): { signals: string[], score: number } {
    const signals: string[] = []
    let score = 0
    if (s.lcp !== null && s.lcp >= 4) { signals.push(`sur téléphone, sa page d'accueil met ${String(s.lcp).replace('.', ',')} secondes à s'afficher (mesure Google PageSpeed)`); score += 1 }
    else if (s.performance !== null && s.performance < 50) { signals.push(`sur téléphone, son site obtient ${s.performance}/100 au test de vitesse de Google (PageSpeed)`); score += 0.5 }
    if (s.seo !== null && s.seo < 80) { signals.push(`Google note le référencement de base de son site ${s.seo}/100`); score += 0.5 }
    return { signals, score }
}

export { log }
