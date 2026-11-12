// Client for the API of DC Prospect (same shape as the DC Scaffold api.js)
//   await api.get<DayState>('/state')
//   await api.post('/drafts', { id, step, action })
//   await api.put('/settings', data)
//   await api.delete('/accounts/gmail')
// Every call resolves (never throws) to:
//   success -> { success: true, ...data }
//   failure -> { success: false, error: 'message', status: 404 }
import { API_URL } from './config.js'
import type { ApiResult, ApiSuccess } from './types.js'

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

async function call<T>(method: Method, route: string, body?: unknown): Promise<ApiResult<T>> {
    try {
        const r = await fetch(API_URL + route, {
            method,
            headers: method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-Prospection': '1' },
            body: method === 'GET' ? undefined : JSON.stringify(body || {}),
        })
        // Boundary: the JSON comes from our own engine, whose answers have the shape the caller names (types.ts)
        const j = (await r.json().catch(() => ({ success: false, error: 'Réponse illisible' }))) as ApiResult<T>
        return r.ok ? j : { success: false, status: r.status, ...(j as object) } as ApiResult<T>
    } catch {
        return { success: false, error: 'DC Prospect ne répond pas (l\'application est-elle ouverte ?)', status: 0 }
    }
}

// T = what the route answers besides { success } (defaults to nothing more)
export const api = {
    get: <T = object>(route: string) => call<T>('GET', route),
    post: <T = object>(route: string, body?: unknown) => call<T>('POST', route, body),
    put: <T = object>(route: string, body?: unknown) => call<T>('PUT', route, body),
    delete: <T = object>(route: string, body?: unknown) => call<T>('DELETE', route, body),
}

// For actions with a button: throws the API error so the caller can show it
export async function ensureSuccess<T>(promise: Promise<ApiResult<T>>): Promise<ApiSuccess<T>> {
    const r = await promise
    if (!r.success) throw new Error(r.error || 'Erreur')
    return r
}

// Actions of the Windows app (accounts, folders, updates); the answer depends on the action
export const hostAction = async <T = unknown>(action: string, value?: unknown): Promise<T> =>
    (await ensureSuccess(api.post<{ result: T }>('/host', { action, value }))).result
