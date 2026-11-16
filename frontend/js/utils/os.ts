// System of this computer (the app runs on Windows, macOS and Linux): only the texts that name the system change
export type Os = 'windows' | 'mac' | 'linux'
const agent = navigator.userAgent
export const OS: Os = /Macintosh|Mac OS X/.test(agent) ? 'mac' : /Linux|X11/.test(agent) ? 'linux' : 'windows'
const pick = <T>(values: Record<Os, T>): T => values[OS]

/** « Démarrer avec Windows », « Démarrer avec macOS »... */
export const OS_NAME = pick({ windows: 'Windows', mac: 'macOS', linux: 'Linux' })
/** Who encrypts the passwords on this computer: « chiffré par Windows » */
export const VAULT = pick({ windows: 'Windows', mac: 'le trousseau de macOS', linux: 'le trousseau du système' })
/** Folder of this computer for the accounts and the logs */
export const LOCAL_FOLDER = pick({ windows: '%APPDATA%\\prospection-auto', mac: '~/Library/Application Support/prospection-auto', linux: '~/.config/prospection-auto' })
/** Separator of the folders in the paths shown */
export const SEP = OS === 'windows' ? '\\' : '/'
/** Where the icon of the app is when the window is closed */
export const TRAY = pick({ windows: 'près de l\'horloge', mac: 'dans la barre des menus, en haut de l\'écran', linux: 'dans la barre système (ou relance DC Prospect pour rouvrir la fenêtre)' })
/** What happens when « Mettre à jour » is clicked, in a few words */
export const UPDATE_HINT = pick({
    windows: 'L\'installation se lance toute seule.',
    mac: 'Le fichier s\'ouvre : glisse DC Prospect dans Applications et choisis Remplacer.',
    linux: 'AppImage : remplacée et relancée toute seule ; paquet .deb : il s\'ouvre dans l\'installateur de logiciels.',
})
