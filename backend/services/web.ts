// Web-first lead search helpers: towns of a zone (official geo API), e-mail domain check (MX),
// and a check in the official company register (active, no opposition to prospecting).
import dns from 'node:dns/promises'
import { log } from './base.js'
import type { Zone, Town, AllowedBusiness } from '../types.js'

// Answers of the official APIs (geo.api.gouv.fr, recherche-entreprises.api.gouv.fr): only the fields read here
interface GeoTown { nom: string, centre?: { coordinates: [number, number] }, codesPostaux?: string[], population?: number }
interface RegisterSite { etat_administratif?: string, code_postal?: string, liste_enseignes?: string[] | null, nom_commercial?: string | null, libelle_commune?: string }
interface RegisterManager { type_dirigeant?: string, qualite?: string, prenoms?: string, nom?: string }
interface RegisterCompany {
    siren: string
    nom_complet: string
    etat_administratif?: string
    statut_diffusion?: string
    opposition_diffusion_commerciale?: boolean
    nombre_etablissements_ouverts?: number
    date_creation?: string
    nature_juridique?: string | number
    siege?: RegisterSite
    matching_etablissements?: RegisterSite[]
    dirigeants?: RegisterManager[]
}
interface RegisterAnswer { results?: RegisterCompany[], total_pages?: number }
export interface RegisterCheck { siren: string, closed: boolean, opposed: boolean, establishments: number }

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))
const townsCache = new Map<string, Town[]>(), mxCache = new Map<string, boolean | null>()

// Towns of a zone, biggest first: [{ name, postalCode, population }]
// Zone « a town and N km around »: the postcodes of every town whose centre is in the circle (official geo API,
// all the towns of France read once and kept in memory)
let allTowns: GeoTown[] | null = null
export async function zoneAround(name: string, km: number): Promise<Zone | null> {
    const find = await (await fetch(`https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(name)}&fields=nom,centre,codesPostaux,population&boost=population&limit=1`, { signal: AbortSignal.timeout(20000) })).json() as GeoTown[]
    const c = find?.[0]
    if (!c?.centre) return null
    const all = allTowns = allTowns || await (await fetch('https://geo.api.gouv.fr/communes?fields=nom,centre,codesPostaux,population', { signal: AbortSignal.timeout(60000) })).json() as GeoTown[]
    const [lon, lat] = c.centre.coordinates, rad = Math.PI / 180
    const distance = ([lo, la]: [number, number]) => 6371 * Math.acos(Math.min(1, Math.sin(lat * rad) * Math.sin(la * rad) + Math.cos(lat * rad) * Math.cos(la * rad) * Math.cos((lo - lon) * rad)))
    const near = all.filter((t) => t.centre && distance(t.centre.coordinates) <= km)
    return { name: `${c.nom} et ${km} km autour`, departments: [], postalCodes: [...new Set(near.flatMap((t) => t.codesPostaux || []))].sort(), active: true, towns: near.length }
}

export async function towns(zone: Zone): Promise<Town[]> {
    const key = JSON.stringify([zone.departments, zone.postalCodes])
    const cached = townsCache.get(key)
    if (cached) return cached
    const list: Town[] = []
    for (const d of zone.departments || []) {
        const r = await fetch(`https://geo.api.gouv.fr/departements/${d}/communes?fields=nom,population,codesPostaux`)
        if (r.ok) for (const c of (await r.json()) as GeoTown[]) list.push({ name: c.nom, postalCode: c.codesPostaux?.[0] || '', population: c.population || 0 })
    }
    for (const postalCode of zone.postalCodes || []) {
        const r = await fetch(`https://geo.api.gouv.fr/communes?codePostal=${postalCode}&fields=nom,population,codesPostaux`)
        if (r.ok) for (const c of (await r.json()) as GeoTown[]) list.push({ name: c.nom, postalCode, population: c.population || 0 })
    }
    const seen = new Set<string>()
    const sorted = list.filter((c) => !seen.has(c.name) && seen.add(c.name)).sort((a, b) => b.population - a.population)
    // departments: towns of 2 500 people or more (enough shops); postcodes: every town given
    const result = (zone.postalCodes?.length ? sorted : sorted.filter((c) => c.population >= 2500))
    const kept = result.length ? result : sorted.slice(0, 30)
    townsCache.set(key, kept)
    return kept
}

// The domain of the e-mail really receives mail (MX record); null if DNS is unreachable
export async function hasMx(email: string): Promise<boolean | null> {
    const domain = email.split('@')[1]?.toLowerCase()
    if (!domain) return false
    if (mxCache.has(domain)) return mxCache.get(domain) ?? null
    let ok: boolean | null
    try { ok = (await dns.resolveMx(domain)).length > 0 } catch (e) { ok = ['ENOTFOUND', 'ENODATA', 'ESERVFAIL'].includes((e as NodeJS.ErrnoException).code || '') ? false : null }
    mxCache.set(domain, ok)
    return ok
}

const normalize = (s: string | null | undefined) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
const titleCase = (s: string | null | undefined) => (s || '').toLowerCase().replace(/(^|[\s'-])\S/g, (c) => c.toUpperCase())
const allowedCache = new Map<string, AllowedBusiness[]>()

// Businesses of a trade (its NAF codes) in a town that MAY be prospected, from the official register, BEFORE any search:
// active, not opposed to prospecting (diffusible), 3 establishments at most (no chains), created more than a year ago.
// Returns [{ name, legalName, siren, postalCode, city }] (60 at most). [] = nobody to prospect there: no AI call needed.
// null = register unreachable (the search then goes on without the list, and each lead is checked one by one as before).
// The manager named in the register, when there is exactly one person (« Prénom Nom »): « Bonjour Marie, » instead of « Bonjour, ».
// Only the name is kept (never the birth date). Several managers, or a company as manager: null
function managerOf(e: RegisterCompany): string | null {
    const people = (e.dirigeants || []).filter((d) => d.type_dirigeant === 'personne physique' && /g[ée]rant|pr[ée]sident|entrepreneur|exploitant/i.test(d.qualite || '') && d.prenoms && d.nom)
    const names = [...new Set(people.map((d) => `${(d.prenoms || '').split(/[\s,]+/)[0]} ${(d.nom || '').replace(/\s*\(.*\)\s*/g, ' ').trim()}`.toLowerCase()))]
    if (names.length === 1) return titleCase(names[0])
    // sole trader (entrepreneur individuel): the business carries the person's name (« BENOIT MERCIER »)
    if (!names.length && String(e.nature_juridique) === '1000') { const n = (e.nom_complet || '').replace(/\s*\(.*\)\s*/g, ' ').trim(); if (/^[\p{L}' -]+$/u.test(n) && n.split(' ').length <= 4) return titleCase(n) }
    return null
}

export async function allowedBusinesses(naf: string[], postalCode: string): Promise<AllowedBusiness[] | null> {
    if (!naf?.length || !postalCode) return null
    const key = `${naf.join(',')}|${postalCode}`
    const cached = allowedCache.get(key)
    if (cached) return cached
    const oneYearAgo = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10)
    const list: AllowedBusiness[] = []
    try {
        for (let page = 1; page <= 3; page++) {
            const params = new URLSearchParams({ activite_principale: naf.join(','), code_postal: postalCode, etat_administratif: 'A', per_page: '25', page: String(page), minimal: 'true', include: 'matching_etablissements,siege,dirigeants' })
            let r = await fetch(`https://recherche-entreprises.api.gouv.fr/search?${params}`, { headers: { 'User-Agent': 'prospection' } })
            if (r.status === 429) { await pause(2000); r = await fetch(`https://recherche-entreprises.api.gouv.fr/search?${params}`, { headers: { 'User-Agent': 'prospection' } }) }
            if (!r.ok) return null
            const j = (await r.json()) as RegisterAnswer
            for (const e of j.results || []) {
                if (e.statut_diffusion !== 'O' || e.opposition_diffusion_commerciale) continue
                if ((e.nombre_etablissements_ouverts || 1) > 3) continue
                if (e.date_creation && e.date_creation > oneYearAgo) continue
                const site = (e.matching_etablissements || []).find((m) => m.etat_administratif === 'A' && m.code_postal === postalCode) || e.siege
                const sign = (site?.liste_enseignes?.[0] || site?.nom_commercial || '').split(',')[0].trim()
                list.push({ name: titleCase(sign || e.nom_complet), legalName: e.nom_complet, siren: e.siren, postalCode, city: titleCase(site?.libelle_commune || ''), contact: managerOf(e) })
            }
            if (page >= (j.total_pages || 1)) break
            await pause(250)
        }
    } catch (e) {
        log('Registre injoignable :', (e as Error).message)
        return null
    }
    const result = list.slice(0, 60)
    allowedCache.set(key, result)
    return result
}

// Looks the business up in the register by name and postcode.
// Returns { siren, closed, opposed, establishments } or null if not found (a web lead not found stays allowed)
export async function checkRegister(name: string, postalCode?: string): Promise<RegisterCheck | null> {
    try {
        const params = new URLSearchParams({ q: name, per_page: '5', minimal: 'true', include: 'siege,matching_etablissements' })
        if (postalCode) params.set('code_postal', postalCode)
        const r = await fetch(`https://recherche-entreprises.api.gouv.fr/search?${params}`, { headers: { 'User-Agent': 'prospection' } })
        if (r.status === 429) { await pause(1500); return checkRegister(name, postalCode) }
        if (!r.ok) return null
        const words = normalize(name).split(' ').filter((w) => w.length > 2)
        const match = ((await r.json()) as RegisterAnswer).results?.find((e) => {
            const names = normalize([e.nom_complet, ...(e.matching_etablissements || []).flatMap((m) => [...(m.liste_enseignes || []), m.nom_commercial])].join(' '))
            return words.length && words.filter((w) => names.includes(w)).length >= Math.ceil(words.length / 2)
        })
        if (!match) return null
        return { siren: match.siren, closed: match.etat_administratif !== 'A', opposed: !!match.opposition_diffusion_commerciale || match.statut_diffusion !== 'O', establishments: match.nombre_etablissements_ouverts || 1 }
    } catch (e) {
        log('Registre injoignable :', (e as Error).message)
        return null
    }
}
