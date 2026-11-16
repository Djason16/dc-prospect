// Settings, simple first: profile, how DC Prospect works (settings/engine.ts), sending; the rest folded in "Avancé".
// The blocks also shown on the home screen are in settings/blocks.ts
import { $, $$, esc } from '../../utils/dom.js'
import { store } from '../../stores/state.js'
import { api, ensureSuccess, hostAction } from '../../api.js'
import { runAction, toast, confirmClick } from '../ui/Toast.js'
import { engineBlock, onEngineClick } from './settings/engine.js'
import { calendarBlock, slotRow } from './settings/calendar.js'
import { diagnosisHtml } from './settings/diagnosis.js'
import { templatesSection, loadTemplates, onTemplatesClick, onTemplatesChange } from './settings/templates.js'
import { switchField, profileBlock, quickZoneBlock, deliverabilityBlock, sendingBlock } from './settings/blocks.js'
import type { DomainCheck, MailHost, Settings, Trade, Zone } from '../../types.js'
import { OS_NAME } from '../../utils/os.js'
import { TRADE_NAF, nafOf } from '../../data/trades.js'
import { activityExample } from '../../data/activities.js'

// Mail hosts ready to use: change of host = pick it here and type the password again
// key: [name shown, SMTP server, SMTP port, IMAP server, IMAP port]
const MAIL_HOSTS: Record<string, [string, string, number, string, number]> = {
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

export async function loadSettings(): Promise<void> {
    const r = await api.get<Settings>('/settings')
    if (!r.success) return toast(r.error, true)
    store.settings = r
    if (store.view === 'settings') renderSettings()
}

// ---------- The page ----------
export function renderSettings(): void {
    const s = store.settings
    if (!s) return
    const a = s.accounts || {}, g = a.google, inApp = s.inApp, mb = s.mailbox
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
            ${switchField('auto-start', s.autoStart, `Démarrer avec ${OS_NAME}`, !inApp)}
            ${switchField('daily-digest', s.dailyDigest, 'M\'envoyer un résumé par e-mail le matin')}
            <span class="pause-field"><label class="small" for="pause-until">Pause (vacances) jusqu'au</label><input type="date" id="pause-until" value="${esc(s.pauseUntil || '')}">${s.pauseUntil ? '<button class="btn link small" data-pause-off>Reprendre</button>' : ''}</span>
            <span class="muted small">${a.update ? `Une mise à jour est disponible : ${esc(a.update.version)}.` : 'Mises à jour : DC Prospect regarde tout seul s\'il y a une nouvelle version (au démarrage, puis toutes les 3 heures).'}</span>
        </div>
        <div class="actions">${a.update ? `<button class="btn primary small" data-host="installUpdate">Mettre à jour</button><button class="btn small" data-open="${esc(a.update.page || 'https://github.com/Djason16/dc-prospect/releases/latest')}">Voir les nouveautés</button>` : ''}<button class="btn small" data-open="data">Ouvrir le dossier (tableau, rapports)</button><button class="btn link small" data-host="quit">Quitter l'application</button></div>
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
        ${([['maxSearchesPerDay', 'Recherches web par jour', 'Une recherche = un métier dans une ville (jusqu\'à 6 entreprises avec e-mail). Baisse si ton abonnement ou ton quota sature.'], ['readyReserve', 'Réserve de prospects prêts', '1ers e-mails rédigés d\'avance'], ['maxEmailsPerDay', 'E-mails par jour au maximum', 'Plan : 20']] as [VolumeKey, string, string][])
            .map(([k, label, hint]) => `<div class="tile"><p class="label">${label}</p><input type="number" min="0" data-volume="${k}" value="${esc(s[k as VolumeKey])}" style="margin:.7rem 0 .4rem;font-size:1.4rem"><p class="muted small" style="margin:0">${hint}</p></div>`).join('')}
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
        <p class="small">${g?.connected ? `Connecté : ${esc(g.email)}` : ''}${g?.folder ? ` · <a href="${esc(g.folder)}" target="_blank">Dossier</a>` : ''}${g?.spreadsheet ? ` · <a href="${esc(g.spreadsheet)}" target="_blank">Tableau</a>` : ''}</p>
        ${g?.connected ? `<div class="switch-row">${switchField('g-sheets', g.options?.sheets, 'Tableau dans Google Sheets')}${switchField('g-docs', g.options?.docs, 'Rapports en Google Docs')}</div>` : ''}
        <div class="actions">${!inApp ? '' : !g?.client ? '<button class="btn small" data-host="importGoogleClient">Importer le fichier client</button>' : g.connected ? '<button class="btn small" data-host="disconnectGoogle">Se déconnecter de Google</button>' : '<button class="btn primary small" data-google>Se connecter à Google</button><button class="btn link small" data-host="importGoogleClient">Changer le fichier client</button>'}</div></div>

    <div class="section"><p class="label eyebrow">Fichiers et outils</p>
        <p class="muted small">Données, tableau et rapports : ${esc(a.folder || s.dataFolder)}</p>
        <div class="actions"><button class="btn small" data-open="reports">Rapports</button><button class="btn small" data-open="logs">Journaux</button><button class="btn link small" data-host="chooseFolder">Changer de dossier</button><button class="btn link small" data-host="declareMcp">Déclarer le MCP dans Claude Code</button><button class="btn link small" data-host="checkUpdate">Chercher une mise à jour</button></div></div>
    </details>`
    // my e-mail templates: read when the section is opened
    $<HTMLDetailsElement>('#templates-section')?.addEventListener('toggle', (e) => { if ((e.target as HTMLDetailsElement).open) loadTemplates() })
}

type VolumeKey = 'maxSearchesPerDay' | 'readyReserve' | 'maxEmailsPerDay'

const zoneRow = (z: Zone): string => `<div class="zone-row"><input type="text" data-k="name" value="${esc(z.name)}" aria-label="Nom" placeholder="Nom de la zone"><input type="text" data-k="departments" value="${esc((z.departments || []).join(', '))}" aria-label="Départements" placeholder="Départements"><input type="text" data-k="postalCodes" value="${esc((z.postalCodes || []).join(', '))}" aria-label="Codes postaux" placeholder="Codes postaux"><label class="switch"><input type="checkbox" data-k="active" ${z.active !== false ? 'checked' : ''}></label><button class="btn link small" data-remove>Supprimer</button></div>`
const tradeRow = (t: Trade, yieldRate?: number): string => `<div class="trade-row"><input type="text" data-k="name" value="${esc(t.name)}" aria-label="Métier" list="trade-names" placeholder="Commence à taper : coiffure, plombier..."><input type="text" data-k="naf" value="${esc((t.naf || []).join(', '))}" aria-label="Codes NAF" placeholder="Codes NAF"><div class="gauge" title="${yieldRate ? Math.round(yieldRate * 100) + ' %' : ''}"><span style="width:${Math.round((yieldRate || 0) * 100)}%"></span></div><label class="switch"><input type="checkbox" data-k="active" ${t.active !== false ? 'checked' : ''}></label><button class="btn link small" data-remove>Supprimer</button></div>`
// rows of zones or trades as typed (checked and cleaned by the engine)
const readRows = (selector: string): Record<string, string | boolean>[] => $$(selector + ' > div').map((row) => Object.fromEntries($$<HTMLInputElement>('[data-k]', row).map((i) => [i.dataset.k, i.type === 'checkbox' ? i.checked : i.value])))

// ---------- Clicks and switches of the accounts and settings (also used by the home screen) ----------
export async function onSettingsClick(b: HTMLButtonElement, reload: () => Promise<unknown>): Promise<unknown> {
    const settings = store.settings as Settings // the settings view and the getting started are drawn from them
    if (b.hasAttribute('data-profile')) {
        const d: Record<string, string> = {}
        for (const k of ['firstName', 'lastName', 'address', 'activity', 'city', 'company', 'website', 'phone', 'title', 'bookingUrl', 'offer', 'need', 'mainSignature', 'secondSignature', 'secondSignatureName']) { const i = $<HTMLInputElement>('#pf-' + k); if (i) d[k] = i.value }
        await runAction(b, () => ensureSuccess(api.put('/settings', { profile: d })), 'Profil enregistré')
        return reload()
    }
    // Example for my activity: offer, signs of a need, trades worth prospecting (to change afterwards)
    if (b.hasAttribute('data-activity-example')) {
        const card = b.closest('.card') as HTMLElement, ex = activityExample($<HTMLInputElement>('#pf-activity', card)?.value)
        if (!ex) { toast('Tape d\'abord ton activité (photographe, graphiste, développeur web...) : je propose un exemple qui lui correspond', true); return true }
        const offer = $<HTMLTextAreaElement>('#pf-offer', card), need = $<HTMLTextAreaElement>('#pf-need', card)
        if (!offer.value.trim() || confirmClick(b, 'Remplacer mon texte')) offer.value = ex.offer; else return true
        if (need && !need.value.trim()) need.value = ex.need
        $('#activity-trades', card).innerHTML = `<p class="small" style="margin:.4rem 0">Métiers conseillés pour ton activité : ${ex.trades.map(esc).join(', ')}. <button class="btn link small" data-use-trades="${esc(ex.trades.join('|'))}">Prospecter ces métiers</button></p>`
        toast('Exemple rempli : adapte-le (tes vrais prix) puis enregistre ton profil')
        return true
    }
    if (b.dataset.useTrades) {
        const names = b.dataset.useTrades.split('|')
        const trades = [...names.map((name) => ({ name, naf: nafOf(name), active: true })), ...(settings.trades || []).filter((t) => !names.includes(t.name)).map((t) => ({ ...t, active: false }))]
        await runAction(b, () => ensureSuccess(api.put('/settings', { trades })), 'Métiers choisis : les autres sont désactivés (Réglages, Avancé, Métiers)')
        return true
    }
    if (b.hasAttribute('data-zone-around')) {
        const card = b.closest('.card') as HTMLElement, town = $<HTMLInputElement>('#za-town', card).value.trim()
        if (!town) { toast('Tape d\'abord ta ville', true); return true }
        await runAction(b, () => ensureSuccess(api.post<{ zone: Zone; towns: number }>('/zones/around', { town, km: $<HTMLInputElement>('#za-km', card).value })), (r) => `Zone créée : ${r.zone.name}, ${r.towns} communes`)
        return reload()
    }
    if (b.hasAttribute('data-quick-zone')) {
        const codes = $<HTMLInputElement>('#qz-codes').value.split(/[\s,;]+/).filter(Boolean)
        const zone: Zone = { name: $<HTMLInputElement>('#qz-name').value || codes.join(', '), departments: codes.filter((c) => c.length <= 3), postalCodes: codes.filter((c) => c.length === 5), active: true }
        await runAction(b, () => ensureSuccess(api.put('/settings', { zones: [...(settings.zones || []), zone] })), 'Zone enregistrée')
        return reload()
    }
    if (b.dataset.mode) { await runAction(b, () => ensureSuccess(api.put('/accounts/sending-mode', { mode: b.dataset.mode }))); return reload() }
    if (b.hasAttribute('data-gmail')) { await runAction(b, () => ensureSuccess(api.post('/accounts/gmail', { address: $<HTMLInputElement>('#gmail-address').value, password: $<HTMLInputElement>('#gmail-password').value })), 'Gmail branché : les e-mails partiront par ton Gmail en tant que contact@'); return reload() }
    if (b.hasAttribute('data-gmail-forget')) { await runAction(b, () => ensureSuccess(api.delete('/accounts/gmail')), 'Gmail débranché'); return reload() }
    if (b.hasAttribute('data-test-email')) { await runAction(b, () => ensureSuccess(api.post<{ to: string }>('/accounts/test-email')), (r) => `E-mail de test envoyé à ${r.to} : vérifie que l'expéditeur affiché est contact@`); return true }
    if (b.hasAttribute('data-pause-off')) { await runAction(b, () => ensureSuccess(api.put('/settings', { pauseUntil: '' })), 'DC Prospect reprend'); return reload() }
    if (b.hasAttribute('data-detect-mail')) {
        const r = await runAction(b, () => ensureSuccess(api.post<{ host: MailHost | null }>('/accounts/detect-mail')))
        const h = r?.host
        if (!r) return true
        if (!h) { toast('Hébergeur pas reconnu : choisis-le dans Avancé, « Adresse d\'envoi et serveur de ta boîte »', true); return true }
        if (h.gmail) { toast(`${h.name} : le plus simple est « Par mon Gmail » (bouton au-dessus)`); return true }
        const mb = settings.mailbox
        await runAction(b, () => ensureSuccess(api.put('/settings', { mailbox: { name: mb.name, address: mb.address, smtpHost: h.smtpHost, smtpPort: h.smtpPort, imapHost: h.imapHost, imapPort: h.imapPort } })), `${h.name} trouvé : serveur rempli, tape maintenant ton mot de passe`)
        return reload()
    }
    if (b.hasAttribute('data-password')) {
        const password = $<HTMLInputElement>('#mailbox-password').value
        if (!password) { toast('Tape d\'abord le mot de passe', true); return true }
        await runAction(b, () => ensureSuccess(api.post('/accounts/password', { password })), 'Mot de passe enregistré, connexion réussie')
        return reload()
    }
    if (b.hasAttribute('data-check')) {
        $('#check-result').textContent = 'Vérification (30 secondes environ)...'
        const r = await runAction(b, () => ensureSuccess(api.post<{ results: Record<string, string> }>('/accounts/check')))
        if (r) $('#check-result').innerHTML = diagnosisHtml(r.results)
        return true
    }
    if (b.hasAttribute('data-google')) {
        toast('Ton navigateur s\'ouvre sur la page Google : connecte-toi, accepte, puis reviens ici.')
        await runAction(b, () => hostAction<{ email: string }>('connectGoogle', { canRead: false }), (status) => `Google connecté : ${status.email}`)
        return reload()
    }
    if (await onEngineClick(b, reload)) return true
    if (await onTemplatesClick(b)) return true
    if (b.hasAttribute('data-deliverability')) {
        const r = await runAction(b, () => ensureSuccess(api.post<{ result: DomainCheck }>('/accounts/deliverability')))
        if (r) {
            const d = r.result
            const flag = (label: string, ok: boolean | undefined): string => `<span style="margin-right:1rem;color:${ok ? 'var(--mint)' : 'var(--red)'}">${label} ${ok ? 'OK' : 'manquant'}</span>`
            $('#deliverability-result').innerHTML = (d.webmail ? '' : `<p>${flag('MX', d.mx)}${flag('SPF', d.spf)}${flag('DKIM', d.dkim)}${flag('DMARC', d.dmarc)}</p>`) + d.advice.map((a) => `<p class="muted">${esc(a)}</p>`).join('')
        }
        return true
    }
    if (b.hasAttribute('data-add-zone')) { $('#zones').insertAdjacentHTML('beforeend', zoneRow({ name: '', departments: [], postalCodes: [], active: true })); return true }
    if (b.hasAttribute('data-add-trade')) { $('#trades').insertAdjacentHTML('beforeend', tradeRow({ name: '', naf: [], active: true })); return true }
    if (b.hasAttribute('data-remove')) { b.closest('.zone-row, .trade-row')?.remove(); return true }
    if (b.hasAttribute('data-add-slot')) { $('#slots').insertAdjacentHTML('beforeend', slotRow(['', ''])); return true }
    if (b.hasAttribute('data-remove-slot')) { b.closest('.slot')?.remove(); return true }
    if (b.dataset.save) {
        const k = b.dataset.save
        let d: Record<string, unknown> = {}
        if (k === 'zones') d = { zones: readRows('#zones') }
        if (k === 'trades') d = { trades: readRows('#trades') }
        if (k === 'volumes') { const v: Record<string, number> = {}; $$<HTMLInputElement>('[data-volume]').forEach((i) => (v[i.dataset.volume as string] = Number(i.value))); d = v }
        if (k === 'calendar') d = {
            searchDays: $$<HTMLInputElement>('[data-search-day]').filter((i) => i.checked).map((i) => Number(i.dataset.searchDay)),
            sendDays: $$<HTMLInputElement>('[data-send-day]').filter((i) => i.checked).map((i) => Number(i.dataset.sendDay)),
            firstEmailsPerDay: Object.fromEntries($$<HTMLInputElement>('[data-first-emails]').map((i) => [i.dataset.firstEmails, Number(i.value)])),
            sendWindows: $$('#slots .slot').map((row) => [$<HTMLInputElement>('[data-slot=start]', row).value, $<HTMLInputElement>('[data-slot=end]', row).value]),
            followUpDays: { first: Number(field('#cal-first')), second: Number(field('#cal-second')) },
            gapMinutes: [Number(field('#cal-gap-min')), Number(field('#cal-gap-max'))],
            skipHolidays: $<HTMLInputElement>('#cal-holidays').checked,
        }
        if (k === 'mailbox') d = { mailbox: { name: field('#mb-name'), address: field('#mb-address'), smtpHost: field('#mb-smtp'), smtpPort: field('#mb-smtp-port'), imapHost: field('#mb-imap'), imapPort: field('#mb-imap-port') } }
        const r = await runAction(b, () => ensureSuccess(api.put<{ settings: Settings }>('/settings', d)), 'Enregistré')
        if (r) { store.settings = { ...settings, ...r.settings }; renderSettings(); if (['trades', 'zones', 'volumes', 'calendar', 'mailbox'].includes(k)) $<HTMLDetailsElement>('.advanced').open = true }
        return true
    }
    return false
}

// value of a field of the settings page
const field = (selector: string): string => $<HTMLInputElement>(selector).value

export async function onSettingsChange(i: HTMLInputElement, reload: () => Promise<unknown>): Promise<boolean> {
    if (i.id === 'mail-host' && MAIL_HOSTS[i.value]) {
        const [, smtp, smtpPort, imap, imapPort] = MAIL_HOSTS[i.value]
        const domain = (field('#mb-address').split('@')[1] || 'ton-domaine.fr')
        $<HTMLInputElement>('#mb-smtp').value = smtp.replace('{domain}', domain); $<HTMLInputElement>('#mb-smtp-port').value = String(smtpPort)
        $<HTMLInputElement>('#mb-imap').value = imap.replace('{domain}', domain); $<HTMLInputElement>('#mb-imap-port').value = String(imapPort)
        toast('Serveur rempli : clique sur « Enregistrer l\'adresse et le serveur »')
        return true
    }
    // a known trade typed: its NAF codes are filled
    if (i.dataset.k === 'name' && i.closest('.trade-row')) {
        const naf = $<HTMLInputElement>('[data-k=naf]', i.closest('.trade-row') as HTMLElement)
        if (!naf.value.trim() && nafOf(i.value).length) { naf.value = nafOf(i.value).join(', '); toast('Codes du registre remplis : pense à enregistrer les métiers') }
        return true
    }
    const googleOptions: Record<string, () => { sheets?: boolean; docs?: boolean }> = { 'g-sheets': () => ({ sheets: i.checked }), 'g-docs': () => ({ docs: i.checked }) }
    const google = googleOptions[i.id]
    if (google) { await runAction(null, () => hostAction('setGoogleOptions', google()), 'Enregistré'); reload(); return true }
    if (onTemplatesChange(i)) return true
    if (i.id === 'auto-follow-ups') { await runAction(null, () => ensureSuccess(api.put('/settings', { autoApproveFollowUps: i.checked })), i.checked ? 'Les relances partiront sans ta validation (si leur texte est propre)' : 'Les relances attendent de nouveau ta validation'); return true }
    if (i.id === 'daily-digest') { await runAction(null, () => ensureSuccess(api.put('/settings', { dailyDigest: i.checked })), i.checked ? 'Chaque matin où quelque chose t\'attend, un résumé arrive dans ta boîte' : 'Plus de résumé par e-mail'); return true }
    if (i.id === 'pause-until') { await runAction(null, () => ensureSuccess(api.put('/settings', { pauseUntil: i.value })), i.value ? "En pause : rien ne sera cherché ni envoyé jusqu'à cette date" : 'DC Prospect reprend'); reload(); return true }
    if (i.id === 'warmup') { await runAction(null, () => ensureSuccess(api.put('/settings', { warmup: { enabled: i.checked } })), i.checked ? 'Montée en charge activée : 5 e-mails par jour cette semaine' : 'Montée en charge désactivée'); reload(); return true }
    if (i.id === 'auto-start') { await runAction(null, () => hostAction('setAutoStart', i.checked), i.checked ? `Démarre avec ${OS_NAME}` : `Ne démarre plus avec ${OS_NAME}`); return true }
    return false
}
