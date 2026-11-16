// System helpers: one active PC at a time (lock on the Drive), notifications without window, log cleanup
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { dataFolder, localFolder, root, log, powerShellEnv } from './base.js'
import { isWindows, isMac, findInPath } from './platform.js'
import { errorMessage } from '../utils/ResponseHelper.js'

// lock.json (and verrou.json, its name before 1.2.0, where the heartbeat was « battement »)
interface Lock { machine: string, pid?: number, heartbeat?: string, battement?: string, version?: string }

export const machine = os.hostname()
const lockFile = path.join(dataFolder, 'lock.json')
// Lock written by a version before 1.2.0: still respected, so an old copy on another PC and this one never run together
const oldLockFile = path.join(dataFolder, 'verrou.json')
const EXPIRY = 6 * 60e3 // a PC that has not written for 6 min is considered off (Drive sync takes ~1 min)

export function version(): string {
    try { return fs.readFileSync(path.join(root, 'version.txt'), 'utf8').trim() } catch { return 'dev' }
}

const otherActivePc = (): string | null => {
    let lock: Lock | null = null
    try { lock = JSON.parse(fs.readFileSync(lockFile, 'utf8')) } catch {}
    if (lock && lock.machine !== machine && Date.now() - new Date(lock.heartbeat || 0).getTime() < EXPIRY) return lock.machine
    let old: Lock | null = null
    try { old = JSON.parse(fs.readFileSync(oldLockFile, 'utf8')) } catch {}
    if (old && old.machine !== machine && Date.now() - new Date(old.battement || 0).getTime() < EXPIRY) return old.machine
    return null
}

// Returns null if this PC holds the lock (and refreshes it), or the name of the other active PC
export function takeLock(): string | null {
    const other = otherActivePc()
    if (other) return other
    fs.mkdirSync(dataFolder, { recursive: true })
    fs.writeFileSync(lockFile, JSON.stringify({ machine, pid: process.pid, heartbeat: new Date().toISOString(), version: version() }))
    return null
}

export function releaseLock(): void {
    try {
        const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8')) as Lock
        if (lock.machine === machine) fs.unlinkSync(lockFile)
    } catch {}
}

// Notification of the system, no extra module: Windows (bottom right), macOS (Notification Center), Linux (notify-send)
export function notify(title: string, text: string): void {
    if (!isWindows) return notifyElsewhere(title.slice(0, 240), text.slice(0, 240))
    const q = (s: string) => String(s).replace(/'/g, "''").slice(0, 240)
    const ps = `Add-Type -AssemblyName System.Windows.Forms; $n = New-Object System.Windows.Forms.NotifyIcon; ` +
        `$n.Icon = [System.Drawing.SystemIcons]::Information; $n.Visible = $true; $n.BalloonTipTitle = '${q(title)}'; $n.BalloonTipText = '${q(text)}'; ` +
        `$n.ShowBalloonTip(10000); Start-Sleep -Seconds 12; $n.Dispose()`
    try {
        spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps], { env: powerShellEnv(), windowsHide: true, detached: true, stdio: 'ignore' }).unref()
    } catch (e) { log('Notification impossible :', errorMessage(e)) }
}

// macOS: the texts reach AppleScript as arguments (nothing to escape); Linux: notify-send (libnotify), when installed
function notifyElsewhere(title: string, text: string): void {
    try {
        if (isMac) {
            const apple = ['on run argv', 'display notification (item 2 of argv) with title (item 1 of argv)', 'end run']
            spawn('/usr/bin/osascript', [...apple.flatMap((line) => ['-e', line]), title, text], { detached: true, stdio: 'ignore' }).unref()
            return
        }
        const exe = findInPath('notify-send')
        if (exe) spawn(exe, ['--app-name=DC Prospect', title, text], { detached: true, stdio: 'ignore' }).unref()
    } catch (e) { log('Notification impossible :', errorMessage(e)) }
}

export function cleanLogs(days = 30): void {
    const folder = path.join(localFolder, 'logs')
    const limit = Date.now() - days * 864e5
    for (const f of fs.readdirSync(folder)) {
        const p = path.join(folder, f)
        try { if (fs.statSync(p).mtimeMs < limit) fs.unlinkSync(p) } catch {}
    }
    // console.log is appended forever by the launcher: keep it small
    const c = path.join(folder, 'console.log')
    try { if (fs.statSync(c).size > 5e6) fs.writeFileSync(c, fs.readFileSync(c, 'utf8').slice(-1e6)) } catch {}
}
