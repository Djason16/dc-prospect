// Shared helpers: config, state file on Drive, dates, log
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Config, LocalSettings, State } from '../types.js'
import { migrateLocalFolder, migrateDataFolder, migrateStateFile, migrateMcpLog } from './migration.js'

// project folder: this file runs compiled in out/backend/services/ -> three levels up
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
// config.json holds the defaults shipped with the app (typed here, at the only place it is read)
export const cfg = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8')) as Config

// Local folder for secrets and logs (never on Drive)
export const localFolder = path.join(process.env.APPDATA || os.homedir(), 'prospection-auto')
fs.mkdirSync(localFolder, { recursive: true })
migrateLocalFolder(localFolder) // files written by a version before 1.2.0
fs.mkdirSync(path.join(localFolder, 'logs'), { recursive: true })

// Settings of this PC only (folder of the data chosen in the app), in %APPDATA%\prospection-auto\local.json
export const localFile = path.join(localFolder, 'local.json')
export function localSettings(): LocalSettings { try { return JSON.parse(fs.readFileSync(localFile, 'utf8')) as LocalSettings } catch { return {} } }
export function updateLocalSettings(changes: Partial<LocalSettings>): LocalSettings { const r = { ...localSettings(), ...changes }; fs.writeFileSync(localFile, JSON.stringify(r, null, 1)); return r }
const local = localSettings()
if (local.dataFolder) cfg.dataFolder = local.dataFolder
if (local.promptsFolder) cfg.promptsFolder = local.promptsFolder
if (local.signature) cfg.signature = local.signature
// No Google Drive for desktop on this PC: the data stay on the PC (Google Sheets and Docs still work once Google is connected)
// Default data folder (first start, or chosen folder no longer reachable): Documents\DC Prospect
if (!cfg.dataFolder || !fs.existsSync(path.dirname(cfg.dataFolder))) cfg.dataFolder = path.join(os.homedir(), 'Documents', 'DC Prospect')
// Test mode: another folder and port, so tests never touch the real data
if (process.env.PROSPECTION_DRIVE) cfg.dataFolder = process.env.PROSPECTION_DRIVE
if (process.env.PROSPECTION_PORT) cfg.port = Number(process.env.PROSPECTION_PORT)
fs.mkdirSync(cfg.dataFolder, { recursive: true })

// The folder name is shown to the user in his Drive: it stays in French
export const dataFolder = path.join(cfg.dataFolder, 'Données')
export const stateFile = path.join(dataFolder, 'prospects.json')
fs.mkdirSync(dataFolder, { recursive: true })
migrateDataFolder(dataFolder)
migrateMcpLog(dataFolder)

const emptyState = (): State => ({ version: 2, prospects: [], stop: [], sendsPerDay: {}, searchesPerDay: {}, seenMessages: [], log: [] })

export function loadState(): State {
    try {
        migrateStateFile(stateFile)
        return { ...emptyState(), ...(JSON.parse(fs.readFileSync(stateFile, 'utf8')) as Partial<State>) }
    } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return emptyState()
        throw e
    }
}

export function saveState(state: State): void {
    fs.mkdirSync(dataFolder, { recursive: true })
    state.seenMessages = state.seenMessages.slice(-2000)
    state.log = state.log.slice(-3000)
    const tmp = stateFile + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(state, null, 1))
    fs.renameSync(tmp, stateFile)
}

// One line in the history of the tool (shown in the app and in the daily report)
export function record(state: State, type: string, text: string, extra: Record<string, unknown> = {}): void {
    state.log.push({ date: new Date().toISOString(), type, text, ...extra })
    log(`${type} : ${text}`)
}

export function log(...args: unknown[]): void {
    const line = `[${new Date().toLocaleString('fr-FR')}] ${args.join(' ')}`
    console.error(line)
    fs.appendFileSync(path.join(localFolder, 'logs', today() + '.log'), line + '\n')
}

// ---------- Dates (local time) ----------
const pad = (n: number) => String(n).padStart(2, '0')
export const today = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const dateOf = (s: string) => new Date(s + 'T12:00:00')
export const addDays = (s: string, n: number) => { const d = dateOf(s); d.setDate(d.getDate() + n); return today(d) }
export const daysBetween = (a: string, b: string) => Math.round((dateOf(b).getTime() - dateOf(a).getTime()) / 864e5)
export const frenchDate = (s: string | null | undefined) => s ? s.split('-').reverse().join('/') : ''

export function isoWeek(d = new Date()) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    const n = t.getUTCDay() || 7
    t.setUTCDate(t.getUTCDate() + 4 - n)
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
    return Math.ceil(((t.getTime() - yearStart.getTime()) / 864e5 + 1) / 7)
}

// French public holidays of a year (Easter computed: Monday, Ascension, Whit Monday)
export function publicHolidays(year: number): Set<string> {
    const a = year % 19, b = Math.floor(year / 100), c = year % 100
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4
    const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1
    const easter = `${year}-${pad(month)}-${pad(day)}`
    return new Set([
        `${year}-01-01`, `${year}-05-01`, `${year}-05-08`, `${year}-07-14`, `${year}-08-15`,
        `${year}-11-01`, `${year}-11-11`, `${year}-12-25`,
        addDays(easter, 1), addDays(easter, 39), addDays(easter, 50),
    ])
}

// Calendar from the settings: days of the week (0 = Sunday ... 6 = Saturday), public holidays skipped or not
const isHoliday = (s: string) => cfg.skipHolidays !== false && publicHolidays(+s.slice(0, 4)).has(s)
// Pause (holidays): nothing searched nor sent until this day included; replies and STOP are still read
export const isPaused = (s = today()) => !!cfg.pauseUntil && s <= cfg.pauseUntil
export const isSearchDay = (s: string) => (cfg.searchDays || [1, 2, 3, 4, 5]).includes(dateOf(s).getDay()) && !isHoliday(s) && !isPaused(s)
export const isSendDay = (s: string) => (cfg.sendDays || [2, 3, 4]).includes(dateOf(s).getDay()) && !isHoliday(s) && !isPaused(s)
// Names shown to the user (French)
export const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
export const daysText = (list: number[]) => [1, 2, 3, 4, 5, 6, 0].filter((d) => list.includes(d)).map((d) => DAY_NAMES[d]).join(', ') || 'aucun jour'

export function nextSendDay(from = today()) {
    let s = from
    for (let i = 0; i < 30; i++) { if (isSendDay(s)) return s; s = addDays(s, 1) }
    return s
}

const minutes = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
export function inSendWindow(d = new Date()) {
    const t = d.getHours() * 60 + d.getMinutes()
    return isSendDay(today(d)) && cfg.sendWindows.some(([a, b]) => t >= minutes(a) && t < minutes(b))
}

export const dayName = (s: string) => dateOf(s).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

// Environment for Windows PowerShell 5.1: without the module path of PowerShell 7 (inherited when the app is started
// from pwsh), otherwise ConvertTo-SecureString fails to load ("Coffre : écriture impossible")
export const powerShellEnv = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => k.toUpperCase() !== 'PSMODULEPATH'))
