// Small vault for secrets (Google connection, client file, API keys). Nothing is ever written in clear.
// - Windows: encrypted by Windows (DPAPI, this Windows user on this PC only); values go to PowerShell on stdin, never on
//   a command line.
// - macOS and Linux: encrypted with a key kept by the keychain of the system (keyring.ts).
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { localFolder, powerShellEnv } from './base.js'
import { isWindows } from './platform.js'
import { writeSealed, readSealed } from './keyring.js'

const secretPath = (name: string): string => path.join(localFolder, `${name}.secret`)

export function storeSecret(name: string, value: string): void {
    if (!isWindows) return writeSealed(secretPath(name), value)
    const file = secretPath(name).replace(/'/g, "''")
    // base64 first: any character survives the trip through the console
    const b64 = Buffer.from(value, 'utf8').toString('base64')
    const ps = `$m = [Console]::In.ReadLine(); ConvertTo-SecureString $m -AsPlainText -Force | ConvertFrom-SecureString | Set-Content -LiteralPath '${file}' -Encoding ASCII`
    const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { env: powerShellEnv(), input: b64 + '\n', encoding: 'utf8', windowsHide: true })
    if (r.status !== 0) throw new Error('Coffre : écriture impossible')
}

export function readSecret(name: string): string | null {
    if (!fs.existsSync(secretPath(name))) return null
    if (!isWindows) return readSealed(secretPath(name))
    const file = secretPath(name).replace(/'/g, "''")
    const ps = `$s = Get-Content -LiteralPath '${file}' | ConvertTo-SecureString; [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))`
    const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { env: powerShellEnv(), encoding: 'utf8', windowsHide: true })
    if (r.status !== 0) return null
    return Buffer.from(r.stdout.trim(), 'base64').toString('utf8')
}

export const forgetSecret = (name: string): void => { try { fs.unlinkSync(secretPath(name)) } catch {} }
export const hasSecret = (name: string): boolean => fs.existsSync(secretPath(name))
