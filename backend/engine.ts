// Engine of DC Prospect: prepares the day, serves the app page, sends approved e-mails in the plan's time slots.
// Used by the Windows app (electron/main.ts) and by run.ts (without window, npm run engine). host = { open(), notify(title, text), version, ... }
import fs from 'node:fs'
import { cfg, today, isSearchDay, loadState, saveState, log } from './services/base.js'
import { syncReplies, search, prepareBatch, sendNext, forgetOldLeads, toApprove } from './services/prospecting.js'
import { writeDailyReport, writeTrackingTable } from './services/report.js'
import { startServer } from './server.js'
import { sendingReady, send } from './services/mail.js'
import { isProfileComplete, activeZones } from './services/settings.js'
import { machine, version, takeLock, releaseLock, cleanLogs } from './services/system.js'
import { wakeReminders, backupState } from './services/followThrough.js'
import { errorMessage } from './utils/ResponseHelper.js'
import type { App, Host, State } from './types.js'

export const address = `http://localhost:${cfg.port}`
let host: Host = { open() {}, notify() {} }
const openPage = (): void => host.open()
const notify = (title: string, text: string): void => host.notify(title, text)
const toAnswer = (state: State) => state.prospects.filter((p) => p.status === 'replied' && !p.tracking?.handled)

// Messages shown to the user in the app (French)
export const app: App = {
    state: loadState(),
    busy: false, progress: '', error: '', standby: null, claudeOk: true, mailboxOk: true,
    notes: [], lastSync: 0, pageOpenedOn: null, timer: null,
    health() {
        return {
            password: sendingReady(), mailbox: this.mailboxOk, claude: this.claudeOk,
            drive: fs.existsSync(cfg.dataFolder), machine, version: host.version || version(), standby: this.standby, ...(host.health ? host.health() : {}),
        }
    },
    changed() {
        if (this.standby) return
        saveState(this.state)
        clearTimeout(this.timer ?? undefined)
        this.timer = setTimeout(() => this.writeReports(), 5000)
    },
    async writeReports() {
        try {
            writeDailyReport(this.state, { notes: this.notes })
            await writeTrackingTable(this.state)
        } catch (e) { log('Rapport non écrit :', errorMessage(e)) }
    },
    async sync() {
        const before = toAnswer(this.state).length
        try {
            const n = await syncReplies(this.state)
            this.lastSync = Date.now()
            this.mailboxOk = true
            if (this.error.startsWith('Messagerie')) this.error = ''
            if (n) this.changed()
            const fresh = toAnswer(this.state).length - before
            if (fresh > 0) notify('DC Prospect : réponse reçue', `${fresh} prospect(s) ont répondu. Ouvre DC Prospect pour la suite.`)
        } catch (e) {
            this.mailboxOk = false
            this.error = 'Messagerie : ' + errorMessage(e)
            log(this.error)
        }
    },
    async runDay(force = false) {
        if (this.busy || this.standby) return
        this.busy = true; this.error = ''; this.notes = []
        const day = today()
        const step = (t: string): void => { this.progress = t; log(t) }
        try {
            cleanLogs()
            backupState() // copy of the prospects, once a day, the last 14 kept
            step('lecture des réponses et des STOP')
            await this.sync()
            forgetOldLeads(this.state)
            if (wakeReminders(this.state)) this.changed() // the « plus tard » whose date has come
            // research and sending each follow their own days (Settings, Calendar)
            if (isSearchDay(day) || force) {
                step('recherche de nouveaux prospects')
                const r = await search(this.state, { onProgress: step })
                this.claudeOk = !(r.attempts && r.errors === r.attempts)
                if (r.attempts) this.notes.push(`${r.attempts} recherches : ${r.found} prospects prêts.`)
                this.changed()
            } else {
                this.notes.push('Pas un jour de recherche (Réglages, Calendrier).')
            }
            step('préparation du lot du jour')
            await prepareBatch(this.state, { onProgress: step }) // does nothing outside the sending days
            if (!isProfileComplete()) this.error = "Remplis ton profil (Aujourd'hui, Mise en route) : DC Prospect en a besoin pour chercher et écrire."
            else if (!activeZones().length) this.error = "Choisis au moins une zone (Aujourd'hui, Mise en route)."
            else if (!sendingReady()) this.error = "Envoi pas encore branché : ton Gmail ou ta boîte pro (Aujourd'hui, Mise en route). Rien ne peut partir avant."
            if (!this.claudeOk) this.error = 'Le moteur de recherche ne répond pas (Claude déconnecté, limite de l\'abonnement ou de la clé API atteinte, quota de recherche web épuisé) : la recherche reprendra demain. Réglages, Moteur pour en changer.'
            this.state.lastDay = day
            this.changed()
            await this.writeReports()
        } catch (e) {
            this.error = 'Préparation interrompue : ' + errorMessage(e)
            log(this.error, e instanceof Error ? e.stack || '' : '')
            this.changed()
        } finally {
            this.busy = false; this.progress = ''
        }
        const approve = toApprove(this.state).length, replies = toAnswer(this.state).length
        // summary by e-mail to myself (Réglages, Application), once a day, only when something waits for me
        if (cfg.dailyDigest && (approve || replies) && this.state.digestOn !== day && sendingReady()) {
            this.state.digestOn = day
            const lines = [approve && `- ${approve} e-mail(s) à relire et valider`, replies && `- ${replies} prospect(s) t'ont répondu`].filter(Boolean)
            send({ to: cfg.sender.address, subject: `DC Prospect : ${[approve && `${approve} à valider`, replies && `${replies} réponse(s)`].filter(Boolean).join(', ')}`, body: `Bonjour,\n\nCe matin dans DC Prospect :\n${lines.join('\n')}\n\nOuvre DC Prospect sur ton PC pour t'en occuper : rien ne part sans ton accord.\n\nBien à vous,`, stop: false })
                .then(() => this.changed()).catch((e: unknown) => log('Résumé par e-mail non envoyé :', errorMessage(e)))
        }
        if ((approve || replies || this.error) && this.pageOpenedOn !== day) {
            this.pageOpenedOn = day
            openPage()
            notify('DC Prospect', [approve && `${approve} e-mail(s) à valider`, replies && `${replies} réponse(s) à traiter`, this.error].filter(Boolean).join(' · '))
        }
    },
    // Every minute: lock, new day, replies, an approved e-mail to send
    async tick() {
        const other = takeLock()
        if (other) {
            if (!this.standby) log(`Le PC ${other} fait déjà tourner l'outil : ce PC passe en veille`)
            this.standby = other
            this.state = loadState() // show the data of the active PC
            return
        }
        if (this.standby) { log('Plus d\'autre PC actif : ce PC reprend'); this.standby = null; this.state = loadState() }
        if (this.busy) return
        if (this.state.lastDay !== today()) { this.runDay(); return } // not awaited: the lock keeps being refreshed every minute
        try {
            const waiting = this.state.prospects.some((p) => Object.values(p.drafts || {}).some((d) => d.status === 'approved'))
            if (Date.now() - this.lastSync > (waiting ? 5 : 15) * 60e3) await this.sync()
            if (waiting && this.mailboxOk) {
                const sent = await sendNext(this.state)
                if (sent) this.changed()
            }
        } catch (e) {
            this.error = 'Envoi : ' + errorMessage(e)
            log(this.error)
        }
    },
}

// Starts the engine; returns false if another copy already runs on this PC (port taken)
export async function startEngine(h: Partial<Host> = {}): Promise<boolean> {
    host = { ...host, ...h }
    app.host = host
    for (const p of app.state.prospects) if (p.zone === 'IDF') p.zone = 'Île-de-France' // zone renamed in the settings
    try {
        await startServer(app)
    } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'EADDRINUSE') return false
        throw e
    }
    log(`DC Prospect ${host.version || version()} démarrée sur ${machine} : ${address}`)
    let running = false
    const loop = async () => { if (running) return; running = true; try { await app.tick() } catch (e) { log('Erreur :', errorMessage(e)) } finally { running = false } }
    await loop()
    setInterval(loop, 60e3)
    return true
}

export function stopEngine(): void {
    try { if (!app.standby) saveState(app.state) } catch {}
    releaseLock()
}
