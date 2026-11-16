// Secrets on macOS and Linux (Windows keeps DPAPI, vault.ts): each secret is encrypted with AES-256-GCM in its .secret
// file; the key (32 random bytes) is kept by the keychain of the system, never in the files of the app:
// - macOS: the login Keychain, through /usr/bin/security (the key goes on stdin, never on a command line);
// - Linux: the Secret Service (GNOME Keyring, KWallet), through secret-tool (package libsecret-tools).
// Without a keychain (secret-tool missing, no keyring running), the key is kept in vault.key, readable by this user
// only (chmod 600), next to the secrets: the same protection as the files of the other apps of the system.
// Works in every process of DC Prospect (the app, npm run engine, the MCP server): no Electron API needed.
import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { localFolder } from './base.js'
import { isMac, findInPath } from './platform.js'

const SERVICE = 'dc-prospect', ACCOUNT = 'vault-key', FORMAT = 'dcp1'
const keyFile = path.join(localFolder, 'vault.key')
let cachedKey: Buffer | null = null

function fromKeychain(): string | null {
    const r = isMac
        ? spawnSync('/usr/bin/security', ['find-generic-password', '-s', SERVICE, '-a', ACCOUNT, '-w'], { encoding: 'utf8', timeout: 30000 })
        : spawnSync(findInPath('secret-tool') || 'secret-tool', ['lookup', 'service', SERVICE, 'account', ACCOUNT], { encoding: 'utf8', timeout: 30000 })
    return r.status === 0 ? (r.stdout || '').trim() || null : null
}

function toKeychain(hex: string): boolean {
    const r = isMac
        // interactive mode reads the command on stdin; the key is only made of 0-9a-f
        ? spawnSync('/usr/bin/security', ['-i'], { input: `add-generic-password -U -s ${SERVICE} -a ${ACCOUNT} -l DC-Prospect -w ${hex}\n`, encoding: 'utf8', timeout: 30000 })
        : spawnSync(findInPath('secret-tool') || 'secret-tool', ['store', '--label=DC Prospect', 'service', SERVICE, 'account', ACCOUNT], { input: hex, encoding: 'utf8', timeout: 30000 })
    return r.status === 0 && fromKeychain() === hex
}

/** The key of the vault; made (and kept by the keychain) the first time a secret is written */
function vaultKey(create: boolean): Buffer | null {
    if (cachedKey) return cachedKey
    let hex = fromKeychain()
    if (!hex) try { hex = fs.readFileSync(keyFile, 'utf8').trim() } catch {}
    if (!hex && create) {
        hex = crypto.randomBytes(32).toString('hex')
        if (!toKeychain(hex)) fs.writeFileSync(keyFile, hex, { mode: 0o600 })
    }
    if (!hex || !/^[0-9a-f]{64}$/.test(hex)) return null
    cachedKey = Buffer.from(hex, 'hex')
    return cachedKey
}

export function writeSealed(file: string, value: string): void {
    const key = vaultKey(true)
    if (!key) throw new Error('Coffre : écriture impossible')
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, [FORMAT, iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':') + '\n', { mode: 0o600 })
}

/** The value, or null: no file, another key (keychain reset), file changed */
export function readSealed(file: string): string | null {
    try {
        const [format, iv, tag, data] = fs.readFileSync(file, 'utf8').trim().split(':')
        const key = format === FORMAT ? vaultKey(false) : null
        if (!key) return null
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
        decipher.setAuthTag(Buffer.from(tag, 'base64'))
        return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8')
    } catch { return null }
}
