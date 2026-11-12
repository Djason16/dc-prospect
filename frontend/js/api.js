// Client for the API of DC Prospect (same shape as the DC Scaffold api.js)
//   await api.get('/state')
//   await api.post('/drafts', { id, step, action })
//   await api.put('/settings', data)
//   await api.delete('/accounts/gmail')
// Every call resolves (never throws) to:
//   success -> { success: true, ...data }
//   failure -> { success: false, error: 'message', status: 404 }
import { API_URL } from './config.js'

async function call(method, route, body) {
    try {
        const r = await fetch(API_URL + route, {
            method,
            headers: method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-Prospection': '1' },
            body: method === 'GET' ? undefined : JSON.stringify(body || {}),
        })
        const j = await r.json().catch(() => ({ success: false, error: 'Réponse illisible' }))
        return r.ok ? j : { success: false, status: r.status, ...j }
    } catch {
        return { success: false, error: 'DC Prospect ne répond pas (l\'application est-elle ouverte ?)', status: 0 }
    }
}

export const api = {
    get: (route) => call('GET', route),
    post: (route, body) => call('POST', route, body),
    put: (route, body) => call('PUT', route, body),
    delete: (route, body) => call('DELETE', route, body),
}

// For actions with a button: throws the API error so the caller can show it
export async function ensureSuccess(promise) {
    const r = await promise
    if (!r.success) throw new Error(r.error || 'Erreur')
    return r
}

// Actions of the Windows app (accounts, folders, updates)
export const hostAction = async (action, value) => (await ensureSuccess(api.post('/host', { action, value }))).result
