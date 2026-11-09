// Windows app "DC Prospect": window in the style of djason-chery.dev, icon near the clock, Windows notifications,
// starts with Windows, keeps working when the window is closed. The engine (backend/engine.mjs) runs inside the app.
import { app, BrowserWindow, Tray, Menu, Notification, dialog, shell, nativeImage } from 'electron'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const icon = path.join(root, 'frontend', 'assets', 'images', 'icon.png')
const hidden = process.argv.includes('--hidden') || process.argv.includes('--cache') // started with Windows: no window unless something needs me

if (!app.requestSingleInstanceLock()) app.quit()
app.setAppUserModelId('dev.djason-chery.prospection') // id kept: the installed copies update instead of making a second app

let mainWindow = null, tray = null, engine = null, update = null, toldAboutClosing = false

function openWindow() {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); return }
    mainWindow = new BrowserWindow({
        width: 1320, height: 880, minWidth: 980, minHeight: 640, show: false,
        backgroundColor: '#111417', icon, title: 'DC Prospect', autoHideMenuBar: true,
        titleBarStyle: 'hidden', titleBarOverlay: { color: '#111417', symbolColor: '#eef1f3', height: 44 },
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true },
    })
    mainWindow.webContents.session.setSpellCheckerLanguages(['fr'])
    mainWindow.loadURL(`${engine.address}/?app=1`)
    mainWindow.once('ready-to-show', () => mainWindow.show())
    // links: pages of the app (preview) in a small window, everything else in the usual browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith(engine.address)) return { action: 'allow', overrideBrowserWindowOptions: { width: 760, height: 900, backgroundColor: '#ffffff', autoHideMenuBar: true, icon } }
        shell.openExternal(url)
        return { action: 'deny' }
    })
    mainWindow.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(engine.address)) { e.preventDefault(); shell.openExternal(url) } })
    mainWindow.on('close', (e) => {
        if (app.quitting) return
        e.preventDefault()
        mainWindow.hide()
        if (!toldAboutClosing) { toldAboutClosing = true; notify('DC Prospect continue', 'L\'application tourne en arrière-plan (icône près de l\'horloge). Clic droit sur l\'icône, Quitter pour l\'arrêter.') }
    })
    mainWindow.on('closed', () => { mainWindow = null })
}

function notify(title, text) {
    if (!Notification.isSupported()) return
    const n = new Notification({ title, body: text, icon })
    n.on('click', openWindow)
    n.show()
}

// ---------- Updates: the installer published on the Drive (Fichier\PROSPECTION\Installation) ----------
function checkUpdate(cfg) {
    try {
        const folder = path.join(cfg.dataFolder, 'Installation')
        const latest = JSON.parse(fs.readFileSync(path.join(folder, 'latest.json'), 'utf8'))
        const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false }
        // latest.json written by a version before 1.2.0 names the installer "fichier"
        const installer = latest.file || latest.fichier
        if (newer(latest.version, app.getVersion()) && fs.existsSync(path.join(folder, installer))) {
            const isNew = !update
            update = { version: latest.version, file: path.join(folder, installer), notes: latest.notes || '' }
            if (isNew) notify('Mise à jour disponible', `DC Prospect ${latest.version} est prête : clique sur Installer dans l'application.`)
        }
    } catch {}
    return update
}

// ---------- Claude Code ----------
function installClaude() {
    spawn('cmd.exe', ['/c', 'start', '"Installation de Claude Code"', 'powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
        'Write-Host \'Installation de Claude Code (script officiel d Anthropic)...\'; irm https://claude.ai/install.ps1 | iex; Write-Host \'\'; Write-Host \'Fini. Reviens dans DC Prospect et clique sur Se connecter a Claude.\'; Read-Host \'Entree pour fermer\''],
    { detached: true, stdio: 'ignore' }).unref()
}

function declareMcp(claudeExe) {
    const script = path.join(root, 'backend', 'mcp-server.mjs')
    spawnSync(claudeExe(), ['mcp', 'remove', 'contact-mail', '-s', 'user'], { windowsHide: true, timeout: 30000 })
    const r = spawnSync(claudeExe(), ['mcp', 'add', '--scope', 'user', 'contact-mail', '-e', 'ELECTRON_RUN_AS_NODE=1', '--', process.execPath, script], { windowsHide: true, encoding: 'utf8', timeout: 30000 })
    if (r.status !== 0) throw new Error('MCP non déclaré : ' + (r.stderr || r.stdout || '').slice(0, 200))
    return 'MCP « contact-mail » déclaré dans Claude Code'
}

app.on('second-instance', openWindow)
app.on('window-all-closed', (e) => e.preventDefault()) // keep running in the tray
app.on('before-quit', () => { app.quitting = true; engine?.stopEngine() })

app.whenReady().then(async () => {
    engine = await import('../backend/engine.mjs')
    const { cfg, localSettings, updateLocalSettings } = await import('../backend/services/base.mjs')
    const claude = await import('../backend/services/claude.mjs')
    const google = await import('../backend/services/google.mjs')
    const { secretFile, saveMailboxPassword } = await import('../backend/services/mail.mjs')
    const { forgetSecret } = await import('../backend/services/vault.mjs')

    // first start: start with Windows (can be turned off in the settings)
    if (localSettings().autoStart === undefined) updateLocalSettings({ autoStart: true })
    const applyAutoStart = () => { if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: localSettings().autoStart !== false, args: ['--hidden'] }) }
    applyAutoStart()

    let claudeStatusCache = null
    const claudeStatus = (fresh) => { if (fresh || !claudeStatusCache || Date.now() - claudeStatusCache.t > 30000) claudeStatusCache = { t: Date.now(), v: claude.claudeStatus() }; return claudeStatusCache.v }

    const quit = () => { app.quitting = true; app.quit() }
    // Answers of the actions are shown to the user (French)
    const host = {
        version: app.getVersion(),
        open: openWindow,
        notify,
        autoStart: () => localSettings().autoStart !== false,
        health: () => ({ inApp: true, update }),
        accounts: () => ({ claude: claudeStatus(), google: google.googleStatus(), mailbox: { password: fs.existsSync(secretFile) }, folder: cfg.dataFolder, update, version: app.getVersion(), mcp: localSettings().mcpDeclaredAt || null }),
        actions: {
            connectClaude: () => { claude.connectClaude(); return 'Une fenêtre s\'ouvre : suis les étapes dans ton navigateur, puis reviens ici.' },
            disconnectClaude: () => { claude.disconnectClaude(); claudeStatus(true); return 'Claude déconnecté' },
            claudeStatus: () => claudeStatus(true),
            installClaude: () => { installClaude(); return 'Installation lancée dans une fenêtre PowerShell' },
            connectGoogle: async (v) => google.connectGoogle((url) => shell.openExternal(url), { canRead: v?.canRead !== false }),
            disconnectGoogle: () => { google.disconnectGoogle(); return 'Google déconnecté' },
            importGoogleClient: async () => {
                const r = await dialog.showOpenDialog(mainWindow, { title: 'Fichier client Google (JSON)', filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'] })
                if (r.canceled) return null
                google.importClientFile(fs.readFileSync(r.filePaths[0], 'utf8'))
                return 'Fichier client importé : tu peux te connecter à Google'
            },
            setGoogleOptions: (options) => google.setGoogleOptions(options),
            savePassword: (password) => { saveMailboxPassword(String(password || '')); return 'Mot de passe enregistré' },
            forgetPassword: () => { try { fs.unlinkSync(secretFile) } catch {} forgetSecret('contact'); return 'Mot de passe supprimé de ce PC' },
            chooseFolder: async () => {
                const r = await dialog.showOpenDialog(mainWindow, { title: 'Dossier des données (Google Drive pour ordinateur conseillé)', properties: ['openDirectory', 'createDirectory'], defaultPath: cfg.dataFolder })
                if (r.canceled) return null
                updateLocalSettings({ dataFolder: r.filePaths[0] })
                setTimeout(() => { app.relaunch(); quit() }, 800)
                return 'Dossier changé : l\'application redémarre'
            },
            open: (target) => {
                const places = { data: cfg.dataFolder, reports: path.join(cfg.dataFolder, 'Rapports'), logs: path.join(process.env.APPDATA, 'prospection-auto', 'logs') }
                if (places[target]) { fs.mkdirSync(places[target], { recursive: true }); shell.openPath(places[target]) } else if (/^https:\/\//.test(target)) shell.openExternal(target)
                return true
            },
            setAutoStart: (on) => { updateLocalSettings({ autoStart: !!on }); applyAutoStart(); return !!on },
            declareMcp: () => { const m = declareMcp(claude.claudeExe); updateLocalSettings({ mcpDeclaredAt: new Date().toISOString() }); return m },
            checkUpdate: () => checkUpdate(cfg) || 'Tu as la dernière version',
            installUpdate: () => {
                if (!update) return 'Pas de mise à jour'
                spawn(update.file, [], { detached: true, stdio: 'ignore' }).unref()
                setTimeout(quit, 500)
                return 'Installation de la mise à jour...'
            },
            quit: () => { setTimeout(quit, 300); return true },
        },
    }

    const started = await engine.startEngine(host)
    if (!started) {
        dialog.showErrorBox('DC Prospect', `Le port ${cfg.port} est déjà pris : une ancienne version de DC Prospect tourne peut-être encore (node run.mjs). Ferme-la puis relance l'application.`)
        return quit()
    }

    tray = new Tray(nativeImage.createFromPath(icon).resize({ width: 16, height: 16 }))
    tray.setToolTip('DC Prospect')
    tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Ouvrir DC Prospect', click: openWindow },
        { label: 'Préparer la journée maintenant', click: () => engine.app.runDay(true) },
        { type: 'separator' },
        { label: 'Quitter', click: quit },
    ]))
    tray.on('click', openWindow)

    // MCP declared again whenever the app or the server moved (Claude Code must be installed)
    const mcpPath = `${process.execPath}|${path.join(root, 'backend', 'mcp-server.mjs')}`
    if (localSettings().mcpPath !== mcpPath && claude.claudeStatus().installed) { try { declareMcp(claude.claudeExe); updateLocalSettings({ mcpDeclaredAt: new Date().toISOString(), mcpPath }) } catch {} }

    checkUpdate(cfg)
    setInterval(() => checkUpdate(cfg), 6 * 3600e3)
    if (!hidden) openWindow()
})
