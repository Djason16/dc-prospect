// Web-first lead search helpers: towns of a zone (official geo API), e-mail domain check (MX),
// and a check in the official company register (active, no opposition to prospecting).
import dns from 'node:dns/promises'
import { log } from './base.mjs'

const pause = (ms) => new Promise((r) => setTimeout(r, ms))
const townsCache = new Map(), mxCache = new Map()

// Towns of a zone, biggest first: [{ name, postalCode, population }]
// Zone « a town and N km around »: the postcodes of every town whose centre is in the circle (official geo API,
// all the towns of France read once and kept in memory)
let allTowns = null
export async function zoneAround(name, km) {
    const find = await (await fetch(`https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(name)}&fields=nom,centre,codesPostaux,population&boost=population&limit=1`, { signal: AbortSignal.timeout(20000) })).json()
    const c = find?.[0]
    if (!c?.centre) return null
    allTowns = allTowns || await (await fetch('https://geo.api.gouv.fr/communes?fields=nom,centre,codesPostaux,population', { signal: AbortSignal.timeout(60000) })).json()
    const [lon, lat] = c.centre.coordinates, rad = Math.PI / 180
    const distance = ([lo, la]) => 6371 * Math.acos(Math.min(1, Math.sin(lat * rad) * Math.sin(la * rad) + Math.cos(lat * rad) * Math.cos(la * rad) * Math.cos((lo - lon) * rad)))
    const near = allTowns.filter((t) => t.centre && distance(t.centre.coordinates) <= km)
    return { name: `${c.nom} et ${km} km autour`, departments: [], postalCodes: [...new Set(near.flatMap((t) => t.codesPostaux || []))].sort(), active: true, towns: near.length }
}

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
const titleCase = (s) => (s || '').toLowerCase().replace(/(^|[\s'-])\S/g, (c) => c.toUpperCase())
const allowedCache = new Map()

// Businesses of a trade (its NAF codes) in a town that MAY be prospected, from the official register, BEFORE any search:
// active, not opposed to prospecting (diffusible), 3 establishments at most (no chains), created more than a year ago.
// Returns [{ name, legalName, siren, postalCode, city }] (60 at most). [] = nobody to prospect there: no AI call needed.
// null = register unreachable (the search then goes on without the list, and each lead is checked one by one as before).
// The manager named in the register, when there is exactly one person (« Prénom Nom »): « Bonjour Marie, » instead of « Bonjour, ».
// Only the name is kept (never the birth date). Several managers, or a company as manager: null
function managerOf(e) {
    const people = (e.dirigeants || []).filter((d) => d.type_dirigeant === 'personne physique' && /g[ée]rant|pr[ée]sident|entrepreneur|exploitant/i.test(d.qualite || '') && d.prenoms && d.nom)
    const names = [...new Set(people.map((d) => `${d.prenoms.split(/[\s,]+/)[0]} ${d.nom.replace(/\s*\(.*\)\s*/g, ' ').trim()}`.toLowerCase()))]
    if (names.length === 1) return titleCase(names[0])
    // sole trader (entrepreneur individuel): the business carries the person's name (« BENOIT MERCIER »)
    if (!names.length && String(e.nature_juridique) === '1000') { const n = (e.nom_complet || '').replace(/\s*\(.*\)\s*/g, ' ').trim(); if (/^[\p{L}' -]+$/u.test(n) && n.split(' ').length <= 4) return titleCase(n) }
    return null
}

export async function allowedBusinesses(naf, postalCode) {
    if (!naf?.length || !postalCode) return null
    const key = `${naf.join(',')}|${postalCode}`
    if (allowedCache.has(key)) return allowedCache.get(key)
    const oneYearAgo = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10)
    const list = []
    try {
        for (let page = 1; page <= 3; page++) {
            const params = new URLSearchParams({ activite_principale: naf.join(','), code_postal: postalCode, etat_administratif: 'A', per_page: '25', page: String(page), minimal: 'true', include: 'matching_etablissements,siege,dirigeants' })
            let r = await fetch(`https://recherche-entreprises.api.gouv.fr/search?${params}`, { headers: { 'User-Agent': 'prospection' } })
            if (r.status === 429) { await pause(2000); r = await fetch(`https://recherche-entreprises.api.gouv.fr/search?${params}`, { headers: { 'User-Agent': 'prospection' } }) }
            if (!r.ok) return null
            const j = await r.json()
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
        log('Registre injoignable :', e.message)
        return null
    }
    const result = list.slice(0, 60)
    allowedCache.set(key, result)
    return result
}

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
