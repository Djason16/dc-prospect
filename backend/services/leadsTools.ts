// My own hand on the list of prospects:
//   - import of my own list (CSV from Excel, Google Sheets, a directory...): each business goes through the same checks
//     as the ones found by DC Prospect (register, site, e-mail published, STOP), then gets its first e-mail;
//   - « never contact »: e-mails or domains (my clients, my partners) that DC Prospect will never write to;
//   - erasure at the request of a person (GDPR): the data is deleted, the address kept only to never write again;
//   - outcome of a phone call from the « À appeler » list.
import { today, addDays, record, log, saveState } from './base.js'
import { addLead, knownSet, rewriteDraft } from './prospecting.js'
import { zoneOfTheWeek } from './settings.js'
import { errorMessage } from '../utils/ResponseHelper.js'
import type { State, Prospect, CallRecord, FoundCompany } from '../types.js'

// A line of an imported file, by field
type CsvField = 'name' | 'email' | 'website' | 'city' | 'postalCode' | 'trade' | 'phone' | 'contact'
export type CsvRow = Partial<Record<CsvField, string>>
export type CallOutcome = CallRecord['outcome']

// ---------- 1. Import of a CSV ----------
const plain = (s: unknown): string => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
// column of the file -> field, from its title
const COLUMNS: [CsvField, RegExp][] = [
    ['name', /^(entreprise|societe|nom|raison sociale|enseigne|company|name)/], ['email', /mail/], ['website', /^(site|web|url)/],
    ['city', /^(ville|commune|city)/], ['postalCode', /^(code postal|cp|postal)/], ['trade', /^(metier|activite|secteur|trade)/],
    ['phone', /^(tel|telephone|phone|portable)/], ['contact', /^(contact|gerant|dirigeant|prenom|interlocuteur)/],
]

export function parseCsv(text: unknown): CsvRow[] {
    const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim())
    if (lines.length < 2) return []
    const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ','
    const split = (line: string): string[] => {
        const out: string[] = []; let cur = '', quoted = false
        for (let i = 0; i < line.length; i++) {
            const ch = line[i]
            if (ch === '"') { if (quoted && line[i + 1] === '"') { cur += '"'; i++ } else quoted = !quoted }
            else if (ch === sep && !quoted) { out.push(cur.trim()); cur = '' } else cur += ch
        }
        return [...out, cur.trim()]
    }
    const heads = split(lines[0]).map((h) => COLUMNS.find(([, re]) => re.test(plain(h)))?.[0] || null)
    return lines.slice(1, 301).map((l): CsvRow => Object.fromEntries(split(l).map((v, i) => [heads[i], v] as const).filter(([k, v]) => k && v)))
        .filter((r) => r.name && (r.email || r.website || r.phone))
}

// Postcode of a town (official geo API), or null
const postcodes = new Map<string, string | null>()
async function postalCodeOf(town: string): Promise<string | null> {
    if (postcodes.has(town)) return postcodes.get(town) ?? null
    let code: string | null = null
    // answer of the geo API (outside data): [{ codesPostaux: [...] }]
    try { code = ((await (await fetch(`https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(town)}&fields=codesPostaux&boost=population&limit=1`, { signal: AbortSignal.timeout(15000) })).json()) as { codesPostaux?: string[] }[] | null)?.[0]?.codesPostaux?.[0] || null } catch {}
    postcodes.set(town, code)
    return code
}

// Runs in the background (the site audits take a few seconds each); progress in the history
export async function importLeads(state: State, text: unknown, onDone: () => void = () => {}): Promise<{ rows: number }> {
    const rows = parseCsv(text)
    if (!rows.length) throw new Error('Aucune ligne utilisable : il faut au moins les colonnes « Entreprise » et « E-mail », « Site » ou « Téléphone »')
    ;(async () => {
        const known = knownSet(state), day = today(), zoneName = zoneOfTheWeek() || 'Import'
        const counts: Record<string, number> = { ready: 0, call: 0, discarded: 0, skipped: 0 }
        for (const r of rows) {
            try {
                const website = r.website && !/^https?:/i.test(r.website) ? 'https://' + r.website : r.website
                // without postcode, the register could match a business with the same name elsewhere in France: the town gives it
                if (!r.postalCode && r.city) r.postalCode = (await postalCodeOf(r.city)) || undefined
                if (!r.postalCode) { counts.skipped++; log('Import : code postal introuvable, ligne ignorée :', r.name); continue }
                const company: FoundCompany = { ...r, name: r.name || '', website, signal: '' }
                const outcome = await addLead(state, company, { trade: { name: r.trade || 'Liste importée', naf: [] }, town: { name: r.city || '', postalCode: r.postalCode || '' }, zoneName, day, known, allowed: null, onProgress: () => {} })
                counts[outcome || 'skipped'] = (counts[outcome || 'skipped'] || 0) + 1
                saveState(state)
            } catch (e) { counts.skipped++; log('Import :', r.name || '', errorMessage(e)) }
        }
        record(state, 'import', `Import de ${rows.length} lignes : ${counts.ready} prospects prêts, ${counts.call} à appeler, ${counts.discarded} écartés (registre), ${counts.skipped} ignorés (déjà connus, STOP, sans e-mail valide ou ville introuvable)`)
        onDone()
    })()
    return { rows: rows.length }
}

// ---------- 2. Never contact ----------
export function addDoNotContact(state: State, text: unknown): number {
    const blocked = (state.blockedDomains = state.blockedDomains || [])
    let n = 0
    for (const raw of String(text || '').split(/[\s,;]+/)) {
        const x = raw.trim().toLowerCase().replace(/^mailto:/, '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '')
        if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(x)) { if (!state.stop.includes(x)) { state.stop.push(x); n++ } }
        else if (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(x)) { if (!blocked.includes(x)) { blocked.push(x); n++ } }
    }
    // already prepared e-mails to them are cancelled
    for (const p of state.prospects) {
        const domain = p.email?.split('@')[1] || ''
        if (p.email && (state.stop.includes(p.email.toLowerCase()) || blocked.includes(domain)) && ['ready', 'inSequence'].includes(p.status)) {
            p.status = 'discarded'; p.reason = 'dans « ne jamais contacter »'
            for (const d of Object.values(p.drafts || {})) if (['reserved', 'toApprove', 'approved'].includes(d.status)) d.status = 'cancelled'
        }
    }
    if (n) record(state, 'gdpr', `${n} adresses ou domaines ajoutés à « ne jamais contacter »`)
    return n
}

// ---------- 3. Erasure (GDPR) ----------
export function eraseProspect(state: State, id: string): void {
    const p = state.prospects.find((x) => x.id === id)
    if (!p) throw new Error('Prospect introuvable')
    // the address stays in the STOP list (allowed: it is what guarantees he is never written to again), nothing else
    if (p.email && !state.stop.includes(p.email.toLowerCase())) state.stop.push(p.email.toLowerCase())
    state.prospects = state.prospects.filter((x) => x.id !== id)
    state.forgottenIds = [...(state.forgottenIds || []), id]
    record(state, 'gdpr', 'Données d\'un prospect effacées à sa demande (son adresse reste seulement dans la liste STOP)')
}

// ---------- 4. Set aside by mistake: back in the reserve (never a legal refusal: register, STOP, never contact) ----------
const FINAL = /registre|refuse|ferm[ée]e|cha[iî]ne|STOP|invalide|ne jamais contacter/i
export const canRestore = (p: Prospect): boolean => p.status === 'discarded' && !FINAL.test(p.reason || '')
export async function restoreProspect(state: State, id: string): Promise<void> {
    const p = state.prospects.find((x) => x.id === id)
    if (!p || !canRestore(p)) throw new Error('Ce prospect ne peut pas être remis (refus du registre, STOP ou adresse invalide)')
    delete p.reason
    if (!p.email) { p.status = 'otherChannel'; p.calls = []; delete p.callBackOn; return }
    p.status = 'ready'
    p.drafts = { ...p.drafts, first: { subject: '', body: '', status: 'reserved', subjectStyle: p.drafts?.first?.subjectStyle || 'A', preparedOn: today() } }
    await rewriteDraft(p, 'first')
    record(state, 'review', `${p.company} remis dans la réserve`, { id })
}

// ---------- 5. Outcome of a call (« À appeler ») ----------
export function callOutcome(state: State, id: string, outcome: CallOutcome): void {
    const p = state.prospects.find((x) => x.id === id)
    if (!p) throw new Error('Prospect introuvable')
    const day = today()
    const calls = (p.calls = [...(p.calls || []), { on: day, outcome }])
    p.tracking = p.tracking || {}
    if (outcome === 'interested') { p.status = 'replied'; p.tracking.call = day; p.tracking.handled = day; p.reply = { date: day, excerpt: 'Intéressé au téléphone', kind: 'interested', byPhone: true } }
    if (outcome === 'no') { p.status = 'stopped'; p.stoppedOn = day; p.tracking.result = 'Refus' }
    if (outcome === 'later') p.callBackOn = addDays(day, 60)
    if (outcome === 'noAnswer') {
        if (calls.filter((c) => c.outcome === 'noAnswer').length >= 3) { p.status = 'discarded'; p.reason = 'injoignable (3 appels sans réponse)' }
        else p.callBackOn = addDays(day, 3)
    }
    const said: Record<CallOutcome, string> = { interested: 'intéressé', no: 'pas intéressé', later: 'rappeler plus tard', noAnswer: 'pas de réponse' }
    record(state, 'call', `${p.company} : appel (${said[outcome] || outcome})`, { id })
}
