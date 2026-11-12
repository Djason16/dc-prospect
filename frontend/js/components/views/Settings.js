// Settings, simple first: profile, how DC Prospect works (settings/engine.js), sending; the rest folded in "Avancé"
import { $, $$, esc } from '../../utils/dom.js'
import { store } from '../../stores/state.js'
import { api, ensureSuccess, hostAction } from '../../api.js'
import { runAction, toast, confirmClick } from '../ui/Toast.js'
import { engineBlock, claudeBlock, onEngineClick } from './settings/engine.js'
import { calendarBlock, slotRow } from './settings/calendar.js'
import { diagnosisHtml } from './settings/diagnosis.js'
import { templatesSection, loadTemplates, onTemplatesClick, onTemplatesChange } from './settings/templates.js'

import { TRADE_NAF, nafOf } from '../../data/trades.js'
import { activityExample } from '../../data/activities.js'

export { engineBlock, claudeBlock }

// Mail hosts ready to use: change of host = pick it here and type the password again
// key: [name shown, SMTP server, SMTP port, IMAP server, IMAP port]
const MAIL_HOSTS = {
    infomaniak: ['Infomaniak', 'mail.infomaniak.com', 465, 'mail.infomaniak.com', 993],
    o2switch: ['o2switch (mail.ton-domaine)', 'mail.{domain}', 465, 'mail.{domain}', 993],
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

export async function loadSettings() {
    const r = await api.get('/settings')
    if (!r.success) return toast(r.error, true)
    store.settings = r
    if (store.view === 'settings') renderSettings()
}

const switchField = (id, on, text, disabled = false) => `<label class="switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''} ${disabled ? 'disabled' : ''}> ${text}</label>`

// ---------- Blocks also used on the home screen (getting started) ----------
// Profile: who writes the e-mails (DC Prospect works for anyone: nothing about the user is written in the code)
export function profileBlock(s, { full = true } = {}) {
    const p = s.profile || {}
    const field = (id, label, value, hint = '', type = 'text') => `<div><label class="label field" for="pf-${id}">${label}</label><input type="${type}" id="pf-${id}" value="${esc(value || '')}" placeholder="${esc(hint)}"></div>`
    return `<div class="card">
        <strong class="display display-s">Ton profil</strong>
        <p class="muted small">C'est en ton nom que DC Prospect cherche et écrit. Les e-mails partent de ton adresse d'envoi : ton adresse pro, ou ton adresse perso si tu n'en as pas d'autre.</p>
        <div class="grid g2">
            ${field('firstName', 'Prénom', p.firstName)}
            ${field('lastName', 'Nom', p.lastName)}
            ${field('address', 'Adresse d\'envoi (pro ou perso)', s.sender, 'contact@ton-domaine.fr ou prenom.nom@gmail.com')}
            ${field('activity', 'Ton activité', p.activity, 'développeur web indépendant, photographe, graphiste...')}
            ${field('city', 'Ta ville', p.city, 'Compiègne (Oise)')}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:end;gap:1rem;flex-wrap:wrap"><label class="label field" for="pf-offer">Ce que tu proposes (offres, prix de départ, conditions)</label>
            <button class="btn link small" data-activity-example title="Remplit avec un exemple adapté à ton activité, à modifier ensuite">Exemple pour mon activité</button></div>
        <div id="activity-trades"></div>
        <textarea id="pf-offer" style="min-height:90px" placeholder="Site vitrine dès 490 €, site sur mesure..., paiement en plusieurs fois...">${esc(p.offer || '')}</textarea>
        ${full ? `<details style="margin-top:.8rem"><summary class="small" style="cursor:pointer">Compléter mon profil (facultatif) : site, téléphone, rendez-vous, signature</summary>
        <div class="grid g2">${field('company', 'Nom de l\'entreprise', p.company, 'si différent de ton nom')}${field('website', 'Ton site', p.website, 'https://...')}${field('phone', 'Téléphone (signature)', p.phone)}${field('title', 'Titre sous ton nom (signature)', p.title, 'Développeur web')}${field('bookingUrl', 'Lien de prise de rendez-vous', p.bookingUrl, 'https://calendly.com/... : proposé aux prospects intéressés')}</div>
        <label class="label field" for="pf-need">À quoi on voit qu'un prospect a besoin de toi</label>
        <textarea id="pf-need" style="min-height:70px" placeholder="${esc(s.defaultNeed)}">${esc(p.need || '')}</textarea>
            <p class="muted small" style="margin-top:.8rem">Ma signature HTML (sinon DC Prospect en fait une simple avec ton nom, ton titre, ton téléphone et ton site).</p>
            <textarea id="pf-mainSignature" style="min-height:90px;font-family:monospace;font-size:.85rem">${esc(p.mainSignature || '')}</textarea>
            <label class="label field" for="pf-secondSignatureName">Deuxième signature (facultatif, ex : service comptabilité)</label>
            <input type="text" id="pf-secondSignatureName" value="${esc(p.secondSignatureName || '')}">
            <textarea id="pf-secondSignature" style="min-height:70px;font-family:monospace;font-size:.85rem;margin-top:.5rem">${esc(p.secondSignature || '')}</textarea>
        </details>` : ''}
        <div class="actions"><button class="btn primary small" data-profile>Enregistrer mon profil</button><a class="btn link small" href="/api/signature-preview" target="_blank">Voir ma signature</a></div>
    </div>`
}

// First zone, in one field
export function quickZoneBlock() {
    return `<div class="card"><strong class="display display-s">Ta zone de prospection</strong>
        <p class="muted small">Le plus simple : ta ville et un rayon.</p>
        <div class="grid g2"><div><label class="label field" for="za-town">Ville</label><input type="text" id="za-town" placeholder="Compiègne"></div>
        <div><label class="label field" for="za-km">Rayon (km)</label><input type="number" id="za-km" value="20" min="2" max="80"></div></div>
        <div class="actions"><button class="btn primary small" data-zone-around>Créer la zone</button></div>
        <details style="margin-top:.8rem"><summary class="small" style="cursor:pointer">Ou par départements et codes postaux</summary>
        <p class="muted small">Les départements (60, 75, 69...) ou les codes postaux (60200, 60150...) où chercher. Tu pourras en ajouter d'autres dans Réglages.</p>
        <div class="grid g2"><div><label class="label field" for="qz-name">Nom de la zone</label><input type="text" id="qz-name" placeholder="Oise"></div>
        <div><label class="label field" for="qz-codes">Départements ou codes postaux</label><input type="text" id="qz-codes" placeholder="60"></div></div>
        <div class="actions"><button class="btn primary small" data-quick-zone>Enregistrer la zone</button></div></details></div>`
}

// ---------- Deliverability: SPF, DKIM, DMARC of the sending domain, and the warm-up of a new address ----------
export function deliverabilityBlock(s) {
    const w = s.warmup || {}
    return `<div class="card"><strong class="display display-s">Délivrabilité</strong>
        <p class="muted small">Pour que tes e-mails arrivent en boîte de réception et pas en spam. Un clic vérifie que ton adresse ${esc(s.sender || '')} est bien réglée et dit quoi demander à ton hébergeur si besoin.</p>
        <div class="actions"><button class="btn small" data-deliverability>Vérifier mon domaine</button></div>
        <div id="deliverability-result" class="small" style="margin-top:.6rem"></div>
        <div style="margin-top:1rem">${switchField('warmup', w.enabled, `Adresse neuve : démarrer doucement (5 e-mails par jour la 1re semaine, puis 5 de plus chaque semaine)${w.enabled ? ` : ${w.limitToday} aujourd'hui` : ''}`)}</div></div>`
}

// Steps for MY provider, found from my address (POST /api/accounts/auto-setup, kept in store.mailGuide)
function mailGuideBlock(g, done) {
    if (!g || done) return ''
    return `<div class="tile" style="margin:.6rem 0 1rem;border-color:rgba(126,230,168,.35)"><p class="label">Pour ton adresse${g.name ? ` (${esc(g.name)})` : ''}</p>
        <ol class="small" style="padding-left:1.2rem;margin:.4rem 0 0">${g.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
        ${g.warning ? `<p class="small" style="margin:.5rem 0 0;color:var(--yellow)">${esc(g.warning)}</p>` : ''}</div>`
}

export function sendingBlock(s) {
    const a = s.accounts || {}, gmail = a.gmail || {}, mailbox = a.mailbox || {}
    const viaGmail = a.sendingMode === 'gmail'
    const done = viaGmail ? gmail.configured : mailbox.password
    const isGmail = /@(gmail|googlemail)\.com$/i.test(s.sender || '')
    return `<div class="card account"><div class="avatar ${done ? 'ok' : ''}">@</div><div style="flex:1">
        <strong class="display display-s">Envoi des e-mails</strong>
        <p class="muted small">Le prospect voit toujours ${esc(s.sender || "ton adresse d'envoi")}.</p>
        ${mailGuideBlock(store.mailGuide, done)}
        <div class="actions" style="margin:.4rem 0 .9rem">
            <button class="btn small ${viaGmail ? 'primary' : ''}" data-mode="gmail">Par mon Gmail (conseillé)</button>
            <button class="btn small ${viaGmail ? '' : 'primary'}" data-mode="mailbox">Par ma boîte directement</button>
        </div>
        ${viaGmail ? (gmail.configured
            ? `<p class="small">Gmail branché : <strong>${esc(gmail.address)}</strong> ${gmail.address === s.sender ? 'envoie tes e-mails' : `envoie en tant que ${esc(s.sender)}`}. Copie dans tes Envoyés Gmail, réponses lues dans Gmail.</p>
               <div class="actions"><button class="btn link small" data-test-email>M'envoyer un e-mail de test</button><button class="btn link small" data-gmail-forget>Débrancher Gmail</button></div>`
            : `<ol class="small" style="padding-left:1.2rem;margin:.2rem 0 .7rem">
                <li>Ton adresse d'envoi est ce Gmail : rien à faire. Sinon, elle doit être dans Gmail, Paramètres, Comptes, « Envoyer des e-mails en tant que ».</li>
                <li>La <a href="https://myaccount.google.com/signinoptions/twosv" target="_blank">validation en deux étapes</a> doit être active sur ton compte Google.</li>
                <li>Ouvre <a href="https://myaccount.google.com/apppasswords" target="_blank">Mots de passe des applications</a>, tape « DC Prospect », clique sur Créer.</li>
                <li>Colle ici les 16 lettres affichées.</li></ol>
               <input type="text" id="gmail-address" value="${esc(gmail.address || (isGmail ? s.sender : ''))}" placeholder="Ton adresse Gmail" autocomplete="off" style="margin-bottom:.5rem">
               <input type="password" id="gmail-password" placeholder="Mot de passe d'application (16 lettres)" autocomplete="off">
               <div class="actions"><button class="btn primary small" data-gmail>Brancher Gmail</button></div>`)
        : `<p class="small">${mailbox.password ? `Mot de passe de ${esc(s.sender)} enregistré (chiffré par Windows sur ce PC). Serveur : ${esc(s.mailbox.smtpHost)}.` : `Tape le mot de passe de ${esc(s.sender)} (serveur ${esc(s.mailbox.smtpHost || "à choisir dans Avancé")}). Boîte perso (Orange, SFR, Free, Yahoo, Outlook...) : choisis ton fournisseur dans Avancé ; certains demandent un mot de passe d'application.`}</p>
           ${mailbox.password ? '' : `<div class="actions" style="margin:.2rem 0 .6rem"><button class="btn small" data-detect-mail>Trouver mon serveur tout seul</button><span class="muted small" style="align-self:center">à partir de ton adresse, sans rien taper de technique</span></div>`}
           <input type="password" id="mailbox-password" placeholder="Mot de passe de ${esc(s.sender)}" autocomplete="off">
           <div class="actions"><button class="btn primary small" data-password>Enregistrer et tester</button>${mailbox.password ? '<button class="btn link small" data-test-email>M\'envoyer un e-mail de test</button><button class="btn link small" data-host="forgetPassword">Oublier</button>' : ''}</div>`}
    </div></div>`
}

// ---------- The page ----------
export function renderSettings() {
    const s = store.settings
    if (!s) return
    const a = s.accounts || {}, g = a.google || {}, inApp = s.inApp, mb = s.mailbox
    $('#view-settings').innerHTML = `
    <div class="page-head"><div><p class="label eyebrow">Ce PC et tes préférences</p><h1 class="display display-l">Réglages</h1></div>
        <p class="muted">Trois choses suffisent : ton profil, la formule et l'envoi. Le reste est déjà réglé ; il est dans « Avancé » si tu veux l'ajuster.</p></div>

    <div class="section"><p class="label eyebrow">Profil</p>${profileBlock(s)}</div>

    <div class="section"><p class="label eyebrow">Formule</p>${engineBlock(s)}</div>

    <div class="section"><p class="label eyebrow">Envoi</p><div class="grid g2">${sendingBlock(s)}${deliverabilityBlock(s)}</div>
        <div class="actions"><button class="btn" data-check>Tout vérifier</button></div><div id="check-result" class="small" style="margin-top:.6rem"></div></div>

    <div class="section"><p class="label eyebrow">Application</p><div class="card">
        <div style="display:flex;gap:2rem;flex-wrap:wrap;align-items:center">
            <strong class="display display-s">DC Prospect ${esc(a.version || '')}</strong>
            ${switchField('auto-start', s.autoStart, 'Démarrer avec Windows', !inApp)}
            ${switchField('daily-digest', s.dailyDigest, 'M\'envoyer un résumé par e-mail le matin')}
            <span style="display:flex;gap:.5rem;align-items:center"><label class="small" for="pause-until">Pause (vacances) jusqu'au</label><input type="date" id="pause-until" value="${esc(s.pauseUntil || '')}" style="width:12rem">${s.pauseUntil ? '<button class="btn link small" data-pause-off>Reprendre</button>' : ''}</span>
            <span class="muted small">${a.update ? `Mise à jour ${esc(a.update.version)} prête.` : 'Mises à jour : par le dossier Installation de tes données, ou sur la page des releases.'}</span>
        </div>
        <div class="actions">${a.update ? '<button class="btn primary small" data-host="installUpdate">Installer la mise à jour</button>' : ''}<button class="btn small" data-open="data">Ouvrir le dossier (tableau, rapports)</button><button class="btn link small" data-host="quit">Quitter l'application</button></div>
    </div></div>

    <details class="section advanced"><summary class="label eyebrow">Avancé : zones, métiers, volumes, calendrier, serveur mail, Google</summary>

    <div class="section"><p class="label eyebrow">Zones</p>
        <p class="muted">Une zone par semaine, chacune son tour (cette semaine : <strong style="color:var(--paper)">${esc(s.zoneOfTheWeek || 'aucune')}</strong>). Départements (60, 75...) ou codes postaux (60200, 60150...), séparés par des virgules.</p>
        <div class="zone-row label" style="border:0"><span>Nom</span><span>Départements</span><span>Codes postaux</span><span>Active</span><span></span></div>
        <div id="zones">${s.zones.map(zoneRow).join('')}</div>
        <div style="margin:1rem 0">${quickZoneBlock()}</div>
        <div class="actions"><button class="btn small" data-add-zone>Ajouter une zone</button><button class="btn primary small" data-save="zones">Enregistrer les zones</button></div></div>

    <div class="section"><p class="label eyebrow">Métiers ciblés</p>
        <p class="muted">Les métiers à prospecter dans chaque ville. Les codes NAF (registre officiel) permettent de ne garder que les entreprises qui acceptent la prospection. La barre montre ce qui rapporte le plus : ces métiers passent en premier.</p>
        <div class="trade-row label" style="border:0"><span>Métier</span><span>Codes NAF (registre)</span><span>Rendement</span><span>Actif</span><span></span></div>
        <div id="trades">${s.trades.map((t) => tradeRow(t, s.tradeYield?.[t.name])).join('')}</div>
        <datalist id="trade-names">${Object.keys(TRADE_NAF).map((k) => `<option value="${esc(k)}">`).join('')}</datalist>
        <div class="actions"><button class="btn small" data-add-trade>Ajouter un métier</button><button class="btn primary small" data-save="trades">Enregistrer les métiers</button></div></div>

    <div class="section"><p class="label eyebrow">Volumes</p><div class="grid g3">
        ${[['maxSearchesPerDay', 'Recherches web par jour', 'Une recherche = un métier dans une ville (jusqu\'à 6 entreprises avec e-mail). Baisse si ton abonnement ou ton quota sature.'], ['readyReserve', 'Réserve de prospects prêts', '1ers e-mails rédigés d\'avance'], ['maxEmailsPerDay', 'E-mails par jour au maximum', 'Plan : 20']]
            .map(([k, label, hint]) => `<div class="tile"><p class="label">${label}</p><input type="number" min="0" data-volume="${k}" value="${esc(s[k])}" style="margin:.7rem 0 .4rem;font-size:1.4rem"><p class="muted small" style="margin:0">${hint}</p></div>`).join('')}
    </div><div class="actions"><button class="btn primary small" data-save="volumes">Enregistrer les volumes</button></div></div>

    ${calendarBlock(s)}

    ${templatesSection()}

    <div class="section"><p class="label eyebrow">Adresse d'envoi et serveur de ta boîte</p>
        <p class="muted">Si tu changes d'hébergeur : choisis-le, enregistre, puis retape le mot de passe (Comptes). Pense aussi aux réglages SPF, DKIM et DMARC du domaine chez le nouvel hébergeur.</p>
        <div class="grid g3">
            <div><label class="label field">Hébergeur</label><select id="mail-host"><option value="">Choisir ton hébergeur ou fournisseur...</option>${Object.entries(MAIL_HOSTS).map(([k, [name]]) => `<option value="${k}">${name}</option>`).join('')}</select></div>
            <div><label class="label field">Nom affiché</label><input type="text" id="mb-name" value="${esc(mb.name)}"></div>
            <div><label class="label field">Adresse d'envoi</label><input type="text" id="mb-address" value="${esc(mb.address)}"></div>
            <div><label class="label field">Serveur d'envoi (SMTP)</label><input type="text" id="mb-smtp" value="${esc(mb.smtpHost)}"></div>
            <div><label class="label field">Port d'envoi</label><input type="number" id="mb-smtp-port" value="${esc(mb.smtpPort)}"></div>
            <div><label class="label field">Serveur de réception (IMAP)</label><input type="text" id="mb-imap" value="${esc(mb.imapHost)}"></div>
        </div>
        <input type="hidden" id="mb-imap-port" value="${esc(mb.imapPort)}">
        <div class="actions"><button class="btn primary small" data-save="mailbox">Enregistrer l'adresse et le serveur</button></div></div>

    <div class="section"><p class="label eyebrow">Google Sheets et Google Docs (facultatif)</p>
        <p class="muted">Sans ça, le tableau et les rapports sont déjà dans ton Drive (fichier Excel et textes). Avec, ils deviennent un Google Sheets et des Google Docs. Demande un « fichier client » Google créé une fois (guide dans Aide).</p>
        <p class="small">${g.connected ? `Connecté : ${esc(g.email)}` : ''}${g.folder ? ` · <a href="${esc(g.folder)}" target="_blank">Dossier</a>` : ''}${g.spreadsheet ? ` · <a href="${esc(g.spreadsheet)}" target="_blank">Tableau</a>` : ''}</p>
        ${g.connected ? `<div style="display:flex;gap:2rem;margin:.6rem 0">${switchField('g-sheets', g.options?.sheets, 'Tableau dans Google Sheets')}${switchField('g-docs', g.options?.docs, 'Rapports en Google Docs')}</div>` : ''}
        <div class="actions">${!inApp ? '' : !g.client ? '<button class="btn small" data-host="importGoogleClient">Importer le fichier client</button>' : g.connected ? '<button class="btn small" data-host="disconnectGoogle">Se déconnecter de Google</button>' : '<button class="btn primary small" data-google>Se connecter à Google</button><button class="btn link small" data-host="importGoogleClient">Changer le fichier client</button>'}</div></div>

    <div class="section"><p class="label eyebrow">Fichiers et outils</p>
        <p class="muted small">Données, tableau et rapports : ${esc(a.folder || s.dataFolder)}</p>
        <div class="actions"><button class="btn small" data-open="reports">Rapports</button><button class="btn small" data-open="logs">Journaux</button><button class="btn link small" data-host="chooseFolder">Changer de dossier</button><button class="btn link small" data-host="declareMcp">Déclarer le MCP dans Claude Code</button><button class="btn link small" data-host="checkUpdate">Chercher une mise à jour</button></div></div>
    </details>`
    // my e-mail templates: read when the section is opened
    $('#templates-section')?.addEventListener('toggle', (e) => { if (e.target.open) loadTemplates() })
}

const zoneRow = (z) => `<div class="zone-row"><input type="text" data-k="name" value="${esc(z.name)}" aria-label="Nom"><input type="text" data-k="departments" value="${esc((z.departments || []).join(', '))}" aria-label="Départements"><input type="text" data-k="postalCodes" value="${esc((z.postalCodes || []).join(', '))}" aria-label="Codes postaux"><label class="switch"><input type="checkbox" data-k="active" ${z.active !== false ? 'checked' : ''}></label><button class="btn link small" data-remove>Supprimer</button></div>`
const tradeRow = (t, yieldRate) => `<div class="trade-row"><input type="text" data-k="name" value="${esc(t.name)}" aria-label="Métier" list="trade-names" placeholder="Commence à taper : coiffure, plombier..."><input type="text" data-k="naf" value="${esc((t.naf || []).join(', '))}" aria-label="Codes NAF"><div class="gauge" title="${yieldRate ? Math.round(yieldRate * 100) + ' %' : ''}"><span style="width:${Math.round((yieldRate || 0) * 100)}%"></span></div><label class="switch"><input type="checkbox" data-k="active" ${t.active !== false ? 'checked' : ''}></label><button class="btn link small" data-remove>Supprimer</button></div>`
const readRows = (selector) => $$(selector + ' > div').map((row) => Object.fromEntries($$('[data-k]', row).map((i) => [i.dataset.k, i.type === 'checkbox' ? i.checked : i.value])))

// ---------- Clicks and switches of the accounts and settings (also used by the home screen) ----------
export async function onSettingsClick(b, reload) {
    if (b.hasAttribute('data-profile')) {
        const d = {}
        for (const k of ['firstName', 'lastName', 'address', 'activity', 'city', 'company', 'website', 'phone', 'title', 'bookingUrl', 'offer', 'need', 'mainSignature', 'secondSignature', 'secondSignatureName']) { const i = $('#pf-' + k); if (i) d[k] = i.value }
        await runAction(b, () => ensureSuccess(api.put('/settings', { profile: d })), 'Profil enregistré')
        return reload()
    }
    // Example for my activity: offer, signs of a need, trades worth prospecting (to change afterwards)
    if (b.hasAttribute('data-activity-example')) {
        const card = b.closest('.card'), ex = activityExample($('#pf-activity', card)?.value)
        if (!ex) { toast('Tape d\'abord ton activité (photographe, graphiste, développeur web...) : je propose un exemple qui lui correspond', true); return true }
        const offer = $('#pf-offer', card), need = $('#pf-need', card)
        if (!offer.value.trim() || confirmClick(b, 'Remplacer mon texte')) offer.value = ex.offer; else return true
        if (need && !need.value.trim()) need.value = ex.need
        $('#activity-trades', card).innerHTML = `<p class="small" style="margin:.4rem 0">Métiers conseillés pour ton activité : ${ex.trades.map(esc).join(', ')}. <button class="btn link small" data-use-trades="${esc(ex.trades.join('|'))}">Prospecter ces métiers</button></p>`
        toast('Exemple rempli : adapte-le (tes vrais prix) puis enregistre ton profil')
        return true
    }
    if (b.dataset.useTrades) {
        const names = b.dataset.useTrades.split('|')
        const trades = [...names.map((name) => ({ name, naf: nafOf(name), active: true })), ...(store.settings.trades || []).filter((t) => !names.includes(t.name)).map((t) => ({ ...t, active: false }))]
        await runAction(b, () => ensureSuccess(api.put('/settings', { trades })), 'Métiers choisis : les autres sont désactivés (Réglages, Avancé, Métiers)')
        return true
    }
    if (b.hasAttribute('data-zone-around')) {
        const card = b.closest('.card'), town = $('#za-town', card).value.trim()
        if (!town) { toast('Tape d\'abord ta ville', true); return true }
        await runAction(b, () => ensureSuccess(api.post('/zones/around', { town, km: $('#za-km', card).value })), (r) => `Zone créée : ${r.zone.name}, ${r.towns} communes`)
        return reload()
    }
    if (b.hasAttribute('data-quick-zone')) {
        const codes = $('#qz-codes').value.split(/[\s,;]+/).filter(Boolean)
        const zone = { name: $('#qz-name').value || codes.join(', '), departments: codes.filter((c) => c.length <= 3), postalCodes: codes.filter((c) => c.length === 5), active: true }
        await runAction(b, () => ensureSuccess(api.put('/settings', { zones: [...(store.settings.zones || []), zone] })), 'Zone enregistrée')
        return reload()
    }
    if (b.dataset.mode) { await runAction(b, () => ensureSuccess(api.put('/accounts/sending-mode', { mode: b.dataset.mode }))); return reload() }
    if (b.hasAttribute('data-gmail')) { await runAction(b, () => ensureSuccess(api.post('/accounts/gmail', { address: $('#gmail-address').value, password: $('#gmail-password').value })), 'Gmail branché : les e-mails partiront par ton Gmail en tant que contact@'); return reload() }
    if (b.hasAttribute('data-gmail-forget')) { await runAction(b, () => ensureSuccess(api.delete('/accounts/gmail')), 'Gmail débranché'); return reload() }
    if (b.hasAttribute('data-test-email')) { await runAction(b, () => ensureSuccess(api.post('/accounts/test-email')), (r) => `E-mail de test envoyé à ${r.to} : vérifie que l'expéditeur affiché est contact@`); return true }
    if (b.hasAttribute('data-pause-off')) { await runAction(b, () => ensureSuccess(api.put('/settings', { pauseUntil: '' })), 'DC Prospect reprend'); return reload() }
    if (b.hasAttribute('data-detect-mail')) {
        const r = await runAction(b, () => ensureSuccess(api.post('/accounts/detect-mail')))
        const h = r?.host
        if (!r) return true
        if (!h) { toast('Hébergeur pas reconnu : choisis-le dans Avancé, « Adresse d\'envoi et serveur de ta boîte »', true); return true }
        if (h.gmail) { toast(`${h.name} : le plus simple est « Par mon Gmail » (bouton au-dessus)`); return true }
        const mb = store.settings.mailbox
        await runAction(b, () => ensureSuccess(api.put('/settings', { mailbox: { name: mb.name, address: mb.address, smtpHost: h.smtpHost, smtpPort: h.smtpPort, imapHost: h.imapHost, imapPort: h.imapPort } })), `${h.name} trouvé : serveur rempli, tape maintenant ton mot de passe`)
        return reload()
    }
    if (b.hasAttribute('data-password')) {
        const password = $('#mailbox-password').value
        if (!password) { toast('Tape d\'abord le mot de passe', true); return true }
        await runAction(b, () => ensureSuccess(api.post('/accounts/password', { password })), 'Mot de passe enregistré, connexion réussie')
        return reload()
    }
    if (b.hasAttribute('data-check')) {
        $('#check-result').textContent = 'Vérification (30 secondes environ)...'
        const r = await runAction(b, () => ensureSuccess(api.post('/accounts/check')))
        if (r) $('#check-result').innerHTML = diagnosisHtml(r.results)
        return true
    }
    if (b.hasAttribute('data-google')) {
        toast('Ton navigateur s\'ouvre sur la page Google : connecte-toi, accepte, puis reviens ici.')
        await runAction(b, () => hostAction('connectGoogle', { canRead: false }), (status) => `Google connecté : ${status.email}`)
        return reload()
    }
    if (await onEngineClick(b, reload)) return true
    if (await onTemplatesClick(b)) return true
    if (b.hasAttribute('data-deliverability')) {
        const r = await runAction(b, () => ensureSuccess(api.post('/accounts/deliverability')))
        if (r) {
            const d = r.result
            const flag = (label, ok) => `<span style="margin-right:1rem;color:${ok ? 'var(--mint)' : 'var(--red)'}">${label} ${ok ? 'OK' : 'manquant'}</span>`
            $('#deliverability-result').innerHTML = (d.webmail ? '' : `<p>${flag('MX', d.mx)}${flag('SPF', d.spf)}${flag('DKIM', d.dkim)}${flag('DMARC', d.dmarc)}</p>`) + d.advice.map((a) => `<p class="muted">${esc(a)}</p>`).join('')
        }
        return true
    }
    if (b.hasAttribute('data-add-zone')) { $('#zones').insertAdjacentHTML('beforeend', zoneRow({ name: '', departments: [], postalCodes: [], active: true })); return true }
    if (b.hasAttribute('data-add-trade')) { $('#trades').insertAdjacentHTML('beforeend', tradeRow({ name: '', naf: [], active: true })); return true }
    if (b.hasAttribute('data-remove')) { b.closest('.zone-row, .trade-row').remove(); return true }
    if (b.hasAttribute('data-add-slot')) { $('#slots').insertAdjacentHTML('beforeend', slotRow(['', ''])); return true }
    if (b.hasAttribute('data-remove-slot')) { b.closest('.slot').remove(); return true }
    if (b.dataset.save) {
        const k = b.dataset.save
        let d
        if (k === 'zones') d = { zones: readRows('#zones') }
        if (k === 'trades') d = { trades: readRows('#trades') }
        if (k === 'volumes') { d = {}; $$('[data-volume]').forEach((i) => (d[i.dataset.volume] = Number(i.value))) }
        if (k === 'calendar') d = {
            searchDays: $$('[data-search-day]').filter((i) => i.checked).map((i) => Number(i.dataset.searchDay)),
            sendDays: $$('[data-send-day]').filter((i) => i.checked).map((i) => Number(i.dataset.sendDay)),
            firstEmailsPerDay: Object.fromEntries($$('[data-first-emails]').map((i) => [i.dataset.firstEmails, Number(i.value)])),
            sendWindows: $$('#slots .slot').map((row) => [$('[data-slot=start]', row).value, $('[data-slot=end]', row).value]),
            followUpDays: { first: Number($('#cal-first').value), second: Number($('#cal-second').value) },
            gapMinutes: [Number($('#cal-gap-min').value), Number($('#cal-gap-max').value)],
            skipHolidays: $('#cal-holidays').checked,
        }
        if (k === 'mailbox') d = { mailbox: { name: $('#mb-name').value, address: $('#mb-address').value, smtpHost: $('#mb-smtp').value, smtpPort: $('#mb-smtp-port').value, imapHost: $('#mb-imap').value, imapPort: $('#mb-imap-port').value } }
        const r = await runAction(b, () => ensureSuccess(api.put('/settings', d)), 'Enregistré')
        if (r) { store.settings = { ...store.settings, ...r.settings }; renderSettings(); if (['trades', 'zones', 'volumes', 'calendar', 'mailbox'].includes(k)) $('.advanced').open = true }
        return true
    }
    return false
}

export async function onSettingsChange(i, reload) {
    if (i.id === 'mail-host' && MAIL_HOSTS[i.value]) {
        const [, smtp, smtpPort, imap, imapPort] = MAIL_HOSTS[i.value]
        const domain = ($('#mb-address').value.split('@')[1] || 'ton-domaine.fr')
        $('#mb-smtp').value = smtp.replace('{domain}', domain); $('#mb-smtp-port').value = smtpPort
        $('#mb-imap').value = imap.replace('{domain}', domain); $('#mb-imap-port').value = imapPort
        toast('Serveur rempli : clique sur « Enregistrer l\'adresse et le serveur »')
        return true
    }
    // a known trade typed: its NAF codes are filled
    if (i.dataset.k === 'name' && i.closest('.trade-row')) {
        const naf = $('[data-k=naf]', i.closest('.trade-row'))
        if (!naf.value.trim() && nafOf(i.value).length) { naf.value = nafOf(i.value).join(', '); toast('Codes du registre remplis : pense à enregistrer les métiers') }
        return true
    }
    const google = { 'g-sheets': () => ({ sheets: i.checked }), 'g-docs': () => ({ docs: i.checked }) }[i.id]
    if (google) { await runAction(null, () => hostAction('setGoogleOptions', google()), 'Enregistré'); reload(); return true }
    if (onTemplatesChange(i)) return true
    if (i.id === 'auto-follow-ups') { await runAction(null, () => ensureSuccess(api.put('/settings', { autoApproveFollowUps: i.checked })), i.checked ? 'Les relances partiront sans ta validation (si leur texte est propre)' : 'Les relances attendent de nouveau ta validation'); return true }
    if (i.id === 'daily-digest') { await runAction(null, () => ensureSuccess(api.put('/settings', { dailyDigest: i.checked })), i.checked ? 'Chaque matin où quelque chose t\'attend, un résumé arrive dans ta boîte' : 'Plus de résumé par e-mail'); return true }
    if (i.id === 'pause-until') { await runAction(null, () => ensureSuccess(api.put('/settings', { pauseUntil: i.value })), i.value ? "En pause : rien ne sera cherché ni envoyé jusqu'à cette date" : 'DC Prospect reprend'); reload(); return true }
    if (i.id === 'warmup') { await runAction(null, () => ensureSuccess(api.put('/settings', { warmup: { enabled: i.checked } })), i.checked ? 'Montée en charge activée : 5 e-mails par jour cette semaine' : 'Montée en charge désactivée'); reload(); return true }
    if (i.id === 'auto-start') { await runAction(null, () => hostAction('setAutoStart', i.checked), i.checked ? 'Démarre avec Windows' : 'Ne démarre plus avec Windows'); return true }
    return false
}
