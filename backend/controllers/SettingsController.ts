// Settings shared on the Drive: zones, trades, volumes, sender and mail servers (GET and PUT /api/settings)
import fs from 'node:fs'
import { cfg, record } from '../services/base.js'
import { yieldPerTrade } from '../services/prospecting.js'
import { zoneOfTheWeek, saveSettings, profile, isProfileComplete, activeZones, defaultNeed } from '../services/settings.js'
import { gmailStatus, sendingMode, secretFile } from '../services/mail.js'
import { PROVIDERS, aiSettings, provider, providerHasKey, providerCanSearch } from '../services/ai.js'
import { searchApiReady } from '../services/discovery.js'
import { searchEngine, writingEngine } from '../services/prospecting.js'
import { warmup, dailyLimit } from '../services/deliverability.js'
import { ApiError } from '../utils/ResponseHelper.js'
import { hasSecret } from '../services/vault.js'
import { PAGESPEED_KEY } from '../services/siteAudit.js'
import { localAiStatus } from '../services/localAi.js'

import { zoneAround } from '../services/web.js'
import { listTemplates, saveTemplate } from '../services/templates.js'
import type { App, ProviderId } from '../types.js'

// Bodies of the requests, as the interface sends them (checked here and in saveSettings)
export interface ZoneAroundBody { town?: unknown, km?: unknown }
export interface TemplateBody { name: string, text?: unknown }
// What PUT /api/settings accepts: the fields of saveSettings (each one validated there)
export type SettingsBody = Parameters<typeof saveSettings>[0]
// Accounts of this PC as the Windows app gives them, plus the sending way
interface Accounts { claude?: { connected?: boolean }, [more: string]: unknown }

export const SettingsController = {
    getAll(app: App) {
        const accounts: Accounts = { ...(app.host?.accounts ? app.host.accounts() : {}), gmail: gmailStatus(), sendingMode: sendingMode(), mailbox: { password: fs.existsSync(secretFile) } }
        // Engines: ready when the chosen AI can work (Claude Code logged in, or its API key saved) and the search can run
        const p = provider()
        // the built-in AI not downloaded yet: the templates write meanwhile, so it is ready anyway
        const aiReady = p === 'claude-code' ? !!accounts.claude?.connected : p === 'local' ? true : providerHasKey(p)
        const searchReady = searchEngine() === 'free' || aiReady // the search without AI works even without any key
        const writingReady = writingEngine() === 'templates' || aiReady
        return {
            firstSearchDone: !!app.state.firstSearchOn || app.state.prospects.length > 0, // the first search starts as soon as the getting started is finished
            profile: profile(), profileComplete: isProfileComplete(), defaultNeed, zonesReady: activeZones().length > 0,
            zones: cfg.zones, trades: cfg.trades, tradeYield: yieldPerTrade(app.state), zoneOfTheWeek: zoneOfTheWeek(),
            maxSearchesPerDay: cfg.maxSearchesPerDay, readyReserve: cfg.readyReserve, firstEmailsPerDay: cfg.firstEmailsPerDay,
            maxEmailsPerDay: cfg.maxEmailsPerDay, sendWindows: cfg.sendWindows,
            sendDays: cfg.sendDays, searchDays: cfg.searchDays || [1, 2, 3, 4, 5], followUpDays: cfg.followUpDays, gapMinutes: cfg.gapMinutes, skipHolidays: cfg.skipHolidays !== false, sender: cfg.sender.address,
            mailbox: { name: cfg.sender.name, address: cfg.sender.address, smtpHost: cfg.smtp.host, smtpPort: cfg.smtp.port, imapHost: cfg.imap.host, imapPort: cfg.imap.port },
            dataFolder: cfg.dataFolder, inApp: !!app.host?.actions,
            accounts,
            engine: {
                ...aiSettings(), provider: p, providers: Object.fromEntries(Object.entries(PROVIDERS).map(([k, v]) => [k, { name: v.name, web: v.web, key: !!v.key, keySaved: providerHasKey(k as ProviderId) }])),
                canSearch: providerCanSearch(), searchEngine: searchEngine(), writingEngine: writingEngine(), searchKey: searchApiReady(), speedKey: hasSecret(PAGESPEED_KEY), local: localAiStatus(), chosen: !!cfg.ai?.provider,
                aiReady, ready: searchReady && writingReady, usesAi: searchEngine() === 'ai' || writingEngine() === 'ai',
            },
            warmup: { ...warmup(), limitToday: dailyLimit() }, pauseUntil: cfg.pauseUntil || null, dailyDigest: !!cfg.dailyDigest, autoApproveFollowUps: !!cfg.autoApproveFollowUps,
            autoStart: app.host?.autoStart ? app.host.autoStart() : null,
        }
    },

    // POST /api/zones/around { town, km } : a zone made of a town and the towns around it (saved with the others)
    async zoneAround(app: App, d: ZoneAroundBody) {
        const km = Math.min(80, Math.max(2, Number(d.km) || 20))
        if (!String(d.town || '').trim()) throw new ApiError('Tape une ville')
        const zone = await zoneAround(String(d.town).trim(), km).catch(() => null)
        if (!zone?.postalCodes.length) throw new ApiError('Ville introuvable : vérifie son nom (exemple : Compiègne)')
        const { towns, ...saved } = zone
        const err = saveSettings({ zones: [...cfg.zones, saved] })
        if (err) throw new ApiError(err)
        record(app.state, 'settings', `Zone ajoutée : ${zone.name} (${towns} communes)`)
        return { zone: saved, towns }
    },

    // GET /api/templates, PUT /api/templates { name, text | null } : my e-mail templates (null = back to the original)
    templates() { return { templates: listTemplates() } },
    saveTemplate(app: App, d: TemplateBody) {
        const problems = saveTemplate(d.name, d.text === null ? null : String(d.text || ''))
        if (problems.length) throw new ApiError('À corriger : ' + problems.join(' ; '))
        record(app.state, 'settings', `Modèle d'e-mail ${d.text === null ? 'remis à l\'original' : 'modifié'}`)
        return { templates: listTemplates() }
    },

    update(app: App, d: SettingsBody) {
        const err = saveSettings(d)
        if (err) throw new ApiError(err)
        record(app.state, 'settings', 'Réglages modifiés')
        return { settings: SettingsController.getAll(app) }
    },
}
