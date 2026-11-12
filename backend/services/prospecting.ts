// The plan, step by step: replies and STOP, batch of the day, sending queue, the 12-month rule.
// The research of new leads is in leadSearch.ts, the choice of the engines in writers.ts.
import { cfg, today, addDays, isSendDay, isPaused, inSendWindow, dateOf, record, log } from './base.js'
import { zoneOfTheWeek, fullName } from './settings.js'
import { checkText, capitalizeSubject, classifyReplyWithAi } from './claude.js'
import { ruleKind, replyKind, replyModel, replyChance } from './learning.js'
import { dailyLimit } from './deliverability.js'
import { send, readReplies } from './mail.js'
import { writingEngine, firstEmail, followUp } from './writers.js'
import { WEBMAILS, isStopped } from './leadSearch.js'
import type { State, Prospect, StepName, Draft, ReplyKindName } from '../types.js'

// kept here too: the controllers and the engine import them from this file
export { searchEngine, writingEngine } from './writers.js'
export { search, addLead, knownSet, yieldPerTrade } from './leadSearch.js'

// Kind of a reply (interested | question | later | no): rules, then what the internal AI learned (learning.ts)
export const classifyReply = ruleKind
export const REPLY_KIND: Record<ReplyKindName, string> = { interested: 'Intéressé', question: 'Question', later: 'Plus tard', no: 'Pas intéressé' }

const STEPS: StepName[] = ['first', 'followUp1', 'followUp2']
// Names of the steps shown to the user
export const STEP_NAME: Record<StepName, string> = { first: '1er e-mail', followUp1: 'Relance 1', followUp2: 'Relance 2' }

export const findProspect = (state: State, id: unknown) => state.prospects.find((p) => p.id === id)
export const sentOn = (state: State, day = today()) => state.sendsPerDay[day] || 0

// Next step of a prospect in sequence and the day it is due
/** A draft waiting in a list (to approve, or approved and waiting to be sent) */
export interface QueuedDraft { p: Prospect, step: StepName, draft: Draft }

export function nextStep(p: Prospect): { step: StepName, due: string | null } | null {
    if (!['ready', 'inSequence'].includes(p.status)) return null
    const firstSent = p.steps?.first?.sentOn
    if (!firstSent) return { step: 'first', due: null }
    if (!p.steps.followUp1) return { step: 'followUp1', due: addDays(firstSent, cfg.followUpDays.first) }
    if (!p.steps.followUp2) return { step: 'followUp2', due: addDays(firstSent, cfg.followUpDays.second) }
    return null
}

// ---------- 1. Replies, STOP, bounces ----------
export async function syncReplies(state: State): Promise<number> {
    const addresses = new Set(state.prospects.filter((p) => p.email && p.steps?.first).map((p) => (p.email || '').toLowerCase()))
    const domains = new Set([...addresses].filter((a) => !WEBMAILS.test(a)).map((a) => a.split('@')[1]))
    if (!addresses.size) return 0
    const messages = await readReplies(30, (e) => !state.seenMessages.includes(e.id) && (e.bounce || addresses.has(e.from) || domains.has(e.from.split('@')[1])))
    let changed = 0
    for (const m of messages) {
        if (state.seenMessages.includes(m.id)) continue
        state.seenMessages.push(m.id)
        // contacted prospects: they all have an e-mail
        const contacted = state.prospects.filter((p): p is Prospect & { email: string } => !!p.email && !!p.steps?.first)
        if (m.bounce) {
            const p = contacted.find((x) => m.text.toLowerCase().includes(x.email.toLowerCase()))
            if (p && p.status !== 'stopped') {
                p.status = 'discarded'; p.reason = 'adresse invalide (e-mail revenu)'
                record(state, 'bounce', `${p.company} : adresse ${p.email} invalide, séquence arrêtée`, { id: p.id })
                changed++
            }
            continue
        }
        const domain = (e: string) => e.split('@')[1]
        const p = contacted.find((x) => x.email.toLowerCase() === m.from) ||
            contacted.find((x) => !WEBMAILS.test(m.from) && domain(x.email.toLowerCase()) === domain(m.from))
        if (!p) continue
        if (/réponse automatique|absence|out of office|automatic reply|autoreply/i.test(m.subject)) continue
        // Only the new text, not the quoted e-mail
        const newText = m.text.split(/\n>|\nLe .{5,80}a écrit|\nOn .{5,80}wrote|-----Original/)[0]
        const wantsStop = /\bstop\b|d[ée]sinscri|ne (plus|pas) (me |nous )?(contacter|[ée]crire|recevoir|solliciter)/i.test(`${m.subject}\n${newText}`)
        p.reply = { date: m.date?.slice(0, 10) || today(), subject: m.subject, excerpt: newText.replace(/\s+/g, ' ').trim().slice(0, 400), read: false, messageId: m.id, kind: replyKind(state, newText) }
        // the rules hesitate (« question » by default): the AI of the formula reads the reply
        if (!wantsStop && p.reply.kind === 'question' && writingEngine() === 'ai') {
            try { const k = await classifyReplyWithAi(newText); if (REPLY_KIND[k] && p.reply) p.reply.kind = k } catch (e) { log("Type de réponse par l'IA :", (e as Error).message) }
        }
        if (wantsStop) {
            p.status = 'stopped'; p.stoppedOn = today()
            if (!state.stop.includes(p.email.toLowerCase())) state.stop.push(p.email.toLowerCase())
            record(state, 'stop', `${p.company} a répondu STOP : retiré pour toujours`, { id: p.id })
        } else if (p.status !== 'stopped') {
            p.status = 'replied'
            record(state, 'reply', `${p.company} a répondu : à traiter`, { id: p.id })
        }
        for (const s of STEPS) { const d = p.drafts?.[s]; if (d && ['approved', 'toApprove'].includes(d.status)) d.status = 'cancelled' }
        changed++
    }
    return changed
}

// ---------- 3. Batch of the day (send days only): follow-ups due, then first e-mails ----------
export async function prepareBatch(state: State, { onProgress = () => {} }: { onProgress?: (text: string) => void } = {}): Promise<{ followUps: number, firsts: number }> {
    const day = today()
    if (!isSendDay(day)) return { followUps: 0, firsts: 0 }
    // first e-mails not approved on a previous day go back to the reserve
    for (const p of state.prospects) {
        const d = p.drafts?.first
        if (p.status === 'ready' && d?.status === 'toApprove' && d.batch !== day) { d.status = 'reserved'; delete d.batch }
    }
    const alreadyInBatch = state.prospects.filter((p) => STEPS.some((s) => p.drafts?.[s]?.batch === day && p.drafts[s]?.status !== 'cancelled')).length
    let room = dailyLimit(day, state) - Math.max(alreadyInBatch, sentOn(state))
    let followUps = 0
    for (const p of state.prospects) {
        const n = nextStep(p)
        if (!n || n.step === 'first' || (n.due || '') > day || room <= 0) continue
        const existing = p.drafts[n.step]
        if (existing && existing.status !== 'rejected') continue
        onProgress(`Rédaction de la ${STEP_NAME[n.step].toLowerCase()} : ${p.company}`)
        try {
            const r = await followUp(p, n.step)
            const problems = checkText('', r.body)
            // option (Réglages, Calendrier): the follow-ups go without my click when their text is clean (the 1st e-mail was approved by me)
            const auto = cfg.autoApproveFollowUps && !problems.length
            p.drafts[n.step] = { subject: replySubject(capitalizeSubject(p.drafts.first?.subject)), body: r.body, status: auto ? 'approved' : 'toApprove', batch: day, preparedOn: day, writer: writingEngine(), problems, ...(auto ? { approvedAt: new Date().toISOString(), autoApproved: true } : {}) }
            room--; followUps++
        } catch (e) { log('Relance non rédigée', p.company, (e as Error).message) }
    }
    const quota = Math.min(cfg.firstEmailsPerDay[dateOf(day).getDay()] || 0, room)
    const zone = zoneOfTheWeek()
    // the internal AI estimates the chance of a reply of each prospect (once enough results are known); the score before
    const model = replyModel(state)
    const reserve = state.prospects.filter((p) => p.status === 'ready' && p.drafts?.first?.status === 'reserved')
    for (const p of reserve) p.chance = replyChance(model, p)
    const chosen = reserve
        .sort((a, b) => Number(b.zone === zone) - Number(a.zone === zone) || (model ? (b.chance ?? 0) - (a.chance ?? 0) : b.score - a.score) || a.addedOn.localeCompare(b.addedOn))
        .slice(0, Math.max(0, quota))
    for (const p of chosen) Object.assign(p.drafts.first || {}, { status: 'toApprove', batch: day })
    if (followUps || chosen.length) record(state, 'batch', `Lot du jour : ${chosen.length} premiers e-mails et ${followUps} relances à valider`)
    return { followUps, firsts: chosen.length }
}

// A new version of a draft (button « Réécrire » on its card): same prospect, same step, same style of subject
export async function rewriteDraft(p: Prospect | undefined, step: StepName): Promise<Draft> {
    const d = p?.drafts?.[step]
    if (!p || !d || !['toApprove', 'reserved'].includes(d.status)) throw new Error('Brouillon introuvable')
    if (step === 'first') {
        const m = await firstEmail(p, { subjectStyle: d.subjectStyle || 'A', bodyStyle: d.bodyStyle || 'standard' })
        Object.assign(d, { subject: capitalizeSubject(m.subject), body: m.body, writer: writingEngine(), problems: checkText(m.subject, m.body) })
    } else {
        const r = await followUp(p, step)
        Object.assign(d, { body: r.body, writer: writingEngine(), problems: checkText('', r.body) })
    }
    return d
}

const replySubject = (s: string) => (/^re\s*:/i.test(s || '') ? s : `Re: ${s}`)

// Drafts waiting for my approval, today's batch first
export function toApprove(state: State): QueuedDraft[] {
    const list: QueuedDraft[] = []
    for (const p of state.prospects) for (const s of STEPS) {
        const d = p.drafts?.[s]
        if (d?.status === 'toApprove') list.push({ p, step: s, draft: d })
    }
    return list.sort((x, y) => (x.draft.batch || '').localeCompare(y.draft.batch || '') || STEPS.indexOf(y.step) - STEPS.indexOf(x.step) || y.p.score - x.p.score)
}

export function sendQueue(state: State): QueuedDraft[] {
    const list: QueuedDraft[] = []
    for (const p of state.prospects) for (const s of STEPS) { const d = p.drafts?.[s]; if (d?.status === 'approved') list.push({ p, step: s, draft: d }) }
    return list.sort((x, y) => (x.draft.approvedAt || '').localeCompare(y.draft.approvedAt || ''))
}

// ---------- 4. Send one approved e-mail if we are in a sending window ----------
export async function sendNext(state: State): Promise<QueuedDraft | null> {
    const day = today()
    if (!inSendWindow() || isPaused(day)) return null
    if (sentOn(state) >= dailyLimit(day, state)) return null
    const sinceLast = state.lastSentAt ? Date.now() - new Date(state.lastSentAt).getTime() : Infinity
    const [min, max] = cfg.gapMinutes
    if (sinceLast < (state.nextGapMinutes || min) * 60e3) return null
    const next = sendQueue(state).find(({ p }) => ['ready', 'inSequence'].includes(p.status) && !isStopped(state, p.email))
    if (!next) return null
    const { p, step, draft } = next
    // a follow-up goes in the conversation of the first e-mail
    const first = p.steps.first
    if (!p.email) return null
    const sent = await send({
        to: p.email, subject: capitalizeSubject(draft.subject), body: draft.body, signature: 'main', stop: true,
        inReplyTo: step === 'first' ? undefined : first?.messageId,
        threadId: step === 'first' ? undefined : first?.threadId,
        quote: step === 'first' || !first ? undefined : { header: `Le ${dateOf(first.sentOn).toLocaleDateString('fr-FR')}, ${fullName() || cfg.sender.name} a écrit :`, text: p.drafts.first?.body || '' },
    })
    p.steps[step] = { sentOn: day, at: new Date().toISOString(), messageId: sent.messageId, threadId: sent.threadId, subject: draft.subject }
    draft.status = 'sent'
    p.status = step === 'followUp2' ? 'finished' : 'inSequence'
    state.sendsPerDay[day] = sentOn(state) + 1
    state.lastSentAt = new Date().toISOString()
    state.nextGapMinutes = min + Math.random() * (max - min)
    record(state, 'send', `${STEP_NAME[step]} envoyé à ${p.company} (${p.email})`, { id: p.id })
    return next
}

// ---------- 5. Data rule of the plan: forget leads without reply after 12 months ----------
export function forgetOldLeads(state: State): void {
    const limit = addDays(today(), -cfg.forgetAfterDays)
    const forgotten = state.forgottenIds = state.forgottenIds || []
    const keep: Prospect[] = []
    for (const p of state.prospects) {
        const date = p.steps?.first?.sentOn || p.addedOn
        const old = date < limit && ['discarded', 'finished', 'inSequence', 'ready'].includes(p.status) && !p.reply
        if (old) forgotten.push(p.id); else keep.push(p)
    }
    const n = state.prospects.length - keep.length
    state.prospects = keep
    if (n) record(state, 'gdpr', `${n} prospects sans réponse depuis 12 mois supprimés`)
}
