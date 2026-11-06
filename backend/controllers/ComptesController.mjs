// Accounts of this PC: sending way (Gmail or the pro mailbox), passwords, tests, and the actions of the Windows app
import fs from 'node:fs'
import { cfg } from '../services/base.mjs'
import { verifierClaude } from '../services/claude.mjs'
import { enregistrerMotDePasse, testerConnexion, enregistrerGmail, oublierGmail, choisirModeEnvoi, modeEnvoi, envoyerTest } from '../services/mail.mjs'
import { ErreurApi } from '../utils/ResponseHelper.mjs'

const effacerErreurEnvoi = (app) => { app.messagerieOk = true; if (/^(Envoi pas encore|Mot de passe|Messagerie)/.test(app.erreur)) app.erreur = '' }

export const ComptesController = {
    // POST /api/comptes/gmail { adresse, mdp } : Gmail with an app password
    async gmail(app, d) { await enregistrerGmail(d.adresse, d.mdp); effacerErreurEnvoi(app); return {} },
    // DELETE /api/comptes/gmail
    oublierGmail() { oublierGmail(); return {} },
    // POST /api/comptes/mot-de-passe { mdp } : password of the pro mailbox
    async motDePasse(app, d) {
        enregistrerMotDePasse(String(d.mdp || ''))
        try { await testerConnexion() } catch (e) { throw new ErreurApi('Enregistré, mais la connexion à la boîte échoue : ' + e.message) }
        effacerErreurEnvoi(app)
        return {}
    },
    // PUT /api/comptes/envoi { mode: gmail | boite }
    modeEnvoi(app, d) { choisirModeEnvoi(d.mode); return { mode: modeEnvoi() } },
    // POST /api/comptes/test-envoi : test e-mail to myself
    async testEnvoi() { return { a: await envoyerTest() } },
    // POST /api/comptes/tester : checks everything, sends nothing
    async tester(app) {
        const r = {}
        try { await testerConnexion(); r.envoi = 'OK' } catch (e) { r.envoi = e.message }
        try { r.claude = (await verifierClaude()) ? 'OK' : 'réponse inattendue' } catch (e) { r.claude = e.message }
        try { r.registre = (await fetch('https://recherche-entreprises.api.gouv.fr/search?q=boulangerie&per_page=1')).ok ? 'OK' : 'injoignable' } catch (e) { r.registre = e.message }
        r.dossier = fs.existsSync(cfg.dossierDrive) ? 'OK' : 'dossier introuvable : ' + cfg.dossierDrive
        app.claudeOk = r.claude === 'OK'; app.messagerieOk = r.envoi === 'OK'
        return { resultats: r }
    },
    // POST /api/hote { action, valeur } : actions of the Windows app (accounts, folders, updates)
    async hote(app, d) {
        const f = app.hote?.actions?.[d.action]
        if (!f) throw new ErreurApi('Action disponible seulement dans l\'application Windows')
        return { resultat: await f(d.valeur) }
    },
}
