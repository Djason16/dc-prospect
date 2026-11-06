// Web-first lead search helpers: towns of a zone (official geo API), e-mail domain check (MX),
// and a check in the official company register (active, no opposition to prospecting).
import dns from 'node:dns/promises'
import { log } from './base.mjs'

const pause = (ms) => new Promise((r) => setTimeout(r, ms))
const cacheCommunes = new Map(), cacheMx = new Map()

// Towns of a zone, biggest first: [{ nom, cp, population }]
export async function communes(zone) {
    const cle = JSON.stringify([zone.departements, zone.codesPostaux])
    if (cacheCommunes.has(cle)) return cacheCommunes.get(cle)
    const liste = []
    for (const d of zone.departements || []) {
        const r = await fetch(`https://geo.api.gouv.fr/departements/${d}/communes?fields=nom,population,codesPostaux`)
        if (r.ok) for (const c of await r.json()) liste.push({ nom: c.nom, cp: c.codesPostaux?.[0], population: c.population || 0 })
    }
    for (const cp of zone.codesPostaux || []) {
        const r = await fetch(`https://geo.api.gouv.fr/communes?codePostal=${cp}&fields=nom,population,codesPostaux`)
        if (r.ok) for (const c of await r.json()) liste.push({ nom: c.nom, cp, population: c.population || 0 })
    }
    const vus = new Set()
    const tri = liste.filter((c) => !vus.has(c.nom) && vus.add(c.nom)).sort((a, b) => b.population - a.population)
    // départements: towns of 2 500 people or more (enough shops); postcodes: every town given
    const resultat = (zone.codesPostaux?.length ? tri : tri.filter((c) => c.population >= 2500))
    cacheCommunes.set(cle, resultat.length ? resultat : tri.slice(0, 30))
    return cacheCommunes.get(cle)
}

// The domain of the e-mail really receives mail (MX record); null if DNS is unreachable
export async function mxValide(email) {
    const domaine = email.split('@')[1]?.toLowerCase()
    if (!domaine) return false
    if (cacheMx.has(domaine)) return cacheMx.get(domaine)
    let ok
    try { ok = (await dns.resolveMx(domaine)).length > 0 } catch (e) { ok = ['ENOTFOUND', 'ENODATA', 'ESERVFAIL'].includes(e.code) ? false : null }
    cacheMx.set(domaine, ok)
    return ok
}

const normaliser = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

// Looks the business up in the register by name and postcode.
// Returns { siren, ferme, opposition } or null if not found (a web lead not found stays allowed)
export async function verifierRegistre(nom, cp) {
    try {
        const params = new URLSearchParams({ q: nom, per_page: '5', minimal: 'true', include: 'siege,matching_etablissements' })
        if (cp) params.set('code_postal', cp)
        const r = await fetch(`https://recherche-entreprises.api.gouv.fr/search?${params}`, { headers: { 'User-Agent': 'prospection' } })
        if (r.status === 429) { await pause(1500); return verifierRegistre(nom, cp) }
        if (!r.ok) return null
        const mots = normaliser(nom).split(' ').filter((m) => m.length > 2)
        const trouve = (await r.json()).results?.find((e) => {
            const noms = normaliser([e.nom_complet, ...(e.matching_etablissements || []).flatMap((m) => [...(m.liste_enseignes || []), m.nom_commercial])].join(' '))
            return mots.length && mots.filter((m) => noms.includes(m)).length >= Math.ceil(mots.length / 2)
        })
        if (!trouve) return null
        return { siren: trouve.siren, ferme: trouve.etat_administratif !== 'A', opposition: !!trouve.opposition_diffusion_commerciale || trouve.statut_diffusion !== 'O', nombreEtablissements: trouve.nombre_etablissements_ouverts || 1 }
    } catch (e) {
        log('Registre injoignable :', e.message)
        return null
    }
}
