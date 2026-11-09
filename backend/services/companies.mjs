// Lead source: official French company register (API Recherche d'entreprises, free, no key)
import { log } from './base.mjs'
import { zoneByName, activeTrades } from './settings.mjs'

const API = 'https://recherche-entreprises.api.gouv.fr/search'
const pause = (ms) => new Promise((r) => setTimeout(r, ms))

async function call(params) {
    for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetch(`${API}?${new URLSearchParams(params)}`, { headers: { 'User-Agent': 'prospection-auto' } })
        if (res.status === 429) { await pause(2000 * (attempt + 1)); continue }
        if (!res.ok) throw new Error(`API entreprises : HTTP ${res.status}`)
        return res.json()
    }
    throw new Error('API entreprises : trop de requêtes')
}

const titleCase = (s) => (s || '').toLowerCase().replace(/(^|[\s'-])\S/g, (c) => c.toUpperCase())

// Returns up to `count` new small active companies of the zone, never already known
export async function findCandidates({ zone, count, known, weights = {} }) {
    const z = zoneByName(zone)
    const departments = z?.departments || [], codes = z?.postalCodes || []
    // weighted shuffle: trades that bring more leads come first more often, the others still get a chance
    const trades = activeTrades().map((t) => ({ t, k: Math.random() ** (1 / (weights[t.name] || 0.3)) })).sort((a, b) => b.k - a.k).map((x) => x.t)
    const found = []
    const oneYearAgo = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10)
    for (let round = 0; found.length < count && round < trades.length * 4; round++) {
        const trade = trades[round % trades.length]
        const base = {
            activite_principale: trade.naf.join(','),
            ...(departments.length ? { departement: departments.join(',') } : {}),
            ...(codes.length ? { code_postal: codes.join(',') } : {}),
            etat_administratif: 'A',
            tranche_effectif_salarie: 'NN,00,01,02,03,11',
            per_page: '25',
            minimal: 'true',
            include: 'matching_etablissements,siege',
        }
        const firstPage = await call({ ...base, page: '1' })
        const pages = Math.min(firstPage.total_pages || 1, 400)
        const page = 1 + Math.floor(Math.random() * pages)
        const res = page === 1 ? firstPage : await call({ ...base, page: String(page) })
        await pause(300)
        let added = 0
        for (const r of res.results || []) {
            if (found.length >= count || added >= Math.ceil(count / 3)) break
            if (known.has(r.siren)) continue
            if (r.statut_diffusion !== 'O' || r.opposition_diffusion_commerciale) continue // refuses prospecting
            if ((r.nombre_etablissements_ouverts || 1) > 3) continue // chains: not our target
            if (r.date_creation && r.date_creation > oneYearAgo) continue // too new to have a visible need
            const inZone = (e) => e && e.etat_administratif === 'A' && (departments.some((d) => (e.code_postal || '').startsWith(d)) || codes.includes(e.code_postal))
            const site = (r.matching_etablissements || []).find(inZone) || (inZone(r.siege) ? r.siege : null)
            if (!site) continue
            const shopSign = (site.liste_enseignes?.[0] || site.nom_commercial || '').split(',')[0].trim()
            // a shop sign or employees = a real storefront business (much more often online with a public e-mail)
            if (!shopSign && site.caractere_employeur !== 'O' && r.caractere_employeur !== 'O') continue
            found.push({
                id: r.siren,
                company: titleCase(shopSign || r.nom_complet),
                legalName: r.nom_complet.replace(/s*([^)]*,[^)]*)/, ''),
                trade: trade.name,
                naf: r.activite_principale,
                address: site.adresse,
                city: titleCase(site.libelle_commune),
                postalCode: site.code_postal,
                zone,
                association: r.nature_juridique?.startsWith('92'),
                source: 'Registre des entreprises (API Recherche d\'entreprises)',
            })
            known.add(r.siren)
            added++
        }
    }
    log(`Registre : ${found.length} candidats trouvés en ${zone}`)
    return found
}
