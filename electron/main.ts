// Desktop app "DC Prospect" (Windows, macOS, Linux): window in the style of djason-chery.dev, icon near the clock (menu
// bar on macOS), notifications of the system, starts with the session, keeps working when the window is closed. The
// engine (backend/engine.ts) runs inside the app. What differs between the systems is in desktop.ts, updates in update.ts.
// Compiled to out/electron/main.js (npm run build:ts): the paths below are taken from there.
import { app, BrowserWindow, Tray, Menu, Notification, dialog, shell, nativeImage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Host } from '../backend/types.js'
import { applyAutoStart, startedHidden, installClaude, declareMcp, mcpLaunch, closingHint } from './desktop.js'
import { checkUpdates, installUpdate, pendingUpdate } from './update.js'

type Engine = typeof import('../backend/engine.js')
interface ClaudeStatus { installed: boolean, connected: boolean, email?: string, plan?: string, expires?: string }

const here = path.dirname(fileURLToPath(import.meta.url))
// project folder: this file runs from out/electron/, two levels down
const root = path.resolve(here, '..', '..')
const icon = path.join(root, 'frontend', 'assets', 'images', 'icon.png')
const hidden = startedHidden() // started with the session: no window unless something needs me
const isMac = process.platform === 'darwin'
// AppImage only: Claude Code starts the MCP server through the AppImage itself (desktop.ts), no window, no lock
const mcpMode = process.argv.includes('--mcp')

if (!mcpMode && !app.requestSingleInstanceLock()) app.quit()
app.setAppUserModelId('dev.djason-chery.prospection') // id kept: the installed copies update instead of making a second app

let mainWindow: BrowserWindow | null = null, tray: Tray | null = null, engine: Engine | null = null, toldAboutClosing = false
// set when the user really quits (tray, update...): closing the window then quits instead of hiding
let quitting = false
// address of the local server, known once the engine is loaded
const address = (): string => engine?.address || ''

function openWindow(): void {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); return }
    const win = new BrowserWindow({
        width: 1320, height: 880, minWidth: 320, minHeight: 320, show: false,
        backgroundColor: '#111417', icon, title: 'DC Prospect', autoHideMenuBar: true,
        // macOS: the window buttons stay on the left of the top bar, in its middle
        titleBarStyle: 'hidden', ...(isMac ? { trafficLightPosition: { x: 18, y: 21 } } : { titleBarOverlay: { color: '#111417', symbolColor: '#eef1f3', height: 44 } }),
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true },
    })
    mainWindow = win
    win.webContents.session.setSpellCheckerLanguages(['fr'])
    win.loadURL(`${address()}/?app=1`)
    win.once('ready-to-show', () => win.show())
    // links: pages of the app (preview) in a small window, everything else in the usual browser
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith(address())) return { action: 'allow', overrideBrowserWindowOptions: { width: 760, height: 900, backgroundColor: '#ffffff', autoHideMenuBar: true, icon } }
        shell.openExternal(url)
        return { action: 'deny' }
    })
    win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(address())) { e.preventDefault(); shell.openExternal(url) } })
    // « Ajouter un rappel à mon agenda »: the .ics opens straight in the calendar of the PC (Outlook, Calendrier...)
    win.webContents.session.on('will-download', (e, item) => {
        if (!/\.ics$/i.test(item.getFilename())) return
        const file = path.join(app.getPath('temp'), item.getFilename())
        item.setSavePath(file)
        item.once('done', (ev, state) => { if (state === 'completed') shell.openPath(file) })
    })
    win.on('close', (e) => {
        if (quitting) return
        e.preventDefault()
        win.hide()
        if (!toldAboutClosing) { toldAboutClosing = true; notify('DC Prospect continue', closingHint) }
    })
    win.on('closed', () => { mainWindow = null })
}

function notify(title: string, text: string): void {
    if (!Notification.isSupported()) return
    const n = new Notification({ title, body: text, icon })
    n.on('click', openWindow)
    n.show()
}

// The MCP server is the compiled out/backend/mcp-server.js, run by the app's own Node (ELECTRON_RUN_AS_NODE)
const mcpScript = path.join(root, 'out', 'backend', 'mcp-server.js')

app.on('second-instance', () => { if (engine) openWindow() })
app.on('activate', () => { if (engine) openWindow() }) // macOS: click on the icon in the Dock
app.on('window-all-closed', () => {}) // keep running in the tray: listening to this event is what stops Electron from quitting
app.on('before-quit', () => { quitting = true; engine?.stopEngine() })

app.whenReady().then(async () => {
    if (mcpMode) {
        app.dock?.hide()
        process.stdin.on('close', () => app.exit(0))
        await import('../backend/mcp-server.js')
        return
    }
    const loaded: Engine = await import('../backend/engine.js')
    engine = loaded
    const { cfg, localFolder, localSettings, updateLocalSettings } = await import('../backend/services/base.js')
    const claude = await import('../backend/services/claude.js')
    const google = await import('../backend/services/google.js')
    const { secretFile, saveMailboxPassword } = await import('../backend/services/mail.js')
    const { forgetSecret } = await import('../backend/services/vault.js')

    // first start: start with the session (can be turned off in the settings)
    if (localSettings().autoStart === undefined) updateLocalSettings({ autoStart: true })
    const autoStart = () => applyAutoStart(localSettings().autoStart !== false)
    autoStart()

    let claudeStatusCache: { t: number, v: ClaudeStatus } | null = null
    const claudeStatus = (fresh?: boolean): ClaudeStatus => { if (fresh || !claudeStatusCache || Date.now() - claudeStatusCache.t > 30000) claudeStatusCache = { t: Date.now(), v: claude.claudeStatus() }; return claudeStatusCache.v }

    const quit = (): void => { quitting = true; app.quit() }
    const findUpdate = () => checkUpdates(cfg.dataFolder, (u) => notify('Mise à jour disponible', `Une mise à jour est disponible : DC Prospect ${u.version}. Clique sur Mettre à jour dans l'application.`))
    // dialogs belong to the window when it is open
    const pick = (options: Electron.OpenDialogOptions) => (mainWindow ? dialog.showOpenDialog(mainWindow, options) : dialog.showOpenDialog(options))
    const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
    // Answers of the actions are shown to the user (French)
    const host: Host = {
        version: app.getVersion(),
        open: openWindow,
        notify,
        autoStart: () => localSettings().autoStart !== false,
        health: () => ({ inApp: true, update: pendingUpdate() }),
        accounts: () => ({ claude: claudeStatus(), google: google.googleStatus(), mailbox: { password: fs.existsSync(secretFile) }, folder: cfg.dataFolder, update: pendingUpdate(), version: app.getVersion(), mcp: localSettings().mcpDeclaredAt || null }),
        actions: {
            connectClaude: () => { claude.connectClaude(); return 'Une fenêtre s\'ouvre : suis les étapes dans ton navigateur, puis reviens ici.' },
            disconnectClaude: () => { claude.disconnectClaude(); claudeStatus(true); return 'Claude déconnecté' },
            claudeStatus: () => claudeStatus(true),
            installClaude: () => installClaude(),
            connectGoogle: async (v) => google.connectGoogle((url) => shell.openExternal(url), { canRead: !isRecord(v) || v.canRead !== false }),
            disconnectGoogle: () => { google.disconnectGoogle(); return 'Google déconnecté' },
            importGoogleClient: async () => {
                const r = await pick({ title: 'Fichier client Google (JSON)', filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'] })
                if (r.canceled) return null
                google.importClientFile(fs.readFileSync(r.filePaths[0], 'utf8'))
                return 'Fichier client importé : tu peux te connecter à Google'
            },
            setGoogleOptions: (options) => google.setGoogleOptions(isRecord(options) ? { ...(typeof options.sheets === 'boolean' ? { sheets: options.sheets } : {}), ...(typeof options.docs === 'boolean' ? { docs: options.docs } : {}) } : {}),
            savePassword: (password) => { saveMailboxPassword(String(password || '')); return 'Mot de passe enregistré' },
            forgetPassword: () => { try { fs.unlinkSync(secretFile) } catch {} forgetSecret('contact'); return 'Mot de passe supprimé de ce PC' },
            chooseFolder: async () => {
                const r = await pick({ title: 'Dossier des données (Google Drive pour ordinateur conseillé)', properties: ['openDirectory', 'createDirectory'], defaultPath: cfg.dataFolder })
                if (r.canceled) return null
                updateLocalSettings({ dataFolder: r.filePaths[0] })
                setTimeout(() => { app.relaunch(); quit() }, 800)
                return 'Dossier changé : l\'application redémarre'
            },
            open: (value) => {
                const target = String(value ?? '')
                const places: Record<string, string> = { data: cfg.dataFolder, reports: path.join(cfg.dataFolder, 'Rapports'), logs: path.join(localFolder, 'logs') }
                const place = places[target]
                if (place) { fs.mkdirSync(place, { recursive: true }); shell.openPath(place) } else if (/^https:\/\//.test(target)) shell.openExternal(target)
                return true
            },
            setAutoStart: (on) => { updateLocalSettings({ autoStart: !!on }); autoStart(); return !!on },
            declareMcp: () => { const m = declareMcp(claude.claudeExe, mcpScript); updateLocalSettings({ mcpDeclaredAt: new Date().toISOString() }); return m },
            checkUpdate: async () => { const u = await findUpdate(); return u ? `Une mise à jour est disponible : ${u.version}` : 'Tu as la dernière version' },
            installUpdate: () => installUpdate(quit),
            quit: () => { setTimeout(quit, 300); return true },
        },
    }

    const started = await loaded.startEngine(host)
    if (!started) {
        dialog.showErrorBox('DC Prospect', `Le port ${cfg.port} est déjà pris : une ancienne version de DC Prospect tourne peut-être encore (npm run engine). Ferme-la puis relance l'application.`)
        return quit()
    }

    tray = new Tray(nativeImage.createFromPath(icon).resize({ width: 16, height: 16 }))
    tray.setToolTip('DC Prospect')
    tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Ouvrir DC Prospect', click: openWindow },
        { label: 'Préparer la journée maintenant', click: () => { loaded.app.runDay(true) } },
        { type: 'separator' },
        { label: 'Quitter', click: quit },
    ]))
    tray.on('click', openWindow)

    // MCP declared again whenever the app or the server moved (Claude Code must be installed)
    const mcpPath = mcpLaunch(mcpScript).key
    if (localSettings().mcpPath !== mcpPath && claude.claudeStatus().installed) { try { declareMcp(claude.claudeExe, mcpScript); updateLocalSettings({ mcpDeclaredAt: new Date().toISOString(), mcpPath }) } catch {} }

    // Updates: data folder and GitHub release, at start and every 3 hours (update.ts)
    findUpdate()
    setInterval(findUpdate, 3 * 3600e3)
    if (!hidden) openWindow()
})
