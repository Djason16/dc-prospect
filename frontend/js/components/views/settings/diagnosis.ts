// « Tout vérifier » in plain words: for each check that fails, what it means and what to do
import { esc } from '../../../utils/dom.js'

type Part = 'Envoi' | 'Moteur' | 'Registre' | 'Dossier'

// [part, pattern of the error, what to do]
const FIXES: [Part, RegExp, string][] = [
    ['Envoi', /535|534|auth|login|password|mot de passe|credentials|username/i, 'Le mot de passe est refusé. Avec Gmail : crée un nouveau mot de passe d\'application (myaccount.google.com/apppasswords) et colle-le dans Envoi. Avec ta boîte : retape le mot de passe de ton adresse.'],
    ['Envoi', /ENOTFOUND|getaddrinfo|EAI_AGAIN/i, 'Le serveur de ta boîte est introuvable. Clique sur « Trouver mon serveur tout seul » (Envoi, Par ma boîte directement), ou vérifie ta connexion internet.'],
    ['Envoi', /ETIMEDOUT|ECONNREFUSED|ECONNRESET|timeout|délai/i, 'Le serveur ne répond pas : vérifie ta connexion internet ; si elle marche, ton antivirus ou ton réseau bloque peut-être l\'envoi d\'e-mails (essaie « Par mon Gmail »).'],
    ['Envoi', /certificate|self.signed|TLS|SSL/i, 'Problème de sécurité avec le serveur : vérifie son adresse dans Avancé (souvent mail.ton-domaine.fr) ou utilise « Par mon Gmail ».'],
    ['Envoi', /pas encore|not configured|branch/i, 'L\'envoi n\'est pas encore branché : choisis « Par mon Gmail » ou « Par ma boîte directement » et suis les étapes.'],
    ['Moteur', /pas install|not installed|ENOENT/i, 'Claude Code n\'est pas installé : clique sur « Installer Claude Code » dans Formule, ou choisis la formule gratuite.'],
    ['Moteur', /connect|login|auth|401|403|clé|key/i, 'L\'IA refuse la connexion : reconnecte Claude, ou recolle ta clé (Formule).'],
    ['Moteur', /limit|quota|429|rate/i, 'La limite de ton IA est atteinte pour aujourd\'hui : la recherche reprend demain tout seul. Pour ne plus dépendre d\'une limite : formule « Gratuit, sur ce PC ».'],
    ['Moteur', /télécharg/i, 'L\'IA intégrée n\'est pas encore téléchargée : Formule, « Télécharger ». En attendant, les modèles d\'e-mails écrivent à sa place.'],
    ['Registre', /./, 'Le registre officiel des entreprises ne répond pas pour l\'instant (ça arrive) : rien à faire, DC Prospect réessaie tout seul.'],
    ['Dossier', /./, 'Le dossier des données est introuvable (Drive pas encore démarré, ou dossier déplacé) : lance Google Drive, ou Avancé, Fichiers et outils, « Changer de dossier ».'],
]

// results: 'OK' or the error of each check (AccountsController.check)
export function diagnosisHtml(results: Record<string, string>): string {
    const parts: Record<Part, string | undefined> = { Envoi: results.sending, Moteur: results.claude, Registre: results.register, Dossier: results.folder }
    const line = Object.entries(parts).map(([k, v]) => `<span style="margin-right:1rem;color:${v === 'OK' ? 'var(--mint)' : 'var(--red)'}">${k} : ${v === 'OK' ? 'OK' : 'à corriger'}</span>`).join('')
    const fixes = Object.entries(parts).filter(([, v]) => v !== 'OK').map(([k, v]) => {
        const fix = FIXES.find(([part, re]) => part === k && re.test(String(v)))
        return `<p class="small" style="margin:.4rem 0 0"><strong>${k}</strong> : ${esc(fix ? fix[2] : 'problème inattendu.')} <span class="muted">(détail : ${esc(String(v).slice(0, 160))})</span></p>`
    }).join('')
    return `<div>${line}</div>${fixes || '<p class="small" style="margin:.4rem 0 0;color:var(--mint)">Tout est prêt.</p>'}`
}
