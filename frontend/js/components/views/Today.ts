// Home screen: getting started (if needed), what needs me today, e-mails to approve, e-mails waiting for their time slot
import { $, esc } from '../../utils/dom.js'
import { store } from '../../stores/state.js'
import { emailCard } from '../ui/EmailCard.js'
import { sendingBlock, profileBlock, quickZoneBlock } from './settings/blocks.js'
import { engineBlock } from './settings/engine.js'
import { api } from '../../api.js'
import { toast } from '../ui/Toast.js'
import type { MailGuide, ReplyKind, Settings } from '../../types.js'

const sendingReady = (s: Settings): boolean | undefined => (s.accounts?.sendingMode === 'gmail' ? s.accounts.gmail?.configured || s.accounts.google?.connected : s.accounts?.mailbox?.password)
// The formula is chosen and works: with the built-in AI, it is downloaded (or downloading: the templates write meanwhile)
const engineDone = (s: Settings): boolean => {
    const e: Partial<Settings['engine']> = s?.engine || {}
    if (!e.chosen && !s?.accounts?.claude?.connected) return false
    return e.provider === 'local' ? !!(e.local?.installed || e.local?.downloading) : !!e.ready
}
const ready = (s: Settings | null): boolean => !!(s?.profileComplete && s.zonesReady && engineDone(s) && sendingReady(s))
// What DC Prospect needs to work, shown as a checklist during the getting started
const NEEDS: [string, string, (s: Settings) => boolean | undefined][] = [
    ['Ton profil', 'ton nom, ton activité, ce que tu proposes', (s) => s.profileComplete],
    ['Ta zone', 'les départements ou villes où chercher', (s) => s.zonesReady],
    ['Ta formule', "l'IA qui écrit tes e-mails : gratuite (sur ce PC ou Google Gemini) ou ton abonnement Claude", engineDone],
    ["Ton adresse d'envoi", 'ton Gmail ou ta boîte pro, pour envoyer et lire les réponses', (s) => !!sendingReady(s)],
]

export function renderToday(): void {
    const { day, settings } = store
    if (!day) return
    const el = $('#view-today')
    // first render: build the frame once, then only refresh the parts (keeps what I am typing)
    if (!el.dataset.mounted) {
        el.dataset.mounted = '1'
        el.innerHTML = `
        <div class="page-head"><div><p class="label eyebrow" id="day-label"></p><h1 class="display display-l">Aujourd'hui</h1></div>
            <p class="muted">Tu valides, DC Prospect envoie depuis ton adresse aux bons moments, relance et lit les réponses. Rien ne part sans ton accord.</p></div>
        <div id="getting-started"></div><div id="banners"></div>
        <div class="grid g4 section" id="tiles"></div>
        <p class="muted small" id="next-steps" style="margin-top:-1rem"></p>
        <div class="section" id="replies-block"></div>
        <div class="section"><div class="section-head">
            <p class="label eyebrow" style="margin:0">E-mails à valider</p><button class="btn primary" id="approve-all" hidden>Tout valider</button></div>
            <div id="to-approve"></div></div>
        <div class="section"><p class="label eyebrow">Validés, partent au prochain créneau</p><div id="queue"></div></div>
        <details class="section"><summary class="label eyebrow" style="cursor:pointer">Ce que DC Prospect a fait</summary><div id="log" class="small" style="margin-top:1rem"></div></details>`
    }
    $('#day-label').textContent = `${day.today} · zone de la semaine : ${day.zone}`

    // getting started, right here (no need to go to the settings)
    // redrawn only when the step changes (the 15 s refresh must not wipe the fields being filled)
    const step = !settings ? 0 : !settings.profileComplete ? 1 : !settings.zonesReady ? 2 : !engineDone(settings) ? 3 : !sendingReady(settings) ? 4 : 0
    const key = `${step}|${JSON.stringify(settings?.accounts || {})}|${JSON.stringify(settings?.engine || {})}`
    const box = $('#getting-started')
    // getting started just finished: the first search starts now (not tomorrow), once
    if (!step && settings && !settings.firstSearchDone && !store.firstSearchAsked) {
        store.firstSearchAsked = true
        api.post('/prepare').then((r) => { if (r.success) toast('Tout est prêt : DC Prospect cherche tes premiers prospects (quelques minutes). Les premiers e-mails arriveront ici pour que tu les valides.') })
    }
    // step 4: the right sending way and the servers found from my address, once per address
    if (settings && step === 4 && store.autoSetupFor !== settings.sender) {
        store.autoSetupFor = settings.sender
        api.post<{ guide: MailGuide }>('/accounts/auto-setup').then(async (r) => {
            if (!r.success) return
            store.mailGuide = r.guide
            const s = await api.get<Settings>('/settings')
            if (s.success) { store.settings = s; box.dataset.key = ''; renderToday() }
        })
    }
    if (box.dataset.key !== key) box.dataset.key = key, box.innerHTML = step && settings ? `<div class="card" style="border-color:rgba(126,230,168,.35)">
        <p class="label eyebrow">Mise en route, étape ${step} sur 4 : ${['', 'qui tu es', 'où chercher', 'qui écrit tes e-mails', "d'où partent tes e-mails"][step]}</p>
        <div style="display:flex;flex-wrap:wrap;gap:.5rem 1.6rem;margin:.8rem 0 0">${NEEDS.map(([title, text, done], i) => `<span class="small" title="${esc(text)}" style="color:${done(settings) ? 'var(--mint)' : i + 1 === step ? 'var(--paper)' : 'var(--paper-muted)'}">${done(settings) ? '✓' : i + 1}. ${esc(title)}</span>`).join('')}</div>
        <div style="margin-top:1rem">${step === 1 ? profileBlock(settings, { full: false }) : step === 2 ? quickZoneBlock() : step === 3 ? engineBlock(settings, { start: true }) : sendingBlock(settings)}</div>
        <p class="muted small" style="margin:.4rem 0 0">Ensuite, DC Prospect cherche tes prospects tout seul. Tout reste modifiable dans Réglages.</p></div>` : ''

    const banners = []
    // everything is connected: last check, a test e-mail to myself (once)
    if (ready(settings) && !day.testEmailDone) banners.push(`<div class="banner info"><span>Dernière vérification : envoie-toi un e-mail de test, pour voir à quoi ressemblent tes e-mails (signature, expéditeur) avant le premier prospect.</span><button class="btn small" data-test-email>M'envoyer un e-mail de test</button></div>`)
    // the last search found little: why, and what to change
    if (ready(settings) && day.searchAdvice) banners.push(`<div class="banner info"><span>La dernière recherche a trouvé peu de prospects (${day.searchAdvice.found} sur ${day.searchAdvice.examined} entreprises examinées). Pour en trouver plus : ${day.searchAdvice.tips.map(esc).join(' ; ')}.</span><button class="btn small" data-go="settings">Réglages</button></div>`)
    if (day.pauseUntil) banners.push(`<div class="banner info"><span>En pause jusqu'au ${esc(day.pauseUntil)} : rien n'est cherché ni envoyé, les réponses sont toujours lues.</span><button class="btn small" data-pause-off>Reprendre</button></div>`)
    if (day.busy) banners.push(`<div class="banner info"><span><span class="status-dot pending" style="margin-right:.8rem"></span>${esc(day.progress || 'Préparation en cours')}</span></div>`)
    if (day.error && ready(settings)) banners.push(`<div class="banner error"><span>${esc(day.error)}</span><button class="btn small" data-go="settings">Réglages</button></div>`)
    $('#banners').innerHTML = banners.join('')

    const s = day.stats
    $('#tiles').innerHTML = ([
        ['À valider', day.toApprove.length, '', day.toApprove.length > 0],
        ['Réponses', day.replies.length, '', day.replies.length > 0],
        ['Envoyés aujourd\'hui', day.sent, ` / ${day.max}`, false],
        ['Prospects prêts', s.ready, ` / ${s.reserve}`, false],
    ] as [string, number, string, boolean][]).map(([label, n, suffix, accent]): string => `<div class="tile${accent ? ' accent' : ''}"><p class="label">${esc(label)}</p><div class="figure">${n}<small>${esc(suffix)}</small></div></div>`).join('')

    // what happens next, in one sentence
    const approved = day.queue.length
    $('#next-steps').textContent = day.pauseUntil || step ? '' : `Ensuite : ${approved ? `${approved} e-mail(s) validé(s) partent ${day.inWindow ? 'maintenant, un toutes les quelques minutes' : `au prochain créneau (${day.windows})`}` : day.toApprove.length ? `${day.toApprove.length} e-mail(s) t'attendent ci-dessous : une fois validés, ils partent aux créneaux d'envoi` : `prochains e-mails à valider ${day.nextSendDay}`}. ${s.ready ? `${s.ready} prospect(s) prêt(s) en réserve.` : 'DC Prospect cherche de nouveaux prospects les jours de recherche.'} Les réponses sont lues toutes les 15 minutes.`

    // [action, button text, style]
    const KINDS: Record<ReplyKind, string> = { interested: 'Intéressé', question: 'Question', later: 'Plus tard', no: 'Pas intéressé' }
    const TRACK_BUTTONS: [string, string, string][] = [['call', 'Appel prévu', 'primary'], ['proposal', 'Proposition envoyée', ''], ['client', 'Devenu client', ''], ['handled', 'Rien d\'autre', ''], ['declined', 'Pas intéressé', 'danger']]
    // while I write an answer, the 15 s refresh does not redraw the replies
    if (!store.replying) $('#replies-block').innerHTML = day.replies.length ? `<p class="label eyebrow">Ils ont répondu</p>${day.replies.map((r) => `<div class="card" data-reply="${esc(r.id)}">
        <div class="top"><div><span class="tag${r.kind === 'no' ? ' yellow' : ''}">${esc(r.kindLabel || 'Réponse')}</span><strong class="display display-s">${esc(r.company)}</strong></div><span class="muted">${esc(r.city)} · ${esc(r.email)} · ${esc(r.date)}</span></div>
        <blockquote>${esc(r.excerpt)}</blockquote>
        ${r.recontact ? '<p class="muted small">Il t\'avait dit « plus tard » : c\'est le moment de revenir vers lui, dans la même conversation.</p>' : `<p class="muted small">${r.kindConfirmed ? 'Type confirmé.' : 'Type deviné : corrige-le si besoin, DC Prospect apprend de tes corrections.'}
            ${Object.entries(KINDS).map(([k, t]) => `<button class="btn link small" style="${k === r.kind ? 'font-weight:700;text-decoration:underline' : ''}" data-reply-kind="${k}" data-id="${esc(r.id)}">${t}</button>`).join('')}</p>`}
        ${r.answered ? '<p class="small" style="color:var(--mint)">Réponse envoyée depuis DC Prospect.</p>' : r.answer
            ? `<p class="label field">Ma réponse (modifiable, part dans la même conversation)</p><textarea data-answer spellcheck="true">${esc(r.answer.body)}</textarea>
               <div class="actions"><button class="btn primary small" data-reply-send="${esc(r.id)}">Envoyer la réponse</button><button class="btn link small" data-reply-draft="${esc(r.id)}">Proposer une autre réponse</button></div>`
            : `<div class="actions"><button class="btn primary small" data-reply-draft="${esc(r.id)}">Préparer une réponse</button><span class="muted small" style="align-self:center">ou réponds depuis ta messagerie</span></div>`}
        <p class="muted small">Puis dis à DC Prospect ce qui s'est passé : <button class="btn link small" data-reminder="${esc(r.id)}" data-title="Rappeler ${esc(r.company)}" data-details="${esc(`${r.company} (${r.city}) : ${r.email}. Sa réponse : ${r.excerpt}`)}">Ajouter un rappel à mon agenda</button></p>
        <div class="actions">${TRACK_BUTTONS.map(([a, t, c]) => `<button class="btn small ${c}" data-track="${a}" data-id="${esc(r.id)}">${t}</button>`).join('')}</div></div>`).join('')}` : ''

    if (!store.editing) $('#to-approve').innerHTML = day.toApprove.map((x) => emailCard(x, true)).join('') || `<div class="empty">Rien à valider. ${day.stats.ready ? `${day.stats.ready} prospects sont prêts : ils arriveront ici ${esc(day.nextSendDay)}.` : 'DC Prospect cherche des prospects.'}</div>`
    $('#approve-all').hidden = !day.toApprove.length
    $('#queue').innerHTML = day.queue.map((x) => emailCard(x, false)).join('') || `<div class="empty">Rien en attente. Créneaux : ${esc(day.windows)}, le ${esc(day.sendDays)} (Réglages, Avancé, Calendrier).</div>`
    $('#log').innerHTML = day.log.slice(0, 20).map((e) => `<div style="padding:.45rem 0;border-bottom:1px solid var(--line)"><span class="muted">${esc(e.time)}</span> · ${esc(e.text)}</div>`).join('') || '<div class="empty">Rien pour l\'instant.</div>'
}
