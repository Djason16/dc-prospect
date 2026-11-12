# 4. Réglages

L'onglet **Réglages** montre d'abord l'essentiel (profil, comptes, application) ; tout le reste est replié dans **Avancé**.

Ce qui est **partagé entre tes PC** (dans le dossier de données, `Données\settings.json`) : profil, adresse et serveur d'envoi, zones, métiers, volumes. Ce qui est **propre à ce PC** (`%APPDATA%\prospection-auto`) : comptes, mots de passe, dossier de données choisi, démarrage avec Windows.

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
| Lien de prise de rendez-vous | Facultatif (Calendly, Google Agenda...) : proposé dans les réponses préparées aux prospects intéressés |
| Ce que tu proposes | Offres, prix de départ, conditions : l'IA (ou le modèle) choisit l'offre adaptée au prospect |
| À quoi on voit qu'un prospect a besoin de toi | Ce que l'IA cherche sur le web. Par défaut (sites web) : pas de site, site daté ou lent, pas adapté au téléphone, Wix, Google Sites ou Canva, réservation seulement via une plateforme, peu de contenu. Écris le tien si tu vends autre chose (ex. photographe : pas de photos pro, photos de mauvaise qualité sur le site et les réseaux) |
| Ma signature HTML | Colle le code HTML de ta signature (tableaux et styles en ligne, comme pour Gmail) ; sinon DC Prospect en fait une simple. **Voir ma signature** pour l'aperçu |
| Deuxième signature | Facultatif (ex. « Service comptabilité ») : utilisée par le MCP pour les devis et factures |

## Formule
Comment DC Prospect cherche et écrit. Trois formules, à changer à tout moment :

| Formule | Ce qu'il faut | Ce que ça fait |
|---|---|---|
| **Gratuit, sur ce PC** (conseillé sans abonnement Claude) | Rien : un clic télécharge une fois l'IA intégrée. Deux modèles sous licence Apache 2.0 : Qwen3 4B (rapide et fiable, 2,5 Go, conseillé) ou Ministral 3 8B de Mistral (plus naturel, 5,2 Go, plus lent) | L'IA intégrée écrit les e-mails et les réponses sur ton PC. Les prospects sont trouvés sans IA : registre officiel, site retrouvé à partir du nom, lecture du site. Pendant le téléchargement, les modèles d'e-mails prennent le relais |
| **Gratuit, en ligne (Google)** | Une clé gratuite sur aistudio.google.com/apikey (« Create API key ») | Gemini cherche les prospects sur Google et écrit les e-mails ; limite gratuite par jour (la recherche reprend le lendemain). Google peut utiliser les échanges de l'offre gratuite pour améliorer ses services |
| **Avec mon abonnement Claude** | Claude Code installé et connecté (boutons dans l'appli) | Claude cherche les prospects sur le web et écrit les e-mails |
| **Avec une clé API** | Une clé Anthropic, ou OpenAI, Mistral, Groq, OpenRouter, Cerebras (adresses prêtes en un clic ; Groq, Mistral, OpenRouter et Cerebras ont une offre gratuite limitée), ou Ollama sur ce PC sans clé | Comme Claude, payé à l'usage ; les IA autres qu'Anthropic ne cherchent pas sur le web (recherche sans IA) |

**Options pour aller plus loin** (repliées) :
- **Trouver les prospects** avec ou sans IA. Sans IA, une clé Brave (brave.com/search/api, crédit gratuit de 5 $ par mois, environ 1 000 recherches) retrouve beaucoup plus de sites que la recherche à partir du nom.
- **Écrire les e-mails** avec l'IA ou avec tes modèles (`resources/templates`, ou sous-dossier `modèles` de ton dossier de prompts).

Dans tous les cas, ce qui compte (registre, site, e-mail publié) est vérifié par DC Prospect lui-même, pas par l'IA.

**Mesure de vitesse Google (facultatif)** : avec une clé gratuite de l'API PageSpeed Insights (console.cloud.google.com, un projet, activer « PageSpeed Insights API », Identifiants, Créer une clé API), chaque site retenu est mesuré par Google sur téléphone : temps d'affichage et note de référencement. Sans clé, cette mesure est simplement sautée.

## Comptes
- **Envoi des e-mails** : « Par mon Gmail » ou « Par la boîte pro directement » ; brancher ou débrancher Gmail ; mot de passe de la boîte ; **M'envoyer un e-mail de test**.
- **Délivrabilité** : **Vérifier mon domaine** contrôle MX, SPF, DKIM et DMARC de l'adresse d'envoi et dit quoi corriger. Gmail, Yahoo et Outlook refusent de plus en plus les e-mails d'un domaine sans SPF, DKIM et DMARC alignés.
- **Montée en charge** : à cocher pour une adresse neuve ou jamais utilisée pour prospecter : 5 premiers e-mails par jour la 1re semaine, puis 5 de plus chaque semaine jusqu'au volume réglé.
- **Tout vérifier** : teste l'envoi et la lecture, le moteur, le registre des entreprises et le dossier de données, sans rien envoyer.

## Application
- Version, « Démarrer avec Windows », installer une mise à jour, ouvrir le dossier des données, quitter l'application.

## Avancé
### Zones
Une ligne par zone : nom, départements (`60, 75`), codes postaux (`60200, 60150`), active ou en pause. Une zone active par semaine, chacune son tour (la zone de la semaine est affichée). Pour une zone en départements, DC Prospect cherche dans les communes de 2 500 habitants et plus ; pour une zone en codes postaux, dans toutes les communes données.

### Métiers ciblés
Une ligne par métier : nom (commence à taper, une liste de 50 métiers courants est proposée et remplit les codes NAF ; ce qui est tapé dans la recherche, ex. « Plombier chauffagiste »), codes NAF du registre (recommandé : ils servent à prendre dans le registre la liste des entreprises qui acceptent la prospection, avant toute recherche), actif ou non. La barre montre le **rendement** : la part de recherches qui donnent un prospect utile. Les métiers qui rapportent passent en premier, les autres gardent une chance.

### Volumes
| Réglage | Par défaut | Effet |
|---|---|---|
| Recherches web par jour | 10 | Une recherche = un métier dans une ville, jusqu'à 6 entreprises avec e-mail. À baisser si ton abonnement ou ton quota de recherche sature |
| Réserve de prospects prêts | 30 | 1ers e-mails rédigés d'avance |
| E-mails par jour au maximum | 20 | Toutes étapes confondues |

Le nombre de 1ers e-mails de chaque jour d'envoi se règle dans le Calendrier, ci-dessous.

### Calendrier
| Réglage | Par défaut | Effet |
|---|---|---|
| Jours de recherche | lundi à vendredi | Les jours où DC Prospect cherche de nouveaux prospects |
| Jours d'envoi | mardi, mercredi, jeudi | Les jours où le lot est préparé et envoyé (au moins un) |
| 1ers e-mails par jour d'envoi | 15 mardi, 0 mercredi, 15 jeudi | Les relances passent avant, dans la limite du maximum par jour |
| Créneaux d'envoi | 08:00 - 10:00 et 13:30 - 15:00 | Ajoute ou retire des créneaux ; le début avant la fin |
| Relance 1, relance 2 | J+4, J+11 | Jours après le 1er e-mail (relance 1 : 1 à 30 ; relance 2 : après la 1, 60 au plus). Une relance due un jour sans envoi part au jour d'envoi suivant |
| Écart entre deux e-mails | 2 à 4 minutes | Un écart au hasard entre le minimum et le maximum (1 à 60) |
| Sauter les jours fériés | oui | Ni recherche ni envoi les jours fériés français |

Clique sur **Enregistrer le calendrier** : c'est pris en compte tout de suite.

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
DC Prospect utilise ses prompts neutres (`resources/prompts`), remplis avec ton profil. Pour utiliser les tiens, ajoute dans `%APPDATA%\prospection-auto\local.json` : `"promptsFolder": "C:/chemin/vers/mes/prompts"`. DC Prospect y reconnaît les prompts par leur nom de fichier :
| Rôle | Nom de fichier reconnu (contient) |
|---|---|
| Fiche prospect (score, niveau, offre) | « Fiche prospect » ou « Prospect sheet » |
| Premier e-mail | « Premier e-mail », « First e-mail » ou `Email.txt` |
| Relance | « Relance de prospection » ou « Follow-up » |

Les règles automatiques (pas de signature tapée, pas de phrase STOP, JSON) s'ajoutent toujours à tes prompts.

Même principe pour la rédaction sans IA : un sous-dossier `modèles` dans ce dossier, avec des fichiers nommés comme ceux de `resources/templates` (`first-email.txt`, `follow-up-1.txt`, `follow-up-2.txt`, `reply.txt`). Les variables disponibles sont décrites dans `resources/templates/LISEZ-MOI.txt`.
