// What changes from one system to another (Windows, macOS, Linux), without Electron: the engine also runs in plain Node
// (npm run engine, the MCP server). No side effect here: the Windows app imports this file before anything else.
//   systemConfigFolder()          %APPDATA% on Windows, ~/Library/Application Support on macOS, ~/.config on Linux
//   findInPath('notify-send')      full path of a program, or null
//   openTerminal('claude auth login')   a terminal window that runs a shell command (macOS and Linux)
//   openWithSystem(url)            a page or a file with the program of the system (macOS and Linux)
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const isWindows = process.platform === 'win32'
export const isMac = process.platform === 'darwin'
export const isLinux = process.platform === 'linux'
/** Name of the system, in the texts read by the user */
export const systemName = isWindows ? 'Windows' : isMac ? 'macOS' : 'Linux'

export function systemConfigFolder(): string {
    if (isWindows) return process.env.APPDATA || os.homedir()
    if (isMac) return path.join(os.homedir(), 'Library', 'Application Support')
    return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config')
}

// An app started from the Dock or a menu gets a short PATH: the usual folders of the tools are searched too
const EXTRA_PATH = isWindows ? [] : [path.join(os.homedir(), '.local', 'bin'), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin']
export function findInPath(name: string): string | null {
    const folders = [...(process.env.PATH || '').split(path.delimiter), ...EXTRA_PATH].filter(Boolean)
    for (const folder of folders) {
        const file = path.join(folder, name)
        try { if (fs.statSync(file).isFile()) return file } catch {}
    }
    return null
}

/** One argument for a POSIX shell: 'it''s' style quoting, nothing is interpreted */
export const shellQuote = (s: string): string => `'${s.replace(/'/g, `'\\''`)}'`

// Linux terminals, the most common first: [program, arguments before the command]
const LINUX_TERMINALS: [string, string[]][] = [
    ['gnome-terminal', ['--']], ['ptyxis', ['--']], ['kgx', ['--']], ['konsole', ['-e']], ['xfce4-terminal', ['-x']],
    ['mate-terminal', ['-x']], ['tilix', ['-e']], ['x-terminal-emulator', ['-e']], ['xterm', ['-e']],
]

/**
 * Opens a terminal window that runs `command` with bash, then waits for Enter (macOS: Terminal; Linux: the first terminal
 * found). Throws an error that tells what to type when no terminal can be opened.
 */
export function openTerminal(command: string): void {
    const script = `${command}; echo; read -r -p 'Entrée pour fermer cette fenêtre ' _`
    if (isMac) {
        // the command reaches AppleScript as an argument: nothing to escape inside the script
        const apple = ['on run argv', 'tell application "Terminal"', 'activate', 'do script (item 1 of argv)', 'end tell', 'end run']
        spawn('/usr/bin/osascript', [...apple.flatMap((line) => ['-e', line]), `/bin/bash -c ${shellQuote(script)}`], { detached: true, stdio: 'ignore' }).unref()
        return
    }
    for (const [program, before] of LINUX_TERMINALS) {
        const exe = findInPath(program)
        if (!exe) continue
        spawn(exe, [...before, 'bash', '-c', script], { detached: true, stdio: 'ignore' }).unref()
        return
    }
    throw new Error(`Aucun terminal trouvé : ouvre un terminal et tape ${command}`)
}

/** A web page, a file or a folder, opened by the program chosen in the system (macOS and Linux) */
export function openWithSystem(target: string): void {
    spawn(isMac ? 'open' : 'xdg-open', [target], { detached: true, stdio: 'ignore' }).unref()
}
