# 7. Dépannage

D'abord : Réglages, Comptes, **Tout vérifier**. Puis les journaux : Réglages, Avancé, Fichiers, **Journaux** (`%APPDATA%\prospection-auto\logs` sur Windows, `~/Library/Application Support/prospection-auto/logs` sur macOS, `~/.config/prospection-auto/logs` sur Linux, un fichier par jour).

| Message ou problème | Cause | Quoi faire |
|---|---|---|
| « Windows a protégé votre ordinateur » à l'installation | L'application n'est pas signée | *Informations complémentaires*, *Exécuter quand même* |
| macOS : « DC Prospect ne peut pas être ouvert » ou « développeur non identifié » | L'application n'est pas signée par Apple | Clic droit sur l'application, *Ouvrir* ; sur macOS 15 : Réglages Système, Confidentialité et sécurité, *Ouvrir quand même* |
| macOS : « DC Prospect est endommagé » | La quarantaine de macOS sur un fichier téléchargé | Dans le Terminal : `xattr -dr com.apple.quarantine "/Applications/DC Prospect.app"` |
| Linux : l'AppImage ne se lance pas | Pas exécutable, ou FUSE manquant, ou bac à sable refusé (Ubuntu 24.04) | `chmod +x` sur le fichier ; `sudo apt install libfuse2` ; sinon lance-la avec `--no-sandbox`, ou installe le paquet `.deb` (il règle le bac à sable) |
| Linux : « Coffre : écriture impossible » ou mots de passe oubliés à chaque démarrage | Le trousseau n'a pas pu garder la clé, ou le dossier n'est pas modifiable | Installe `libsecret-tools` et un trousseau (GNOME Keyring, KWallet), ou vérifie les droits de `~/.config/prospection-auto` |
| Rien ne s'affiche alors qu'une nouvelle version est sortie | Pas d'internet, limite de GitHub (60 demandes par heure), ou pas encore de fichier pour ton système dans la release | DC Prospect réessaie toutes les 3 heures ; Réglages, Avancé, *Chercher une mise à jour* ; sinon la page des releases |
| « Remplis ton profil » | Prénom ou nom, activité, ville ou adresse pro manquant | Aujourd'hui, Mise en route, ou Réglages, Profil |
| « Choisis au moins une zone » | Aucune zone active | Mise en route, ou Réglages, Avancé, Zones |
| « Envoi pas encore branché » | Ni Gmail ni mot de passe de la boîte | Réglages, Comptes, Envoi des e-mails |
| « Gmail refuse ce mot de passe » | Mauvais mot de passe d'application, ou validation en deux étapes inactive | Recrée un mot de passe d'application (16 lettres) et colle-le |
| « Coffre : écriture impossible » | Windows PowerShell n'a pas pu chiffrer (module de sécurité perturbé par PowerShell 7) | Corrigé depuis la 1.0.0 (DC Prospect lance PowerShell sans le chemin de modules de PowerShell 7). Si ça revient : relance DC Prospect depuis le menu Démarrer |
| Connexion refusée avec Outlook.com, Yahoo ou iCloud | Ces fournisseurs refusent le mot de passe habituel | Crée un mot de passe d'application dans leur espace sécurité et utilise-le à la place |
| L'e-mail de test arrive avec ton adresse Gmail comme expéditeur | Ton adresse pro n'est pas dans « Envoyer en tant que » de Gmail | Gmail, Paramètres, Comptes, « Envoyer des e-mails en tant que » : ajoute ton adresse pro avec le serveur d'envoi de ton hébergeur |
| « Claude ne répond pas (connexion ou limite de l'abonnement) » | Pas connecté, ou limite d'usage atteinte | Réglages, Comptes, Claude : Actualiser ou Se connecter ; sinon la recherche reprend le lendemain. Baisse « Recherches web par jour » si ça arrive souvent |
| « Claude Code n'est pas installé » | Claude Code absent | Bouton « Installer Claude Code », puis Actualiser |
| Peu de prospects trouvés | Peu d'entreprises publient un e-mail dans ces métiers | Ajoute des métiers ou des zones ; regarde le rendement par métier (Avancé) |
| « Ce PC est en veille : l'outil tourne sur le PC ... » | Un autre PC utilise le même dossier de données | Valide depuis ce PC-là, ou quitte DC Prospect sur l'autre PC (reprise en 6 minutes au plus) |
| « Le port 4747 est déjà pris » | Une autre copie tourne (par exemple `npm run engine`) | Ferme-la, puis relance DC Prospect |
| Rien ne part alors que des e-mails sont validés | Hors créneau, jour non envoyé, maximum atteint, ou erreur d'envoi | Vérifie Réglages, Avancé, Calendrier (par défaut mardi à jeudi, 8 h - 10 h et 13 h 30 - 15 h) ; regarde les bandeaux et le journal |
| Le tableau Excel ne se met pas à jour | Il est ouvert dans Excel | Ferme-le ; il est refait au changement suivant |
| « Connexion Google expirée » | Jeton révoqué, ou application Google restée en mode test (7 jours) | Publie l'écran de consentement (voir [4. Réglages](04-reglages.md)), puis reconnecte Google |
| La fenêtre ne s'ouvre pas | Elle est cachée près de l'horloge (dans la barre des menus sur macOS) | Clic sur l'icône ronde DC près de l'horloge, ou relance le raccourci DC Prospect (sur macOS : clic sur son icône dans le Dock) |
