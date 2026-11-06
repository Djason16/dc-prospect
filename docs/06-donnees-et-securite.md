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
| Dossier de données (par défaut `Documents\DC Prospect`, ou celui choisi dans Réglages) | `Données\prospects.json` (prospects, journal), `Données\reglages.json` (profil, zones, métiers, volumes, serveur), `Données\verrou.json` (PC actif), `Données\envois-mcp.jsonl`, `Suivi prospection.xlsx`, `Rapports\`, `Installation\` |
| `%APPDATA%\prospection-auto` | `*.secret` (mots de passe et connexion Google, chiffrés), `local.json` (réglages de ce PC), `google.json` (identifiants des fichiers Google, sans secret), `consommation-claude.json`, `journaux\` |
| `%LOCALAPPDATA%\Programs\dc-prospect` | L'application installée |

Ne modifie pas `Données\*.json` à la main pendant que l'application tourne.

## Les secrets
- Les mots de passe (Gmail, boîte pro) et la connexion Google sont **chiffrés par Windows** (DPAPI) : seul ton compte Windows, sur ce PC, peut les relire. Ils ne vont jamais dans le dossier de données, ni dans Git.
- Ils sont transmis à PowerShell par l'entrée standard, jamais sur une ligne de commande.
- Le mot de passe Gmail est un **mot de passe d'application** : tu peux le révoquer à tout moment sur myaccount.google.com/apppasswords sans toucher à ton vrai mot de passe.
- Connexion Google (option Sheets et Docs) : OAuth pour application de bureau avec PKCE ; DC Prospect n'accède qu'aux fichiers qu'il a créés.

## L'interface locale
L'interface est servie par le moteur sur `http://localhost:4747`, **accessible depuis ce PC seulement** (adresse 127.0.0.1, en-tête `Host` vérifié). Toute modification exige l'en-tête `X-Prospection: 1`, qu'une page d'un autre site ne peut pas envoyer sans que le navigateur demande d'abord la permission : un site malveillant ne peut pas valider ou envoyer à ta place. Les fichiers servis sont limités au dossier `frontend`.

## Plusieurs PC : le verrou
Le PC actif écrit chaque minute `Données\verrou.json` (nom du PC, heure). Un autre PC qui voit un verrou de moins de 6 minutes se met **en veille** : il affiche les données mais ne cherche pas, n'envoie pas et refuse les validations. Quand le PC actif s'éteint ou quitte DC Prospect, l'autre reprend la main.

## Le MCP « contact-mail » (Claude Code)
DC Prospect déclare tout seul un serveur MCP dans Claude Code (portée utilisateur), lancé par `DC Prospect.exe` (`ELECTRON_RUN_AS_NODE=1`), sans Node.js :
| Outil | Effet |
|---|---|
| `envoyer_email` | Envoie un e-mail depuis ton adresse pro (Gmail ou boîte pro, selon les réglages), avec ta signature principale ou secondaire, phrase STOP en option. Claude doit te montrer le texte exact et attendre ton accord. Les tirets longs sont refusés. Chaque envoi est noté dans `Données\envois-mcp.jsonl` |
| `etat_prospection` | E-mails à valider, en attente, réponses à traiter, prospects par statut |
| `lire_boite_contact` | Les derniers e-mails reçus (lecture seule) |

Si Claude Code est installé après DC Prospect : Réglages, Avancé, **Déclarer le MCP dans Claude Code**.
