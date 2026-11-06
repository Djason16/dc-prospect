# 4. Réglages

L'onglet **Réglages** montre d'abord l'essentiel (profil, comptes, application) ; tout le reste est replié dans **Avancé**.

Ce qui est **partagé entre tes PC** (dans le dossier de données, `Données\reglages.json`) : profil, adresse et serveur d'envoi, zones, métiers, volumes. Ce qui est **propre à ce PC** (`%APPDATA%\prospection-auto`) : comptes, mots de passe, dossier de données choisi, démarrage avec Windows.

## Profil
| Champ | Utilisation |
|---|---|
| Prénom, Nom | Signature, « Le ... , Prénom Nom a écrit » dans les relances |
| Adresse d'envoi (pro ou perso) | Expéditeur de tous les e-mails ; une adresse perso marche aussi (voir [2. Premier lancement](02-premier-lancement.md)) |
| Activité | « Prénom Nom, *activité*, basé à *ville* » dans les prompts |
| Ville | Idem |
| Nom de l'entreprise | Si différent de ton nom |
| Ton site | Seul lien autorisé dans le 1er e-mail ; mis en lien automatiquement |
| Téléphone, Titre | Signature simple (si tu n'as pas collé de signature HTML) |
| Ce que tu proposes | Offres, prix de départ, conditions : Claude choisit l'offre adaptée au prospect |
| À quoi on voit qu'un prospect a besoin de toi | Ce que Claude cherche sur le web. Par défaut (sites web) : pas de site, site daté ou lent, pas adapté au téléphone, Wix, Google Sites ou Canva, réservation seulement via une plateforme, peu de contenu. Écris le tien si tu vends autre chose (ex. photographe : pas de photos pro, photos de mauvaise qualité sur le site et les réseaux) |
| Ma signature HTML | Colle le code HTML de ta signature (tableaux et styles en ligne, comme pour Gmail) ; sinon DC Prospect en fait une simple. **Voir ma signature** pour l'aperçu |
| Deuxième signature | Facultatif (ex. « Service comptabilité ») : utilisée par le MCP pour les devis et factures |

## Comptes
- **Claude** : installer, se connecter, se déconnecter, actualiser (voir [2. Premier lancement](02-premier-lancement.md)).
- **Envoi des e-mails** : « Par mon Gmail » ou « Par la boîte pro directement » ; brancher ou débrancher Gmail ; mot de passe de la boîte ; **M'envoyer un e-mail de test**.
- **Tout vérifier** : teste l'envoi et la lecture, Claude, le registre des entreprises et le dossier de données, sans rien envoyer.

## Application
- Version, « Démarrer avec Windows », installer une mise à jour, ouvrir le dossier des données, quitter l'application.

## Avancé
### Zones
Une ligne par zone : nom, départements (`60, 75`), codes postaux (`60200, 60150`), active ou en pause. Une zone active par semaine, chacune son tour (la zone de la semaine est affichée). Pour une zone en départements, DC Prospect cherche dans les communes de 2 500 habitants et plus ; pour une zone en codes postaux, dans toutes les communes données.

### Métiers ciblés
Une ligne par métier : nom (ce que Claude tape dans la recherche, ex. « Plombier chauffagiste »), codes NAF du registre (facultatif, pour information), actif ou non. La barre montre le **rendement** : la part de recherches qui donnent un prospect utile. Les métiers qui rapportent passent en premier, les autres gardent une chance.

### Volumes
| Réglage | Par défaut | Effet |
|---|---|---|
| Recherches web par jour | 10 | Une recherche = un métier dans une ville, jusqu'à 6 entreprises avec e-mail. À baisser si ton abonnement Claude sature |
| Réserve de prospects prêts | 30 | 1ers e-mails rédigés d'avance |
| E-mails par jour au maximum | 20 | Toutes étapes confondues |
| 1ers e-mails le mardi, mercredi, jeudi | 15, 0, 15 | Les relances passent avant, dans la limite du maximum |

### Adresse d'envoi et serveur de la boîte pro
Hébergeur ou fournisseur (modèle qui remplit les serveurs : Infomaniak, o2switch, OVHcloud, IONOS, Google Workspace, Microsoft 365, et pour une adresse perso Outlook.com / Hotmail, Yahoo, Orange, SFR, Free, La Poste, iCloud), nom affiché, adresse d'envoi, serveur d'envoi (SMTP) et son port (465 : chiffré dès la connexion ; 587 : STARTTLS, exigé), serveur de réception (IMAP). **Si tu changes d'hébergeur** : choisis-le, enregistre, retape le mot de passe (Comptes), et pense aux réglages SPF, DKIM et DMARC de ton domaine chez le nouvel hébergeur. Avec Gmail, mets aussi à jour « Envoyer en tant que » dans Gmail.

### Google Sheets et Google Docs (facultatif)
Sans ça, le tableau et les rapports sont déjà dans ton dossier de données (Excel et textes). Avec, le tableau devient un Google Sheets et les rapports des Google Docs, dans un dossier « DC Prospect » de ton Google Drive.

Il faut une fois un **fichier client** Google :
1. https://console.cloud.google.com : crée un projet « DC Prospect ».
2. *API et services, Bibliothèque* : active **Google Sheets API** et **Google Drive API**.
3. *Écran de consentement OAuth* : type **Externe**, nom « DC Prospect », ton adresse ; ajoute-toi dans **Utilisateurs test** ; puis **Publier l'application** (sinon la connexion expire tous les 7 jours).
4. *Identifiants, Créer des identifiants, ID client OAuth*, type **Application de bureau**, **Télécharger le JSON**.
5. Dans DC Prospect : **Importer le fichier client**, puis **Se connecter à Google**. « Google n'a pas validé cette application » est normal pour un outil perso : *Paramètres avancés*, *Accéder à DC Prospect*.

DC Prospect n'accède qu'aux fichiers qu'il a créés (accès `drive.file`), pas à tout ton Drive.

### Fichiers et outils
- **Rapports**, **Journaux** : ouvrent les dossiers.
- **Changer de dossier** : le dossier de données (l'application redémarre). Choisis un dossier Google Drive pour partager entre PC.
- **Déclarer le MCP dans Claude Code** : voir [6. Règles, données et sécurité](06-donnees-et-securite.md).
- **Chercher une mise à jour**.

### Mes propres prompts (sans écran, pour les utilisateurs avancés)
DC Prospect utilise ses prompts neutres (`ressources/prompts`), remplis avec ton profil. Pour utiliser les tiens, ajoute dans `%APPDATA%\prospection-auto\local.json` : `"dossierPrompts": "C:/chemin/vers/mes/prompts"`. DC Prospect y reconnaît les prompts par leur nom de fichier :
| Rôle | Nom de fichier reconnu (contient) |
|---|---|
| Fiche prospect (score, niveau, offre) | « Fiche prospect » ou « Prospect sheet » |
| Premier e-mail | « Premier e-mail » ou `Email.txt` |
| Relance | « Relance de prospection » ou « Follow-up » |

Les règles automatiques (pas de signature tapée, pas de phrase STOP, JSON) s'ajoutent toujours à tes prompts.
