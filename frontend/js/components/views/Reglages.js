// Settings: accounts first (Claude, sending), the rest folded in "Avancé" (zones, trades, volumes, mail server, Google, files)
import { $, $$, esc } from '../../utils/dom.js'
import { store } from '../../stores/etat.js'
import { api, exiger, hote } from '../../api.js'
import { action, toast } from '../ui/Toast.js'

// Mail hosts ready to use: change of host = pick it here and type the password again
const SERVEURS = {
    infomaniak: ['Infomaniak', 'mail.infomaniak.com', 465, 'mail.infomaniak.com', 993],
    o2switch: ['o2switch (mail.ton-domaine)', 'mail.{domaine}', 465, 'mail.{domaine}', 993],
    ovh: ['OVHcloud', 'ssl0.ovh.net', 465, 'ssl0.ovh.net', 993],
    ionos: ['IONOS', 'smtp.ionos.fr', 465, 'imap.ionos.fr', 993],
    workspace: ['Google Workspace', 'smtp.gmail.com', 465, 'imap.gmail.com', 993],
    microsoft: ['Microsoft 365', 'smtp.office365.com', 587, 'outlook.office365.com', 993],
    // personal mailboxes (with an app password where the provider asks for one)
    outlook: ['Outlook.com / Hotmail (perso)', 'smtp-mail.outlook.com', 587, 'outlook.office365.com', 993],
    yahoo: ['Yahoo (perso)', 'smtp.mail.yahoo.com', 465, 'imap.mail.yahoo.com', 993],
    orange: ['Orange / Wanadoo (perso)', 'smtp.orange.fr', 465, 'imap.orange.fr', 993],
    sfr: ['SFR (perso)', 'smtp.sfr.fr', 465, 'imap.sfr.fr', 993],
    free: ['Free (perso)', 'smtp.free.fr', 465, 'imap.free.fr', 993],
    laposte: ['La Poste (perso)', 'smtp.laposte.net', 465, 'imap.laposte.net', 993],
    icloud: ['iCloud (perso)', 'smtp.mail.me.com', 587, 'imap.mail.me.com', 993],
}

export async function chargerReglages() {
    const r = await api.get('/reglages')
    if (!r.success) return toast(r.error, true)
    store.R = r
    if (store.vue === 'reglages') rendreReglages()
}

const sw = (id, oui, texte, desactive = false) => `<label class="interrupteur"><input type="checkbox" id="${id}" ${oui ? 'checked' : ''} ${desactive ? 'disabled' : ''}> ${texte}</label>`

// ---------- Blocks also used on the home screen (getting started) ----------
// Profile: who writes the e-mails (DC Prospect works for anyone: nothing about the user is written in the code)
export function blocProfil(R, { complet = true } = {}) {
    const p = R.profil || {}
    const champ = (id, label, valeur, aide = '', type = 'text') => `<div><label class="label champ" for="pf-${id}">${label}</label><input type="${type}" id="pf-${id}" value="${esc(valeur || '')}" placeholder="${esc(aide)}"></div>`
    return `<div class="carte">
        <strong class="display display-s">Ton profil</strong>
        <p class="muted petit">C'est en ton nom que DC Prospect cherche et écrit. Les e-mails partent de ton adresse d'envoi : ton adresse pro, ou ton adresse perso si tu n'en as pas d'autre.</p>
        <div class="grille g2">
            ${champ('prenom', 'Prénom', p.prenom)}
            ${champ('nom', 'Nom', p.nom)}
            ${champ('adresse', 'Adresse d\'envoi (pro ou perso)', R.expediteur, 'contact@ton-domaine.fr ou prenom.nom@gmail.com')}
            ${champ('activite', 'Ton activité', p.activite, 'développeur web indépendant, photographe, graphiste...')}
            ${champ('ville', 'Ta ville', p.ville, 'Compiègne (Oise)')}
            ${complet ? `${champ('entreprise', 'Nom de l\'entreprise', p.entreprise, 'si différent de ton nom')}${champ('siteWeb', 'Ton site', p.siteWeb, 'https://...')}${champ('telephone', 'Téléphone (signature)', p.telephone)}${champ('titre', 'Titre sous ton nom (signature)', p.titre, 'Développeur web')}` : ''}
        </div>
        <label class="label champ" for="pf-offre">Ce que tu proposes (offres, prix de départ, conditions)</label>
        <textarea id="pf-offre" style="min-height:90px" placeholder="Site vitrine dès 490 €, site sur mesure..., paiement en plusieurs fois...">${esc(p.offre || '')}</textarea>
        ${complet ? `<label class="label champ" for="pf-besoin">À quoi on voit qu'un prospect a besoin de toi</label>
        <textarea id="pf-besoin" style="min-height:70px" placeholder="${esc(R.besoinParDefaut)}">${esc(p.besoin || '')}</textarea>
        <details style="margin-top:.8rem"><summary class="petit" style="cursor:pointer">Ma signature HTML (facultatif)</summary>
            <p class="muted petit">Colle le code HTML de ta signature (sinon DC Prospect en fait une simple avec ton nom, ton titre, ton téléphone et ton site).</p>
            <textarea id="pf-signaturePrincipale" style="min-height:90px;font-family:monospace;font-size:.85rem">${esc(p.signaturePrincipale || '')}</textarea>
            <label class="label champ" for="pf-nomSignatureSecondaire">Deuxième signature (facultatif, ex : service comptabilité)</label>
            <input type="text" id="pf-nomSignatureSecondaire" value="${esc(p.nomSignatureSecondaire || '')}">
            <textarea id="pf-signatureSecondaire" style="min-height:70px;font-family:monospace;font-size:.85rem;margin-top:.5rem">${esc(p.signatureSecondaire || '')}</textarea>
        </details>` : ''}
        <div class="actions"><button class="btn primaire petit" data-profil>Enregistrer mon profil</button><a class="btn lien petit" href="/api/apercu-signature" target="_blank">Voir ma signature</a></div>
    </div>`
}

// First zone, in one field
export function blocZoneRapide() {
    return `<div class="carte"><strong class="display display-s">Ta zone de prospection</strong>
        <p class="muted petit">Les départements (60, 75, 69...) ou les codes postaux (60200, 60150...) où chercher. Tu pourras en ajouter d'autres dans Réglages.</p>
        <div class="grille g2"><div><label class="label champ" for="zr-nom">Nom de la zone</label><input type="text" id="zr-nom" placeholder="Oise"></div>
        <div><label class="label champ" for="zr-codes">Départements ou codes postaux</label><input type="text" id="zr-codes" placeholder="60"></div></div>
        <div class="actions"><button class="btn primaire petit" data-zone-rapide>Enregistrer la zone</button></div></div>`
}

export function blocClaude(R) {
    const cl = R.comptes?.claude || {}
    const enApp = R.application
    return `<div class="carte compte"><div class="rond ${cl.connecte ? 'ok' : ''}">C</div><div style="flex:1">
        <strong class="display display-s">Claude</strong>
        <p class="muted petit">${!enApp ? 'Visible dans l\'application DC Prospect.' : !cl.installe ? 'Claude Code n\'est pas installé sur ce PC.' : cl.connecte ? `Connecté : ${esc(cl.email)} (abonnement ${esc(cl.abonnement || '')})` : 'Pas connecté.'}</p>
        <p class="petit">Il cherche les prospects et rédige les e-mails avec ton abonnement.</p>
        <div class="actions">${!enApp ? '' : !cl.installe ? '<button class="btn primaire petit" data-hote="installerClaude">Installer Claude Code</button>' : cl.connecte ? '<button class="btn petit" data-hote="deconnecterClaude">Se déconnecter</button>' : '<button class="btn primaire petit" data-hote="connecterClaude">Se connecter à Claude</button>'}
        <button class="btn lien petit" data-actualiser>Actualiser</button></div></div></div>`
}

export function blocEnvoi(R) {
    const c = R.comptes || {}, gm = c.gmail || {}, m = c.messagerie || {}
    const parGmail = c.envoi === 'gmail'
    return `<div class="carte compte"><div class="rond ${(parGmail ? gm.configure : m.motDePasse) ? 'ok' : ''}">@</div><div style="flex:1">
        <strong class="display display-s">Envoi des e-mails</strong>
        <p class="muted petit">Le prospect voit toujours ${esc(R.expediteur || "ton adresse d'envoi")}.</p>
        <div class="actions" style="margin:.4rem 0 .9rem">
            <button class="btn petit ${parGmail ? 'primaire' : ''}" data-mode="gmail">Par mon Gmail (conseillé)</button>
            <button class="btn petit ${parGmail ? '' : 'primaire'}" data-mode="boite">Par ma boîte directement</button>
        </div>
        ${parGmail ? (gm.configure
            ? `<p class="petit">Gmail branché : <strong>${esc(gm.adresse)}</strong> ${gm.adresse === R.expediteur ? 'envoie tes e-mails' : `envoie en tant que ${esc(R.expediteur)}`}. Copie dans tes Envoyés Gmail, réponses lues dans Gmail.</p>
               <div class="actions"><button class="btn lien petit" data-test-envoi>M'envoyer un e-mail de test</button><button class="btn lien petit" data-gmail-oublier>Débrancher Gmail</button></div>`
            : `<ol class="petit" style="padding-left:1.2rem;margin:.2rem 0 .7rem">
                <li>Ton adresse d'envoi est ce Gmail : rien à faire. Sinon, elle doit être dans Gmail, Paramètres, Comptes, « Envoyer des e-mails en tant que ».</li>
                <li>La <a href="https://myaccount.google.com/signinoptions/twosv" target="_blank">validation en deux étapes</a> doit être active sur ton compte Google.</li>
                <li>Ouvre <a href="https://myaccount.google.com/apppasswords" target="_blank">Mots de passe des applications</a>, tape « DC Prospect », clique sur Créer.</li>
                <li>Colle ici les 16 lettres affichées.</li></ol>
               <input type="text" id="gmail-adresse" value="${esc(gm.adresse || '')}" placeholder="Ton adresse Gmail" autocomplete="off" style="margin-bottom:.5rem">
               <input type="password" id="gmail-mdp" placeholder="Mot de passe d'application (16 lettres)" autocomplete="off">
               <div class="actions"><button class="btn primaire petit" data-gmail>Brancher Gmail</button></div>`)
        : `<p class="petit">${m.motDePasse ? `Mot de passe de ${esc(R.expediteur)} enregistré (chiffré par Windows sur ce PC). Serveur : ${esc(R.messagerie.smtpHote)}.` : `Tape le mot de passe de ${esc(R.expediteur)} (serveur ${esc(R.messagerie.smtpHote || "à choisir dans Avancé")}). Boîte perso (Orange, SFR, Free, Yahoo, Outlook...) : choisis ton fournisseur dans Avancé ; certains demandent un mot de passe d'application.`}</p>
           <input type="password" id="mdp" placeholder="Mot de passe de ${esc(R.expediteur)}" autocomplete="off">
           <div class="actions"><button class="btn primaire petit" data-mdp>Enregistrer et tester</button>${m.motDePasse ? '<button class="btn lien petit" data-test-envoi>M\'envoyer un e-mail de test</button><button class="btn lien petit" data-hote="oublierMotDePasse">Oublier</button>' : ''}</div>`}
    </div></div>`
}

// ---------- The page ----------
export function rendreReglages() {
    const R = store.R
    if (!R) return
    const c = R.comptes || {}, g = c.google || {}, app = R.application, mg = R.messagerie
    $('#vue-reglages').innerHTML = `
    <div class="tete"><div><p class="label eyebrow">Ce PC et tes préférences</p><h1 class="display display-l">Réglages</h1></div>
        <p class="muted">Les comptes sont propres à ce PC. Zones, métiers et volumes sont dans ton Drive : tous tes PC utilisent les mêmes.</p></div>

    <div class="section"><p class="label eyebrow">Profil</p>${blocProfil(R)}</div>

    <div class="section"><p class="label eyebrow">Comptes</p><div class="grille g2">${blocClaude(R)}${blocEnvoi(R)}</div>
        <div class="actions"><button class="btn" data-tester>Tout vérifier</button><span id="resultat-test" class="muted petit" style="align-self:center"></span></div></div>

    <div class="section"><p class="label eyebrow">Application</p><div class="carte">
        <div style="display:flex;gap:2rem;flex-wrap:wrap;align-items:center">
            <strong class="display display-s">DC Prospect ${esc(c.version || '')}</strong>
            ${sw('demarrage', R.demarrageAuto, 'Démarrer avec Windows', !app)}
            <span class="muted petit">${c.miseAJour ? `Mise à jour ${esc(c.miseAJour.version)} prête.` : 'Mises à jour : par le dossier Installation de tes données, ou sur la page des releases.'}</span>
        </div>
        <div class="actions">${c.miseAJour ? '<button class="btn primaire petit" data-hote="installerMiseAJour">Installer la mise à jour</button>' : ''}<button class="btn petit" data-ouvrir="donnees">Ouvrir le dossier (tableau, rapports)</button><button class="btn lien petit" data-hote="quitter">Quitter l'application</button></div>
    </div></div>

    <details class="section avance"><summary class="label eyebrow">Avancé : zones, métiers, volumes, calendrier, serveur mail, Google</summary>

    <div class="section"><p class="label eyebrow">Zones</p>
        <p class="muted">Une zone par semaine, chacune son tour (cette semaine : <strong style="color:var(--paper)">${esc(R.zoneDeLaSemaine || 'aucune')}</strong>). Départements (60, 75...) ou codes postaux (60200, 60150...), séparés par des virgules.</p>
        <div class="zone label" style="border:0"><span>Nom</span><span>Départements</span><span>Codes postaux</span><span>Active</span><span></span></div>
        <div id="zones">${R.zones.map(ligneZone).join('')}</div>
        <div class="actions"><button class="btn petit" data-ajouter-zone>Ajouter une zone</button><button class="btn primaire petit" data-enregistrer="zones">Enregistrer les zones</button></div></div>

    <div class="section"><p class="label eyebrow">Métiers ciblés</p>
        <p class="muted">Ce que Claude cherche dans chaque ville (« plombier Compiègne »...). La barre montre ce qui rapporte le plus : ces métiers passent en premier.</p>
        <div class="metier label" style="border:0"><span>Métier</span><span>Codes NAF (registre)</span><span>Rendement</span><span>Actif</span><span></span></div>
        <div id="metiers">${R.secteurs.map((s) => ligneMetier(s, R.rendement?.[s.nom])).join('')}</div>
        <div class="actions"><button class="btn petit" data-ajouter-metier>Ajouter un métier</button><button class="btn primaire petit" data-enregistrer="secteurs">Enregistrer les métiers</button></div></div>

    <div class="section"><p class="label eyebrow">Volumes</p><div class="grille g3">
        ${[['maxRecherchesParJour', 'Recherches web par jour', 'Une recherche = un métier dans une ville (jusqu\'à 6 entreprises avec e-mail). Baisse si l\'abonnement Claude sature.'], ['reserveProspectsPrets', 'Réserve de prospects prêts', '1ers e-mails rédigés d\'avance'], ['maxEmailsParJour', 'E-mails par jour au maximum', 'Plan : 20']]
            .map(([k, l, d]) => `<div class="tuile"><p class="label">${l}</p><input type="number" min="0" data-volume="${k}" value="${esc(R[k])}" style="margin:.7rem 0 .4rem;font-size:1.4rem"><p class="muted petit" style="margin:0">${d}</p></div>`).join('')}
    </div><div class="actions"><button class="btn primaire petit" data-enregistrer="volumes">Enregistrer les volumes</button></div></div>

    ${blocCalendrier(R)}

    <div class="section"><p class="label eyebrow">Adresse d'envoi et serveur de ta boîte</p>
        <p class="muted">Si tu changes d'hébergeur : choisis-le, enregistre, puis retape le mot de passe (Comptes). Pense aussi aux réglages SPF, DKIM et DMARC du domaine chez le nouvel hébergeur.</p>
        <div class="grille g3">
            <div><label class="label champ">Hébergeur</label><select id="serveur-modele"><option value="">Choisir ton hébergeur ou fournisseur...</option>${Object.entries(SERVEURS).map(([k, [n]]) => `<option value="${k}">${n}</option>`).join('')}</select></div>
            <div><label class="label champ">Nom affiché</label><input type="text" id="mg-nom" value="${esc(mg.nom)}"></div>
            <div><label class="label champ">Adresse d'envoi</label><input type="text" id="mg-adresse" value="${esc(mg.adresse)}"></div>
            <div><label class="label champ">Serveur d'envoi (SMTP)</label><input type="text" id="mg-smtp" value="${esc(mg.smtpHote)}"></div>
            <div><label class="label champ">Port d'envoi</label><input type="number" id="mg-smtp-port" value="${esc(mg.smtpPort)}"></div>
            <div><label class="label champ">Serveur de réception (IMAP)</label><input type="text" id="mg-imap" value="${esc(mg.imapHote)}"></div>
        </div>
        <input type="hidden" id="mg-imap-port" value="${esc(mg.imapPort)}">
        <div class="actions"><button class="btn primaire petit" data-enregistrer="messagerie">Enregistrer l'adresse et le serveur</button></div></div>

    <div class="section"><p class="label eyebrow">Google Sheets et Google Docs (facultatif)</p>
        <p class="muted">Sans ça, le tableau et les rapports sont déjà dans ton Drive (fichier Excel et textes). Avec, ils deviennent un Google Sheets et des Google Docs. Demande un « fichier client » Google créé une fois (guide dans Aide).</p>
        <p class="petit">${g.connecte ? `Connecté : ${esc(g.email)}` : ''}${g.dossier ? ` · <a href="${esc(g.dossier)}" target="_blank">Dossier</a>` : ''}${g.classeur ? ` · <a href="${esc(g.classeur)}" target="_blank">Tableau</a>` : ''}</p>
        ${g.connecte ? `<div style="display:flex;gap:2rem;margin:.6rem 0">${sw('g-sheets', g.options?.sheets, 'Tableau dans Google Sheets')}${sw('g-docs', g.options?.docs, 'Rapports en Google Docs')}</div>` : ''}
        <div class="actions">${!app ? '' : !g.client ? '<button class="btn petit" data-hote="importerClientGoogle">Importer le fichier client</button>' : g.connecte ? '<button class="btn petit" data-hote="deconnecterGoogle">Se déconnecter de Google</button>' : '<button class="btn primaire petit" data-google>Se connecter à Google</button><button class="btn lien petit" data-hote="importerClientGoogle">Changer le fichier client</button>'}</div></div>

    <div class="section"><p class="label eyebrow">Fichiers et outils</p>
        <p class="muted petit">Données, tableau et rapports : ${esc(c.dossier || R.dossierDrive)}</p>
        <div class="actions"><button class="btn petit" data-ouvrir="rapports">Rapports</button><button class="btn petit" data-ouvrir="journaux">Journaux</button><button class="btn lien petit" data-hote="choisirDossier">Changer de dossier</button><button class="btn lien petit" data-hote="declarerMcp">Déclarer le MCP dans Claude Code</button><button class="btn lien petit" data-hote="verifierMiseAJour">Chercher une mise à jour</button></div></div>
    </details>`
}

// ---------- Calendar: research days, sending days and their first e-mails, time slots, follow-ups, rhythm, holidays ----------
const JOURS = [[1, 'Lundi'], [2, 'Mardi'], [3, 'Mercredi'], [4, 'Jeudi'], [5, 'Vendredi'], [6, 'Samedi'], [0, 'Dimanche']]
const ligneCreneau = ([a, b]) => `<div class="creneau" style="display:flex;gap:.7rem;align-items:center;margin-bottom:.5rem"><input type="time" data-c="debut" value="${esc(a)}" style="width:9rem"><span class="muted">à</span><input type="time" data-c="fin" value="${esc(b)}" style="width:9rem"><button class="btn lien petit" data-supprimer-creneau>Supprimer</button></div>`

function blocCalendrier(R) {
    const envoi = R.joursEnvoi || [2, 3, 4], recherche = R.joursRecherche || [1, 2, 3, 4, 5]
    return `<div class="section"><p class="label eyebrow">Calendrier</p>
        <p class="muted">Quand DC Prospect cherche, quand il envoie, et à quel rythme. Les réponses et les STOP, eux, sont lus tous les jours, toutes les 15 minutes.</p>
        <div class="grille g2">
            <div class="tuile"><p class="label">Jours de recherche</p><p class="muted petit">Recherche de prospects et rédaction des 1ers e-mails</p>
                <div style="display:flex;flex-wrap:wrap;gap:.8rem 1.4rem;margin-top:.7rem">${JOURS.map(([j, n]) => `<label class="interrupteur"><input type="checkbox" data-jour-recherche="${j}" ${recherche.includes(j) ? 'checked' : ''}> ${n}</label>`).join('')}</div></div>
            <div class="tuile"><p class="label">Jours d'envoi et 1ers e-mails par jour</p><p class="muted petit">Les relances dues partent ces jours-là en premier ; puis les 1ers e-mails, jusqu'au maximum par jour</p>
                <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:.6rem 1.4rem;margin-top:.7rem">${JOURS.map(([j, n]) => `<div style="display:flex;align-items:center;gap:.7rem"><label class="interrupteur" style="min-width:8.5rem"><input type="checkbox" data-jour-envoi="${j}" ${envoi.includes(j) ? 'checked' : ''}> ${n}</label><input type="number" min="0" max="40" data-j0="${j}" value="${esc(R.j0ParJour?.[j] ?? 0)}" title="1ers e-mails le ${n.toLowerCase()}" style="width:5rem;padding:.4rem .6rem"></div>`).join('')}</div></div>
            <div class="tuile"><p class="label">Créneaux d'envoi</p><p class="muted petit">Heures où les e-mails validés partent (les mêmes pour chaque jour d'envoi)</p>
                <div id="creneaux" style="margin-top:.7rem">${(R.fenetres || []).map(ligneCreneau).join('')}</div>
                <button class="btn petit" data-ajouter-creneau>Ajouter un créneau</button></div>
            <div class="tuile"><p class="label">Relances et rythme</p>
                <div style="display:grid;grid-template-columns:auto 6rem;gap:.6rem 1rem;align-items:center;margin-top:.7rem">
                    <span>Relance 1 : jours après le 1er e-mail</span><input type="number" min="1" max="30" id="cal-r1" value="${esc(R.relances?.r1 ?? 4)}">
                    <span>Relance 2 : jours après le 1er e-mail</span><input type="number" min="2" max="60" id="cal-r2" value="${esc(R.relances?.r2 ?? 11)}">
                    <span>Écart entre deux e-mails : minimum (minutes)</span><input type="number" min="1" max="60" id="cal-emin" value="${esc(R.ecartMinutes?.[0] ?? 2)}">
                    <span>Écart entre deux e-mails : maximum (minutes)</span><input type="number" min="1" max="60" id="cal-emax" value="${esc(R.ecartMinutes?.[1] ?? 4)}">
                </div>
                <div style="margin-top:1rem">${sw('cal-feries', R.sauterFeries !== false, 'Ne rien chercher ni envoyer les jours fériés')}</div>
                <p class="muted petit" style="margin:.6rem 0 0">Une relance qui tombe un jour sans envoi part au jour d'envoi suivant.</p></div>
        </div>
        <div class="actions"><button class="btn primaire petit" data-enregistrer="calendrier">Enregistrer le calendrier</button></div></div>`
}

const ligneZone = (z) => `<div class="zone"><input type="text" data-k="nom" value="${esc(z.nom)}" aria-label="Nom"><input type="text" data-k="departements" value="${esc((z.departements || []).join(', '))}" aria-label="Départements"><input type="text" data-k="codesPostaux" value="${esc((z.codesPostaux || []).join(', '))}" aria-label="Codes postaux"><label class="interrupteur"><input type="checkbox" data-k="active" ${z.active !== false ? 'checked' : ''}></label><button class="btn lien petit" data-supprimer>Supprimer</button></div>`
const ligneMetier = (s, r) => `<div class="metier"><input type="text" data-k="nom" value="${esc(s.nom)}" aria-label="Métier"><input type="text" data-k="naf" value="${esc((s.naf || []).join(', '))}" aria-label="Codes NAF"><div class="jauge" title="${r ? Math.round(r * 100) + ' %' : ''}"><span style="width:${Math.round((r || 0) * 100)}%"></span></div><label class="interrupteur"><input type="checkbox" data-k="actif" ${s.actif !== false ? 'checked' : ''}></label><button class="btn lien petit" data-supprimer>Supprimer</button></div>`
const lireLignes = (sel) => $$(sel + ' > div').map((l) => Object.fromEntries($$('[data-k]', l).map((i) => [i.dataset.k, i.type === 'checkbox' ? i.checked : i.value])))

// ---------- Clicks and switches of the accounts and settings (also used by the home screen) ----------
export async function clicReglages(b, recharger) {
    if (b.hasAttribute('data-profil')) {
        const d = {}
        for (const k of ['prenom', 'nom', 'adresse', 'activite', 'ville', 'entreprise', 'siteWeb', 'telephone', 'titre', 'offre', 'besoin', 'signaturePrincipale', 'signatureSecondaire', 'nomSignatureSecondaire']) { const i = $('#pf-' + k); if (i) d[k] = i.value }
        await action(b, () => exiger(api.put('/reglages', { profil: d })), 'Profil enregistré')
        return recharger()
    }
    if (b.hasAttribute('data-zone-rapide')) {
        const codes = $('#zr-codes').value.split(/[\s,;]+/).filter(Boolean)
        const zone = { nom: $('#zr-nom').value || codes.join(', '), departements: codes.filter((c) => c.length <= 3), codesPostaux: codes.filter((c) => c.length === 5), active: true }
        await action(b, () => exiger(api.put('/reglages', { zones: [...(store.R.zones || []), zone] })), 'Zone enregistrée')
        return recharger()
    }
    if (b.dataset.mode) { await action(b, () => exiger(api.put('/comptes/envoi', { mode: b.dataset.mode }))); return recharger() }
    if (b.hasAttribute('data-gmail')) { await action(b, () => exiger(api.post('/comptes/gmail', { adresse: $('#gmail-adresse').value, mdp: $('#gmail-mdp').value })), 'Gmail branché : les e-mails partiront par ton Gmail en tant que contact@'); return recharger() }
    if (b.hasAttribute('data-gmail-oublier')) { await action(b, () => exiger(api.delete('/comptes/gmail')), 'Gmail débranché'); return recharger() }
    if (b.hasAttribute('data-test-envoi')) { await action(b, () => exiger(api.post('/comptes/test-envoi')), (r) => `E-mail de test envoyé à ${r.a} : vérifie que l'expéditeur affiché est contact@`); return true }
    if (b.hasAttribute('data-mdp')) {
        const mdp = $('#mdp').value
        if (!mdp) { toast('Tape d\'abord le mot de passe', true); return true }
        await action(b, () => exiger(api.post('/comptes/mot-de-passe', { mdp })), 'Mot de passe enregistré, connexion réussie')
        return recharger()
    }
    if (b.hasAttribute('data-tester')) {
        $('#resultat-test').textContent = 'Vérification (30 secondes environ)...'
        const r = await action(b, () => exiger(api.post('/comptes/tester')))
        if (r) $('#resultat-test').innerHTML = Object.entries({ Envoi: r.resultats.envoi, Claude: r.resultats.claude, Registre: r.resultats.registre, Dossier: r.resultats.dossier })
            .map(([k, v]) => `<span style="margin-right:1rem;color:${v === 'OK' ? 'var(--mint)' : 'var(--red)'}">${k} : ${esc(v)}</span>`).join('')
        return true
    }
    if (b.hasAttribute('data-google')) {
        toast('Ton navigateur s\'ouvre sur la page Google : connecte-toi, accepte, puis reviens ici.')
        await action(b, () => hote('connecterGoogle', { lecture: false }), (s) => `Google connecté : ${s.email}`)
        return recharger()
    }
    if (b.hasAttribute('data-actualiser')) { await action(b, () => hote('statutClaude')); return recharger() }
    if (b.hasAttribute('data-ajouter-zone')) { $('#zones').insertAdjacentHTML('beforeend', ligneZone({ nom: '', departements: [], codesPostaux: [], active: true })); return true }
    if (b.hasAttribute('data-ajouter-metier')) { $('#metiers').insertAdjacentHTML('beforeend', ligneMetier({ nom: '', naf: [], actif: true })); return true }
    if (b.hasAttribute('data-supprimer')) { b.closest('.zone, .metier').remove(); return true }
    if (b.hasAttribute('data-ajouter-creneau')) { $('#creneaux').insertAdjacentHTML('beforeend', ligneCreneau(['', ''])); return true }
    if (b.hasAttribute('data-supprimer-creneau')) { b.closest('.creneau').remove(); return true }
    if (b.dataset.enregistrer) {
        const k = b.dataset.enregistrer
        let d
        if (k === 'zones') d = { zones: lireLignes('#zones') }
        if (k === 'secteurs') d = { secteurs: lireLignes('#metiers') }
        if (k === 'volumes') { d = {}; $('[data-volume]').forEach((i) => (d[i.dataset.volume] = Number(i.value))) }
        if (k === 'calendrier') d = {
            joursRecherche: $('[data-jour-recherche]').filter((i) => i.checked).map((i) => Number(i.dataset.jourRecherche)),
            joursEnvoi: $('[data-jour-envoi]').filter((i) => i.checked).map((i) => Number(i.dataset.jourEnvoi)),
            j0ParJour: Object.fromEntries($('[data-j0]').map((i) => [i.dataset.j0, Number(i.value)])),
            fenetres: $('#creneaux .creneau').map((l) => [$('[data-c=debut]', l).value, $('[data-c=fin]', l).value]),
            relances: { r1: Number($('#cal-r1').value), r2: Number($('#cal-r2').value) },
            ecartMinutes: [Number($('#cal-emin').value), Number($('#cal-emax').value)],
            sauterFeries: $('#cal-feries').checked,
        }
        if (k === 'messagerie') d = { messagerie: { nom: $('#mg-nom').value, adresse: $('#mg-adresse').value, smtpHote: $('#mg-smtp').value, smtpPort: $('#mg-smtp-port').value, imapHote: $('#mg-imap').value, imapPort: $('#mg-imap-port').value } }
        const r = await action(b, () => exiger(api.put('/reglages', d)), 'Enregistré')
        if (r) { store.R = { ...store.R, ...r.reglages }; rendreReglages(); if (['secteurs', 'zones', 'volumes', 'calendrier', 'messagerie'].includes(k)) $('.avance').open = true }
        return true
    }
    return false
}

export async function changeReglages(i, recharger) {
    if (i.id === 'serveur-modele' && SERVEURS[i.value]) {
        const [, smtp, sp, imap, ip] = SERVEURS[i.value]
        const domaine = ($('#mg-adresse').value.split('@')[1] || 'ton-domaine.fr')
        $('#mg-smtp').value = smtp.replace('{domaine}', domaine); $('#mg-smtp-port').value = sp
        $('#mg-imap').value = imap.replace('{domaine}', domaine); $('#mg-imap-port').value = ip
        toast('Serveur rempli : clique sur « Enregistrer l\'adresse et le serveur »')
        return true
    }
    const g = { 'g-sheets': () => ({ sheets: i.checked }), 'g-docs': () => ({ docs: i.checked }) }[i.id]
    if (g) { await action(null, () => hote('reglerGoogle', g()), 'Enregistré'); recharger(); return true }
    if (i.id === 'demarrage') { await action(null, () => hote('demarrageAuto', i.checked), i.checked ? 'Démarre avec Windows' : 'Ne démarre plus avec Windows'); return true }
    return false
}
