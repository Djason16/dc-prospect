# 1. Installation

## Ce qu'il faut
| Quoi | Pourquoi | Comment l'avoir |
|---|---|---|
| Windows 10 ou 11 | DC Prospect est une application Windows | |
| Un abonnement Claude (Pro ou Max) | Claude cherche les prospects et rédige les e-mails, sans frais en plus de l'abonnement | claude.ai |
| Claude Code | Le programme qui fait travailler Claude depuis DC Prospect | DC Prospect propose de l'installer (bouton « Installer Claude Code ») ; sinon : https://claude.com/claude-code |
| Une adresse e-mail pro | Les e-mails partent de cette adresse | Ton hébergeur (Infomaniak, o2switch, OVHcloud, IONOS, Google Workspace, Microsoft 365...) |
| Gmail (conseillé) | Le plus simple pour envoyer et lire les réponses | Gmail doit pouvoir « Envoyer en tant que » ton adresse pro |
| Google Drive pour ordinateur (conseillé) | Retrouver profil, zones et prospects sur tous tes PC | drive.google.com |

Node.js n'est **pas** nécessaire : il est inclus dans l'application.

## Installer
1. Télécharge `DC-Prospect-Setup-<version>.exe` dans les releases du dépôt GitHub (https://github.com/Djason16/dc-prospect/releases), ou prends `DC-Prospect-Setup.exe` dans le dossier `Installation` de tes données, puis double-clique dessus.
2. Windows peut afficher « Windows a protégé votre ordinateur » (l'application n'est pas signée) : clique sur **Informations complémentaires**, puis **Exécuter quand même**.
3. L'installation se fait toute seule, sans droits d'administrateur, dans `%LOCALAPPDATA%\Programs\dc-prospect`. Un raccourci **DC Prospect** est ajouté sur le bureau et dans le menu Démarrer.
4. **Si Claude Code manque**, l'installateur te demande « L'installer maintenant ? » : réponds Oui, une fenêtre lance l'installateur officiel d'Anthropic. Si tu réponds Non, DC Prospect te le proposera au premier lancement. Rien d'autre n'est à installer : Node.js et le navigateur intégré sont inclus dans l'application.
5. L'application s'ouvre : suis la mise en route, [2. Premier lancement](02-premier-lancement.md).

## Démarrage avec Windows
DC Prospect démarre tout seul à l'ouverture de ta session Windows, sans fenêtre. Il s'ouvre seulement s'il a quelque chose pour toi (e-mails à valider, réponse, erreur). Pour le désactiver : Réglages, Application, « Démarrer avec Windows ».

Quand tu fermes la fenêtre, l'application **continue** près de l'horloge (icône ronde DC). Pour l'arrêter vraiment : clic droit sur l'icône, **Quitter**.

## Mettre à jour
- Quand une nouvelle version est déposée dans le sous-dossier `Installation` de ton dossier de données (voir [8. Développement](08-developpement.md), « Publier »), DC Prospect affiche « Nouvelle version » : clique sur **Installer**. Il se ferme, s'installe et se relance.
- À la main : relance simplement le nouveau `DC-Prospect-Setup.exe`. Tes données et tes comptes sont gardés.

## Utiliser Google Drive (facultatif)
DC Prospect n'a besoin d'aucun cloud : sans rien faire, ses données sont dans `Documents\DC Prospect`, sur ce PC. Google Drive sert à deux choses différentes, toutes les deux facultatives.

### 1. Mettre tes données dans Google Drive (sauvegarde et plusieurs PC)
DC Prospect ne se « connecte » pas à Drive : il écrit dans un dossier de ton PC que **Google Drive pour ordinateur** synchronise tout seul.
1. Installe Google Drive pour ordinateur (https://www.google.com/drive/download/) et connecte ton compte Google. Ton Drive apparaît comme un disque dans l'Explorateur (souvent `G:\Mon Drive`).
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
Paramètres de Windows, Applications, **DC Prospect**, Désinstaller. Tes données (dossier de données) et tes comptes (`%APPDATA%\prospection-auto`) ne sont pas effacés ; supprime ces dossiers à la main si tu veux tout retirer.
