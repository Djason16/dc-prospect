# 8. Développement

## Les briques
| Brique | Choix |
|---|---|
| Application de bureau | Electron, pour Windows, macOS et Linux (fenêtre, icône près de l'horloge ou dans la barre des menus, notifications, démarrage avec la session) |
| Langage | TypeScript strict partout (`electron/`, `backend/`, `frontend/js/`), compilé par `tsc` dans `out/` (voir [TypeScript](#typescript)) |
| Moteur et API | Node.js (modules ES), serveur `http` sans framework, réponses au format DC Scaffold `{ success, ... }` |
| Interface | HTML, CSS et modules ES chargés tels quels par la fenêtre, sans bundler (rangement du stack « HTML / CSS / JS » de DC Scaffold) |
| IA | Claude Code en mode `claude -p` (abonnement de l'utilisateur) : Haiku pour chercher, Sonnet pour rédiger |
| E-mails | nodemailer (SMTP), imapflow (IMAP), mailparser |
| Tableau | exceljs ; Google Sheets et Drive par leurs API REST (option) |
| MCP | @modelcontextprotocol/sdk, zod |
| Installateur | electron-builder (`asar: false` pour que le MCP et l'interface restent de vrais fichiers) : Windows NSIS (une installation par utilisateur), macOS `.dmg` et `.zip` (arm64 et x64, signature ad hoc), Linux AppImage, `.deb` et `.tar.gz` (x64) |
| Publication | `scripts/publish.ps1` (Windows : dossier de données et release GitHub) ; `.github/workflows/release.yml` (les trois systèmes, sur un tag `v*`) |

## Arborescence
Tout le code est en anglais (fichiers, fonctions, variables, routes, clés des données) ; seuls les textes lus par l'utilisateur sont en français.
```
dc-prospect/
├── backend/
│   ├── types.ts, types/        formes des données : réglages (settings), état et prospects (prospects), recherche et moteur (engine)
│   ├── server.ts               serveur : frontend/ (et out/frontend/js pour /js/) + table des routes /api vers les contrôleurs
│   ├── engine.ts               la journée, le tour de chaque minute, le verrou, les notifications
│   ├── run.ts                  le moteur sans fenêtre (npm run engine)
│   ├── check.ts                vérifie tout sans rien envoyer (npm run check)
│   ├── mcp-server.ts           MCP « contact-mail »
│   ├── controllers/            StateController, ProspectsController, SettingsController, AccountsController
│   ├── services/
│   │   ├── base.ts             config, dossiers, état (prospects.json), dates, jours fériés, créneaux, journal
│   │   ├── migration.ts        conversion une seule fois des fichiers écrits avant la 1.2.0 (clés en français)
│   │   ├── settings.ts         profil, zones, métiers, volumes (Données\settings.json), zone de la semaine
│   │   ├── prospecting.ts      réponses, lot du jour, envoi, oubli à 12 mois
│   │   ├── leadSearch.ts       recherche des prospects (ville et métier), contrôles de chaque entreprise, rendement par métier
│   │   ├── writers.ts          qui cherche et qui écrit (IA, IA intégrée ou modèles), styles d'objet et de longueur
│   │   ├── claude.ts           rédaction par l'IA (1er e-mail, relances, réponses, type des réponses), compte Claude, contrôle des textes
│   │   ├── aiSearch.ts         recherche des prospects par l'IA sur le web
│   │   ├── prompts.ts          morceaux communs des prompts : profil, fichiers de prompts, règles du mode automatique
│   │   ├── ai.ts               moteurs d'IA interchangeables : Claude Code, API Anthropic, API compatible OpenAI, Gemini, IA intégrée
│   │   ├── discovery.ts        recherche sans IA : registre + API Brave (site de chaque entreprise)
│   │   ├── siteAudit.ts        lecture des sites sans IA (e-mails, téléphones, constats, SEO), mesure PageSpeed
│   │   ├── templates.ts        rédaction sans IA par modèles (resources/templates, variantes {a|b})
│   │   ├── localAi.ts          IA intégrée : téléchargement du modèle (Qwen3 4B), exécution sur le PC (node-llama-cpp)
│   │   ├── localWriter.ts      rédaction par l'IA intégrée : brouillon des modèles, rendu naturel, contrôles (pas de chiffre inventé)
│   │   ├── replies.ts          réponses aux prospects : préparation et envoi dans la même conversation
│   │   ├── learning.ts         IA interne : chance de réponse, bandit des objets, type des réponses, santé de l'envoi
│   │   ├── deliverability.ts   SPF, DKIM, DMARC du domaine d'envoi, montée en charge, plafond du jour
│   │   ├── web.ts              communes d'une zone, contrôle MX, vérification au registre
│   │   ├── companies.ts        registre des entreprises (ancienne recherche, gardée pour référence)
│   │   ├── mail.ts             signatures, composition, envoi et lecture (Gmail ou boîte pro), tests
│   │   ├── google.ts           OAuth bureau (PKCE), Gmail API, Drive (rapports en Docs), Sheets
│   │   ├── report.ts           chiffres, tableau (Excel et Sheets), rapport du jour, bilan du vendredi
│   │   ├── vault.ts            secrets chiffrés : Windows (DPAPI via PowerShell), sinon keyring.ts
│   │   ├── keyring.ts          macOS et Linux : AES-256-GCM, clé gardée par le trousseau (security, secret-tool)
│   │   ├── platform.ts         ce qui change d'un système à l'autre : dossier local, PATH, terminal, ouvrir un fichier
│   │   └── system.ts           verrou entre PC, notifications sans fenêtre (Windows, macOS, Linux), nettoyage des journaux
│   └── utils/ResponseHelper.ts  { success: true, ...data } / { success: false, error, type } ; ApiError
├── frontend/
│   ├── pages/index.html        la page (le cadre est ajouté par AppShell)
│   ├── assets/css/             main.css, base/, components/, utils/variables.css, utils/fonts.css
│   ├── assets/fonts/, assets/images/
│   └── js/                     en TypeScript, compilé dans out/frontend/js (tsconfig.json propre au navigateur)
│       ├── main.ts             point d'entrée : cadre, rafraîchissement toutes les 15 s, clics
│       ├── api.ts, config.ts   client de l'API (ne lève jamais d'erreur, réponses typées), adresse de l'API
│       ├── types.ts            formes des réponses de l'API (journée, prospects, réglages, comptes)
│       ├── stores/state.ts     état de l'interface
│       ├── utils/dom.ts        $, $$, esc, pct, labelCells (tableaux en cartes sur écran étroit)
│       ├── utils/os.ts         système de l'ordinateur (textes « Démarrer avec Windows », chemins, trousseau)
│       └── components/         layout/AppShell, ui/ (Toast, EmailCard), views/ (Today, Prospects, Settings, Help),
│                               views/settings/ (blocks, engine, calendar, templates, diagnosis)
├── electron/main.ts            l'application de bureau, les actions « hôte » (comptes, dossiers, mises à jour, MCP)
├── electron/desktop.ts         ce qui diffère entre Windows, macOS et Linux : démarrage, Claude Code, MCP, textes
├── electron/update.ts          mises à jour : dossier Installation (Windows) et dernière release GitHub (tous)
├── out/                        le JavaScript compilé (npm run build:ts), jamais dans Git : c'est lui qui tourne
├── tsconfig.base.json, tsconfig.json, frontend/js/tsconfig.json  réglages de TypeScript (communs, Node, interface)
├── resources/prompts/          prospect-sheet.txt, first-email.txt, follow-up.txt ({{NOM}}, {{ACTIVITE}}, {{OFFRE}}...)
├── build/icon.png              icône (512 px) ; build/icon.icns : la même pour macOS (faite depuis icon.png avec Pillow)
├── build/fonts/, build/logo-light.png  polices Barlow Condensed (licence OFL) et logo, pour la bannière
├── build/installer.nsh         étape en plus de l'installateur : propose d'installer Claude Code s'il manque
├── scripts/publish.ps1         fabrique l'installateur et le dépose dans <données>\Installation
├── scripts/make-banner.py      dessine la bannière et la ligne du README (Python + Pillow), même mise en page que DC Scaffold
├── start.bat, start.ps1        le menu du projet (Windows) ; start.sh : le même sur macOS et Linux
├── .github/workflows/release.yml  fabrique l'application des trois systèmes sur un tag v* et la joint à la release
├── config.json                 réglages par défaut, sans rien de personnel
└── package.json
```

## Lancer
Double-clic sur `start.bat` (ou `.\start.ps1 -Action <touche>`) :
| Touche | Effet |
|---|---|
| `D` Développement | `npm start` : compile le TypeScript puis lance l'application Electron |
| `M` Moteur seul | `npm run engine` : compile, puis le moteur sans fenêtre, interface sur http://localhost:4747 |
| `T` Tester | `npm run check` : compile, puis vérifie le dossier, la signature, l'envoi et la lecture, Claude, le registre |
| `I` Installer | `npm install` |
| `B` Build | `npm run build` : compile, puis `electron-builder --win nsis` ; installateur dans `dist\` |
| `P` Publier | `scripts\publish.ps1` |

Sur **macOS et Linux** : `./start.sh` (ou `./start.sh D`), mêmes touches sauf `P` ; `B` lance `npm run build:mac` ou `npm run build:linux`. Il faut Node.js 22 et `npm install` sur ce système (les binaires de l'IA intégrée, `@node-llama-cpp/<système>`, viennent de npm pour le système où il tourne). Les dossiers de ce PC sont `~/Library/Application Support/prospection-auto` (macOS) et `~/.config/prospection-auto` (Linux).

**Tester sans toucher aux vraies données** : `PROSPECTION_DRIVE=<dossier de test>` et `PROSPECTION_PORT=4799` (le moteur prend ce dossier et ce port). Pour ne pas toucher non plus aux réglages de ce PC (`local.json`, mots de passe, MCP), lance-le avec `APPDATA=<autre dossier de test>` (marche aussi sur macOS et Linux). `PROSPECTION_NO_UPDATE=1` coupe la recherche de mise à jour ; `PROSPECTION_UPDATE_CHECK=1` l'active avec `npm start` (sinon seule l'application installée regarde GitHub).

## TypeScript
Tout le code est en TypeScript strict (`strict: true`, aucun `any` sauf aux frontières : JSON lu sur le disque ou reçu d'une API, aussitôt typé). `tsc` compile, sans bundler :
| Commande | Effet |
|---|---|
| `npm run build:ts` | vide `out/`, compile `electron/` et `backend/` (`tsconfig.json`, Node) puis `frontend/js/` (`frontend/js/tsconfig.json`, navigateur) dans `out/` |
| `npm run typecheck` | vérifie les types des deux projets sans rien écrire (doit finir à zéro erreur) |
| `npm start`, `engine`, `mcp`, `check`, `build` | compilent d'abord (`build:ts`), puis lancent `out/...` |

- **Où va le JavaScript** : `out/electron/main.js` (le `main` de `package.json`), `out/backend/**`, `out/frontend/js/**`. Le dossier `out/` n'est jamais dans Git.
- **L'interface** reste en modules ES chargés tels quels par la fenêtre : les imports s'écrivent avec `.js` (`import { api } from './api.js'`) et `tsc` les garde. Le serveur sert `/js/...` depuis `out/frontend/js` et le reste (pages, CSS, polices, images) depuis `frontend/`.
- **Les chemins** : le code compilé calcule le dossier du projet depuis sa place dans `out/` (`backend/services/base.ts`, `electron/main.ts`). Le MCP déclaré dans Claude Code pointe sur `out/backend/mcp-server.js` ; une application qui avait déclaré l'ancien chemin le redéclare toute seule au démarrage.
- **L'installateur** ne contient que le JavaScript compilé (`out/`), les pages et les assets de `frontend/`, `resources/` et `config.json` : pas les sources `.ts` (`files` de `build` dans `package.json`).
- **Les types des données** (réglages, état, prospects, brouillons, recherche, moteur) sont dans `backend/types.ts` et `backend/types/` ; ceux de l'interface (réponses de l'API) dans `frontend/js/types.ts`.

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
| `POST /api/host` | AccountsController.host | `{ action, value }` : actions de l'application de bureau (connexion Claude et Google, dossiers, démarrage, mises à jour `checkUpdate` et `installUpdate`, MCP, quitter) |

## Les réglages
- `config.json` : valeurs par défaut (aucune donnée personnelle).
- `Données\settings.json` (partagé) : remplace `profile`, `sender`, `smtp`, `imap`, `zones`, `trades`, volumes, calendrier, modèles.
- `%APPDATA%\prospection-auto\local.json` (ce PC ; `~/Library/Application Support/prospection-auto` sur macOS, `~/.config/prospection-auto` sur Linux) : `dataFolder`, `promptsFolder`, `sendingMode`, `autoStart`, `mcpPath`, `mcpDeclaredAt`.

## Passage à la 1.2.0 (code et données en anglais)
Au premier lancement de la 1.2.0, `backend/services/migration.ts` convertit une seule fois ce qu'une version plus ancienne a écrit :
- `Données\prospects.json` (version 1 vers 2 : clés, statuts `pret` vers `ready`, étapes `j0`, `r1`, `r2` vers `first`, `followUp1`, `followUp2`...) ; l'ancien fichier est gardé en `prospects.v1-backup.json` ;
- `Données\reglages.json` devient `Données\settings.json` (copie en `reglages.v1-backup.json`) ; `envois-mcp.jsonl` devient `mcp-sends.jsonl` ;
- sur ce PC : `local.json` et `google.json` (clés), `consommation-claude.json` devient `claude-usage.json`, `journaux\` devient `logs\`.

Une version plus ancienne ne sait pas relire les fichiers convertis : installe la 1.2.0 sur **tous** les PC qui partagent le dossier de données. Le verrou de l'ancienne version (`verrou.json`) reste respecté, pour que deux PC ne tournent jamais ensemble.

## Fabriquer et publier
1. Monte `version` dans `package.json` et `package-lock.json` (ex. `1.4.1`) et note les changements dans `CHANGELOG.md` (titre `## 1.4.1 (mois année)` : il sert de notes à la release).
2. Commit et push des changements (en anglais).
3. **Les trois systèmes** : pousse le tag, `git tag v1.4.1` puis `git push origin v1.4.1`. Le workflow `.github/workflows/release.yml` fabrique sur GitHub Actions l'installateur Windows (`windows-latest`), les `.dmg` et `.zip` macOS arm64 et x64 (`macos-latest`, puce Apple : les binaires Intel de l'IA intégrée sont ajoutés avant), l'AppImage, le `.deb` et le `.tar.gz` Linux (`ubuntu-latest`), puis crée la release `v1.4.1` (ou la complète) avec les notes du CHANGELOG et tous les fichiers. Suivi : onglet Actions du dépôt (environ 15 minutes).
4. **Le dossier de données (Windows)** : `start.bat`, touche `P` : fabrique `dist\DC-Prospect-Setup-<version>.exe`, le copie en `DC-Prospect-Setup.exe` dans `<dossier de données>\Installation` et écrit `latest.json` ; il crée aussi la release GitHub si elle n'existe pas encore, ou y remplace l'installateur (il faut `gh` connecté). Les fichiers ne vont jamais dans le dépôt lui-même : GitHub refuse les fichiers de plus de 100 Mo.
5. Les applications installées voient la nouvelle version au démarrage ou dans les 3 heures : une bande « Une mise à jour est disponible : 1.4.1 » avec **Voir les nouveautés** et **Mettre à jour** (`electron/update.ts`). Elles lisent `https://api.github.com/repos/Djason16/dc-prospect/releases/latest` (sans jeton, 60 demandes par heure et par adresse) et cherchent le fichier de leur système par son nom : `DC-Prospect-Setup-<v>.exe`, `DC-Prospect-<v>-mac-arm64.dmg` ou `-mac-x64.dmg`, `DC-Prospect-<v>-linux-x86_64.AppImage`, `.deb` ou `.tar.gz` (garde ces noms). Une release sans le fichier d'un système n'est pas proposée sur ce système.

Fabriquer à la main : `npm run build` (Windows), `npm run build:mac` (sur un Mac), `npm run build:linux` (sur Linux). Le `.tar.gz` Linux se fabrique aussi depuis Windows (`npx electron-builder --linux tar.gz --publish never`), mais sans les binaires Linux de l'IA intégrée : pour une vraie version, passe par le workflow.

Pièges :
- Un build interrompu laisse des fichiers ouverts dans `dist` : arrête les processus `app-builder` restants avant de relancer.
- Garde l'`appId` (`dev.djason-chery.prospection`) : le changer créerait une deuxième application au lieu de mettre à jour.
- macOS : l'application est signée « ad hoc » (`identity: "-"`, `hardenedRuntime: false`) et pas notarisée : sans au moins cette signature, un Mac à puce Apple refuse de la lancer. Les utilisateurs l'ouvrent une première fois par clic droit, Ouvrir (voir [1. Installation](01-installation.md)).
- Linux : le paquet `.deb` demande `homepage` et `maintainer` dans `package.json` (electron-builder s'arrête sinon).
- Le journal écrit sur la sortie d'erreur : la sortie standard est réservée au protocole du MCP.

## Conventions
- Tout le code en anglais : noms de fichiers, fonctions, variables, classes CSS, routes de l'API, clés des données, commentaires et messages de commit. Seuls les textes lus par l'utilisateur (interface, e-mails, rapports, consignes données à Claude) sont en français, au tutoiement, sans tiret long.
- Pas de secret dans le code ni dans Git (`.gitignore` : `*.secret`, `local.json`, `.env`, journaux, `dist/`).
- Rien de personnel dans le code : tout ce qui concerne l'utilisateur passe par le profil et les réglages.
- Fichiers courts et lisibles (moins de 300 lignes) ; une responsabilité par service ; réponses de l'API toujours au format `{ success, ... }`.
- `npm run typecheck` à zéro erreur avant chaque commit.
