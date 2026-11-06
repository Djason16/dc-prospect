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
1. Double-clique sur `DC-Prospect-Setup.exe`.
2. Windows peut afficher « Windows a protégé votre ordinateur » (l'application n'est pas signée) : clique sur **Informations complémentaires**, puis **Exécuter quand même**.
3. L'installation se fait toute seule, sans droits d'administrateur, dans `%LOCALAPPDATA%\Programs\dc-prospect`. Un raccourci **DC Prospect** est ajouté sur le bureau et dans le menu Démarrer, puis l'application s'ouvre.
4. Suis la mise en route : [2. Premier lancement](02-premier-lancement.md).

## Démarrage avec Windows
DC Prospect démarre tout seul à l'ouverture de ta session Windows, sans fenêtre. Il s'ouvre seulement s'il a quelque chose pour toi (e-mails à valider, réponse, erreur). Pour le désactiver : Réglages, Application, « Démarrer avec Windows ».

Quand tu fermes la fenêtre, l'application **continue** près de l'horloge (icône ronde DC). Pour l'arrêter vraiment : clic droit sur l'icône, **Quitter**.

## Mettre à jour
- Quand une nouvelle version est déposée dans le sous-dossier `Installation` de ton dossier de données (voir [8. Développement](08-developpement.md), « Publier »), DC Prospect affiche « Nouvelle version » : clique sur **Installer**. Il se ferme, s'installe et se relance.
- À la main : relance simplement le nouveau `DC-Prospect-Setup.exe`. Tes données et tes comptes sont gardés.

## Plusieurs PC
1. Installe DC Prospect sur chaque PC.
2. Sur chacun, choisis **le même dossier de données** (Réglages, Avancé, Fichiers, « Changer de dossier »), par exemple un dossier dans Google Drive pour ordinateur.
3. Profil, zones, métiers, volumes et prospects sont alors partagés. Les comptes (Claude, mot de passe Gmail ou de la boîte) restent propres à chaque PC : branche-les sur chacun.
4. Un seul PC travaille à la fois : si deux sont allumés, le second se met **en veille** tout seul et reprend quand le premier s'éteint (voir [6. Règles, données et sécurité](06-donnees-et-securite.md)).

## Désinstaller
Paramètres de Windows, Applications, **DC Prospect**, Désinstaller. Tes données (dossier de données) et tes comptes (`%APPDATA%\prospection-auto`) ne sont pas effacés ; supprime ces dossiers à la main si tu veux tout retirer.
