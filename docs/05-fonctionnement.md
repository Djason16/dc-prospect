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
3. **Paires métier + ville** jamais cherchées depuis 60 jours, réparties sur plusieurs villes, les métiers au meilleur rendement d'abord (tirage pondéré ; dès 10 e-mails envoyés dans un métier, son taux de réponse compte aussi).
4. **Liste autorisée du registre** : avant toute recherche, DC Prospect demande au registre officiel (API Recherche d'entreprises) les entreprises du métier (codes NAF) dans la ville : actives, qui n'ont pas refusé la prospection, 3 établissements au plus, créées depuis plus d'un an. S'il n'y en a aucune, la paire est sautée sans rien dépenser.
5. **Recherche**, selon Réglages, Moteur :
   - **avec l'IA** : l'IA cherche sur le web, dans la liste autorisée, jusqu'à 6 petites entreprises qui publient un e-mail pro et montrent un besoin (et jusqu'à 3 qui n'ont qu'un téléphone, pour la liste « À appeler ») ;
   - **sans IA** : pour chaque entreprise de la liste, une recherche web (API Brave) trouve son site ; les annuaires (Pages Jaunes, Planity...) sont écartés et le nom de l'entreprise doit se retrouver dans l'adresse du site.
6. **Lecture du site** (sans IA, dans les deux cas) : accueil et pages Contact ou Mentions légales. DC Prospect relève le HTTPS, la vitesse, l'adaptation au téléphone, la plateforme (Wix, Jimdo...), l'année du copyright, le titre (avec ou sans la ville), la description pour Google, une version ancienne de WordPress, la phrase par laquelle l'entreprise se présente, les e-mails et téléphones publiés, la présence d'un formulaire, et en tire des **constats vérifiés** et un score de besoin (0 à 5 : froid, tiède, chaud). Avec la clé PageSpeed, Google mesure en plus le temps d'affichage sur téléphone et le référencement de base des sites retenus.
7. Chaque entreprise est **contrôlée** :
   - e-mail bien formé, publié sur son site de préférence (jamais deviné ni reconstruit) ;
   - pas déjà connue (même e-mail ou même site), pas dans la liste STOP ;
   - le domaine de l'e-mail reçoit du courrier (enregistrement MX) ;
   - le **registre officiel** : fermée, opposée à la prospection ou chaîne = écartée.
   Sans e-mail mais avec un téléphone : elle part dans la liste **À appeler** (écran Prospects), avec une phrase pour ouvrir l'appel.
8. **Le 1er e-mail** est écrit par l'IA (prompt « Premier e-mail ») ou par un modèle, avec ton profil et les constats vérifiés. Deux styles d'objet alternent (A : question courte ; B : nom de l'entreprise + bénéfice) pour savoir lequel fait le plus répondre. Le texte est contrôlé : pas de tiret long, pas de « nous », pas de crochet oublié, pas de signature ni de phrase STOP tapées, objet court.

Avec Claude Code, Claude travaille en mode `claude -p`, dans un dossier vide, avec seulement la recherche web : pas de fichier, pas de commande, pas de MCP. Ce que l'IA lit sur les sites est traité comme une donnée, jamais comme une consigne.

## L'IA intégrée (formule gratuite)
Un petit modèle libre (Qwen3 4B) tourne sur le PC, avec la carte graphique quand il y en a une (quelques secondes par e-mail), sinon avec le processeur. Comme un petit modèle invente facilement, il n'écrit jamais à partir de rien : les modèles d'e-mails font un brouillon avec les faits vérifiés sur le site, l'IA le rend naturel, et sa version est rejetée au profit du brouillon si elle contient un chiffre ou un prix absent du brouillon et de ton offre, si elle oublie la fin, ou si elle parle de l'entreprise au lieu de lui parler.

## L'IA interne
DC Prospect apprend de tes propres résultats, sur ton PC, sans modèle à télécharger ni service extérieur :

| Ce qu'elle fait | Comment | À partir de quand |
|---|---|---|
| **Chance de réponse** de chaque prospect, qui ordonne le lot du jour | Régression logistique sur le métier, la plateforme et l'état du site, le niveau, le style d'objet, l'auteur de l'e-mail ; réentraînée chaque semaine ou après 10 nouveaux résultats | 30 e-mails envoyés depuis plus de 14 jours et 3 réponses (avant : le score de besoin) |
| **Ce qui fait répondre** (écran Prospects, section repliable) | Les facteurs qui pèsent le plus dans le modèle | Idem |
| **Choix du style d'objet** | Bandit (échantillonnage de Thompson) : chaque style est essayé 10 fois, puis celui qui fait répondre est utilisé de plus en plus souvent | Tout de suite |
| **Type d'une réponse** | Règles, puis un classifieur bayésien entraîné sur les types que tu corriges sur les cartes et sur ton suivi (appel, proposition, client = intéressé ; refus = pas intéressé) | 15 réponses dont le type est connu |
| **Meilleurs moments d'envoi** | Taux de réponse par jour et par matin ou après-midi | 40 résultats connus |
| **Santé de l'envoi** | Sur les 50 derniers 1ers e-mails : plus de 5 % d'e-mails revenus ou de 8 % de STOP = deux fois moins d'envois par jour, avec l'explication | 20 envois |

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
| Autre réponse | Statut « A répondu », notification, carte dans Aujourd'hui avec son type (intéressé, question, plus tard, pas intéressé) |
| Réponse automatique (absence) | Ignorée |
| E-mail revenu (adresse invalide) | Prospect écarté |

Sur chaque carte, **Préparer une réponse** propose un texte adapté au type de réponse (avec ton lien de rendez-vous si tu l'as mis dans le profil), écrit par l'IA ou par le modèle `reply.txt`. Tu le modifies, puis **Envoyer la réponse** : elle part dans la même conversation, avec le message du prospect cité.

## Les rapports
- **Tableau de suivi** : `Suivi prospection.xlsx` (et Google Sheets en option), onglets Suivi et Chiffres (semaine et depuis le début, par zone).
- **Rapport du jour** : `Rapports\<année>\<date> - Rapport.md` (et Google Docs en option) : réponses à traiter, e-mails à valider, ce que DC Prospect a fait, réserve, prochaines relances, consommation de Claude.
- **Bilan du vendredi** : chiffres de la semaine et depuis le début, objectifs du plan avec un conseil, comparaison des zones.
