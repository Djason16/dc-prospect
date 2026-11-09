// Web-first lead search helpers: towns of a zone (official geo API), e-mail domain check (MX),
// and a check in the official company register (active, no opposition to prospecting).
import dns from 'node:dns/promises'
import { log } from './base.mjs'

const pause = (ms) => new Promise((r) => setTimeout(r, ms))
const townsCache = new Map(), mxCache = new Map()

// Towns of a zone, biggest first: [{ name, postalCode, population }]
export async function towns(zone) {
    const key = JSON.stringify([zone.departments, zone.postalCodes])
    if (townsCache.has(key)) return townsCache.get(key)
    const list = []
    for (const d of zone.departments || []) {
        const r = await fetch(`https://geo.api.gouv.fr/departements/${d}/communes?fields=nom,population,codesPostaux`)
        if (r.ok) for (const c of await r.json()) list.push({ name: c.nom, postalCode: c.codesPostaux?.[0], population: c.population || 0 })
    }
    for (const postalCode of zone.postalCodes || []) {
        const r = await fetch(`https://geo.api.gouv.fr/communes?codePostal=${postalCode}&fields=nom,population,codesPostaux`)
        if (r.ok) for (const c of await r.json()) list.push({ name: c.nom, postalCode, population: c.population || 0 })
    }
    const seen = new Set()
    const sorted = list.filter((c) => !seen.has(c.name) && seen.add(c.name)).sort((a, b) => b.population - a.population)
    // departments: towns of 2 500 people or more (enough shops); postcodes: every town given
    const result = (zone.postalCodes?.length ? sorted : sorted.filter((c) => c.population >= 2500))
    townsCache.set(key, result.length ? result : sorted.slice(0, 30))
    return townsCache.get(key)
}

// The domain of the e-mail really receives mail (MX record); null if DNS is unreachable
export async function hasMx(email) {
    const domain = email.split('@')[1]?.toLowerCase()
    if (!domain) return false
    if (mxCache.has(domain)) return mxCache.get(domain)
    let ok
    try { ok = (await dns.resolveMx(domain)).length > 0 } catch (e) { ok = ['ENOTFOUND', 'ENODATA', 'ESERVFAIL'].includes(e.code) ? false : null }
    mxCache.set(domain, ok)
    return ok
}

const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

// Looks the business up in the register by name and postcode.
// Returns { siren, closed, opposed, establishments } or null if not found (a web lead not found stays allowed)
export async function checkRegister(name, postalCode) {
    try {
        const params = new URLSearchParams({ q: name, per_page: '5', minimal: 'true', include: 'siege,matching_etablissements' })
        if (postalCode) params.set('code_postal', postalCode)
        const r = await fetch(`https://recherche-entreprises.api.gouv.fr/search?${params}`, { headers: { 'User-Agent': 'prospection' } })
        if (r.status === 429) { await pause(1500); return checkRegister(name, postalCode) }
        if (!r.ok) return null
        const words = normalize(name).split(' ').filter((w) => w.length > 2)
        const match = (await r.json()).results?.find((e) => {
            const names = normalize([e.nom_complet, ...(e.matching_etablissements || []).flatMap((m) => [...(m.liste_enseignes || []), m.nom_commercial])].join(' '))
            return words.length && words.filter((w) => names.includes(w)).length >= Math.ceil(words.length / 2)
        })
        if (!match) return null
        return { siren: match.siren, closed: match.etat_administratif !== 'A', opposed: !!match.opposition_diffusion_commerciale || match.statut_diffusion !== 'O', establishments: match.nombre_etablissements_ouverts || 1 }
    } catch (e) {
        log('Registre injoignable :', e.message)
        return null
    }
}
