// What I decide in the interface: approve or reject an e-mail, note what happened with a prospect, prepare the day now
import { today, record } from '../services/base.js'
import { findProspect, STEP_NAME, REPLY_KIND, rewriteDraft } from '../services/prospecting.js'
import { draftReply, sendReply } from '../services/replies.js'
import { scheduleReminder } from '../services/followThrough.js'
import { importLeads, addDoNotContact, eraseProspect, callOutcome, restoreProspect } from '../services/leadsTools.js'
import { checkText, capitalizeSubject } from '../services/claude.js'
import { ApiError, errorMessage } from '../utils/ResponseHelper.js'
import type { App, StepName, ReplyKindName, Draft } from '../types.js'
import type { CallOutcome } from '../services/leadsTools.js'

// Bodies of the requests, as the interface sends them (the server parses the JSON; each handler checks what matters)
export interface DraftBody { id: string, step: StepName, action: string, subject?: unknown, body?: unknown }
export interface TrackingBody { id: string, action: string }
export interface IdBody { id: string }
export interface ReplyBody { id: string, body?: unknown }
export interface ReplyKindBody { id: string, kind: string }
export interface RewriteBody { id: string, step: StepName }
export interface NotesBody { id: string, text?: unknown }
export interface ImportBody { csv?: unknown }
export interface DoNotContactBody { text?: unknown }
export interface CallBody { id: string, outcome: string }
const TRACKING_DATES = ['call', 'mockup', 'proposal', 'client'] as const
type TrackingDate = typeof TRACKING_DATES[number]
const isTrackingDate = (a: string): a is TrackingDate => (TRACKING_DATES as readonly string[]).includes(a)
const isReplyKind = (k: string): k is ReplyKindName => k in REPLY_KIND
const CALL_OUTCOMES: readonly string[] = ['interested', 'no', 'later', 'noAnswer']

const failIfStandby = (app: App): void => { if (app.standby) throw new ApiError(`L'outil tourne sur le PC ${app.standby} : valide et note depuis ce PC-là (celui-ci est en veille).`, 409, 'CONFLICT') }

export const ProspectsController = {
    // POST /api/drafts { id, step, action: approve | cancel | reject, subject?, body? }
    draft(app: App, d: DraftBody) {
        failIfStandby(app)
        const p = findProspect(app.state, d.id), draft = p?.drafts?.[d.step]
        if (!p || !draft || !['toApprove', 'approved'].includes(draft.status)) throw new ApiError('Brouillon introuvable', 404, 'NOT_FOUND')
        if (typeof d.subject === 'string') draft.subject = capitalizeSubject(d.subject)
        if (typeof d.body === 'string') draft.body = d.body.replace(/\r/g, '').trim()
        // a follow-up keeps the subject of the e-mail already sent (« Re: ... », same conversation): only its text is checked
        draft.problems = checkText(d.step === 'first' ? draft.subject : '', draft.body)
        if (d.action === 'approve') {
            if (draft.problems.length) throw new ApiError('À corriger avant validation : ' + draft.problems.join(', '))
            draft.status = 'approved'; draft.approvedAt = new Date().toISOString()
        } else if (d.action === 'cancel') {
            draft.status = 'toApprove'
        } else if (d.action === 'reject') {
            draft.status = 'rejected'
            if (d.step === 'first') { p.status = 'discarded'; p.reason = 'refusé à la validation' } else { p.status = 'finished'; p.reason = 'relance refusée à la validation' }
            record(app.state, 'review', `${p.company} : ${STEP_NAME[d.step]} refusé, prospect retiré de la séquence`, { id: p.id })
        } else throw new ApiError('Action inconnue')
        app.changed()
        return { problems: draft.problems }
    },

    // POST /api/tracking { id, action: call | mockup | proposal | client | handled | declined | stop | discard }
    track(app: App, d: TrackingBody) {
        failIfStandby(app)
        const state = app.state, p = findProspect(state, d.id)
        if (!p) throw new ApiError('Prospect introuvable', 404, 'NOT_FOUND')
        p.tracking = p.tracking || {}
        const day = today(), a = d.action
        if (isTrackingDate(a)) p.tracking[a] = day
        if (['handled', 'call', 'mockup', 'proposal', 'client'].includes(a) && p.reply) p.tracking.handled = day
        if (a === 'handled') scheduleReminder(p) // « plus tard » : back on the home screen at the right time
        if (a === 'client') p.status = 'client'
        if (a === 'declined' || a === 'stop') {
            // result shown in the tracking table (French)
            p.status = 'stopped'; p.stoppedOn = day; p.tracking.result = a === 'declined' ? 'Refus' : 'STOP'
            if (p.email && !state.stop.includes(p.email)) state.stop.push(p.email)
            for (const draft of Object.values(p.drafts || {}) as Draft[]) if (['toApprove', 'approved'].includes(draft.status)) draft.status = 'cancelled'
        }
        if (a === 'discard') { p.status = 'discarded'; p.reason = 'retiré à la main' }
        record(state, 'tracking', `${p.company} : ${a}`, { id: p.id })
        app.changed()
        return {}
    },

    // POST /api/replies/draft { id } : an answer prepared for a prospect who replied (AI or template), to read and change
    async draftReply(app: App, d: IdBody) {
        failIfStandby(app)
        try { const answer = await draftReply(app.state, d.id); app.changed(); return { answer } } catch (e) { throw new ApiError(errorMessage(e)) }
    },
    // POST /api/replies/send { id, body } : sends my answer in the same thread (my approval = this click)
    async sendReply(app: App, d: ReplyBody) {
        failIfStandby(app)
        try { await sendReply(app.state, d.id, d.body); app.changed(); return {} } catch (e) { throw new ApiError(errorMessage(e)) }
    },

    // POST /api/replies/kind { id, kind } : kind of a reply corrected by me (the internal AI learns from it)
    replyKind(app: App, d: ReplyKindBody) {
        failIfStandby(app)
        const p = findProspect(app.state, d.id)
        if (!p?.reply) throw new ApiError('Réponse introuvable', 404, 'NOT_FOUND')
        if (!isReplyKind(d.kind)) throw new ApiError('Type de réponse inconnu')
        p.reply.kind = d.kind; p.reply.kindConfirmed = true
        delete p.reply.answer // the prepared answer followed the old kind
        app.changed()
        return {}
    },

    // POST /api/drafts/rewrite { id, step } : a new version of the e-mail
    async rewrite(app: App, d: RewriteBody) {
        failIfStandby(app)
        const p = findProspect(app.state, d.id)
        try {
            if (!p) throw new Error('Brouillon introuvable')
            const draft = await rewriteDraft(p, d.step); app.changed(); return { draft }
        } catch (e) { throw new ApiError(errorMessage(e)) }
    },
    // POST /api/notes { id, text } : my notes on a prospect (kept, shown in its card)
    notes(app: App, d: NotesBody) {
        const p = findProspect(app.state, d.id)
        if (!p) throw new ApiError('Prospect introuvable', 404, 'NOT_FOUND')
        p.notes = String(d.text || '').slice(0, 5000)
        app.changed()
        return {}
    },
    // POST /api/restore { id } : a prospect set aside by mistake, back in the reserve (its first e-mail written again)
    async restore(app: App, d: IdBody) {
        failIfStandby(app)
        try { await restoreProspect(app.state, d.id) } catch (e) { throw new ApiError(errorMessage(e)) }
        app.changed(); return {}
    },
    // POST /api/import { csv } : my own list of prospects, checked like the others (in the background)
    async importLeads(app: App, d: ImportBody) {
        failIfStandby(app)
        try { return await importLeads(app.state, d.csv, () => app.changed()) } catch (e) { throw new ApiError(errorMessage(e)) }
    },
    // POST /api/do-not-contact { text } : e-mails or domains never to write to
    doNotContact(app: App, d: DoNotContactBody) { failIfStandby(app); const added = addDoNotContact(app.state, d.text); app.changed(); return { added, domains: app.state.blockedDomains?.length || 0 } },
    // POST /api/erase { id } : erasure of a prospect's data at his request (GDPR)
    erase(app: App, d: IdBody) { failIfStandby(app); try { eraseProspect(app.state, d.id) } catch (e) { throw new ApiError(errorMessage(e), 404, 'NOT_FOUND') } app.changed(); return {} },
    // POST /api/calls { id, outcome: interested | no | later | noAnswer } : outcome of a phone call
    call(app: App, d: CallBody) {
        failIfStandby(app)
        if (!CALL_OUTCOMES.includes(d.outcome)) throw new ApiError("Résultat d'appel inconnu")
        try { callOutcome(app.state, d.id, d.outcome as CallOutcome) } catch (e) { throw new ApiError(errorMessage(e), 404, 'NOT_FOUND') }
        app.changed(); return {}
    },

    // POST /api/prepare : research and batch of the day, now
    prepare(app: App) {
        failIfStandby(app)
        app.state.firstSearchOn = app.state.firstSearchOn || new Date().toISOString().slice(0, 10)
        app.runDay(true)
        return {}
    },
}
