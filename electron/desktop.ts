// What the app does differently on Windows, macOS and Linux: start with the session, install Claude Code, declare the
// MCP server in Claude Code, the words used for the icon. Windows keeps exactly what it did before 1.4.0.
import { app } from 'electron'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openTerminal } from '../backend/services/platform.js'

const isWindows = process.platform === 'win32', isMac = process.platform === 'darwin'

// ---------- Start with the session ----------
// Linux has no login item API: a .desktop file in ~/.config/autostart (the path of the AppImage when it is one: the
// app itself runs from a folder that changes at each start)
const autostartFile = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'autostart', 'dc-prospect.desktop')
const launcher = (): string => process.env.APPIMAGE || process.execPath

export function applyAutoStart(on: boolean): void {
    if (!app.isPackaged) return
    if (isWindows) return app.setLoginItemSettings({ openAtLogin: on, args: ['--hidden'] })
    if (isMac) return app.setLoginItemSettings({ openAtLogin: on })
    try {
        if (!on) { fs.rmSync(autostartFile, { force: true }); return }
        fs.mkdirSync(path.dirname(autostartFile), { recursive: true })
        fs.writeFileSync(autostartFile, ['[Desktop Entry]', 'Type=Application', 'Name=DC Prospect', `Exec="${launcher().replace(/(["`$\\])/g, '\\$1')}" --hidden`,
            'X-GNOME-Autostart-enabled=true', 'NoDisplay=true', ''].join('\n'))
    } catch {}
}

/** Started with the session: no window unless something needs me (macOS gives no argument, it tells it instead) */
export const startedHidden = (): boolean => process.argv.includes('--hidden') || process.argv.includes('--cache')
    || (isMac && app.isPackaged && app.getLoginItemSettings().wasOpenedAtLogin === true)

// ---------- Claude Code: official install script of Anthropic, in a window that shows its progress ----------
export function installClaude(): string {
    if (isWindows) {
        spawn('cmd.exe', ['/c', 'start', '"Installation de Claude Code"', 'powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
            'Write-Host \'Installation de Claude Code (script officiel d Anthropic)...\'; irm https://claude.ai/install.ps1 | iex; Write-Host \'\'; Write-Host \'Fini. Reviens dans DC Prospect et clique sur Se connecter a Claude.\'; Read-Host \'Entree pour fermer\''],
        { detached: true, stdio: 'ignore' }).unref()
        return 'Installation lancée dans une fenêtre PowerShell'
    }
    openTerminal("echo 'Installation de Claude Code (script officiel d Anthropic)...'; curl -fsSL https://claude.ai/install.sh | bash; echo; echo 'Fini. Reviens dans DC Prospect et clique sur Se connecter à Claude.'")
    return 'Installation lancée dans une fenêtre du terminal'
}

// ---------- MCP server « contact-mail » in Claude Code ----------
// Windows, macOS, .deb: the compiled out/backend/mcp-server.js run by the app's own Node (ELECTRON_RUN_AS_NODE).
// AppImage: its files are in a folder that changes at each start, so Claude Code starts the AppImage with --mcp (main.ts).
export const mcpLaunch = (script: string): { key: string, args: string[] } => (process.env.APPIMAGE
    ? { key: `${process.env.APPIMAGE}|--mcp`, args: ['--', process.env.APPIMAGE, '--mcp'] }
    : { key: `${process.execPath}|${script}`, args: ['-e', 'ELECTRON_RUN_AS_NODE=1', '--', process.execPath, script] })

export function declareMcp(claudeExe: () => string, script: string): string {
    spawnSync(claudeExe(), ['mcp', 'remove', 'contact-mail', '-s', 'user'], { windowsHide: true, timeout: 30000 })
    const r = spawnSync(claudeExe(), ['mcp', 'add', '--scope', 'user', 'contact-mail', ...mcpLaunch(script).args], { windowsHide: true, encoding: 'utf8', timeout: 30000 })
    if (r.status !== 0) throw new Error('MCP non déclaré : ' + (r.stderr || r.stdout || '').slice(0, 200))
    return 'MCP « contact-mail » déclaré dans Claude Code'
}

// ---------- Words ----------
/** Told once, when the window is closed the first time: the app keeps running */
export const closingHint = isWindows
    ? 'L\'application tourne en arrière-plan (icône près de l\'horloge). Clic droit sur l\'icône, Quitter pour l\'arrêter.'
    : isMac ? 'L\'application tourne en arrière-plan (icône dans la barre des menus). Clic sur l\'icône, Quitter pour l\'arrêter.'
        : 'L\'application tourne en arrière-plan (icône de la barre système, ou relance DC Prospect pour rouvrir la fenêtre). Quitter dans le menu de l\'icône pour l\'arrêter.'
