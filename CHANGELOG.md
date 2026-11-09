# Journal des versions

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
