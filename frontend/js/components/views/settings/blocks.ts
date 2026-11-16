// Blocks of the settings also shown on the home screen (getting started): profile, first zone, sending, deliverability
import { esc } from '../../../utils/dom.js'
import { store } from '../../../stores/state.js'
import type { MailGuide, Settings } from '../../../types.js'
import { VAULT } from '../../../utils/os.js'

export const switchField = (id: string, on: boolean | null | undefined, text: string, disabled = false): string => `<label class="switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''} ${disabled ? 'disabled' : ''}> ${text}</label>`

// Profile: who writes the e-mails (DC Prospect works for anyone: nothing about the user is written in the code)
export function profileBlock(s: Settings, { full = true }: { full?: boolean } = {}): string {
    const p = s.profile || {}
    const field = (id: string, label: string, value: string | undefined, hint = '', type = 'text'): string => `<div><label class="label field" for="pf-${id}">${label}</label><input type="${type}" id="pf-${id}" value="${esc(value || '')}" placeholder="${esc(hint)}"></div>`
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
export function quickZoneBlock(): string {
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
export function deliverabilityBlock(s: Settings): string {
    const w = s.warmup || { limitToday: 0 }
    return `<div class="card"><strong class="display display-s">Délivrabilité</strong>
        <p class="muted small">Pour que tes e-mails arrivent en boîte de réception et pas en spam. Un clic vérifie que ton adresse ${esc(s.sender || '')} est bien réglée et dit quoi demander à ton hébergeur si besoin.</p>
        <div class="actions"><button class="btn small" data-deliverability>Vérifier mon domaine</button></div>
        <div id="deliverability-result" class="small" style="margin-top:.6rem"></div>
        <div style="margin-top:1rem">${switchField('warmup', w.enabled, `Adresse neuve : démarrer doucement (5 e-mails par jour la 1re semaine, puis 5 de plus chaque semaine)${w.enabled ? ` : ${w.limitToday} aujourd'hui` : ''}`)}</div></div>`
}

// Steps for MY provider, found from my address (POST /api/accounts/auto-setup, kept in store.mailGuide)
function mailGuideBlock(g: MailGuide | undefined, done: boolean | undefined): string {
    if (!g || done) return ''
    return `<div class="tile" style="margin:.6rem 0 1rem;border-color:rgba(126,230,168,.35)"><p class="label">Pour ton adresse${g.name ? ` (${esc(g.name)})` : ''}</p>
        <ol class="small" style="padding-left:1.2rem;margin:.4rem 0 0">${g.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
        ${g.warning ? `<p class="small" style="margin:.5rem 0 0;color:var(--yellow)">${esc(g.warning)}</p>` : ''}</div>`
}

export function sendingBlock(s: Settings): string {
    const a = s.accounts || {}, gmail = a.gmail || { configured: false }, mailbox = a.mailbox || { password: false }
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
        : `<p class="small">${mailbox.password ? `Mot de passe de ${esc(s.sender)} enregistré (chiffré par ${VAULT} sur ce PC). Serveur : ${esc(s.mailbox.smtpHost)}.` : `Tape le mot de passe de ${esc(s.sender)} (serveur ${esc(s.mailbox.smtpHost || "à choisir dans Avancé")}). Boîte perso (Orange, SFR, Free, Yahoo, Outlook...) : choisis ton fournisseur dans Avancé ; certains demandent un mot de passe d'application.`}</p>
           ${mailbox.password ? '' : `<div class="actions" style="margin:.2rem 0 .6rem"><button class="btn small" data-detect-mail>Trouver mon serveur tout seul</button><span class="muted small" style="align-self:center">à partir de ton adresse, sans rien taper de technique</span></div>`}
           <input type="password" id="mailbox-password" placeholder="Mot de passe de ${esc(s.sender)}" autocomplete="off">
           <div class="actions"><button class="btn primary small" data-password>Enregistrer et tester</button>${mailbox.password ? '<button class="btn link small" data-test-email>M\'envoyer un e-mail de test</button><button class="btn link small" data-host="forgetPassword">Oublier</button>' : ''}</div>`}
    </div></div>`
}
