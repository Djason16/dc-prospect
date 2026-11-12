// Example of a first e-mail, written with MY profile and the chosen formula, for a made-up business:
// to see what DC Prospect would send before anything starts (Settings, Formule, « Voir un exemple d'e-mail »)
import { profile, activeTrades, isProfileComplete } from './settings.mjs'
import { writingEngine } from './prospecting.mjs'
import { provider } from './ai.mjs'
import { writeFirstEmail, checkText, capitalizeSubject } from './claude.mjs'
import { localFirstEmail } from './localWriter.mjs'
import { templateFirstEmail } from './templates.mjs'
import { writingHints } from './followThrough.mjs'

export async function sampleEmail() {
    if (!isProfileComplete()) throw new Error("remplis d'abord ton profil (prénom, nom, activité, ville, ce que tu proposes) : l'e-mail est écrit en ton nom")
    const trade = activeTrades()[0]?.name || 'Coiffure'
    const city = (profile().city || 'Compiègne').replace(/\s*\(.*\)$/, '')
    const p = {
        id: 'example', company: `${trade} Exemple`, trade, city, email: 'contact@exemple.fr', website: 'https://exemple.fr', platform: 'Wix',
        score: 4, level: 'CHAUD', signal: 'son site n\'est pas adapté au téléphone',
        audit: { signals: ['son site n\'est pas adapté au téléphone', 'son site affiche « © 2019 » (pas mis à jour depuis)'], tagline: null },
        steps: {}, drafts: {},
    }
    const engine = writingEngine()
    const mail = engine === 'templates' ? templateFirstEmail(p, { subjectStyle: 'A' }) : provider() === 'local' ? await localFirstEmail(p, { subjectStyle: 'A' }) : await writeFirstEmail(p, { subjectStyle: 'A' })
    const subject = capitalizeSubject(mail.subject)
    return { subject, body: mail.body, company: p.company, writer: engine === 'templates' ? 'modèles' : provider() === 'local' ? 'IA intégrée' : 'IA', problems: checkText(subject, mail.body), hints: writingHints(subject, mail.body) }
}
