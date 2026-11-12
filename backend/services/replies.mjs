// Answers to the prospects who replied: prepared by the chosen writer (AI, built-in AI or template), changed by me if needed,
// then sent in the same thread after my click
import { today, dateOf, record } from './base.mjs'
import { findProspect, classifyReply, writingEngine } from './prospecting.mjs'
import { provider } from './ai.mjs'
import { writeReplyDraft, checkText } from './claude.mjs'
import { localReply } from './localWriter.mjs'
import { templateReply } from './templates.mjs'
import { send } from './mail.mjs'
import { scheduleReminder } from './followThrough.mjs'

export async function draftReply(state, id) {
    const p = findProspect(state, id)
    if (!p?.reply) throw new Error('Pas de réponse de ce prospect')
    // a « plus tard » whose date has come: a message to come back to him
    const kind = p.reply.recontact ? 'recontact' : p.reply.kind || classifyReply(p.reply.excerpt)
    const r = writingEngine() === 'templates' ? templateReply(p, kind) : provider() === 'local' ? await localReply(p, kind) : await writeReplyDraft(p, kind)
    p.reply.answer = { body: r.body, preparedOn: today(), problems: checkText('', r.body) }
    return p.reply.answer
}

export async function sendReply(state, id, body) {
    const p = findProspect(state, id)
    if (!p?.reply || !p.email) throw new Error('Pas de réponse de ce prospect')
    const text = String(body || '').replace(/\r/g, '').trim()
    const problems = checkText('', text).filter((x) => !/STOP/.test(x))
    if (!text) throw new Error('Réponse vide')
    if (problems.length) throw new Error('À corriger avant envoi : ' + problems.join(', '))
    const subject = /^re\s*:/i.test(p.reply.subject || '') ? p.reply.subject : `Re: ${p.reply.subject || p.drafts?.first?.subject || ''}`
    const sent = await send({ to: p.email, subject, body: text, signature: 'main', stop: false, inReplyTo: p.reply.messageId, threadId: p.steps?.first?.threadId,
        quote: { header: `Le ${dateOf(p.reply.date).toLocaleDateString('fr-FR')}, ${p.contact || p.company} a écrit :`, text: p.reply.excerpt } })
    p.reply.answered = { on: today(), messageId: sent.messageId, body: text }
    p.tracking = { ...(p.tracking || {}), handled: today() }
    scheduleReminder(p)
    record(state, 'reply', `Réponse envoyée à ${p.company}`, { id: p.id })
}
