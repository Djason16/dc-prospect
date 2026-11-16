// State of the day for the interface (GET /api/state) and preview of an e-mail with the signature (GET /api/preview/:id/:step)
import { cfg, today, addDays, dateOf, frenchDate, dayName, nextSendDay, inSendWindow, daysText } from '../services/base.js'
import { toApprove, sendQueue, findProspect, sentOn, nextStep, STEP_NAME, REPLY_KIND, classifyReply } from '../services/prospecting.js'
import { dailyLimit } from '../services/deliverability.js'
import { compose } from '../services/mail.js'
import { zoneOfTheWeek } from '../services/settings.js'
import { figures, figuresByTrade, figuresBySubject } from '../services/report.js'
import { replyModel, insights, bestMoments, sendingHealth, armStats } from '../services/learning.js'
import { writingHints, searchAdvice } from '../services/followThrough.js'
import { checkText } from '../services/claude.js'
import { activeTrades } from '../services/settings.js'
import { canRestore } from '../services/leadsTools.js'
import { ApiError } from '../utils/ResponseHelper.js'
import type { App, Prospect, Draft, StepName, ProspectStatus, CallRecord } from '../types.js'

// A draft and its prospect, as listed by toApprove and sendQueue
interface DraftItem { p: Prospect, step: StepName, draft: Draft }
const STEPS: readonly StepName[] = ['first', 'followUp1', 'followUp2']
const isStep = (s: unknown): s is StepName => STEPS.includes(s as StepName)

// Status of a prospect as shown in the app
const STATUS_LABEL: Record<ProspectStatus, string> = {
    ready: 'Prêt', inSequence: 'En séquence', replied: 'A répondu', stopped: 'STOP', finished: 'Séquence finie',
    discarded: 'Écarté', otherChannel: 'À appeler', client: 'Client',
}

const CALL_LABEL: Record<CallRecord['outcome'], string> = { interested: 'intéressé', no: 'pas intéressé', later: 'rappeler plus tard', noAnswer: 'pas de réponse' }

export const StateController = {
    getAll(app: App) {
        const state = app.state
        const card = ({ p, step, draft }: DraftItem) => ({
            id: p.id, step, stepName: STEP_NAME[step], subject: draft.subject, body: draft.body, batch: draft.batch,
            // checked again with the rules of today (a draft written before a change of the rules keeps no old problem)
            problems: checkText(step === 'first' ? draft.subject : '', draft.body),
            status: draft.status, autoApproved: !!draft.autoApproved, hints: writingHints(draft.subject, draft.body), company: p.company, trade: p.trade, city: p.city, zone: p.zone, email: p.email, emailSource: p.emailSource,
            website: p.website, platform: p.platform, signal: p.signal, googleRating: p.googleRating, detail: p.detail, score: p.score, level: p.level,
            facts: p.audit?.signals || [], emailChecked: !!p.emailChecked, chance: typeof p.chance === 'number' ? Math.round(p.chance * 1000) / 10 : null, subjectStyle: draft.subjectStyle || null, writer: draft.writer || null,
            firstSentOn: frenchDate(p.steps?.first?.sentOn),
        })
        const monday = addDays(today(), -((dateOf(today()).getDay() + 6) % 7))
        const zones = [...new Set([...cfg.zones.map((z) => z.name), ...state.prospects.map((p) => p.zone).filter((z): z is string => !!z)])]
        return {
            today: dayName(today()), zone: zoneOfTheWeek() || 'aucune',
            busy: app.busy, progress: app.progress,
            error: app.standby ? `Ce PC est en veille : l'outil tourne sur le PC ${app.standby}.` : app.error,
            sent: sentOn(state), max: dailyLimit(today(), state), inWindow: inSendWindow(), windows: cfg.sendWindows.map((w) => w.join(' - ')).join(' et '), sendDays: daysText(cfg.sendDays || []),
            nextSendDay: dayName(nextSendDay()), pauseUntil: cfg.pauseUntil && cfg.pauseUntil >= today() ? frenchDate(cfg.pauseUntil) : null,
            toApprove: toApprove(state).map(card),
            queue: sendQueue(state).map(card),
            replies: state.prospects.filter((p): p is Prospect & { reply: NonNullable<Prospect['reply']> } => p.status === 'replied' && !p.tracking?.handled && !!p.reply)
                .map((p) => {
                    const kind = p.reply.kind || classifyReply(p.reply.excerpt)
                    return { id: p.id, company: p.company, city: p.city, email: p.email, date: frenchDate(p.reply.date), excerpt: p.reply.excerpt, kind, kindLabel: p.reply.recontact ? 'À recontacter' : REPLY_KIND[kind], recontact: !!p.reply.recontact, kindConfirmed: !!p.reply.kindConfirmed, answer: p.reply.answer || null, answered: !!p.reply.answered }
                }),
            toCall: state.prospects.filter((p) => p.status === 'otherChannel' && (!p.callBackOn || p.callBackOn <= today())).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 100)
                .map((p) => ({ id: p.id, company: p.company, trade: p.trade, city: p.city, phone: p.phone, website: p.website, signal: p.signal, level: p.level, callHook: p.callHook, contact: p.contact, calls: (p.calls || []).length })),
            searchAdvice: searchAdvice(state, { activeTrades: activeTrades().length, reserve: cfg.readyReserve }),
            blockedDomains: (state.blockedDomains || []).length, testEmailDone: !!state.testEmailOn || state.prospects.some((p) => p.steps?.first),
            // set aside (last 100): why, and whether it can be put back
            discarded: state.prospects.filter((p) => p.status === 'discarded').slice(-100).reverse()
                .map((p) => ({ id: p.id, company: p.company, trade: p.trade, city: p.city, reason: p.reason || '', restorable: canRestore(p) })),
            tracked: state.prospects.filter((p) => p.status !== 'discarded')
                .sort((a, b) => (b.steps?.first?.sentOn || b.addedOn || '').localeCompare(a.steps?.first?.sentOn || a.addedOn || '')).slice(0, 400)
                .map((p) => {
                    const n = nextStep(p)
                    return {
                        id: p.id, company: p.company, trade: p.trade, city: p.city, zone: p.zone, email: p.email, status: STATUS_LABEL[p.status] || p.status, score: p.score,
                        first: frenchDate(p.steps?.first?.sentOn), followUp1: frenchDate(p.steps?.followUp1?.sentOn), followUp2: frenchDate(p.steps?.followUp2?.sentOn),
                        next: n && n.due ? `${STEP_NAME[n.step]} le ${frenchDate(n.due)}` : '', reply: p.reply?.excerpt || '',
                        // details shown when I open the prospect
                        website: p.website || '', phone: p.phone || '', contact: p.contact || '', level: p.level || '', facts: p.audit?.signals || [], notes: p.notes || '',
                        sent: Object.entries(p.steps || {}).map(([s, x]) => ({ step: isStep(s) ? STEP_NAME[s] : s, on: frenchDate(x.sentOn), subject: x.subject || '', body: (isStep(s) && p.drafts?.[s]?.body) || '' })),
                        calls: (p.calls || []).map((c) => `${frenchDate(c.on)} : ${CALL_LABEL[c.outcome] || c.outcome}`),
                        reason: p.reason || '', remindOn: frenchDate(p.remindOn),
                    }
                }),
            stats: {
                zones: zones.map((z) => ({ zone: z, ...figures(state, '0000', '9999', z) })),
                week: figures(state, monday, addDays(monday, 6)), total: figures(state), trades: figuresByTrade(state), subjects: figuresBySubject(state),
                ready: state.prospects.filter((p) => p.status === 'ready' && p.drafts?.first?.status === 'reserved').length, reserve: cfg.readyReserve,
                learning: insights(replyModel(state)), moments: bestMoments(state), sending: sendingHealth(state),
                bodies: armStats(state, ['standard', 'short'], (p) => p.drafts?.first?.bodyStyle),
            },
            health: app.health(),
            log: state.log.slice(-40).reverse().map((e) => ({ time: new Date(e.date).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }), text: e.text })),
        }
    },

    // HTML page of the e-mail as the prospect will see it
    preview(app: App, { id, step }: { id: string, step: StepName }): string {
        const draft = findProspect(app.state, id)?.drafts?.[step]
        if (!draft) throw new ApiError('E-mail introuvable', 404, 'NOT_FOUND')
        return `<!doctype html><meta charset="utf-8"><title>Aperçu</title><body style="margin:24px;background:#fff">${compose(draft.body, { stop: true }).html}</body>`
    },
}
