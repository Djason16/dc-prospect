// Writing with the built-in AI (localAi.ts). A small model invents easily (an offer, a price, a fact), so it never
// writes from nothing: the templates (templates.ts) make a draft from the CHECKED facts, and the model only makes it
// read naturally, or adapts the answer to what the prospect said. Its text is kept only if it passes the checks
// (no number nor price that was not in the draft or the offer, the end kept, the usual text rules); otherwise the draft goes.
import { log } from './base.js'
import { profile, fullName } from './settings.js'
import { runLocal } from './localAi.js'
import { templateFirstEmail, templateFollowUp, templateReply } from './templates.js'
import type { TemplateFacts, WritingOptions } from './templates.js'
import type { JsonSchema } from './ai.js'
import type { Prospect, StepName, AnswerKind, WrittenEmail } from '../types.js'

const BODY: JsonSchema = { type: 'object', properties: { body: { type: 'string' } }, required: ['body'] }
const numbers = (s: unknown) => new Set((String(s).match(/\d+(?:[.,]\d+)?/g) || []).map((n) => n.replace(',', '.')))

// Same rules as claude.ts checkText (kept here to avoid a circular import)
function textProblems(body: string): string[] {
    const p = []
    if (/[—–]/.test(body)) p.push('tiret long')
    if (/\[|\]|___|\{|\}/.test(body)) p.push('crochet')
    // « nous » outside the quotes (a sentence of the prospect's site may say it)
    if (/\bnous\b/i.test(body.replace(/«[^»]*»/g, ''))) p.push('nous')
    if (/signature|stop/i.test(body)) p.push('signature ou STOP')
    if (/\bleurs? (site|page|entreprise)\b|\bils ont\b/i.test(body)) p.push('parle de l\'entreprise au lieu de lui parler')
    if (/\*|^#|^\s*- /m.test(body)) p.push('mise en forme (gras, titres, listes)')
    if (/\b(tu|te|toi|ton|ta|tes|dis-moi|n'hésite pas)\b/i.test(body)) p.push('tutoiement')
    return p
}

// The model's version if it is safe, else the draft
async function polish(draft: string, instruction: string, context = '', maxRatio = 1.8): Promise<string> {
    const me = profile()
    const prompt = `Tu écris en français pour ${fullName(me) || 'un indépendant'}, ${me.activity || 'indépendant'} à ${me.city || ''}.
${instruction}
Règles strictes :
- N'invente rien : aucun fait, aucun prix, aucun chiffre, aucune offre, aucune démo, aucune promesse qui ne soit pas dans le brouillon ou dans « Ce que je propose ».
- Tu t'adresses directement à l'entreprise : « vous », « votre site » (jamais « leur site » ni « ils »).
- Vouvoiement, « je » (jamais « nous »), ton simple et chaleureux, phrases courtes, pas de tiret long, pas de signature.
- Commence par la salutation du brouillon et finis par « Bien à vous, ».
Ce que je propose : ${me.offer || 'voir le brouillon'}
${context}
Brouillon :
${draft}

Réponds uniquement en JSON : { "body": "le texte" }`
    try {
        const out = String((JSON.parse(await runLocal(prompt, { minutes: 4, schema: BODY })) as { body?: unknown }).body || '').replace(/\r/g, '').trim()
            // a text on one line: the greeting and the ending on their own lines, like the draft
            .replace(/^(Bonjour[^,\n]{0,40},)\s+(?=\S)/, '$1\n\n').replace(/\s+(Bien à vous,?)\s*$/, '\n\n$1')
            .replace(/^(Bonjour[^,\n]{0,40},\n\n)(\p{Ll})/u, (m, a: string, b: string) => a + b.toUpperCase())
        const allowed = new Set([...numbers(draft), ...numbers(me.offer), ...numbers(context)])
        const invented = [...numbers(out)].filter((n) => !allowed.has(n))
        // promises it could invent (a demo, a mock-up, a free audit...) only if the draft or the offer already make them
        const promise = /d[ée]mo(nstration)?|maquette|audit|offert|gratuit/i
        const invents = promise.test(out) && !promise.test(`${draft} ${me.offer} ${context}`)
        // the greeting of the draft is kept (« Bonjour Sylvie, »)
        const greeting = draft.split('\n')[0].trim()
        const sane = !invents && out.startsWith(greeting) && out.length >= draft.length * 0.6 && out.length <= draft.length * maxRatio && /Bien à vous,?\s*$/.test(out) && !invented.length && !textProblems(out).length
        if (sane) return out
        log(`IA intégrée : texte écarté (${invented.length ? 'chiffres inventés ' + invented.join(', ') : 'règles non tenues'}), le modèle part`)
    } catch (e) { log('IA intégrée :', (e as Error).message) }
    return draft
}

// What the previous version got wrong (button « Réécrire »)
const avoid = (fix?: string[]) => (fix?.length ? ` Une version précédente avait ces défauts, ne les refais pas : ${fix.join(' ; ')}.` : '')

export async function localFirstEmail(p: TemplateFacts, options?: WritingOptions): Promise<WrittenEmail> {
    const draft = templateFirstEmail(p, options)
    const length = options?.bodyStyle === 'short' ? 'court (40 à 70 mots)' : 'entre 90 et 150 mots'
    return { subject: draft.subject, body: await polish(draft.body, `Voici un e-mail de prospection écrit à partir de faits vérifiés. Réécris-le pour qu'il sonne naturel et personnel, ${length}, en gardant chaque fait et la question finale.${avoid(options?.fix)}`) }
}

export async function localFollowUp(p: TemplateFacts, step: StepName, fix?: string[]): Promise<{ body: string }> {
    const draft = templateFollowUp(p, step)
    return { body: await polish(draft.body, `Voici une relance de prospection. Réécris-la pour qu'elle sonne naturelle, courte (60 à 120 mots), en gardant le conseil et la proposition finale.${avoid(fix)}`) }
}

export async function localReply(p: TemplateFacts & Pick<Prospect, 'reply'>, kind: AnswerKind): Promise<{ body: string }> {
    const draft = templateReply(p, kind)
    return { body: await polish(draft.body, 'Voici une réponse type à un prospect qui m\'a répondu. Adapte-la pour répondre précisément à ce qu\'il a écrit (en t\'appuyant seulement sur « Ce que je propose »), 40 à 120 mots, en gardant la proposition finale.', `Ce que le prospect a écrit : « ${p.reply?.excerpt || ''} »`, 3) }
}
