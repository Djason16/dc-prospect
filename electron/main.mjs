// Windows app "DC Prospect": window in the style of djason-chery.dev, icon near the clock, Windows notifications,
// starts with Windows, keeps working when the window is closed. The engine (lib/moteur.mjs) runs inside the app.
import { app, BrowserWindow, Tray, Menu, Notification, dialog, shell, nativeImage } from 'electron'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ici = path.dirname(fileURLToPath(import.meta.url))
const racine = path.resolve(ici, '..')
const icone = path.join(racine, 'frontend', 'assets', 'images', 'icone.png')
const enCache = process.argv.includes('--cache') // started with Windows: no window unless something needs me

if (!app.requestSingleInstanceLock()) app.quit()
app.setAppUserModelId('dev.djason-chery.prospection') // id kept: the installed copies update instead of making a second app

let fenetre = null, tray = null, moteur = null, miseAJour = null, prevenuFermeture = false

function ouvrirFenetre() {
    if (fenetre) { if (fenetre.isMinimized()) fenetre.restore(); fenetre.show(); fenetre.focus(); return }
    fenetre = new BrowserWindow({
        width: 1320, height: 880, minWidth: 980, minHeight: 640, show: false,
        backgroundColor: '#111417', icon: icone, title: 'DC Prospect', autoHideMenuBar: true,
        titleBarStyle: 'hidden', titleBarOverlay: { color: '#111417', symbolColor: '#eef1f3', height: 44 },
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true },
    })
    fenetre.webContents.session.setSpellCheckerLanguages(['fr'])
    fenetre.loadURL(`${moteur.adresse}/?app=1`)
    fenetre.once('ready-to-show', () => fenetre.show())
    // links: pages of the app (preview) in a small window, everything else in the usual browser
    fenetre.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith(moteur.adresse)) return { action: 'allow', overrideBrowserWindowOptions: { width: 760, height: 900, backgroundColor: '#ffffff', autoHideMenuBar: true, icon: icone } }
        shell.openExternal(url)
        return { action: 'deny' }
    })
    fenetre.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(moteur.adresse)) { e.preventDefault(); shell.openExternal(url) } })
    fenetre.on('close', (e) => {
        if (app.quitte) return
        e.preventDefault()
        fenetre.hide()
        if (!prevenuFermeture) { prevenuFermeture = true; notifier('DC Prospect continue', 'L\'application tourne en arrière-plan (icône près de l\'horloge). Clic droit sur l\'icône, Quitter pour l\'arrêter.') }
    })
    fenetre.on('closed', () => { fenetre = null })
}

function notifier(titre, texte) {
    if (!Notification.isSupported()) return
    const n = new Notification({ title: titre, body: texte, icon: icone })
    n.on('click', ouvrirFenetre)
    n.show()
}

// ---------- Updates: the installer published on the Drive (Fichier\PROSPECTION\Installation) ----------
function verifierMiseAJour(cfg) {
    try {
        const dossier = path.join(cfg.dossierDrive, 'Installation')
        const j = JSON.parse(fs.readFileSync(path.join(dossier, 'latest.json'), 'utf8'))
        const plusRecente = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false }
        if (plusRecente(j.version, app.getVersion()) && fs.existsSync(path.join(dossier, j.fichier))) {
            const nouvelle = !miseAJour
            miseAJour = { version: j.version, fichier: path.join(dossier, j.fichier), notes: j.notes || '' }
            if (nouvelle) notifier('Mise à jour disponible', `DC Prospect ${j.version} est prête : clique sur Installer dans l'application.`)
        }
    } catch {}
    return miseAJour
}

// ---------- Claude Code ----------
function installerClaude() {
    spawn('cmd.exe', ['/c', 'start', '"Installation de Claude Code"', 'powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
        'Write-Host \'Installation de Claude Code (script officiel d Anthropic)...\'; irm https://claude.ai/install.ps1 | iex; Write-Host \'\'; Write-Host \'Fini. Reviens dans DC Prospect et clique sur Se connecter a Claude.\'; Read-Host \'Entree pour fermer\''],
    { detached: true, stdio: 'ignore' }).unref()
}

function declarerMcp(exeClaude) {
    const script = path.join(racine, 'backend', 'mcp-server.mjs')
    spawnSync(exeClaude(), ['mcp', 'remove', 'contact-mail', '-s', 'user'], { windowsHide: true, timeout: 30000 })
    const r = spawnSync(exeClaude(), ['mcp', 'add', '--scope', 'user', 'contact-mail', '-e', 'ELECTRON_RUN_AS_NODE=1', '--', process.execPath, script], { windowsHide: true, encoding: 'utf8', timeout: 30000 })
    if (r.status !== 0) throw new Error('MCP non déclaré : ' + (r.stderr || r.stdout || '').slice(0, 200))
    return 'MCP « contact-mail » déclaré dans Claude Code'
}

app.on('second-instance', ouvrirFenetre)
app.on('window-all-closed', (e) => e.preventDefault()) // keep running in the tray
app.on('before-quit', () => { app.quitte = true; moteur?.arreterMoteur() })

app.whenReady().then(async () => {
    moteur = await import('../backend/moteur.mjs')
    const { cfg, reglagesLocaux, majReglagesLocaux } = await import('../backend/services/base.mjs')
    const claude = await import('../backend/services/claude.mjs')
    const google = await import('../backend/services/google.mjs')
    const { fichierSecret, enregistrerMotDePasse } = await import('../backend/services/mail.mjs')
    const { oublierCoffre } = await import('../backend/services/coffre.mjs')

    // first start: start with Windows (can be turned off in the settings)
    if (reglagesLocaux().demarrageAuto === undefined) majReglagesLocaux({ demarrageAuto: true })
    const appliquerDemarrage = () => { if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: reglagesLocaux().demarrageAuto !== false, args: ['--cache'] }) }
    appliquerDemarrage()

    let statutClaudeCache = null
    const statutClaude = (frais) => { if (frais || !statutClaudeCache || Date.now() - statutClaudeCache.t > 30000) statutClaudeCache = { t: Date.now(), v: claude.statutClaude() }; return statutClaudeCache.v }

    const hote = {
        version: app.getVersion(),
        ouvrir: ouvrirFenetre,
        notifier,
        demarrageAuto: () => reglagesLocaux().demarrageAuto !== false,
        sante: () => ({ application: true, miseAJour }),
        comptes: () => ({ claude: statutClaude(), google: google.statutGoogle(), messagerie: { motDePasse: fs.existsSync(fichierSecret) }, dossier: cfg.dossierDrive, miseAJour, version: app.getVersion(), mcp: reglagesLocaux().mcp || null }),
        actions: {
            connecterClaude: () => { claude.connecterClaude(); return 'Une fenêtre s\'ouvre : suis les étapes dans ton navigateur, puis reviens ici.' },
            deconnecterClaude: () => { claude.deconnecterClaude(); statutClaude(true); return 'Claude déconnecté' },
            statutClaude: () => statutClaude(true),
            installerClaude: () => { installerClaude(); return 'Installation lancée dans une fenêtre PowerShell' },
            connecterGoogle: async (v) => google.connecterGoogle((url) => shell.openExternal(url), { lecture: v?.lecture !== false }),
            deconnecterGoogle: () => { google.deconnecterGoogle(); return 'Google déconnecté' },
            importerClientGoogle: async () => {
                const r = await dialog.showOpenDialog(fenetre, { title: 'Fichier client Google (JSON)', filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'] })
                if (r.canceled) return null
                google.importerClient(fs.readFileSync(r.filePaths[0], 'utf8'))
                return 'Fichier client importé : tu peux te connecter à Google'
            },
            reglerGoogle: (options) => google.reglerGoogle(options),
            motDePasse: (mdp) => { enregistrerMotDePasse(String(mdp || '')); return 'Mot de passe enregistré' },
            oublierMotDePasse: () => { try { fs.unlinkSync(fichierSecret) } catch {} oublierCoffre('contact'); return 'Mot de passe supprimé de ce PC' },
            choisirDossier: async () => {
                const r = await dialog.showOpenDialog(fenetre, { title: 'Dossier des données (Google Drive pour ordinateur conseillé)', properties: ['openDirectory', 'createDirectory'], defaultPath: cfg.dossierDrive })
                if (r.canceled) return null
                majReglagesLocaux({ dossierDrive: r.filePaths[0] })
                setTimeout(() => { app.relaunch(); app.quitte = true; app.quit() }, 800)
                return 'Dossier changé : l\'application redémarre'
            },
            ouvrir: (cible) => {
                const lieux = { donnees: cfg.dossierDrive, rapports: path.join(cfg.dossierDrive, 'Rapports'), journaux: path.join(process.env.APPDATA, 'prospection-auto', 'journaux') }
                if (lieux[cible]) { fs.mkdirSync(lieux[cible], { recursive: true }); shell.openPath(lieux[cible]) } else if (/^https:\/\//.test(cible)) shell.openExternal(cible)
                return true
            },
            demarrageAuto: (oui) => { majReglagesLocaux({ demarrageAuto: !!oui }); appliquerDemarrage(); return !!oui },
            declarerMcp: () => { const m = declarerMcp(claude.exeClaude); majReglagesLocaux({ mcp: new Date().toISOString() }); return m },
            verifierMiseAJour: () => verifierMiseAJour(cfg) || 'Tu as la dernière version',
            installerMiseAJour: () => {
                if (!miseAJour) return 'Pas de mise à jour'
                spawn(miseAJour.fichier, [], { detached: true, stdio: 'ignore' }).unref()
                setTimeout(() => { app.quitte = true; app.quit() }, 500)
                return 'Installation de la mise à jour...'
            },
            quitter: () => { setTimeout(() => { app.quitte = true; app.quit() }, 300); return true },
        },
    }

    const lance = await moteur.demarrerMoteur(hote)
    if (!lance) {
        dialog.showErrorBox('DC Prospect', `Le port ${cfg.port} est déjà pris : une ancienne version de DC Prospect tourne peut-être encore (node run.mjs). Ferme-la puis relance l'application.`)
        app.quitte = true
        return app.quit()
    }

    tray = new Tray(nativeImage.createFromPath(icone).resize({ width: 16, height: 16 }))
    tray.setToolTip('DC Prospect')
    tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Ouvrir DC Prospect', click: ouvrirFenetre },
        { label: 'Préparer la journée maintenant', click: () => moteur.app.lancerJournee(true) },
        { type: 'separator' },
        { label: 'Quitter', click: () => { app.quitte = true; app.quit() } },
    ]))
    tray.on('click', ouvrirFenetre)

    // MCP declared once (Claude Code must be installed)
    const cheminMcp = `${process.execPath}|${path.join(racine, 'backend', 'mcp-server.mjs')}`
    if (reglagesLocaux().mcpChemin !== cheminMcp && claude.statutClaude().installe) { try { declarerMcp(claude.exeClaude); majReglagesLocaux({ mcp: new Date().toISOString(), mcpChemin: cheminMcp }) } catch {} }

    verifierMiseAJour(cfg)
    setInterval(() => verifierMiseAJour(cfg), 6 * 3600e3)
    if (!enCache) ouvrirFenetre()
})
