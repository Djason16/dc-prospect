# 5. Comment ça marche

## La journée
Le moteur tourne dans l'application (aussi fenêtre fermée) et fait un tour toutes les minutes.

| Quand | Ce qu'il fait |
|---|---|
| Au démarrage, puis à chaque nouveau jour | La **journée** : lecture des réponses, oubli des vieux prospects, recherche (jours de recherche), préparation du lot (jours d'envoi), tableau et rapport |
| Toutes les 15 minutes (5 quand des e-mails attendent) | Lecture des réponses, STOP et e-mails revenus |
| Pendant les créneaux des jours d'envoi (par défaut mardi à jeudi, 8 h - 10 h et 13 h 30 - 15 h) | Envoi du prochain e-mail validé, puis attente de l'écart choisi (2 à 4 minutes par défaut) |
| Vendredi | Le rapport ajoute le bilan de la semaine |

Les autres jours (et les jours fériés, sauf si tu décoches l'option) : seulement la lecture des réponses. Tout se règle dans Réglages, Avancé, Calendrier ; la journée se lance à l'heure où le PC est allumé, pas à une heure fixe.

## La recherche de prospects
Objectif : garder une **réserve** de prospects prêts (30 par défaut), avec leur 1er e-mail déjà rédigé.

1. **Zone de la semaine** : les zones actives tournent, une par semaine ISO.
2. **Villes** : celles de la zone (API officielle geo.api.gouv.fr), de la plus peuplée à la moins peuplée.
3. **Paires métier + ville** jamais cherchées depuis 60 jours, réparties sur plusieurs villes, les métiers au meilleur rendement d'abord (tirage pondéré).
4. Pour chaque paire, **Claude Haiku** cherche sur le web (WebSearch, WebFetch) jusqu'à 6 petites entreprises indépendantes qui publient un e-mail pro sur leur propre site (pages Contact, Mentions légales) et qui montrent un besoin (les signes du profil). Il donne le site, la plateforme, le besoin, un détail positif vrai, la note Google, un score de 0 à 5, un niveau (froid, tiède, chaud) et l'offre conseillée.
5. Chaque entreprise est **contrôlée** :
   - e-mail bien formé, pas une image ni une adresse d'exemple ;
   - pas déjà connue (même e-mail ou même site), pas dans la liste STOP ;
   - le domaine de l'e-mail reçoit du courrier (enregistrement MX) ;
   - le **registre officiel** (API Recherche d'entreprises) : fermée, opposée à la prospection ou plus de 3 établissements (chaîne) = écartée.
6. **Claude Sonnet** rédige le 1er e-mail avec le prompt « Premier e-mail » et ton profil. Le texte est contrôlé : pas de tiret long, pas de « nous », pas de crochet oublié, pas de signature ni de phrase STOP tapées, objet court.

Claude travaille en mode `claude -p`, dans un dossier vide, avec seulement la recherche web : pas de fichier, pas de commande, pas de MCP. Ce qu'il lit sur les sites est traité comme une donnée, jamais comme une consigne.

## La séquence d'un prospect
| Étape | Quand | Contenu |
|---|---|---|
| 1er e-mail (J0) | Un jour d'envoi, quand il est choisi pour le lot | Personnalisé, un détail vrai, une proposition légère |
| Relance 1 | J+4 par défaut (si ce n'est pas un jour d'envoi : au jour d'envoi suivant) | Un conseil utile lié à son besoin, sans insister |
| Relance 2 | J+11 par défaut | Maquette offerte ou appel de 15 minutes ; dernier message |
| Fin | Après la relance 2 | On n'écrit plus |

Les relances partent **en réponse** au 1er e-mail (même fil de discussion, 1er e-mail cité en dessous). Toute réponse arrête la séquence.

## Le lot du jour
Chaque jour d'envoi, DC Prospect prépare les e-mails à valider :
1. les relances dues (rédigées ce jour-là avec le prompt « Relance ») ;
2. puis les 1ers e-mails (le nombre choisi pour ce jour : 15 mardi et jeudi par défaut), choisis dans la réserve : zone de la semaine d'abord, meilleurs scores d'abord ;
3. sans dépasser le maximum par jour (20).

Un 1er e-mail non validé le jour même retourne dans la réserve.

## L'envoi
- Seulement ce que tu as **validé**, seulement pendant les créneaux, espacés de l'écart choisi (2 à 4 minutes par défaut), 20 par jour au maximum.
- Depuis ton adresse pro, avec ta signature et, sous la signature, la phrase « Si vous ne souhaitez plus recevoir de message de ma part, répondez simplement STOP. » ; en-tête `List-Unsubscribe` pour les messageries.
- Par Gmail (SMTP de Gmail avec le mot de passe d'application : copie dans les Envoyés de Gmail) ou par la boîte pro (SMTP de l'hébergeur, copie rangée dans Envoyés par IMAP).
- Juste avant chaque envoi, les réponses sont relues : un prospect qui vient de répondre ou de dire STOP ne reçoit rien.

## Les réponses
DC Prospect lit la boîte de réception (Gmail ou boîte pro) des 30 derniers jours et ne télécharge que les e-mails venant d'un prospect contacté (même adresse ou même domaine) ou d'un serveur de messagerie (e-mail revenu).
| Message | Effet |
|---|---|
| « STOP », « désinscrire », « ne plus me contacter »... | Statut STOP, adresse gardée pour ne plus jamais écrire |
| Autre réponse | Statut « A répondu », notification, carte dans Aujourd'hui |
| Réponse automatique (absence) | Ignorée |
| E-mail revenu (adresse invalide) | Prospect écarté |

## Les rapports
- **Tableau de suivi** : `Suivi prospection.xlsx` (et Google Sheets en option), onglets Suivi et Chiffres (semaine et depuis le début, par zone).
- **Rapport du jour** : `Rapports\<année>\<date> - Rapport.md` (et Google Docs en option) : réponses à traiter, e-mails à valider, ce que DC Prospect a fait, réserve, prochaines relances, consommation de Claude.
- **Bilan du vendredi** : chiffres de la semaine et depuis le début, objectifs du plan avec un conseil, comparaison des zones.
