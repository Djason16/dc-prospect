// Accounts of this PC: sending way (Gmail or the pro mailbox), passwords, tests, and the actions of the Windows app
import fs from 'node:fs'
import { cfg } from '../services/base.js'
import { checkClaude } from '../services/claude.js'
import { saveMailboxPassword, testConnection, saveGmail, forgetGmail, chooseSendingMode, sendingMode, sendTestEmail, viaGmail, gmailStatus, secretFile } from '../services/mail.js'
import { storeSecret, forgetSecret } from '../services/vault.js'
import { PROVIDERS, testGeminiKey } from '../services/ai.js'
import { BRAVE_KEY, webSearch } from '../services/discovery.js'
import { checkDomain, detectMailHost, mailGuide } from '../services/deliverability.js'
import { saveSettings } from '../services/settings.js'
import { PAGESPEED_KEY, checkPageSpeedKey } from '../services/siteAudit.js'
import { downloadModel, deleteModel } from '../services/localAi.js'
import { sampleEmail } from '../services/sample.js'

import { ApiError, errorMessage } from '../utils/ResponseHelper.js'
import type { App, LocalModelId } from '../types.js'

// Keys typed in the app: name -> secret of the vault
const KEYS: Record<string, string | null> = { gemini: PROVIDERS.gemini.key, anthropic: PROVIDERS.anthropic.key, openai: PROVIDERS.openai.key, brave: BRAVE_KEY, pagespeed: PAGESPEED_KEY }

// Bodies of the requests, as the interface sends them (checked here)
export interface GmailBody { address?: unknown, password?: unknown }
export interface PasswordBody { password?: unknown }
export interface SendingModeBody { mode?: unknown }
export interface KeyBody { name: string, key?: unknown }
export interface LocalAiBody { id?: LocalModelId }
export interface HostBody { action: string, value?: unknown }

const clearSendingError = (app: App): void => { app.mailboxOk = true; if (/^(Envoi pas encore|Mot de passe|Messagerie)/.test(app.error)) app.error = '' }

export const AccountsController = {
    // POST /api/accounts/gmail { address, password } : Gmail with an app password
    async gmail(app: App, d: GmailBody) { await saveGmail(d.address, d.password); clearSendingError(app); return {} },
    // DELETE /api/accounts/gmail
    forgetGmail() { forgetGmail(); return {} },
    // POST /api/accounts/password { password } : password of the pro mailbox
    async password(app: App, d: PasswordBody) {
        saveMailboxPassword(String(d.password || ''))
        try { await testConnection() } catch (e) { throw new ApiError('Enregistré, mais la connexion à la boîte échoue : ' + errorMessage(e)) }
        clearSendingError(app)
        return {}
    },
    // PUT /api/accounts/sending-mode { mode: gmail | mailbox }
    sendingMode(app: App, d: SendingModeBody) { chooseSendingMode(d.mode); return { mode: sendingMode() } },
    // POST /api/accounts/test-email : test e-mail to myself
    async testEmail(app: App) { const to = await sendTestEmail(); app.state.testEmailOn = new Date().toISOString().slice(0, 10); app.changed(); return { to } },
    // POST /api/accounts/key { name: gemini | anthropic | openai | brave | pagespeed, key } : API key, encrypted by Windows on this PC
    async saveKey(app: App, d: KeyBody) {
        const secret = KEYS[d.name], key = String(d.key || '').trim()
        if (!secret) throw new ApiError('Clé inconnue')
        if (key.length < 8 || key.length > 400 || /\s/.test(key)) throw new ApiError('Clé invalide : colle-la entière, sans espace')
        storeSecret(secret, key)
        if (d.name === 'brave') {
            try { await webSearch('boulangerie Compiègne') } catch (e) { forgetSecret(secret); throw new ApiError('Clé refusée par la recherche web : ' + errorMessage(e)) }
        }
        if (d.name === 'gemini') {
            try { await testGeminiKey() } catch (e) { forgetSecret(secret); throw new ApiError('Clé refusée par Google : ' + errorMessage(e).replace(/^Gemini : /, '')) }
        }
        if (d.name === 'pagespeed') {
            const refused = await checkPageSpeedKey(key)
            if (refused) { forgetSecret(secret); throw new ApiError('Clé refusée par Google PageSpeed. ' + refused) }
        }
        return {}
    },
    // POST /api/local-ai/download, DELETE /api/local-ai : the AI built into the app (about 2.5 GB, once)
    // POST /api/sample-email : what DC Prospect would write, with my profile and formula, to a made-up business
    async sampleEmail() { try { return { sample: await sampleEmail() } } catch (e) { throw new ApiError('Exemple impossible : ' + errorMessage(e)) } },
    downloadLocalAi(app: App, d: LocalAiBody | null) { return { local: downloadModel(d?.id) } },
    deleteLocalAi(app: App, d: LocalAiBody | null) { return { local: deleteModel(d?.id) } },
    // DELETE /api/accounts/key { name }
    forgetKey(app: App, d: KeyBody) { const secret = KEYS[d.name]; if (secret) forgetSecret(secret); return {} },
    // POST /api/accounts/auto-setup : the right sending way chosen and the servers filled from MY address, with the steps
    // for my provider (getting started). Changes nothing once a sending way works.
    async autoSetup() {
        const guide = await mailGuide(cfg.sender.address)
        const working = sendingMode() === 'gmail' ? gmailStatus().configured : fs.existsSync(secretFile)
        if (!working) {
            chooseSendingMode(guide.mode)
            if (guide.servers) saveSettings({ mailbox: { name: cfg.sender.name, address: cfg.sender.address, ...guide.servers } })
        }
        return { guide, mode: sendingMode() }
    },
    // POST /api/accounts/detect-mail : the mail servers of my sending address, found from its domain
    async detectMail() { return { host: await detectMailHost(cfg.sender.address) } },
    // POST /api/accounts/deliverability : SPF, DKIM, DMARC of the domain of the sending address
    async deliverability() { return { result: await checkDomain(cfg.sender.address, { viaGmail: viaGmail() }) } },
    // POST /api/accounts/check : checks everything, sends nothing
    async check(app: App) {
        const r: Record<'sending' | 'claude' | 'register' | 'folder', string> = { sending: '', claude: '', register: '', folder: '' }
        try { await testConnection(); r.sending = 'OK' } catch (e) { r.sending = errorMessage(e) }
        try { r.claude = (await checkClaude()) ? 'OK' : 'réponse inattendue' } catch (e) { r.claude = errorMessage(e) }
        try { r.register = (await fetch('https://recherche-entreprises.api.gouv.fr/search?q=boulangerie&per_page=1')).ok ? 'OK' : 'injoignable' } catch (e) { r.register = errorMessage(e) }
        r.folder = fs.existsSync(cfg.dataFolder) ? 'OK' : 'dossier introuvable : ' + cfg.dataFolder
        app.claudeOk = r.claude === 'OK'; app.mailboxOk = r.sending === 'OK'
        return { results: r }
    },
    // POST /api/host { action, value } : actions of the Windows app (accounts, folders, updates)
    async host(app: App, d: HostBody) {
        const f = app.host?.actions?.[d.action]
        if (!f) throw new ApiError('Action disponible seulement dans l\'application Windows')
        return { result: await f(d.value) }
    },
}
