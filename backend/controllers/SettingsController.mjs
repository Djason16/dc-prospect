// Settings shared on the Drive: zones, trades, volumes, sender and mail servers (GET and PUT /api/settings)
import fs from 'node:fs'
import { cfg, record } from '../services/base.mjs'
import { yieldPerTrade } from '../services/prospecting.mjs'
import { zoneOfTheWeek, saveSettings, profile, isProfileComplete, activeZones, defaultNeed } from '../services/settings.mjs'
import { gmailStatus, sendingMode, secretFile } from '../services/mail.mjs'
import { ApiError } from '../utils/ResponseHelper.mjs'

export const SettingsController = {
    getAll(app) {
        return {
            profile: profile(), profileComplete: isProfileComplete(), defaultNeed, zonesReady: activeZones().length > 0,
            zones: cfg.zones, trades: cfg.trades, tradeYield: yieldPerTrade(app.state), zoneOfTheWeek: zoneOfTheWeek(),
            maxSearchesPerDay: cfg.maxSearchesPerDay, readyReserve: cfg.readyReserve, firstEmailsPerDay: cfg.firstEmailsPerDay,
            maxEmailsPerDay: cfg.maxEmailsPerDay, sendWindows: cfg.sendWindows,
            sendDays: cfg.sendDays, searchDays: cfg.searchDays || [1, 2, 3, 4, 5], followUpDays: cfg.followUpDays, gapMinutes: cfg.gapMinutes, skipHolidays: cfg.skipHolidays !== false, sender: cfg.sender.address,
            mailbox: { name: cfg.sender.name, address: cfg.sender.address, smtpHost: cfg.smtp.host, smtpPort: cfg.smtp.port, imapHost: cfg.imap.host, imapPort: cfg.imap.port },
            dataFolder: cfg.dataFolder, inApp: !!app.host?.actions,
            accounts: { ...(app.host?.accounts ? app.host.accounts() : {}), gmail: gmailStatus(), sendingMode: sendingMode(), mailbox: { password: fs.existsSync(secretFile) } },
            autoStart: app.host?.autoStart ? app.host.autoStart() : null,
        }
    },

    update(app, d) {
        const err = saveSettings(d)
        if (err) throw new ApiError(err)
        record(app.state, 'settings', 'Réglages modifiés')
        return { settings: SettingsController.getAll(app) }
    },
}
