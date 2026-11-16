// Updates of DC Prospect, found in two places:
// - the data folder (Installation\latest.json and the installer, written by scripts/publish.ps1): Windows only, as before;
// - the latest GitHub release of github.com/Djason16/dc-prospect (public API, no token), with the file of this system:
//   the installer on Windows, the .dmg of this processor on macOS, the AppImage or the .deb on Linux.
// Checked at start and every 3 hours (main.ts). Offline, rate limit, no file for this system: nothing is shown, the next
// check tries again. The texts returned are shown to the user (French).
import { app, shell } from 'electron'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream as WebReadableStream } from 'node:stream/web'

export const REPOSITORY = 'Djason16/dc-prospect'
/** A newer version: its installer on the data folder (file) or its file on GitHub (url, asset) */
export interface Update { version: string, file?: string, url?: string, asset?: string, page: string, notes: string }
interface Release { tag_name?: string, html_url?: string, body?: string, assets?: { name: string, browser_download_url: string }[] }

const AGENT = { 'User-Agent': 'DC-Prospect-update-check' }
const releasePage = (version: string) => `https://github.com/${REPOSITORY}/releases/tag/v${version}`
// "1.10.0" is newer than "1.9.2"
export const isNewer = (a: string, b: string): boolean => {
    const x = a.split('.').map(Number), y = b.split('.').map(Number)
    for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0)
    return false
}
// Linux: installed by the .deb package (in /opt), or the AppImage (APPIMAGE = its path), or the .tar.gz archive
const linuxKind = (): string => (process.env.APPIMAGE ? '.AppImage' : process.execPath.startsWith('/opt/') ? '.deb' : '.tar.gz')

function fromDataFolder(dataFolder: string): Update | null {
    if (process.platform !== 'win32') return null // the installer published there is the Windows one
    try {
        const folder = path.join(dataFolder, 'Installation')
        // written by scripts/publish.ps1; one written by a version before 1.2.0 names the installer "fichier"
        const latest = JSON.parse(fs.readFileSync(path.join(folder, 'latest.json'), 'utf8')) as { version: string, file?: string, fichier?: string, notes?: string }
        const installer = latest.file || latest.fichier || ''
        if (!fs.existsSync(path.join(folder, installer))) return null
        return { version: latest.version, file: path.join(folder, installer), page: releasePage(latest.version), notes: latest.notes || '' }
    } catch { return null }
}

/** The file of this system among the files of a release */
export function assetFor(names: string[]): string | undefined {
    if (process.platform === 'win32') return names.find((n) => /^DC-Prospect-Setup-[\d.]+\.exe$/.test(n))
    if (process.platform === 'darwin') return names.find((n) => n.endsWith(`-mac-${process.arch}.dmg`))
    if (process.platform === 'linux' && process.arch === 'x64') return names.find((n) => n.endsWith(`-linux-x86_64${linuxKind()}`))
    return undefined
}

async function fromGitHub(): Promise<Update | null> {
    // a copy run from the sources (npm start) only checks when asked: PROSPECTION_UPDATE_CHECK=1
    if (process.env.PROSPECTION_NO_UPDATE || (!app.isPackaged && !process.env.PROSPECTION_UPDATE_CHECK)) return null
    try {
        const r = await fetch(`https://api.github.com/repos/${REPOSITORY}/releases/latest`, { headers: { Accept: 'application/vnd.github+json', ...AGENT }, signal: AbortSignal.timeout(10000) })
        if (!r.ok) return null // 403 or 429: rate limit (60 an hour); 404: no release yet
        const release = (await r.json()) as Release
        const version = String(release.tag_name || '').replace(/^v/, '')
        if (!/^\d+\.\d+\.\d+$/.test(version)) return null
        const asset = assetFor((release.assets || []).map((a) => a.name))
        const url = release.assets?.find((a) => a.name === asset)?.browser_download_url
        if (!asset || !url?.startsWith('https://github.com/')) return null
        return { version, url, asset, page: release.html_url || releasePage(version), notes: String(release.body || '').slice(0, 4000) }
    } catch { return null }
}

let current: Update | null = null
export const pendingUpdate = (): Update | null => current

/** Looks in both places; onNew is called once per new version (notification) */
export async function checkUpdates(dataFolder: string, onNew: (u: Update) => void): Promise<Update | null> {
    const found = [fromDataFolder(dataFolder), await fromGitHub()].filter((u): u is Update => !!u && isNewer(u.version, app.getVersion()))
    // the newest; at the same version, the installer already on the data folder (nothing to download)
    found.sort((a, b) => (isNewer(a.version, b.version) ? -1 : isNewer(b.version, a.version) ? 1 : a.file ? -1 : 1))
    const best = found[0]
    if (best && best.version !== current?.version) onNew(best)
    if (best) current = best
    return current
}

async function download(u: Update, folder: string, suffix = ''): Promise<string> {
    if (!u.url || !u.asset) throw new Error('Pas de fichier à télécharger')
    fs.mkdirSync(folder, { recursive: true })
    const file = path.join(folder, u.asset + suffix), part = file + '.part'
    const r = await fetch(u.url, { headers: AGENT, signal: AbortSignal.timeout(20 * 60e3) })
    if (!r.ok || !r.body) throw new Error(`Téléchargement de la mise à jour impossible (${r.status}) : réessaie plus tard, ou prends-la sur la page des nouveautés.`)
    await pipeline(Readable.fromWeb(r.body as unknown as WebReadableStream), fs.createWriteStream(part))
    fs.renameSync(part, file)
    return file
}

let installing = false
/** Installs the update found; quit() closes the app when the installer needs it */
export async function installUpdate(quit: () => void): Promise<string> {
    const u = current
    if (!u) return 'Pas de mise à jour'
    if (installing) return 'La mise à jour est déjà en cours'
    installing = true
    try {
        if (process.platform === 'win32') {
            // the installer of the data folder when it is there, otherwise the one of the GitHub release
            const file = u.file && fs.existsSync(u.file) ? u.file : await download(u, app.getPath('temp'))
            spawn(file, [], { detached: true, stdio: 'ignore' }).unref()
            setTimeout(quit, 500)
            return 'Installation de la mise à jour...'
        }
        if (!u.url || !u.asset || u.asset.endsWith('.tar.gz')) {
            await shell.openExternal(u.page)
            return 'La page de la nouvelle version s\'ouvre : télécharge l\'archive .tar.gz et remplace l\'ancien dossier par le nouveau.'
        }
        if (process.platform === 'darwin') {
            const file = await download(u, app.getPath('downloads'))
            await shell.openPath(file)
            setTimeout(quit, 10000)
            return `La mise à jour s'ouvre (${u.asset}, dans Téléchargements) : glisse DC Prospect dans Applications et choisis Remplacer. DC Prospect se ferme dans 10 secondes pour ça : rouvre-le ensuite.`
        }
        const appImage = process.env.APPIMAGE
        if (appImage && u.asset.endsWith('.AppImage')) {
            // the new AppImage replaces this one (same folder, so the rename is instant), then the app restarts on it
            try { fs.accessSync(path.dirname(appImage), fs.constants.W_OK) } catch {
                const file = await download(u, app.getPath('downloads'))
                fs.chmodSync(file, 0o755)
                shell.showItemInFolder(file)
                return `La nouvelle version est dans Téléchargements (${u.asset}) : le dossier de DC Prospect est protégé, remplace l'ancien fichier par celui-ci puis relance-le.`
            }
            const file = await download(u, path.dirname(appImage), '.download')
            fs.chmodSync(file, 0o755)
            fs.renameSync(file, appImage)
            app.relaunch({ execPath: appImage, args: [] })
            setTimeout(quit, 500)
            return 'Mise à jour installée : DC Prospect redémarre.'
        }
        const file = await download(u, app.getPath('downloads'))
        if (await shell.openPath(file)) shell.showItemInFolder(file)
        return `La mise à jour est dans Téléchargements (${u.asset}) et s'ouvre dans l'installateur de logiciels : clique sur Installer (ou, dans un terminal : sudo apt install ./${u.asset}), puis relance DC Prospect.`
    } finally { installing = false }
}
