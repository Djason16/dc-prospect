// Client for the API of DC Prospect (same shape as the DC Scaffold api.js)
//   await api.get('/etat')
//   await api.post('/brouillons', { id, etape, action })
//   await api.put('/reglages', data)
//   await api.delete('/comptes/gmail')
// Every call resolves (never throws) to:
//   success -> { success: true, ...data }
//   failure -> { success: false, error: 'message', status: 404 }
import { API_URL } from './config.js'

async function appel(methode, chemin, corps) {
    try {
        const r = await fetch(API_URL + chemin, {
            method: methode,
            headers: methode === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-Prospection': '1' },
            body: methode === 'GET' ? undefined : JSON.stringify(corps || {}),
        })
        const j = await r.json().catch(() => ({ success: false, error: 'Réponse illisible' }))
        return r.ok ? j : { success: false, status: r.status, ...j }
    } catch {
        return { success: false, error: 'DC Prospect ne répond pas (l\'application est-elle ouverte ?)', status: 0 }
    }
}

export const api = {
    get: (chemin) => appel('GET', chemin),
    post: (chemin, corps) => appel('POST', chemin, corps),
    put: (chemin, corps) => appel('PUT', chemin, corps),
    delete: (chemin) => appel('DELETE', chemin),
}

// For actions with a button: throws the API error so the caller can show it
export async function exiger(promesse) {
    const r = await promesse
    if (!r.success) throw new Error(r.error || 'Erreur')
    return r
}

// Actions of the Windows app (accounts, folders, updates)
export const hote = async (action, valeur) => (await exiger(api.post('/hote', { action, valeur }))).resultat
