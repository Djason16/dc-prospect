// Writing WITHOUT AI (Settings, Moteur, « Rédaction par modèles »): the e-mails are built from editable templates
// (resources/templates/*.txt, or the user's own files with the same names in his prompts folder), filled with the
// profile and the facts CHECKED on the prospect's site (siteAudit.mjs). Same answers as the AI writer (claude.mjs).
// The texts are read by the prospect: in French.
import fs from 'node:fs'
import path from 'node:path'
import { cfg, root, dataFolder } from './base.mjs'
import { profile, fullName } from './settings.mjs'

const FILES = { first: 'first-email.txt', firstShort: 'first-email-short.txt', followUp1: 'follow-up-1.txt', followUp2: 'follow-up-2.txt', reply: 'reply.txt' }
// My versions, written from the app (Réglages, Avancé, Mes modèles d'e-mails): in the data folder, so all my PCs use them
const myFolder = path.join(dataFolder, 'Modèles')
const original = (name) => path.join(root, 'resources', 'templates', FILES[name])

function readTemplate(name) {
    const mine = path.join(myFolder, FILES[name])
    const own = cfg.promptsFolder && path.join(cfg.promptsFolder, 'modèles', FILES[name])
    const file = [mine, own].find((f) => f && fs.existsSync(f)) || original(name)
    return fs.readFileSync(file, 'utf8')
}

// ---------- Editing from the app ----------
export const EDITABLE_TEMPLATES = { first: '1er e-mail', firstShort: '1er e-mail (version courte)', followUp1: 'Relance 1', followUp2: 'Relance 2' }
export function listTemplates() {
    return Object.entries(EDITABLE_TEMPLATES).map(([name, label]) => ({ name, label, text: readTemplate(name), custom: fs.existsSync(path.join(myFolder, FILES[name])) }))
}
// text null: back to the original. Returns the problems found (nothing saved when there are some)
export function saveTemplate(name, text) {
    if (!EDITABLE_TEMPLATES[name]) return ['modèle inconnu']
    const file = path.join(myFolder, FILES[name])
    if (text === null) { try { fs.unlinkSync(file) } catch {} return [] }
    const t = String(text || '').replace(/\r/g, '').trim()
    const problems = []
    if (!t) problems.push('le modèle est vide')
    if (!/Bien à vous,?\s*$/.test(t)) problems.push('il doit finir par « Bien à vous, »')
    if (/\[|\]/.test(t)) problems.push('pas de crochets [ ] : les mots à remplir s\'écrivent {{ENTREPRISE}}, {{VILLE}}...')
    if (/[—–]/.test(t)) problems.push('pas de tiret long')
    if (/\bnous\b/i.test(t)) problems.push('« je » plutôt que « nous »')
    const unknown = [...t.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).filter((k) => !(k in values({ company: 'x', city: '' })))
    if (unknown.length) problems.push(`mots inconnus : ${[...new Set(unknown)].map((k) => `{{${k}}}`).join(', ')}`)
    if (problems.length) return problems
    fs.mkdirSync(myFolder, { recursive: true })
    fs.writeFileSync(file, t + '\n', 'utf8')
    return []
}

// A useful advice for follow-up 1, from the main sign of a need (first match wins)
const ADVICE = [
    [/téléphone/, 'Plus de la moitié des visites d\'un site local se font sur téléphone : un site qui s\'y affiche mal fait partir la moitié des visiteurs avant même qu\'ils voient vos services.'],
    [/sécurisé|https/, 'Les navigateurs affichent « Non sécurisé » à côté d\'un site sans cadenas https : un détail qui suffit à faire douter un visiteur, alors que le corriger ne coûte presque rien.'],
    [/secondes|lourde/, 'Au-delà de 3 secondes de chargement, une bonne partie des visiteurs repart : alléger les photos de la page d\'accueil suffit souvent à gagner plusieurs secondes.'],
    [/©|mis à jour/, 'Un site qui affiche une année ancienne donne l\'impression que l\'activité est à l\'arrêt : mettre à jour les horaires, les photos et l\'année suffit à rassurer.'],
    [/Wix|Jimdo|Google Sites|Canva|Pages Jaunes|Webnode/, 'Les sites faits avec un outil gratuit sont souvent mal référencés sur Google : un site à votre nom, avec vos services et votre ville dans les titres, ressort bien mieux dans les recherches locales.'],
    [/Planity|réservation/, 'Une page de réservation seule ne présente ni votre univers ni vos avis : un site à vous, avec le bouton de réservation dedans, garde les clients chez vous plutôt que sur la plateforme.'],
    [/pas de site/, 'Quand on cherche un professionnel près de chez soi, on choisit souvent celui qui a un site clair, avec des photos, des avis et un moyen de contact : c\'est souvent ce qui fait la différence.'],
]
const DEFAULT_ADVICE = 'Une fiche Google à jour (horaires, photos récentes, réponses aux avis) et un site simple qui reprend les mêmes informations suffisent souvent à attirer de nouveaux clients du secteur.'

// The facts are written about the business (« son site ») : in the e-mail, they speak to it (« votre site »)
const toYou = (t) => t.replace(/\bson\b/g, 'votre').replace(/\bsa\b/g, 'votre').replace(/\bses\b/g, 'vos').replace(/\bà son nom\b/g, 'à votre nom')
const firstName = (contact) => (contact || '').trim().split(/\s+/)[0] || ''
const lowerFirst = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s)

function values(p) {
    const me = profile()
    const signal = (p.audit?.signals?.[0] || (p.signal || '').split(/\s*;\s*/)[0] || '').trim()
    const offerLine = (me.offer || '').split(/\n/)[0].trim()
    return {
        BONJOUR: p.contact ? `Bonjour ${firstName(p.contact)},` : 'Bonjour,',
        ENTREPRISE: p.company, METIER: (p.trade || '').toLowerCase(), VILLE: p.city || '',
        CONSTAT: signal ? (/^(pas de site|son site|sa seule|sa page)/.test(signal) ? `j'ai remarqué que ${toYou(signal).replace(/^pas de site internet à votre nom/, 'vous n\'avez pas encore de site à votre nom')}` : `j'ai remarqué ceci : ${lowerFirst(toYou(signal))}`) : 'j\'ai vu que votre présence en ligne pourrait vous apporter plus de clients',
        // the search typed: « coiffure Compiègne », or the town alone for an imported list without trade
        RECHERCHE: p.trade && p.trade !== 'Liste importée' ? `« ${p.trade.toLowerCase()} ${p.city || ''} » sur Google`.replace(' »', ' »') : `les entreprises de ${p.city || 'votre secteur'}`,
        CONSEIL: (ADVICE.find(([re]) => re.test(signal)) || [null, DEFAULT_ADVICE])[1],
        NOM: fullName(me), ACTIVITE: me.activity || '', MA_VILLE: (me.city || '').replace(/\s*\(.*\)$/, ''), OFFRE: offerLine ? `Pour vous situer : ${lowerFirst(offerLine.replace(/\.$/, ''))}.` : '',
        ACCROCHE: p.audit?.tagline ? `J'ai lu sur votre site « ${p.audit.tagline.replace(/[.!]+$/, '')} » : c'est exactement le genre de message qui mérite d'être bien mis en avant.` : '',
        RESERVATION: me.bookingUrl ? `Vous pouvez choisir un créneau ici : ${me.bookingUrl}` : 'Dites-moi simplement quel moment vous arrange cette semaine.',
    }
}

// {{NAME}}: a value; {a|b|c}: one of the variations, at random (two e-mails are never the same, which messaging services like)
const pick = (list) => list[Math.floor(Math.random() * list.length)]
const fill = (text, v) => text.replace(/\{\{(\w+)\}\}/g, (m, k) => v[k] ?? '').replace(/\{([^{}]*\|[^{}]*)\}/g, (m, list) => pick(list.split('|')))
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()

// Subject of the first e-mail, in the style of the test (A: a short question, B: the business and a benefit), 8 words at most
function subject(p, style) {
    const s = p.audit?.signals?.[0] || p.signal || ''
    const name = (n) => p.company.split(/\s+/).slice(0, n).join(' ')
    // several wordings of each style: the same subject sent tens of times looks like a mass mailing
    if (style === 'B') return pick([`${name(4)} : plus de clients en ligne`, `${name(4)} : être trouvé sur Google`, `${name(4)} et vos futurs clients`])
    if (/téléphone/.test(s)) return pick(['Votre site sur téléphone ?', 'Votre site sur mobile ?', 'Une question sur votre site'])
    if (/pas de site/.test(s)) return pick([`Un site pour ${name(3)} ?`, `${name(3)} sur internet ?`])
    if (/titre|description|référencement|Google/.test(s)) return pick(['Votre site sur Google ?', 'Une idée pour votre visibilité'])
    return pick(['Une idée pour votre site ?', 'Une question sur votre site', 'Votre site internet'])
}

// bodyStyle: 'standard' or 'short' (tested against each other like the subjects: learning.mjs pickArm)
export function templateFirstEmail(p, { subjectStyle = 'A', bodyStyle = 'standard' } = {}) {
    return { subject: subject(p, subjectStyle), body: fill(readTemplate(bodyStyle === 'short' ? 'firstShort' : 'first'), values(p)) }
}

export function templateFollowUp(p, step) {
    return { body: fill(readTemplate(step === 'followUp1' ? 'followUp1' : 'followUp2'), values(p)) }
}

export function templateReply(p, kind) {
    const v = values(p)
    const lines = {
        interested: `Merci pour votre réponse, avec plaisir. Le plus simple est d'en parler 15 minutes au téléphone : je vous montre ce que je ferais pour ${p.company}, sans engagement.\n\n${v.RESERVATION}`,
        question: `Merci pour votre question. Je vous réponds volontiers en détail lors d'un court appel de 15 minutes, ce sera plus clair qu'un long e-mail.\n\n${v.RESERVATION}`,
        later: 'Merci pour votre réponse, je comprends tout à fait. Je me permettrai de revenir vers vous dans quelques mois ; d\'ici là, n\'hésitez pas à me écrire si le sujet revient.',
        no: 'Merci d\'avoir pris le temps de me répondre. Je vous souhaite une très bonne continuation.',
        recontact: `Il y a quelque temps, vous m'aviez dit que le sujet de votre site reviendrait plus tard : je me permets de revenir vers vous comme convenu. Est-ce le bon moment pour en parler 15 minutes ?\n\n${v.RESERVATION}`,
    }
    return { body: `${v.BONJOUR}\n\n${lines[kind] || lines.question}\n\nBien à vous,` }
}
