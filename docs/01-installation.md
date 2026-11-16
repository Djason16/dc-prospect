# 1. Installation

## Ce qu'il faut
| Quoi | Pourquoi | Comment l'avoir |
|---|---|---|
| Windows 10 ou 11, macOS 12 ou plus récent (puce Apple ou Intel), ou Linux 64 bits (Ubuntu, Debian, Fedora...) | DC Prospect est une application de bureau | |
| Un abonnement Claude (Pro ou Max) | Claude cherche les prospects et rédige les e-mails, sans frais en plus de l'abonnement | claude.ai |
| Claude Code | Le programme qui fait travailler Claude depuis DC Prospect | DC Prospect propose de l'installer (bouton « Installer Claude Code ») ; sinon : https://claude.com/claude-code |
| Une adresse e-mail pro | Les e-mails partent de cette adresse | Ton hébergeur (Infomaniak, o2switch, OVHcloud, IONOS, Google Workspace, Microsoft 365...) |
| Gmail (conseillé) | Le plus simple pour envoyer et lire les réponses | Gmail doit pouvoir « Envoyer en tant que » ton adresse pro |
| Google Drive pour ordinateur (conseillé) | Retrouver profil, zones et prospects sur tous tes PC | drive.google.com |

Node.js n'est **pas** nécessaire : il est inclus dans l'application.

## Installer sur Windows
1. Télécharge `DC-Prospect-Setup-<version>.exe` dans les releases du dépôt GitHub (https://github.com/Djason16/dc-prospect/releases), ou prends `DC-Prospect-Setup.exe` dans le dossier `Installation` de tes données, puis double-clique dessus.
2. Windows peut afficher « Windows a protégé votre ordinateur » (l'application n'est pas signée) : clique sur **Informations complémentaires**, puis **Exécuter quand même**.
3. L'installation se fait toute seule, sans droits d'administrateur, dans `%LOCALAPPDATA%\Programs\dc-prospect`. Un raccourci **DC Prospect** est ajouté sur le bureau et dans le menu Démarrer.
4. **Claude Code** n'est utile qu'avec la formule « Avec mon abonnement Claude » : DC Prospect propose alors de l'installer (installateur officiel d'Anthropic). Rien d'autre n'est à installer : Node.js et le navigateur intégré sont inclus dans l'application.
5. L'application s'ouvre : suis la mise en route, [2. Premier lancement](02-premier-lancement.md).

## Installer sur macOS
1. Dans les releases (https://github.com/Djason16/dc-prospect/releases), télécharge `DC-Prospect-<version>-mac-arm64.dmg` pour un Mac à puce Apple (M1, M2, M3, M4...) ou `DC-Prospect-<version>-mac-x64.dmg` pour un Mac Intel (menu Pomme, « À propos de ce Mac » : la ligne « Puce » ou « Processeur » le dit). Le `.zip` du même nom contient la même application.
2. Ouvre le `.dmg` et glisse **DC Prospect** dans **Applications**.
3. L'application n'est pas signée par Apple : au premier lancement, **clic droit** sur DC Prospect dans Applications, **Ouvrir**, puis **Ouvrir** encore. Sur macOS 15 et plus récent : lance-la une fois, puis Réglages Système, Confidentialité et sécurité, **Ouvrir quand même**. Si macOS dit que l'application « est endommagée », tape dans le Terminal :
   ```
   xattr -dr com.apple.quarantine "/Applications/DC Prospect.app"
   ```
4. Les mots de passe sont gardés par le **trousseau** de macOS : accepte s'il te demande l'accès pour DC Prospect.
5. Suis la mise en route, [2. Premier lancement](02-premier-lancement.md).

## Installer sur Linux
Trois formats, dans les releases (https://github.com/Djason16/dc-prospect/releases), pour un PC 64 bits (x86_64) :
- **AppImage** (toutes les distributions, sans installation) : télécharge `DC-Prospect-<version>-linux-x86_64.AppImage`, rends-le exécutable (`chmod +x DC-Prospect-*.AppImage`, ou Propriétés, « Autoriser l'exécution ») puis double-clique dessus. Range-le dans un dossier à toi (par exemple `~/Applications`) : les mises à jour le remplacent au même endroit. Sur Ubuntu 22.04 et plus ancien, il faut parfois `sudo apt install libfuse2`.
- **Paquet .deb** (Ubuntu, Debian, Mint...) : `sudo apt install ./DC-Prospect-<version>-linux-x86_64.deb`. L'application est dans le menu des applications et dans `/opt/DC Prospect`.
- **Archive .tar.gz** : décompresse-la où tu veux et lance `dc-prospect`.

Les mots de passe sont gardés par le trousseau du système (GNOME Keyring ou KWallet) grâce à `secret-tool` : `sudo apt install libsecret-tools` s'il manque. Sans trousseau, ils sont chiffrés avec une clé lisible par toi seul (voir [6. Règles, données et sécurité](06-donnees-et-securite.md)). Les notifications utilisent `notify-send` (paquet `libnotify-bin`).

## Démarrage avec la session
DC Prospect démarre tout seul à l'ouverture de ta session (Windows, macOS ou Linux), sans fenêtre. Il s'ouvre seulement s'il a quelque chose pour toi (e-mails à valider, réponse, erreur). Pour le désactiver : Réglages, Application, « Démarrer avec Windows » (« avec macOS », « avec Linux »). Sur Linux, c'est le fichier `~/.config/autostart/dc-prospect.desktop`.

Quand tu fermes la fenêtre, l'application **continue** près de l'horloge (icône ronde DC ; dans la barre des menus en haut de l'écran sur macOS). Pour l'arrêter vraiment : clic droit sur l'icône (clic sur macOS), **Quitter**. Sur Linux, si ton bureau n'affiche pas les icônes de la barre système (GNOME sans extension), relance DC Prospect pour rouvrir sa fenêtre.

## Mettre à jour
DC Prospect regarde tout seul s'il existe une nouvelle version, au démarrage puis toutes les 3 heures : dans la dernière release GitHub du projet et, sur Windows, dans le sous-dossier `Installation` de ton dossier de données (voir [8. Développement](08-developpement.md), « Publier »). Quand il y en a une, une bande s'affiche en haut de tous les écrans : « Une mise à jour est disponible : 1.4.1 », avec **Voir les nouveautés** (la page de la version) et **Mettre à jour**. Une notification le dit aussi, une fois.
- **Windows** : DC Prospect prend l'installateur du dossier `Installation` s'il y est, sinon il le télécharge, puis se ferme, s'installe et se relance.
- **macOS** : le `.dmg` de ton Mac est téléchargé dans Téléchargements et s'ouvre ; glisse DC Prospect dans Applications et choisis **Remplacer** (DC Prospect se ferme tout seul pour ça), puis rouvre-le.
- **Linux** : l'AppImage est remplacée au même endroit et DC Prospect redémarre ; le paquet `.deb` est téléchargé dans Téléchargements et s'ouvre dans l'installateur de logiciels (ou `sudo apt install ./<fichier>.deb`) ; pour l'archive `.tar.gz`, la page de la version s'ouvre.
- Sans internet, ou si GitHub limite les demandes, rien ne s'affiche : DC Prospect réessaie plus tard. Réglages, Avancé, Fichiers et outils, **Chercher une mise à jour** vérifie tout de suite.
- À la main : installe simplement la nouvelle version par-dessus. Tes données et tes comptes sont gardés.

## Utiliser Google Drive (facultatif)
DC Prospect n'a besoin d'aucun cloud : sans rien faire, ses données sont dans `Documents\DC Prospect`, sur ce PC. Google Drive sert à deux choses différentes, toutes les deux facultatives.

### 1. Mettre tes données dans Google Drive (sauvegarde et plusieurs PC)
DC Prospect ne se « connecte » pas à Drive : il écrit dans un dossier de ton PC que **Google Drive pour ordinateur** synchronise tout seul.
1. Installe Google Drive pour ordinateur (https://www.google.com/drive/download/) et connecte ton compte Google. Ton Drive apparaît comme un disque dans l'Explorateur (souvent `G:\Mon Drive`), ou dans le Finder sur macOS (« Google Drive »). Sur Linux, Google ne fait pas Drive pour ordinateur : utilise un outil de synchronisation (Insync, rclone...) ou un autre service synchronisé.
2. Dans DC Prospect : Réglages, Avancé, Fichiers et outils, **Changer de dossier**. Choisis ou crée un dossier dans ton Drive (par exemple `G:\Mon Drive\DC Prospect`). L'application redémarre.
3. C'est tout : profil, zones, prospects, tableau et rapports sont maintenant dans ce dossier, sauvegardés par Google et visibles sur drive.google.com.

Ça marche de la même façon avec OneDrive ou Dropbox : choisis simplement un dossier qu'ils synchronisent.

Les mots de passe ne vont jamais dans ce dossier : ils restent sur chaque PC, chiffrés (voir [6. Règles, données et sécurité](06-donnees-et-securite.md)).

### 2. Tableau en Google Sheets et rapports en Google Docs
Là, DC Prospect se connecte à ton compte Google pour créer un vrai Google Sheets et des Google Docs, en plus du fichier Excel. Il faut une fois un « fichier client » Google : la marche à suivre est dans [4. Réglages](04-reglages.md), « Google Sheets et Google Docs ».

## Plusieurs PC
1. Installe DC Prospect sur chaque PC.
2. Sur chacun, choisis **le même dossier de données** (Réglages, Avancé, Fichiers, « Changer de dossier »), par exemple un dossier dans Google Drive pour ordinateur.
3. Profil, zones, métiers, volumes et prospects sont alors partagés. Les comptes (Claude, mot de passe Gmail ou de la boîte) restent propres à chaque PC : branche-les sur chacun.
4. Un seul PC travaille à la fois : si deux sont allumés, le second se met **en veille** tout seul et reprend quand le premier s'éteint (voir [6. Règles, données et sécurité](06-donnees-et-securite.md)).

## Désinstaller
- **Windows** : Paramètres de Windows, Applications, **DC Prospect**, Désinstaller.
- **macOS** : glisse DC Prospect d'Applications à la Corbeille.
- **Linux** : supprime l'AppImage (et `~/.config/autostart/dc-prospect.desktop`), ou `sudo apt remove dc-prospect` pour le paquet .deb.

Tes données (dossier de données) et tes comptes (`%APPDATA%\prospection-auto` sur Windows, `~/Library/Application Support/prospection-auto` sur macOS, `~/.config/prospection-auto` sur Linux) ne sont pas effacés ; supprime ces dossiers à la main si tu veux tout retirer. Sur macOS et Linux, la clé du coffre reste aussi dans le trousseau (« dc-prospect »).
