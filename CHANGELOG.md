# Journal des versions

## 1.3.1 (novembre 2026)
- **Tout le code en TypeScript strict** (application Windows, moteur, interface) : `npm run build:ts` compile dans `out/`, `npm run typecheck` vérifie les types ; `npm start`, `engine`, `check` et `build` compilent d'abord. L'installateur ne contient que le JavaScript compilé. Le MCP « contact-mail » pointe maintenant sur `out/backend/mcp-server.js` et se redéclare tout seul au premier démarrage.
- **Champs des formulaires** : la flèche des listes déroulantes a la même marge à droite que l'icône du calendrier ; les icônes des champs date et heure (et les flèches des nombres) sont claires sur le thème sombre au lieu de noires presque invisibles.
- **Contrastes vérifiés partout** (WCAG AA, mesurés dans chaque écran) : bordures des champs (1,13:1 au pire avant, 3,22:1 maintenant), textes d'exemple des champs (3,76:1 avant, 5,81:1), boutons désactivés (2,58:1 avant, 5,52:1 au moins).
- **Petites fenêtres** : l'application marche jusqu'à 320 px de large et 320 px de haut (la fenêtre peut maintenant être réduite jusque-là) ; la barre du haut passe sur plusieurs lignes, les tableaux deviennent des cartes au lieu de défiler sur le côté.
- Fichiers de plus de 300 lignes découpés (recherche des prospects, prompts de l'IA, réglages de l'interface).

## 1.3.0 (novembre 2026)
- **IA intégrée, gratuite** : formule « Gratuit, sur ce PC ». Au choix Qwen3 4B (rapide et fiable, 2,5 Go, conseillé) ou Ministral 3 8B de Mistral (plus naturel, 5,2 Go), sous licence Apache 2.0, téléchargés une fois depuis l'appli. Le modèle écrit les e-mails et les réponses sur le PC, sans compte ni internet, avec la carte graphique quand il y en a une. Modèles d'e-mails en attendant la fin du téléchargement.
- **Google Gemini, gratuit en ligne** : formule « Gratuit, en ligne (Google) » avec une clé gratuite créée en 1 minute sur aistudio.google.com ; Gemini cherche aussi les prospects sur Google. Le modèle le plus récent de l'offre gratuite est choisi tout seul.
- **Réglages simplifiés** : quatre formules au lieu des réglages techniques (gratuit sur ce PC, gratuit en ligne avec Google, mon abonnement Claude, une clé API ; adresses prêtes pour Groq, Mistral, OpenRouter, Cerebras et Ollama) ; options repliées ; profil réduit à l'essentiel (le reste replié) ; textes sans jargon.
- **Mise en route en 4 étapes** avec la liste de ce qu'il faut (profil, zone, formule, adresse d'envoi) ; la formule conseillée est mise en avant et l'IA intégrée se télécharge depuis la mise en route.
- **Recherche sans IA et sans aucune clé** : le site de chaque entreprise du registre est retrouvé à partir de son nom (adresses habituelles vérifiées sur la page : nom et ville). La clé Brave devient facultative.
- **« Plus tard » suivis** : quand un prospect répond « plus tard », DC Prospect retient la date qu'il donne (« dans 2 mois », « en septembre », « à la rentrée »..., sinon 3 mois) et le remet sur l'écran d'accueil ce jour-là, avec une réponse à préparer dans la même conversation.
- **Conseils d'écriture** sur chaque e-mail à valider (sans bloquer) : trop long, mots qui font classer en spam dans l'objet, plusieurs liens, majuscules, pas de question finale.
- **Exemple d'e-mail** (Réglages, Formule) : ce que DC Prospect écrirait avec ton profil à une entreprise fictive, avant de lancer quoi que ce soit.
- **Prénom du gérant** pris dans le registre officiel (gérant unique ou entrepreneur individuel, jamais la date de naissance) : « Bonjour Sylvie, » au lieu de « Bonjour, » (45 salons sur 51 à Compiègne).
- **Serveur mail trouvé tout seul** à partir de l'adresse d'envoi (Infomaniak, OVHcloud, Google Workspace, Microsoft 365, IONOS, o2switch et les hébergeurs cPanel, Gandi, Hostinger, Zoho, Orange, SFR, Free, La Poste, Yahoo, iCloud, Outlook.com).
- **Pause (vacances)** jusqu'à une date (Réglages, Application) : rien n'est cherché ni envoyé, les réponses sont toujours lues ; bandeau « Reprendre » sur l'accueil.
- Clé Google PageSpeed : la vérification dit la vraie raison d'un refus (clé invalide, API pas activée, clé restreinte à une autre API, nouvelle clé pas encore active) et n'échoue plus si Google n'arrive pas à mesurer la page de test.
- Correction : une relance dont l'objet (« Re: » + objet du 1er e-mail déjà envoyé) dépassait 8 mots ne pouvait pas être validée ; seul le texte des relances est contrôlé, leur objet reste celui de la conversation.
- Recherche : chaque ville commence par un métier différent (avant, une journée pouvait chercher un seul métier dans toutes les villes).
- **« Pourquoi si peu de prospects ? »** : quand la dernière recherche trouve peu, l'accueil dit pourquoi et quoi changer (clé Brave, zone plus grande, plus de métiers, entreprises sans e-mail à appeler, zone déjà parcourue).
- **Rappel dans mon agenda** : sur les réponses et dans « À appeler », un clic crée un rappel (fichier .ics, le lendemain à 10 h, avec le téléphone et ce qu'il a répondu) qui s'ouvre dans l'agenda du PC (Outlook, Calendrier, ou à importer dans Google Agenda).
- **Envoi branché presque tout seul** (mise en route, étape 4) : à partir de l'adresse du profil, DC Prospect choisit la bonne méthode (Gmail ou ta boîte), remplit le serveur, pré-remplit l'adresse Gmail et n'affiche que les étapes de ton fournisseur, avec ses pièges (mot de passe d'application chez Yahoo et iCloud, blocages Microsoft, Orange).
- **Dernière vérification** : une fois tout branché, l'accueil propose de s'envoyer un e-mail de test avant le premier prospect.
- **Installateur** : il ne propose plus d'installer Claude Code (plus nécessaire) ; l'appli le propose seulement si tu choisis la formule Claude.
- **Aide sans jargon** : les questions techniques (Google Sheets, MCP) sont rangées dans « Pour les utilisateurs avancés ».
- **Relances validées toutes seules** (option, Réglages, Avancé, Calendrier) : une relance dont le texte est propre part sans ton clic ; les premiers e-mails restent toujours validés par toi, et une réponse du prospect annule les relances prévues.
- **Mes notes** dans le tableau de suivi (Excel ou Google Sheets), et la recherche du tableau des prospects cherche aussi dans leurs réponses, mes notes et le nom du gérant.
- **Exemple pour mon activité** (profil et mise en route) : photographe, vidéaste, graphiste, community manager, rédacteur, référenceur ou développeur web ; remplit l'offre et les signes de besoin, propose les métiers à prospecter (« Prospecter ces métiers » les active en un clic).
- **Écartés** (écran Prospects) : la liste des prospects écartés avec la raison, et « Remettre » pour ceux écartés par erreur (nouvel e-mail rédigé) ; les refus légaux (registre, STOP, adresse invalide, ne jamais contacter) restent définitifs.
- **Mes modèles d'e-mails dans l'appli** (Réglages, Avancé) : 1er e-mail, version courte, relances, modifiables sans toucher aux fichiers, avec la liste des mots remplis tout seuls ; contrôlés à l'enregistrement (fin « Bien à vous, », pas de crochets, de « nous » ni de tiret long, pas de mot inconnu) ; gardés dans le dossier de données pour tous les PC ; « Remettre l'original ».
- **E-mail court contre e-mail standard** : quand les modèles écrivent (sans IA ou avec l'IA intégrée), les deux longueurs sont essayées 10 fois chacune, puis celle qui fait le plus répondre est utilisée de plus en plus (résultats dans Prospects, IA interne).
- **Tableau des prospects triable** : clic sur Entreprise, Métier, Ville, Statut, 1er e-mail ou Réponse (un 2e clic inverse).
- **Première recherche tout de suite** : dès que la mise en route est finie, DC Prospect cherche les premiers prospects, sans attendre le lendemain.
- **Fiche de chaque prospect** (clic sur son nom dans Prospects) : site, téléphone, gérant, constats vérifiés, e-mails envoyés, sa réponse, appels, et **mes notes**.
- **Type des réponses par l'IA** quand les règles hésitent : testé sur 5 réponses, 5 justes avec l'IA intégrée contre 2 avec les règles seules (« bien équipés », « après les fêtes », « envoyez-moi une proposition »).
- **« Tout vérifier » en clair** : pour chaque problème (mot de passe refusé, serveur introuvable, limite atteinte, IA pas téléchargée, dossier introuvable...), ce que ça veut dire et quoi faire.
- **Zone par ville et rayon** (« Compiègne et 20 km autour ») : à la mise en route et dans Réglages, sans connaître les codes postaux ; les communes des départements voisins comptent aussi.
- **Réécrire** un e-mail à valider : une nouvelle version, même prospect et même style d'objet.
- **Résumé par e-mail le matin** (Réglages, Application, facultatif) : quand des e-mails attendent ta validation ou que des prospects ont répondu, un court e-mail arrive dans ta boîte.
- **Importer ma liste** (CSV d'Excel ou de Google Sheets, écran Prospects) : chaque entreprise passe les mêmes contrôles (registre, site, e-mail publié, STOP) puis reçoit son 1er e-mail.
- **Ne jamais contacter** : e-mails ou domaines de tes clients, partenaires, proches ; les e-mails déjà préparés pour eux sont annulés.
- **Effacement RGPD** d'un prospect à sa demande (bouton « Effacer » du tableau) : ses données sont supprimées, son adresse reste seulement dans la liste STOP.
- **Appels suivis** dans « À appeler » : prénom du gérant à demander, boutons Intéressé, Pas de réponse (rappel dans 3 jours, écarté après 3 essais), Rappeler plus tard (dans 2 mois), Pas intéressé.
- **Ce qui va se passer** en une phrase sous les chiffres de l'accueil (prochain envoi, réserve, lecture des réponses).
- **Objets variés** : plusieurs formulations par style, pour ne pas envoyer des dizaines de fois le même objet ; les constats s'adressent au prospect (« votre site »).
- **Sauvegarde automatique** des prospects chaque jour (Données\Sauvegardes, les 14 derniers jours).
- Modèles d'e-mails neutres (plus seulement pour les sites web) ; ta ville sans le département entre parenthèses.
- **50 métiers courants** proposés à la saisie, avec leurs codes du registre remplis tout seuls.
- **Moins dépendant de Claude** : Réglages, Moteur. Au choix Claude Code (abonnement), l'API Anthropic ou une API compatible OpenAI (OpenAI, Mistral, Groq, OpenRouter, Ollama en local), avec modèles réglables ; ou **sans IA** : recherche par le registre officiel + API Brave + lecture des sites, rédaction par modèles personnalisables (`resources/templates`, ou sous-dossier `modèles` des prompts).
- **Registre d'abord** : avant chaque recherche, liste des entreprises du métier et de la ville qui acceptent la prospection (actives, diffusibles, 3 établissements au plus, plus d'un an). Plus de recherche dépensée sur des entreprises qui seront écartées.
- **Lecture des sites sans IA** : HTTPS, vitesse, téléphone, plateforme, copyright, e-mails et téléphones publiés ; constats vérifiés repris dans les e-mails et score de besoin calculé. L'e-mail publié sur le site est préféré à celui trouvé par l'IA.
- **Liste « À appeler »** (écran Prospects) : les entreprises sans e-mail publié, avec leur téléphone et une phrase pour ouvrir l'appel.
- **Réponses** : type de réponse reconnu (intéressé, question, plus tard, pas intéressé), réponse préparée (IA ou modèle, avec le lien de rendez-vous du profil), modifiable et envoyée dans la même conversation.
- **Test A/B des objets** : deux styles alternent ; résultats par style dans Prospects et dans le bilan du vendredi.
- **Chiffres par métier** (trouvés, refusent la prospection, chauds, contactés, réponses, clients) dans Prospects, le tableau de suivi (onglet « Par métier ») et le bilan ; le taux de réponse oriente le choix des métiers.
- **Délivrabilité** : vérification MX, SPF, DKIM et DMARC du domaine d'envoi avec conseils ; montée en charge pour une adresse neuve (5 par jour la 1re semaine, +5 chaque semaine).
- **IA interne** (sans modèle à télécharger, apprend de tes résultats sur ce PC) : chance de réponse estimée de chaque prospect (régression logistique réentraînée chaque semaine) qui ordonne le lot du jour ; « ce qui fait répondre » dans Prospects ; objets choisis par un bandit (le style qui fait répondre est utilisé de plus en plus) ; type des réponses appris de tes corrections et de ton suivi ; meilleurs moments d'envoi.
- **Santé de l'envoi** : plus de 5 % d'e-mails revenus ou de 8 % de STOP sur les 50 derniers, et l'envoi ralentit de moitié tout seul, avec l'explication.
- **Lecture des sites enrichie** : titre sans la ville, pas de description pour Google, WordPress ancien ; phrase de présentation de l'entreprise reprise dans l'e-mail ; mesure Google PageSpeed (temps d'affichage sur téléphone, référencement) avec une clé gratuite facultative.
- **Modèles avec variantes** `{phrase 1|phrase 2}` : deux e-mails ne sont jamais identiques. Nouvelle variable `{{ACCROCHE}}`.
- Aide et documentation mises à jour ; nouvelle page [9. Vendre DC Prospect](docs/09-vendre.md).

## 1.2.0 (novembre 2026)
- Tout le code passe en anglais : noms de fichiers, fonctions, variables, classes, routes de l'API, outils du MCP (`send_email`, `prospecting_status`, `read_inbox`) et clés des données enregistrées. Les textes de l'application restent en français.
- Au premier lancement, les données d'une version plus ancienne sont converties une seule fois (sauvegarde gardée à côté) : installe la 1.2.0 sur tous les PC qui partagent le dossier de données.
- Correction : l'objet des e-mails commence toujours par une majuscule (consigne de Claude corrigée, première lettre mise en majuscule à la préparation, à la modification et à l'envoi ; « Re: » des relances compris).

## 1.1.1 (novembre 2026)
- Correction : « Enregistrer le calendrier » et « Enregistrer » des volumes ne faisaient rien.

## 1.1.0 (novembre 2026)
- Calendrier réglable (Réglages, Avancé, Calendrier) : jours de recherche, jours d'envoi et 1ers e-mails par jour, créneaux d'envoi, délais des relances, écart entre deux e-mails, jours fériés.
- Écran de chargement au démarrage (attend que le moteur réponde), roue de chargement sur les boutons pendant une action et dans Réglages pendant le chargement.
- Champ heure au même style que les autres champs.
- Aide et documentation mises à jour pour le calendrier.

## 1.0.0 (novembre 2026)
Première version.
- Application Windows (Electron) : fenêtre au style de djason-chery.dev, icône près de l'horloge, notifications Windows, démarrage avec Windows, installateur NSIS (propose d'installer Claude Code s'il manque) et mise à jour par le dossier `Installation` des données.
- Mise en route en 3 étapes : profil (prénom, nom, adresse pro, activité, ville, offre, signatures), zone, comptes.
- Recherche web « métier + ville » avec Claude Code (Haiku), contrôle du domaine de l'e-mail (MX) et du registre officiel des entreprises, rédaction du premier e-mail (Sonnet).
- Séquence J0, J+4, J+11 par défaut ; lot du jour validé à la main ; envoi pendant les créneaux, 20 par jour au maximum.
- Envoi par Gmail (mot de passe d'application) ou par la boîte de n'importe quel hébergeur ou fournisseur, adresse pro ou perso (ports 465 et 587).
- Lecture des réponses, des STOP et des e-mails revenus ; oubli des prospects sans réponse après 12 mois.
- Tableau de suivi (Excel, ou Google Sheets en option), rapport du jour et bilan du vendredi (Google Docs en option).
- Zones, métiers et volumes modifiables ; plusieurs PC avec un verrou ; MCP « contact-mail » pour Claude Code.
