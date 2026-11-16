# 6. Règles, données et sécurité

## RGPD et délivrabilité
La prospection B2B par e-mail est permise sans accord préalable quand le message s'adresse à un professionnel, sur son adresse pro, et parle de son activité. DC Prospect applique :
- **Seulement des e-mails professionnels publiés par l'entreprise elle-même** (site, mentions légales, fiche Google, page Facebook), jamais devinés ni reconstruits ; pas d'adresse d'annuaire ou de plateforme.
- **Exclusions** : entreprises fermées, chaînes et franchises, entreprises qui refusent la prospection dans le registre officiel.
- **Dans chaque e-mail** : qui écrit (signature), comment répondre, la phrase « répondez simplement STOP », et l'en-tête de désinscription.
- **STOP et refus gardés pour toujours** (seulement l'adresse), pour ne plus jamais écrire.
- **Minimisation** : on garde le nom, l'entreprise, l'e-mail pro, les dates et les réponses ; les prospects sans réponse sont **supprimés après 12 mois**.
- **Délivrabilité** : 20 e-mails par jour au maximum, espacés, texte simple, un seul lien (ton site), pas de pièce jointe ; relances dans le même fil. Ton domaine doit avoir SPF, DKIM et DMARC (demande à ton hébergeur).

Tu restes responsable de tes envois : relis chaque e-mail avant de le valider.

## Où sont les fichiers
| Où | Quoi |
|---|---|
| Dossier de données (par défaut `Documents\DC Prospect`, ou celui choisi dans Réglages) | `Données\prospects.json` (prospects, journal), `Données\settings.json` (profil, zones, métiers, volumes, serveur), `Données\lock.json` (PC actif), `Données\mcp-sends.jsonl`, `Suivi prospection.xlsx`, `Rapports\`, `Installation\` |
| `%APPDATA%\prospection-auto` (Windows), `~/Library/Application Support/prospection-auto` (macOS), `~/.config/prospection-auto` (Linux) | `*.secret` (mots de passe et connexion Google, chiffrés), `local.json` (réglages de ce PC), `google.json` (identifiants des fichiers Google, sans secret), `claude-usage.json`, `logs\` (journaux) ; sur Linux sans trousseau, `vault.key` |
| `%LOCALAPPDATA%\Programs\dc-prospect` (Windows), `/Applications/DC Prospect.app` (macOS), l'AppImage ou `/opt/DC Prospect` (Linux) | L'application installée |

Ne modifie pas `Données\*.json` à la main pendant que l'application tourne.

## Les secrets
- Les mots de passe (Gmail, boîte pro), les clés API et la connexion Google ne vont jamais dans le dossier de données, ni dans Git. Ils ne passent jamais sur une ligne de commande (entrée standard seulement).
- **Windows** : ils sont **chiffrés par Windows** (DPAPI) : seul ton compte Windows, sur ce PC, peut les relire. Ils sont transmis à PowerShell par l'entrée standard.
- **macOS et Linux** : chaque secret est chiffré (AES-256-GCM) dans son fichier `.secret` avec une clé de 32 octets tirée au hasard, gardée par le **trousseau du système** : le trousseau de session de macOS (élément « dc-prospect ») ou, sur Linux, le Secret Service (GNOME Keyring, KWallet) par `secret-tool`. Sans trousseau sur Linux (`secret-tool` absent, aucun trousseau lancé), la clé est gardée dans `vault.key`, lisible par ton compte seulement (droits 600) : la même protection que les fichiers des autres applications. Ce choix marche dans tous les processus de DC Prospect (l'application, `npm run engine`, le MCP), qui n'ont pas tous Electron.
- Si la clé est perdue (trousseau réinitialisé), les secrets ne se relisent plus : retape tes mots de passe dans Réglages, Comptes.
- Le mot de passe Gmail est un **mot de passe d'application** : tu peux le révoquer à tout moment sur myaccount.google.com/apppasswords sans toucher à ton vrai mot de passe.
- Connexion Google (option Sheets et Docs) : OAuth pour application de bureau avec PKCE ; DC Prospect n'accède qu'aux fichiers qu'il a créés.

## L'interface locale
L'interface est servie par le moteur sur `http://localhost:4747`, **accessible depuis ce PC seulement** (adresse 127.0.0.1, en-tête `Host` vérifié). Toute modification exige l'en-tête `X-Prospection: 1`, qu'une page d'un autre site ne peut pas envoyer sans que le navigateur demande d'abord la permission : un site malveillant ne peut pas valider ou envoyer à ta place. Les fichiers servis sont limités au dossier `frontend`.

## Plusieurs PC : le verrou
Le PC actif écrit chaque minute `Données\lock.json` (nom du PC, heure). Un autre PC qui voit un verrou de moins de 6 minutes se met **en veille** : il affiche les données mais ne cherche pas, n'envoie pas et refuse les validations. Quand le PC actif s'éteint ou quitte DC Prospect, l'autre reprend la main.

## Le MCP « contact-mail » (Claude Code)
DC Prospect déclare tout seul un serveur MCP dans Claude Code (portée utilisateur), lancé par `DC Prospect.exe` (`ELECTRON_RUN_AS_NODE=1`), sans Node.js ; sur macOS et avec le paquet .deb, par l'exécutable de l'application de la même façon ; avec l'AppImage, par l'AppImage elle-même (`DC-Prospect-....AppImage --mcp`), car ses fichiers changent de dossier à chaque lancement :
| Outil | Effet |
|---|---|
| `send_email` | Envoie un e-mail depuis ton adresse pro (Gmail ou boîte pro, selon les réglages), avec ta signature principale ou secondaire, phrase STOP en option. Claude doit te montrer le texte exact et attendre ton accord. Les tirets longs sont refusés. Chaque envoi est noté dans `Données\mcp-sends.jsonl` |
| `prospecting_status` | E-mails à valider, en attente, réponses à traiter, prospects par statut |
| `read_inbox` | Les derniers e-mails reçus (lecture seule) |

Si Claude Code est installé après DC Prospect : Réglages, Avancé, **Déclarer le MCP dans Claude Code**.
