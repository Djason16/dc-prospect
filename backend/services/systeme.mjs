// System helpers: one active PC at a time (lock on the Drive), Windows notifications, log cleanup
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { dossierDonnees, dossierLocal, racine, log, envPowerShell } from './base.mjs'

export const machine = os.hostname()
const fichierVerrou = path.join(dossierDonnees, 'verrou.json')
const EXPIRATION = 6 * 60e3 // a PC that has not written for 6 min is considered off (Drive sync takes ~1 min)

export function version() {
    try { return fs.readFileSync(path.join(racine, 'version.txt'), 'utf8').trim() } catch { return 'dev' }
}

// Returns null if this PC holds the lock (and refreshes it), or the name of the other active PC
export function prendreVerrou() {
    let v = null
    try { v = JSON.parse(fs.readFileSync(fichierVerrou, 'utf8')) } catch {}
    if (v && v.machine !== machine && Date.now() - new Date(v.battement).getTime() < EXPIRATION) return v.machine
    fs.mkdirSync(dossierDonnees, { recursive: true })
    fs.writeFileSync(fichierVerrou, JSON.stringify({ machine, pid: process.pid, battement: new Date().toISOString(), version: version() }))
    return null
}

export function rendreVerrou() {
    try {
        const v = JSON.parse(fs.readFileSync(fichierVerrou, 'utf8'))
        if (v.machine === machine) fs.unlinkSync(fichierVerrou)
    } catch {}
}

// Windows notification (bottom right), no extra module
export function notifier(titre, texte) {
    const q = (s) => String(s).replace(/'/g, "''").slice(0, 240)
    const ps = `Add-Type -AssemblyName System.Windows.Forms; $n = New-Object System.Windows.Forms.NotifyIcon; ` +
        `$n.Icon = [System.Drawing.SystemIcons]::Information; $n.Visible = $true; $n.BalloonTipTitle = '${q(titre)}'; $n.BalloonTipText = '${q(texte)}'; ` +
        `$n.ShowBalloonTip(10000); Start-Sleep -Seconds 12; $n.Dispose()`
    try {
        spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps], { env: envPowerShell(), windowsHide: true, detached: true, stdio: 'ignore' }).unref()
    } catch (e) { log('Notification impossible :', e.message) }
}

export function nettoyerJournaux(jours = 30) {
    const d = path.join(dossierLocal, 'journaux')
    const limite = Date.now() - jours * 864e5
    for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f)
        try { if (fs.statSync(p).mtimeMs < limite) fs.unlinkSync(p) } catch {}
    }
    // console.log is appended forever by the launcher: keep it small
    const c = path.join(d, 'console.log')
    try { if (fs.statSync(c).size > 5e6) fs.writeFileSync(c, fs.readFileSync(c, 'utf8').slice(-1e6)) } catch {}
}
