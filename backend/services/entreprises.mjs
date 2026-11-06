// Lead source: official French company register (API Recherche d'entreprises, free, no key)
import { log } from './base.mjs'
import { zoneParNom, secteursActifs } from './reglages.mjs'

const API = 'https://recherche-entreprises.api.gouv.fr/search'
const pause = (ms) => new Promise((r) => setTimeout(r, ms))

async function appeler(params) {
    for (let essai = 0; essai < 3; essai++) {
        const rep = await fetch(`${API}?${new URLSearchParams(params)}`, { headers: { 'User-Agent': 'prospection-auto' } })
        if (rep.status === 429) { await pause(2000 * (essai + 1)); continue }
        if (!rep.ok) throw new Error(`API entreprises : HTTP ${rep.status}`)
        return rep.json()
    }
    throw new Error('API entreprises : trop de requêtes')
}

const titre = (s) => (s || '').toLowerCase().replace(/(^|[\s'-])\S/g, (c) => c.toUpperCase())

// Returns up to `nombre` new small active companies of the zone, never already known
export async function trouverCandidats({ zone, nombre, connus, poids = {} }) {
    const z = zoneParNom(zone)
    const departements = z?.departements || [], codes = z?.codesPostaux || []
    // weighted shuffle: sectors that bring more leads come first more often, the others still get a chance
    const secteurs = secteursActifs().map((s) => ({ s, k: Math.random() ** (1 / (poids[s.nom] || 0.3)) })).sort((a, b) => b.k - a.k).map((x) => x.s)
    const trouves = []
    const ilYaUnAn = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10)
    for (let tour = 0; trouves.length < nombre && tour < secteurs.length * 4; tour++) {
        const secteur = secteurs[tour % secteurs.length]
        const base = {
            activite_principale: secteur.naf.join(','),
            ...(departements.length ? { departement: departements.join(',') } : {}),
            ...(codes.length ? { code_postal: codes.join(',') } : {}),
            etat_administratif: 'A',
            tranche_effectif_salarie: 'NN,00,01,02,03,11',
            per_page: '25',
            minimal: 'true',
            include: 'matching_etablissements,siege',
        }
        const premiere = await appeler({ ...base, page: '1' })
        const pages = Math.min(premiere.total_pages || 1, 400)
        const page = 1 + Math.floor(Math.random() * pages)
        const res = page === 1 ? premiere : await appeler({ ...base, page: String(page) })
        await pause(300)
        let ajoutes = 0
        for (const r of res.results || []) {
            if (trouves.length >= nombre || ajoutes >= Math.ceil(nombre / 3)) break
            if (connus.has(r.siren)) continue
            if (r.statut_diffusion !== 'O' || r.opposition_diffusion_commerciale) continue // refuses prospecting
            if ((r.nombre_etablissements_ouverts || 1) > 3) continue // chains: not our target
            if (r.date_creation && r.date_creation > ilYaUnAn) continue // too new to have a visible need
            const dansZone = (e) => e && e.etat_administratif === 'A' && (departements.some((d) => (e.code_postal || '').startsWith(d)) || codes.includes(e.code_postal))
            const et = (r.matching_etablissements || []).find(dansZone) || (dansZone(r.siege) ? r.siege : null)
            if (!et) continue
            const enseigne = (et.liste_enseignes?.[0] || et.nom_commercial || '').split(',')[0].trim()
            // a shop sign or employees = a real storefront business (much more often online with a public e-mail)
            if (!enseigne && et.caractere_employeur !== 'O' && r.caractere_employeur !== 'O') continue
            trouves.push({
                id: r.siren,
                entreprise: titre(enseigne || r.nom_complet),
                raisonSociale: r.nom_complet.replace(/s*([^)]*,[^)]*)/, ''),
                metier: secteur.nom,
                naf: r.activite_principale,
                adresse: et.adresse,
                ville: titre(et.libelle_commune),
                cp: et.code_postal,
                zone,
                association: r.nature_juridique?.startsWith('92'),
                source: 'Registre des entreprises (API Recherche d\'entreprises)',
            })
            connus.add(r.siren)
            ajoutes++
        }
    }
    log(`Registre : ${trouves.length} candidats trouvés en ${zone}`)
    return trouves
}
