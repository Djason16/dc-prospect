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
```
dc-prospect/
├── backend/
│   ├── server.mjs              serveur : frontend/ + table des routes /api vers les contrôleurs
│   ├── moteur.mjs              la journée, le tour de chaque minute, le verrou, les notifications
│   ├── run.mjs                 le moteur sans fenêtre (npm run moteur)
│   ├── tester.mjs              vérifie tout sans rien envoyer (npm run tester)
│   ├── mcp-server.mjs          MCP « contact-mail »
│   ├── controllers/            EtatController, ProspectsController, ReglagesController, ComptesController
│   ├── services/
│   │   ├── base.mjs            config, dossiers, état (prospects.json), dates, jours fériés, créneaux, journal
│   │   ├── reglages.mjs        profil, zones, métiers, volumes (Données\reglages.json), zone de la semaine
│   │   ├── prospection.mjs     réponses, recherche, lot du jour, envoi, oubli à 12 mois, rendement par métier
│   │   ├── claude.mjs          appels à Claude Code, prompts (rôles), contrôle des textes, connexion Claude
│   │   ├── web.mjs             communes d'une zone, contrôle MX, vérification au registre
│   │   ├── entreprises.mjs     registre des entreprises (ancienne recherche, gardée pour référence)
│   │   ├── mail.mjs            signatures, composition, envoi et lecture (Gmail ou boîte pro), tests
│   │   ├── google.mjs          OAuth bureau (PKCE), Gmail API, Drive (rapports en Docs), Sheets
│   │   ├── rapport.mjs         chiffres, tableau (Excel et Sheets), rapport du jour, bilan du vendredi
│   │   ├── coffre.mjs          secrets chiffrés par Windows (DPAPI via PowerShell)
│   │   └── systeme.mjs         verrou entre PC, notifications sans fenêtre, nettoyage des journaux
│   └── utils/ResponseHelper.mjs  { success: true, ...data } / { success: false, error, type }
├── frontend/
│   ├── pages/index.html        la page (le cadre est ajouté par AppShell)
│   ├── assets/css/             main.css, base/, components/, utils/variables.css, utils/fonts.css
│   ├── assets/fonts/, assets/images/
│   └── js/
│       ├── main.js             point d'entrée : cadre, rafraîchissement toutes les 15 s, clics
│       ├── api.js, config.js   client de l'API (ne lève jamais d'erreur), adresse de l'API
│       ├── stores/etat.js      état de l'interface
│       ├── utils/dom.js        $, $$, esc, pct
│       └── components/         layout/AppShell, ui/ (Toast, CarteEmail), views/ (Aujourdhui, Prospects, Reglages, Aide)
├── electron/main.mjs           l'application Windows, les actions « hôte » (comptes, dossiers, mises à jour, MCP)
├── ressources/prompts/         fiche-prospect.txt, premier-email.txt, relance.txt ({{NOM}}, {{ACTIVITE}}, {{OFFRE}}...)
├── build/icon.png              icône (512 px)
├── scripts/publier.ps1         fabrique l'installateur et le dépose dans <données>\Installation
├── start.bat, start.ps1        le menu du projet
├── config.json                 réglages par défaut, sans rien de personnel
└── package.json
```

## Lancer
Double-clic sur `start.bat` (ou `.\start.ps1 -Action <touche>`) :
| Touche | Effet |
|---|---|
| `D` Développement | `npm start` : l'application Electron depuis le code |
| `M` Moteur seul | `npm run moteur` : sans fenêtre, interface sur http://localhost:4747 |
| `T` Tester | `npm run tester` : dossier, signature, envoi et lecture, Claude, registre |
| `I` Installer | `npm install` |
| `B` Build | `npx electron-builder --win nsis` : installateur dans `dist\` |
| `P` Publier | `scripts\publier.ps1` |

**Tester sans toucher aux vraies données** : `PROSPECTION_DRIVE=<dossier de test>` et `PROSPECTION_PORT=4799` (le moteur prend ce dossier et ce port).

## L'API locale
Toutes les réponses : `{ success: true, ...data }` ou `{ success: false, error, type }`. Les requêtes autres que GET exigent l'en-tête `X-Prospection: 1`.
| Méthode et chemin | Contrôleur | Effet |
|---|---|---|
| `GET /api/etat` | EtatController.getAll | État du jour (à valider, file, réponses, suivi, chiffres, santé, journal) |
| `GET /api/apercu/:id/:etape` | EtatController.apercu | Page HTML de l'e-mail avec la signature |
| `GET /api/apercu-signature` | | Page HTML de la signature principale |
| `POST /api/brouillons` | ProspectsController.brouillon | `{ id, etape, action: valider \| annuler \| rejeter, objet?, corps? }` |
| `POST /api/suivi` | ProspectsController.suivi | `{ id, action: appel \| maquette \| proposition \| client \| traite \| refus \| stop \| ecarter }` |
| `POST /api/preparation` | ProspectsController.preparer | Lance la journée tout de suite |
| `GET /api/reglages` | ReglagesController.getAll | Profil, zones, métiers, volumes, serveur, comptes |
| `PUT /api/reglages` | ReglagesController.update | `{ profil?, zones?, secteurs?, messagerie?, maxRecherchesParJour?, ... }` (validé) |
| `POST /api/comptes/gmail` | ComptesController.gmail | `{ adresse, mdp }` : teste puis range le mot de passe d'application |
| `DELETE /api/comptes/gmail` | ComptesController.oublierGmail | |
| `POST /api/comptes/mot-de-passe` | ComptesController.motDePasse | `{ mdp }` de la boîte pro, puis test |
| `PUT /api/comptes/envoi` | ComptesController.modeEnvoi | `{ mode: gmail \| boite }` |
| `POST /api/comptes/test-envoi` | ComptesController.testEnvoi | E-mail de test à soi-même |
| `POST /api/comptes/tester` | ComptesController.tester | Vérifie tout |
| `POST /api/hote` | ComptesController.hote | `{ action, valeur }` : actions de l'application Windows (connexion Claude et Google, dossiers, démarrage, mises à jour, MCP, quitter) |

## Les réglages
- `config.json` : valeurs par défaut (aucune donnée personnelle).
- `Données\reglages.json` (partagé) : remplace `profil`, `expediteur`, `smtp`, `imap`, `zones`, `secteurs`, volumes, modèles.
- `%APPDATA%\prospection-auto\local.json` (ce PC) : `dossierDrive`, `dossierPrompts`, `envoi`, `demarrageAuto`, `mcpChemin`.

## Fabriquer et publier
1. Monte `version` dans `package.json` (ex. `1.0.1`) et note les changements dans `CHANGELOG.md`.
2. `start.bat`, touche `P` : fabrique `dist\DC-Prospect-Setup-<version>.exe`, le copie en `DC-Prospect-Setup.exe` dans `<dossier de données>\Installation` et écrit `latest.json`. Les PC qui utilisent ce dossier de données affichent « Nouvelle version ».

Pièges :
- Un build interrompu laisse des fichiers ouverts dans `dist` : arrête les processus `app-builder` restants avant de relancer.
- Garde l'`appId` (`dev.djason-chery.prospection`) : le changer créerait une deuxième application au lieu de mettre à jour.
- Le journal écrit sur la sortie d'erreur : la sortie standard est réservée au protocole du MCP.

## Conventions
- Commentaires et messages de commit en anglais ; textes de l'interface en français, au tutoiement, sans tiret long.
- Pas de secret dans le code ni dans Git (`.gitignore` : `*.secret`, `local.json`, `.env`, journaux, `dist/`).
- Rien de personnel dans le code : tout ce qui concerne l'utilisateur passe par le profil et les réglages.
- Fichiers courts et lisibles ; une responsabilité par service ; réponses de l'API toujours au format `{ success, ... }`.
