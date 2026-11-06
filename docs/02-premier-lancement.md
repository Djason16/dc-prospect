# 2. Premier lancement

Au premier lancement, l'écran **Aujourd'hui** affiche la **mise en route** en 3 étapes. DC Prospect ne cherche rien et n'envoie rien tant qu'elles ne sont pas faites.

## Étape 1 : qui tu es (ton profil)
| Champ | Exemple | À quoi il sert |
|---|---|---|
| Prénom, Nom | Marie, Dupont | Signature et e-mails écrits en ton nom |
| Adresse pro d'envoi | contact@mon-domaine.fr | L'adresse que voient les prospects |
| Ton activité | photographe indépendante | Comment Claude te présente |
| Ta ville | Lyon (Rhône) | « basée à ... » dans les e-mails |
| Ce que tu proposes | Shooting produit dès 290 €, abonnement réseaux sociaux... | Ce que Claude met en avant ; choix de l'offre adaptée à chaque prospect |

Clique sur **Enregistrer mon profil**. Tu complèteras plus tard (site, téléphone, titre, signes du besoin, signatures HTML) dans Réglages : voir [4. Réglages](04-reglages.md).

## Étape 2 : où chercher (ta zone)
- **Nom de la zone** : ce que tu veux (« Oise », « Lyon et alentours »).
- **Départements ou codes postaux** : `60`, ou `69, 01`, ou `60200, 60150, 60280`.

Clique sur **Enregistrer la zone**. Tu peux en ajouter d'autres ensuite : chaque semaine, DC Prospect prend la zone suivante (Réglages, Avancé, Zones).

## Étape 3 : tes comptes
### Claude
- « Pas installé » : clique sur **Installer Claude Code** (une fenêtre PowerShell lance l'installateur officiel d'Anthropic), puis **Actualiser**.
- « Pas connecté » : clique sur **Se connecter à Claude**. Une petite fenêtre et ton navigateur s'ouvrent : connecte-toi avec ton compte Claude, puis reviens et clique sur **Actualiser**.

### L'envoi des e-mails
Deux façons, au choix (le prospect voit toujours ton adresse pro) :

**Par ton Gmail (conseillé)**
1. Dans Gmail, ton adresse pro doit être dans *Paramètres, Comptes et importation, Envoyer des e-mails en tant que* (avec le serveur d'envoi de ton hébergeur). Si ton adresse pro est ton Gmail, rien à faire.
2. La **validation en deux étapes** doit être active sur ton compte Google : https://myaccount.google.com/signinoptions/twosv
3. Ouvre https://myaccount.google.com/apppasswords, tape « DC Prospect », clique sur **Créer** et copie les 16 lettres.
4. Dans DC Prospect : ton adresse Gmail, colle les 16 lettres, **Brancher Gmail**. DC Prospect teste la connexion avant d'enregistrer.

Les e-mails envoyés apparaissent dans tes Envoyés Gmail ; les réponses sont lues dans Gmail.

**Par la boîte pro directement**
1. Clique sur **Par la boîte pro directement**.
2. Vérifie le serveur (Réglages, Avancé, « Adresse d'envoi et serveur de la boîte pro » : choisis ton hébergeur dans la liste).
3. Tape le mot de passe de ta boîte pro, **Enregistrer et tester**.

Une copie de chaque e-mail est rangée dans les Envoyés de ta boîte ; les réponses sont lues dans ta boîte.

### Pas d'adresse pro ? Une adresse perso marche aussi
| Ton adresse | Comment faire |
|---|---|
| Un Gmail (prenom.nom@gmail.com) | Mets ce Gmail comme adresse d'envoi dans le profil, puis **Par mon Gmail** avec un mot de passe d'application. Pas besoin de « Envoyer en tant que » : c'est la même adresse |
| Orange, SFR, Free, La Poste, Yahoo, iCloud, Outlook.com / Hotmail | **Par ma boîte directement** ; dans Réglages, Avancé, « Adresse d'envoi et serveur de ta boîte », choisis ton fournisseur (les serveurs se remplissent) ; puis tape le mot de passe. Yahoo, iCloud et Outlook.com demandent un **mot de passe d'application** créé dans leur espace sécurité, pas ton mot de passe habituel |

Une adresse perso convient pour démarrer, mais une adresse à ton nom de domaine (contact@ton-site.fr) inspire plus confiance et arrive plus souvent en boîte de réception.

### Vérifier
Clique sur **M'envoyer un e-mail de test** : tu reçois un e-mail. Vérifie que l'expéditeur est bien ton adresse pro et que ta signature est en dessous.

## Et ensuite ?
La mise en route disparaît. DC Prospect commence à chercher des prospects (jours ouvrés). Les premiers e-mails à valider arrivent le **prochain mardi ou jeudi** : voir [3. Utilisation au quotidien](03-utilisation.md).
