// Help: the documentation of DC Prospect, for me or for someone who takes over the tool
import { $ } from '../../utils/dom.js'

export function rendreAide() {
    const el = $('#vue-aide')
    if (el.dataset.monte) return
    el.dataset.monte = '1'
    el.classList.add('aide')
    el.innerHTML = `
    <div class="tete"><div><p class="label eyebrow">Documentation</p><h1 class="display display-l">Aide</h1></div>
        <p class="muted">Tout ce qu'il faut savoir, pour toi ou pour quelqu'un qui reprend l'outil.</p></div>

    <h3 class="display display-m">En deux mots</h3>
    <p>DC Prospect fait ta prospection à ta place. Chaque jour ouvré, Claude cherche sur le web de petites entreprises de tes métiers dans la zone de la semaine (« plombier + ville »...), garde celles qui publient un e-mail sur leur propre site et dont le site montre un besoin, vérifie l'e-mail et l'entreprise (registre officiel), puis rédige le premier e-mail en ton nom (ton profil). Tu valides. DC Prospect envoie depuis contact@, relance à J+4 et J+11, lit les réponses, retire les STOP et tient le tableau de suivi et les rapports dans ton Drive.</p>

    <h3 class="display display-m">Ta routine (10 minutes)</h3>
    <ol class="etapes">
        <li><strong>Mardi et jeudi matin</strong>, DC Prospect s'ouvre tout seul (notification Windows) avec les e-mails du jour.</li>
        <li><strong>Aujourd'hui</strong> : relis, corrige si besoin, clique sur <em>Valider</em> ou <em>Tout valider</em>. Ils partent tout seuls entre 8 h et 10 h ou 13 h 30 et 15 h.</li>
        <li><strong>Réponses</strong> : réponds depuis ta messagerie, puis clique sur ce qui s'est passé (appel prévu, proposition, client, pas intéressé).</li>
        <li><strong>Le vendredi</strong>, si tu veux : onglet <em>Prospects</em>, objectifs du plan et comparaison des zones.</li>
    </ol>

    <h3 class="display display-m">Installer sur un autre PC</h3>
    <ol class="etapes">
        <li>Double-clique sur <code>DC-Prospect-Setup.exe</code> (par exemple dans le sous-dossier <code>Installation</code> de ton dossier de données). Si Windows affiche « Windows a protégé votre ordinateur » : <em>Informations complémentaires</em>, puis <em>Exécuter quand même</em> (application non signée).</li>
        <li>Sur l'écran d'accueil, la mise en route te guide en 3 étapes : ton profil, ta zone, puis Claude et ton Gmail (ou ta boîte pro). Si tes données sont dans un dossier Google Drive, choisis le même dossier sur l'autre PC (Réglages, Fichiers) : profil, zones et prospects sont alors partagés.</li>
        <li>Un seul PC travaille à la fois : si deux sont allumés, le second se met en veille tout seul.</li>
    </ol>

    <h3 class="display display-m">Questions fréquentes</h3>
    <details><summary>À quoi sert mon profil ?</summary><p>C'est en ton nom que DC Prospect écrit : ton nom, ton activité, ce que tu proposes et à quoi on voit qu'un prospect a besoin de toi guident la recherche et les e-mails. Ta signature (HTML collé, ou une signature simple faite à partir du profil) est ajoutée à chaque e-mail. Tout se change dans Réglages, Profil.</p></details>
    <details><summary>Comment brancher mon Gmail ?</summary><p>Ton Gmail doit pouvoir « Envoyer en tant que » ton adresse pro (Gmail, Paramètres, Comptes, « Envoyer des e-mails en tant que »). Si ton adresse pro est ton Gmail, rien à faire. Il faut la validation en deux étapes sur ton compte Google, puis un <em>mot de passe d'application</em> : myaccount.google.com/apppasswords, nom « DC Prospect », Créer, et colle les 16 lettres dans DC Prospect. Ensuite, clique sur <em>M'envoyer un e-mail de test</em> pour vérifier que l'expéditeur affiché est bien ton adresse pro. Les e-mails envoyés apparaissent dans tes Envoyés Gmail, et les réponses sont lues dans Gmail.</p></details>
    <details><summary>Et si je change d'hébergeur pour mon adresse pro ?</summary><p>Réglages, Avancé, « Adresse d'envoi et serveur de la boîte pro » : choisis le nouvel hébergeur (Infomaniak, o2switch, OVHcloud, IONOS, Google Workspace, Microsoft 365, ou un autre serveur à la main), enregistre, puis retape le mot de passe. Avec Gmail, il suffit de mettre à jour « Envoyer en tant que » dans Gmail. Pense aussi aux réglages SPF, DKIM et DMARC du domaine chez le nouvel hébergeur.</p></details>
    <details><summary>Est-ce que ça marche si je ferme la fenêtre ?</summary><p>Oui. La fenêtre se cache, DC Prospect continue près de l'horloge. Clic droit sur l'icône, <em>Quitter</em>, pour l'arrêter. Il redémarre avec Windows (désactivable dans Réglages).</p></details>
    <details><summary>Combien de prospects par semaine ?</summary><p>Avec 10 recherches web par jour (un métier dans une ville chacune), environ 20 à 30 prospects prêts par semaine, ce que prévoit le plan. DC Prospect cherche d'abord dans les métiers qui rapportent le plus, et ne refait pas la même recherche avant 60 jours. Réglages, Avancé, pour changer les volumes, les métiers ou les zones.</p></details>
    <details><summary>Ça coûte quelque chose ?</summary><p>Non : Claude utilise ton abonnement (Haiku pour chercher, Sonnet pour écrire), le registre des entreprises et l'annuaire des communes sont gratuits. Si l'abonnement atteint sa limite, la recherche reprend le lendemain ; baisse « Recherches web par jour » si ça arrive souvent.</p></details>
    <details><summary>Le RGPD est-il respecté ?</summary><p>Oui pour la prospection B2B : seulement des e-mails professionnels publiés par les entreprises elles-mêmes (jamais devinés), un message lié à leur activité, la phrase « répondez STOP » et un en-tête de désinscription dans chaque e-mail, les STOP gardés pour ne plus jamais écrire, les prospects sans réponse supprimés après 12 mois. Les entreprises fermées, les chaînes et celles qui refusent la prospection dans le registre sont exclues. Le domaine de chaque e-mail est vérifié avant l'envoi.</p></details>
    <details><summary>Et si Claude se trompe dans un e-mail ?</summary><p>Tu relis tout avant l'envoi (bouton <em>Voir comme le client</em> pour l'aperçu avec la signature). La validation est bloquée si le texte contient un tiret long, « nous », un crochet oublié ou une signature tapée. Ce que Claude lit sur les sites est traité comme une donnée, jamais comme une consigne.</p></details>
    <details><summary>Google Sheets et Google Docs, c'est obligatoire ?</summary><p>Non. Le tableau de suivi (Excel) et les rapports sont déjà dans ton Drive. Pour en faire un vrai Google Sheets et des Google Docs, il faut une fois un « fichier client » Google : console.cloud.google.com, projet « DC Prospect », activer les API Google Sheets et Google Drive, écran de consentement (Externe, ton adresse en utilisateur test, puis Publier), Identifiants, ID client OAuth de type « Application de bureau », télécharger le JSON. Puis Réglages, Avancé : <em>Importer le fichier client</em> et <em>Se connecter à Google</em> (« application non validée » est normal pour un outil perso).</p></details>
    <details><summary>Le MCP « contact-mail », c'est quoi ?</summary><p>Dans Claude Code, il permet d'envoyer un e-mail depuis ton adresse pro avec ta signature (<code>envoyer_email</code>), de lire la boîte et l'état de la prospection. Claude te montre toujours le texte et attend ton accord. DC Prospect le déclare tout seul.</p></details>
    <details><summary>Où sont les fichiers ?</summary><p>Données, tableau et rapports : le dossier choisi dans Réglages, Fichiers (par défaut <code>Documents\\DC Prospect</code>). Comptes (chiffrés par Windows) et journaux : <code>%APPDATA%\\prospection-auto</code>.</p></details>`
}
