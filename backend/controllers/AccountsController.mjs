// Accounts of this PC: sending way (Gmail or the pro mailbox), passwords, tests, and the actions of the Windows app
import fs from 'node:fs'
import { cfg } from '../services/base.mjs'
import { checkClaude } from '../services/claude.mjs'
import { saveMailboxPassword, testConnection, saveGmail, forgetGmail, chooseSendingMode, sendingMode, sendTestEmail } from '../services/mail.mjs'
import { ApiError } from '../utils/ResponseHelper.mjs'

const clearSendingError = (app) => { app.mailboxOk = true; if (/^(Envoi pas encore|Mot de passe|Messagerie)/.test(app.error)) app.error = '' }

export const AccountsController = {
    // POST /api/accounts/gmail { address, password } : Gmail with an app password
    async gmail(app, d) { await saveGmail(d.address, d.password); clearSendingError(app); return {} },
    // DELETE /api/accounts/gmail
    forgetGmail() { forgetGmail(); return {} },
    // POST /api/accounts/password { password } : password of the pro mailbox
    async password(app, d) {
        saveMailboxPassword(String(d.password || ''))
        try { await testConnection() } catch (e) { throw new ApiError('Enregistré, mais la connexion à la boîte échoue : ' + e.message) }
        clearSendingError(app)
        return {}
    },
    // PUT /api/accounts/sending-mode { mode: gmail | mailbox }
    sendingMode(app, d) { chooseSendingMode(d.mode); return { mode: sendingMode() } },
    // POST /api/accounts/test-email : test e-mail to myself
    async testEmail() { return { to: await sendTestEmail() } },
    // POST /api/accounts/check : checks everything, sends nothing
    async check(app) {
        const r = {}
        try { await testConnection(); r.sending = 'OK' } catch (e) { r.sending = e.message }
        try { r.claude = (await checkClaude()) ? 'OK' : 'réponse inattendue' } catch (e) { r.claude = e.message }
        try { r.register = (await fetch('https://recherche-entreprises.api.gouv.fr/search?q=boulangerie&per_page=1')).ok ? 'OK' : 'injoignable' } catch (e) { r.register = e.message }
        r.folder = fs.existsSync(cfg.dataFolder) ? 'OK' : 'dossier introuvable : ' + cfg.dataFolder
        app.claudeOk = r.claude === 'OK'; app.mailboxOk = r.sending === 'OK'
        return { results: r }
    },
    // POST /api/host { action, value } : actions of the Windows app (accounts, folders, updates)
    async host(app, d) {
        const f = app.host?.actions?.[d.action]
        if (!f) throw new ApiError('Action disponible seulement dans l\'application Windows')
        return { result: await f(d.value) }
    },
}
