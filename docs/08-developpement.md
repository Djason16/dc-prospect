# 8. Développement

## Les briques
| Brique | Choix |
|---|---|
| Application Windows | Electron (fenêtre, icône près de l'horloge, notifications, démarrage avec Windows) |
| Moteur et API | Node.js (modules ES `.mjs`), serveur `http` sans framework, réponses au format DC Scaffold `{ success, ... }` |
| Interface | HTML, CSS et modules JavaScript sans compilation (rangement du stack « HTML / CSS / JS » de DC Scaffold) |
| IA | Claude Code en mode `claude -p` (abonnement de l'utilisateur) : Haiku pour chercher, Sonnet pour rédiger |
| E-mails | nodemailer (SMTP), imapflow (IMAP), mailparser |
| Tableau | exceljs ; Google Sheets et Drive par leurs API REST (option) |
| MCP | @modelcontextprotocol/sdk, zod |
| Installateur | electron-builder (NSIS, une installation par utilisateur, `asar: false` pour que le MCP et l'interface restent de vrais fichiers) |

## Arborescence
Tout le code est en anglais (fichiers, fonctions, variables, routes, clés des données) ; seuls les textes lus par l'utilisateur sont en français.
```
dc-prospect/
├── backend/
│   ├── server.mjs              serveur : frontend/ + table des routes /api vers les contrôleurs
│   ├── engine.mjs              la journée, le tour de chaque minute, le verrou, les notifications
│   ├── run.mjs                 le moteur sans fenêtre (npm run engine)
│   ├── check.mjs               vérifie tout sans rien envoyer (npm run check)
│   ├── mcp-server.mjs          MCP « contact-mail »
│   ├── controllers/            StateController, ProspectsController, SettingsController, AccountsController
│   ├── services/
│   │   ├── base.mjs            config, dossiers, état (prospects.json), dates, jours fériés, créneaux, journal
│   │   ├── migration.mjs       conversion une seule fois des fichiers écrits avant la 1.2.0 (clés en français)
│   │   ├── settings.mjs        profil, zones, métiers, volumes (Données\settings.json), zone de la semaine
│   │   ├── prospecting.mjs     réponses, recherche, lot du jour, envoi, oubli à 12 mois, rendement par métier
│   │   ├── claude.mjs          prompts de recherche et de rédaction par l'IA (rôles), contrôle des textes
│   │   ├── ai.mjs              moteurs d'IA interchangeables : Claude Code, API Anthropic, API compatible OpenAI
│   │   ├── discovery.mjs       recherche sans IA : registre + API Brave (site de chaque entreprise)
│   │   ├── siteAudit.mjs       lecture des sites sans IA (e-mails, téléphones, constats, SEO), mesure PageSpeed
│   │   ├── templates.mjs       rédaction sans IA par modèles (resources/templates, variantes {a|b})
│   │   ├── localAi.mjs         IA intégrée : téléchargement du modèle (Qwen3 4B), exécution sur le PC (node-llama-cpp)
│   │   ├── localWriter.mjs     rédaction par l'IA intégrée : brouillon des modèles, rendu naturel, contrôles (pas de chiffre inventé)
│   │   ├── replies.mjs         réponses aux prospects : préparation et envoi dans la même conversation
│   │   ├── learning.mjs        IA interne : chance de réponse, bandit des objets, type des réponses, santé de l'envoi
│   │   ├── deliverability.mjs  SPF, DKIM, DMARC du domaine d'envoi, montée en charge, plafond du jour
│   │   ├── web.mjs             communes d'une zone, contrôle MX, vérification au registre
│   │   ├── companies.mjs       registre des entreprises (ancienne recherche, gardée pour référence)
│   │   ├── mail.mjs            signatures, composition, envoi et lecture (Gmail ou boîte pro), tests
│   │   ├── google.mjs          OAuth bureau (PKCE), Gmail API, Drive (rapports en Docs), Sheets
│   │   ├── report.mjs          chiffres, tableau (Excel et Sheets), rapport du jour, bilan du vendredi
│   │   ├── vault.mjs           secrets chiffrés par Windows (DPAPI via PowerShell)
│   │   └── system.mjs          verrou entre PC, notifications sans fenêtre, nettoyage des journaux
│   └── utils/ResponseHelper.mjs  { success: true, ...data } / { success: false, error, type } ; ApiError
├── frontend/
│   ├── pages/index.html        la page (le cadre est ajouté par AppShell)
│   ├── assets/css/             main.css, base/, components/, utils/variables.css, utils/fonts.css
│   ├── assets/fonts/, assets/images/
│   └── js/
│       ├── main.js             point d'entrée : cadre, rafraîchissement toutes les 15 s, clics
│       ├── api.js, config.js   client de l'API (ne lève jamais d'erreur), adresse de l'API
│       ├── stores/state.js     état de l'interface
│       ├── utils/dom.js        $, $$, esc, pct
│       └── components/         layout/AppShell, ui/ (Toast, EmailCard), views/ (Today, Prospects, Settings, Help)
├── electron/main.mjs           l'application Windows, les actions « hôte » (comptes, dossiers, mises à jour, MCP)
├── resources/prompts/          prospect-sheet.txt, first-email.txt, follow-up.txt ({{NOM}}, {{ACTIVITE}}, {{OFFRE}}...)
├── build/icon.png              icône (512 px)
├── build/fonts/, build/logo-light.png  polices Barlow Condensed (licence OFL) et logo, pour la bannière
├── build/installer.nsh         étape en plus de l'installateur : propose d'installer Claude Code s'il manque
├── scripts/publish.ps1         fabrique l'installateur et le dépose dans <données>\Installation
├── scripts/make-banner.py      dessine la bannière et la ligne du README (Python + Pillow), même mise en page que DC Scaffold
├── start.bat, start.ps1        le menu du projet
├── config.json                 réglages par défaut, sans rien de personnel
└── package.json
```

## Lancer
Double-clic sur `start.bat` (ou `.\start.ps1 -Action <touche>`) :
| Touche | Effet |
|---|---|
| `D` Développement | `npm start` : l'application Electron depuis le code |
| `M` Moteur seul | `npm run engine` : sans fenêtre, interface sur http://localhost:4747 |
| `T` Tester | `npm run check` : dossier, signature, envoi et lecture, Claude, registre |
| `I` Installer | `npm install` |
| `B` Build | `npx electron-builder --win nsis` : installateur dans `dist\` |
| `P` Publier | `scripts\publish.ps1` |

**Tester sans toucher aux vraies données** : `PROSPECTION_DRIVE=<dossier de test>` et `PROSPECTION_PORT=4799` (le moteur prend ce dossier et ce port).

## L'API locale
Toutes les réponses : `{ success: true, ...data }` ou `{ success: false, error, type }`. Les requêtes autres que GET exigent l'en-tête `X-Prospection: 1`.
| Méthode et chemin | Contrôleur | Effet |
|---|---|---|
| `GET /api/state` | StateController.getAll | État du jour (à valider, file, réponses, suivi, chiffres, santé, journal) |
| `GET /api/preview/:id/:step` | StateController.preview | Page HTML de l'e-mail avec la signature (`step` : `first`, `followUp1`, `followUp2`) |
| `GET /api/signature-preview` | | Page HTML de la signature principale |
| `POST /api/drafts` | ProspectsController.draft | `{ id, step, action: approve \| cancel \| reject, subject?, body? }` |
| `POST /api/tracking` | ProspectsController.track | `{ id, action: call \| mockup \| proposal \| client \| handled \| declined \| stop \| discard }` |
| `POST /api/prepare` | ProspectsController.prepare | Lance la journée tout de suite |
| `GET /api/settings` | SettingsController.getAll | Profil, zones, métiers, volumes, serveur, comptes |
| `PUT /api/settings` | SettingsController.update | `{ profile?, zones?, trades?, mailbox?, maxSearchesPerDay?, ... }` (validé) |
| `POST /api/accounts/gmail` | AccountsController.gmail | `{ address, password }` : teste puis range le mot de passe d'application |
| `DELETE /api/accounts/gmail` | AccountsController.forgetGmail | |
| `POST /api/accounts/password` | AccountsController.password | `{ password }` de la boîte pro, puis test |
| `PUT /api/accounts/sending-mode` | AccountsController.sendingMode | `{ mode: gmail \| mailbox }` |
| `POST /api/accounts/test-email` | AccountsController.testEmail | E-mail de test à soi-même |
| `POST /api/accounts/check` | AccountsController.check | Vérifie tout |
| `POST /api/host` | AccountsController.host | `{ action, value }` : actions de l'application Windows (connexion Claude et Google, dossiers, démarrage, mises à jour, MCP, quitter) |

## Les réglages
- `config.json` : valeurs par défaut (aucune donnée personnelle).
- `Données\settings.json` (partagé) : remplace `profile`, `sender`, `smtp`, `imap`, `zones`, `trades`, volumes, calendrier, modèles.
- `%APPDATA%\prospection-auto\local.json` (ce PC) : `dataFolder`, `promptsFolder`, `sendingMode`, `autoStart`, `mcpPath`, `mcpDeclaredAt`.

## Passage à la 1.2.0 (code et données en anglais)
Au premier lancement de la 1.2.0, `backend/services/migration.mjs` convertit une seule fois ce qu'une version plus ancienne a écrit :
- `Données\prospects.json` (version 1 vers 2 : clés, statuts `pret` vers `ready`, étapes `j0`, `r1`, `r2` vers `first`, `followUp1`, `followUp2`...) ; l'ancien fichier est gardé en `prospects.v1-backup.json` ;
- `Données\reglages.json` devient `Données\settings.json` (copie en `reglages.v1-backup.json`) ; `envois-mcp.jsonl` devient `mcp-sends.jsonl` ;
- sur ce PC : `local.json` et `google.json` (clés), `consommation-claude.json` devient `claude-usage.json`, `journaux\` devient `logs\`.

Une version plus ancienne ne sait pas relire les fichiers convertis : installe la 1.2.0 sur **tous** les PC qui partagent le dossier de données. Le verrou de l'ancienne version (`verrou.json`) reste respecté, pour que deux PC ne tournent jamais ensemble.

## Fabriquer et publier
1. Monte `version` dans `package.json` (ex. `1.0.1`) et note les changements dans `CHANGELOG.md`.
2. `start.bat`, touche `P` : fabrique `dist\DC-Prospect-Setup-<version>.exe`, le copie en `DC-Prospect-Setup.exe` dans `<dossier de données>\Installation` et écrit `latest.json`. Les PC qui utilisent ce dossier de données affichent « Nouvelle version ».
3. Le même script crée (ou met à jour) la **release GitHub** `v<version>` avec l'installateur en pièce jointe (il faut `gh` connecté). L'installateur ne va jamais dans le dépôt lui-même : GitHub refuse les fichiers de plus de 100 Mo.
4. Commit et push des changements (en anglais).

Pièges :
- Un build interrompu laisse des fichiers ouverts dans `dist` : arrête les processus `app-builder` restants avant de relancer.
- Garde l'`appId` (`dev.djason-chery.prospection`) : le changer créerait une deuxième application au lieu de mettre à jour.
- Le journal écrit sur la sortie d'erreur : la sortie standard est réservée au protocole du MCP.

## Conventions
- Tout le code en anglais : noms de fichiers, fonctions, variables, classes CSS, routes de l'API, clés des données, commentaires et messages de commit. Seuls les textes lus par l'utilisateur (interface, e-mails, rapports, consignes données à Claude) sont en français, au tutoiement, sans tiret long.
- Pas de secret dans le code ni dans Git (`.gitignore` : `*.secret`, `local.json`, `.env`, journaux, `dist/`).
- Rien de personnel dans le code : tout ce qui concerne l'utilisateur passe par le profil et les réglages.
- Fichiers courts et lisibles ; une responsabilité par service ; réponses de l'API toujours au format `{ success, ... }`.
