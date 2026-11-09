// System helpers: one active PC at a time (lock on the Drive), Windows notifications, log cleanup
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { dataFolder, localFolder, root, log, powerShellEnv } from './base.mjs'

export const machine = os.hostname()
const lockFile = path.join(dataFolder, 'lock.json')
// Lock written by a version before 1.2.0: still respected, so an old copy on another PC and this one never run together
const oldLockFile = path.join(dataFolder, 'verrou.json')
const EXPIRY = 6 * 60e3 // a PC that has not written for 6 min is considered off (Drive sync takes ~1 min)

export function version() {
    try { return fs.readFileSync(path.join(root, 'version.txt'), 'utf8').trim() } catch { return 'dev' }
}

const otherActivePc = () => {
    let lock = null
    try { lock = JSON.parse(fs.readFileSync(lockFile, 'utf8')) } catch {}
    if (lock && lock.machine !== machine && Date.now() - new Date(lock.heartbeat).getTime() < EXPIRY) return lock.machine
    let old = null
    try { old = JSON.parse(fs.readFileSync(oldLockFile, 'utf8')) } catch {}
    if (old && old.machine !== machine && Date.now() - new Date(old.battement).getTime() < EXPIRY) return old.machine
    return null
}

// Returns null if this PC holds the lock (and refreshes it), or the name of the other active PC
export function takeLock() {
    const other = otherActivePc()
    if (other) return other
    fs.mkdirSync(dataFolder, { recursive: true })
    fs.writeFileSync(lockFile, JSON.stringify({ machine, pid: process.pid, heartbeat: new Date().toISOString(), version: version() }))
    return null
}

export function releaseLock() {
    try {
        const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'))
        if (lock.machine === machine) fs.unlinkSync(lockFile)
    } catch {}
}

// Windows notification (bottom right), no extra module
export function notify(title, text) {
    const q = (s) => String(s).replace(/'/g, "''").slice(0, 240)
    const ps = `Add-Type -AssemblyName System.Windows.Forms; $n = New-Object System.Windows.Forms.NotifyIcon; ` +
        `$n.Icon = [System.Drawing.SystemIcons]::Information; $n.Visible = $true; $n.BalloonTipTitle = '${q(title)}'; $n.BalloonTipText = '${q(text)}'; ` +
        `$n.ShowBalloonTip(10000); Start-Sleep -Seconds 12; $n.Dispose()`
    try {
        spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps], { env: powerShellEnv(), windowsHide: true, detached: true, stdio: 'ignore' }).unref()
    } catch (e) { log('Notification impossible :', e.message) }
}

export function cleanLogs(days = 30) {
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
