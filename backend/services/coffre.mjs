// Small vault for secrets (Google connection, client file): encrypted by Windows (DPAPI, this Windows user on this PC only).
// Values go to PowerShell on stdin, never on a command line. Nothing is ever written in clear.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { dossierLocal, envPowerShell } from './base.mjs'

const chemin = (nom) => path.join(dossierLocal, `${nom}.secret`)

export function ranger(nom, valeur) {
    const fichier = chemin(nom).replace(/'/g, "''")
    // base64 first: any character survives the trip through the console
    const b64 = Buffer.from(valeur, 'utf8').toString('base64')
    const ps = `$m = [Console]::In.ReadLine(); ConvertTo-SecureString $m -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -LiteralPath '${fichier}' -Encoding ASCII`
    const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { env: envPowerShell(), input: b64 + '\n', encoding: 'utf8', windowsHide: true })
    if (r.status !== 0) throw new Error('Coffre : écriture impossible')
}

export function lireCoffre(nom) {
    if (!fs.existsSync(chemin(nom))) return null
    const fichier = chemin(nom).replace(/'/g, "''")
    const ps = `$s = Get-Content -LiteralPath '${fichier}' | ConvertTo-SecureString; [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))`
    const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { env: envPowerShell(), encoding: 'utf8', windowsHide: true })
    if (r.status !== 0) return null
    return Buffer.from(r.stdout.trim(), 'base64').toString('utf8')
}

export const oublierCoffre = (nom) => { try { fs.unlinkSync(chemin(nom)) } catch {} }
export const dansCoffre = (nom) => fs.existsSync(chemin(nom))
