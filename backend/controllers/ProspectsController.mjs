// What I decide in the interface: approve or reject an e-mail, note what happened with a prospect, prepare the day now
import { today, record } from '../services/base.mjs'
import { findProspect, STEP_NAME } from '../services/prospecting.mjs'
import { checkText, capitalizeSubject } from '../services/claude.mjs'
import { ApiError } from '../utils/ResponseHelper.mjs'

const failIfStandby = (app) => { if (app.standby) throw new ApiError(`L'outil tourne sur le PC ${app.standby} : valide et note depuis ce PC-là (celui-ci est en veille).`, 409, 'CONFLICT') }

export const ProspectsController = {
    // POST /api/drafts { id, step, action: approve | cancel | reject, subject?, body? }
    draft(app, d) {
        failIfStandby(app)
        const p = findProspect(app.state, d.id), draft = p?.drafts?.[d.step]
        if (!draft || !['toApprove', 'approved'].includes(draft.status)) throw new ApiError('Brouillon introuvable', 404, 'NOT_FOUND')
        if (typeof d.subject === 'string') draft.subject = capitalizeSubject(d.subject)
        if (typeof d.body === 'string') draft.body = d.body.replace(/\r/g, '').trim()
        draft.problems = checkText(draft.subject, draft.body)
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
    track(app, d) {
        failIfStandby(app)
        const state = app.state, p = findProspect(state, d.id)
        if (!p) throw new ApiError('Prospect introuvable', 404, 'NOT_FOUND')
        p.tracking = p.tracking || {}
        const day = today(), a = d.action
        if (['call', 'mockup', 'proposal', 'client'].includes(a)) p.tracking[a] = day
        if (['handled', 'call', 'mockup', 'proposal', 'client'].includes(a) && p.reply) p.tracking.handled = day
        if (a === 'client') p.status = 'client'
        if (a === 'declined' || a === 'stop') {
            // result shown in the tracking table (French)
            p.status = 'stopped'; p.stoppedOn = day; p.tracking.result = a === 'declined' ? 'Refus' : 'STOP'
            if (p.email && !state.stop.includes(p.email)) state.stop.push(p.email)
            for (const draft of Object.values(p.drafts || {})) if (['toApprove', 'approved'].includes(draft.status)) draft.status = 'cancelled'
        }
        if (a === 'discard') { p.status = 'discarded'; p.reason = 'retiré à la main' }
        record(state, 'tracking', `${p.company} : ${a}`, { id: p.id })
        app.changed()
        return {}
    },

    // POST /api/prepare : research and batch of the day, now
    prepare(app) {
        failIfStandby(app)
        app.runDay(true)
        return {}
    },
}
