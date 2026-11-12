// Reports on the Drive: tracking table (xlsx, opens in Google Sheets), daily report, Friday review.
// Everything written here is read by the user: in French.
import fs from 'node:fs'
import path from 'node:path'
import ExcelJS from 'exceljs'
import { cfg, today, addDays, dateOf, frenchDate, dayName, isoWeek, nextSendDay, log } from './base.mjs'
import { nextStep, toApprove, sendQueue, STEP_NAME } from './prospecting.mjs'
import { usage } from './claude.mjs'
import { zoneOfTheWeek, activeTrades } from './settings.mjs'
import { dailyLimit } from './deliverability.mjs'
import { SUBJECT_STYLES } from './claude.mjs'
import { googleActive, googleOptions, writeSpreadsheet, publishReport } from './google.mjs'

// Status of a prospect as shown in the table
const STATUS_LABEL = {
    ready: 'Prêt (1er e-mail rédigé)', inSequence: 'En séquence', replied: 'A répondu', stopped: 'STOP',
    finished: 'Séquence finie sans réponse', discarded: 'Écarté', otherChannel: 'À contacter autrement', client: 'Client',
}

// Zones of the settings plus those still present in the data (a removed zone keeps its history)
const zoneNames = (state) => [...new Set([...cfg.zones.map((z) => z.name), ...state.prospects.map((p) => p.zone).filter(Boolean)])]

// ---------- Figures (plan, section 6) ----------
export function figures(state, from = '0000-00-00', to = '9999-99-99', zone) {
    const within = (d) => d && d >= from && d <= to
    const ps = state.prospects.filter((p) => !zone || p.zone === zone)
    const emails = ps.reduce((n, p) => n + ['first', 'followUp1', 'followUp2'].filter((s) => within(p.steps?.[s]?.sentOn)).length, 0)
    const contacted = ps.filter((p) => within(p.steps?.first?.sentOn)).length
    const replies = ps.filter((p) => within(p.reply?.date)).length
    const stops = ps.filter((p) => within(p.stoppedOn)).length
    const calls = ps.filter((p) => within(p.tracking?.call)).length
    const proposals = ps.filter((p) => within(p.tracking?.proposal)).length
    const clients = ps.filter((p) => within(p.tracking?.client)).length
    const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)
    return {
        emails, contacted, replies, stops, calls, proposals, clients,
        found: ps.filter((p) => within(p.addedOn) && p.status !== 'discarded').length,
        replyRate: pct(replies, contacted), meetingRate: pct(calls, replies), signingRate: pct(clients, proposals), stopRate: pct(stops, contacted),
    }
}

// Per trade: what the search brings and what replies (to keep the trades that work, drop the others)
export function figuresByTrade(state) {
    const names = [...new Set([...activeTrades().map((t) => t.name), ...state.prospects.map((p) => p.trade).filter(Boolean)])]
    return names.map((trade) => {
        const ps = state.prospects.filter((p) => p.trade === trade)
        const contacted = ps.filter((p) => p.steps?.first).length
        const replies = ps.filter((p) => p.reply && p.reply.kind !== 'no').length
        return {
            trade, found: ps.length, opposed: ps.filter((p) => /refuse la prospection/.test(p.reason || '')).length, toCall: ps.filter((p) => p.status === 'otherChannel').length,
            hot: ps.filter((p) => p.level === 'CHAUD').length, contacted, replies, replyRate: contacted ? Math.round((replies / contacted) * 1000) / 10 : 0,
            clients: ps.filter((p) => p.tracking?.client).length,
        }
    }).filter((r) => r.found)
}

// Per style of subject (A / B, alternated): which one gets more replies
export function figuresBySubject(state) {
    return Object.keys(SUBJECT_STYLES).map((style) => {
        const ps = state.prospects.filter((p) => p.steps?.first && p.drafts?.first?.subjectStyle === style)
        const replies = ps.filter((p) => p.reply && p.reply.kind !== 'no').length
        return { style, contacted: ps.length, replies, replyRate: ps.length ? Math.round((replies / ps.length) * 1000) / 10 : 0 }
    })
}

// [label, figure, goal, reached?, advice]
const GOALS = [
    ['Taux de réponse', 'replyRate', '8 % ou plus', (v) => v >= 8, 'Mieux personnaliser l\'accroche, tester un autre objet'],
    ['Taux de rendez-vous', 'meetingRate', '30 % ou plus', (v) => v >= 30, 'Proposer plus tôt la maquette offerte ou l\'appel de 15 min'],
    ['Taux de signature', 'signingRate', '25 % ou plus', (v) => v >= 25, 'Revoir la proposition et la réponse aux objections'],
    ['Plaintes ou STOP', 'stopRate', 'moins de 2 %', (v) => v < 2, 'Mieux cibler (le besoin doit être visible)'],
]

const percent = (v) => `${String(v).replace('.', ',')} %`

// The three tabs of the tracking table, the same for the Excel file and for Google Sheets
export function tabs(state) {
    const tracked = state.prospects.filter((p) => !['discarded', 'otherChannel'].includes(p.status))
        .sort((a, b) => (b.steps?.first?.sentOn || b.addedOn).localeCompare(a.steps?.first?.sentOn || a.addedOn))
    const monday = addDays(today(), -((dateOf(today()).getDay() + 6) % 7))
    const figureRows = []
    for (const [period, from, to] of [['Cette semaine', monday, addDays(monday, 6)], ['Depuis le début', '0000', '9999']]) {
        for (const zone of [undefined, ...zoneNames(state)]) {
            const f = figures(state, from, to, zone)
            figureRows.push([period, zone || 'Toutes', f.found, f.contacted, f.emails, f.replies, f.calls, f.proposals, f.clients, f.stops,
                percent(f.replyRate), percent(f.meetingRate), percent(f.signingRate), percent(f.stopRate)])
        }
    }
    return [
        {
            title: 'Suivi',
            columns: [
                ['Date', 11], ['Entreprise', 26], ['Métier', 18], ['Ville', 16], ['Zone', 12], ['Contact', 18], ['E-mail pro', 28], ['Source', 16],
                ['Signal', 30], ['Score', 7], ['J0', 11], ['Relance 1', 11], ['Relance 2', 11], ['Réponse', 34], ['Maquette envoyée', 11],
                ['Appel', 11], ['Proposition', 11], ['Résultat', 14], ['STOP', 11], ['Statut', 18], ['Site', 26], ['Note Google', 14], ['Mes notes', 40],
            ],
            rows: tracked.map((p) => [
                frenchDate(p.addedOn), p.company, p.trade, p.city, p.zone, p.contact || '', p.email || '', 'Registre + web',
                p.signal || '', `${p.score ?? ''} ${p.level ? '(' + p.level + ')' : ''}`.trim(),
                frenchDate(p.steps?.first?.sentOn), frenchDate(p.steps?.followUp1?.sentOn), frenchDate(p.steps?.followUp2?.sentOn),
                p.reply ? `${frenchDate(p.reply.date)} : ${p.reply.excerpt}` : '', frenchDate(p.tracking?.mockup), frenchDate(p.tracking?.call),
                frenchDate(p.tracking?.proposal), p.tracking?.client ? 'Client' : (p.tracking?.result || ''), frenchDate(p.stoppedOn), STATUS_LABEL[p.status] || p.status,
                p.website || '', p.googleRating || '', p.notes || '',
            ]),
        },
        {
            title: 'À appeler',
            columns: [
                ['Trouvé le', 11], ['Entreprise', 26], ['Métier', 18], ['Ville', 16], ['Zone', 12], ['Téléphone', 16], ['Instagram / Facebook', 30],
                ['Signal', 34], ['Note Google', 14], ['Score', 7], ['Adresse', 36], ["Accroche pour l'appel", 60],
            ],
            rows: state.prospects.filter((p) => p.status === 'otherChannel').sort((a, b) => (b.score || 0) - (a.score || 0)).map((p) => [
                frenchDate(p.addedOn), p.company, p.trade, p.city, p.zone, p.phone || '', p.instagram || '', p.signal || '', p.googleRating || '', p.score ?? '', p.address || '', p.callHook || '',
            ]),
        },
        {
            title: 'Par métier',
            columns: [['Métier', 22], ['Trouvés', 10], ['Refusent la prospection', 14], ['Chauds', 9], ['À appeler', 10], ['Contactés', 10], ['Réponses', 10], ['Taux de réponse', 12], ['Clients', 9]],
            rows: figuresByTrade(state).map((r) => [r.trade, r.found, r.opposed, r.hot, r.toCall, r.contacted, r.replies, percent(r.replyRate), r.clients])
                .concat(figuresBySubject(state).map((s) => [`Objet ${s.style} (${s.style === 'A' ? 'question' : 'nom + bénéfice'})`, '', '', '', '', s.contacted, s.replies, percent(s.replyRate), ''])),
        },
        {
            title: 'Chiffres',
            columns: [
                ['Période', 16], ['Zone', 14], ['Prospects trouvés', 11], ['Contactés', 11], ['E-mails envoyés', 11], ['Réponses', 10], ['Appels', 9],
                ['Propositions', 12], ['Clients', 9], ['STOP', 8], ['Taux de réponse (obj. 8 %)', 14], ['Taux de RDV (obj. 30 %)', 14],
                ['Taux de signature (obj. 25 %)', 14], ['STOP (obj. < 2 %)', 12],
            ],
            rows: figureRows,
        },
    ]
}

// ---------- Tracking table: Google Sheets when Google is connected, Excel file in the local folder in any case ----------
export async function writeTrackingTable(state) {
    const sheets = tabs(state).filter((t) => t.title !== 'À appeler' || t.rows.length) // the call list only shows when it has someone
    const wb = new ExcelJS.Workbook()
    wb.creator = 'DC Prospect'
    const ink = 'FF111417', mint = 'FF7EE6A8', grey = 'FFD9DEE2'
    for (const { title, columns, rows } of sheets) {
        const ws = wb.addWorksheet(title, { views: [{ state: 'frozen', ySplit: 1 }] })
        ws.columns = columns.map(([header, width]) => ({ header: header.toUpperCase(), width }))
        ws.getRow(1).eachCell((c) => {
            c.font = { bold: true, color: { argb: mint }, name: 'Arial', size: 10 }
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ink } }
            c.alignment = { vertical: 'middle', wrapText: true }
        })
        ws.getRow(1).height = 30
        for (const values of rows) {
            const r = ws.addRow(values)
            r.eachCell({ includeEmpty: true }, (c) => {
                c.font = { name: 'Arial', size: 10 }
                c.alignment = { vertical: 'top', wrapText: true }
                c.border = { bottom: { style: 'thin', color: { argb: grey } }, right: { style: 'thin', color: { argb: grey } } }
            })
        }
        ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }
    }
    let ok = true
    try { await wb.xlsx.writeFile(path.join(cfg.dataFolder, 'Suivi prospection.xlsx')) } catch (e) { ok = false; log('Tableau Excel non écrit (ouvert dans Excel ?) :', e.message) }
    if (googleActive() && googleOptions().sheets) {
        try { await writeSpreadsheet(sheets) } catch (e) { ok = false; log('Google Sheets non mis à jour :', e.message) }
    }
    return ok
}

// ---------- Daily report (and Friday review) ----------
export function writeDailyReport(state, { notes = [] } = {}) {
    const day = today()
    const zone = zoneOfTheWeek()
    const f = figures(state, day, day)
    const events = state.log.filter((e) => e.date.slice(0, 10) === day && e.type !== 'batch')
    const approve = toApprove(state)
    const queue = sendQueue(state)
    const replies = state.prospects.filter((p) => p.status === 'replied' && !p.tracking?.handled)
    const ready = state.prospects.filter((p) => p.status === 'ready' && p.drafts?.first?.status === 'reserved').length
    const upcoming = state.prospects.map((p) => ({ p, n: nextStep(p) })).filter((x) => x.n && x.n.step !== 'first')
    const L = []
    L.push(`# DC Prospect : ${dayName(day)}`, '')
    L.push(`Zone de la semaine ${isoWeek()} : **${zone || 'aucune zone active'}**. Page de validation : http://localhost:${cfg.port}`, '')
    L.push('## À faire par moi')
    if (replies.length) for (const p of replies) L.push(`- **Répondre à ${p.company}** (${p.city}, ${p.email}) : « ${p.reply.excerpt.slice(0, 160)} ».`)
    if (approve.length) L.push(`- **Valider ${approve.length} e-mail(s)** sur la page de validation (envoi ensuite tout seul, ${cfg.sendWindows.map((w) => w.join('-')).join(' ou ')}).`)
    const toCall = state.prospects.filter((p) => p.status === 'otherChannel').sort((x, y) => (y.score || 0) - (x.score || 0))
    if (toCall.length) {
        L.push(`- **${toCall.length} prospect(s) à appeler ou visiter** (pas d'e-mail publié ; liste complète sur la page et dans l'onglet « À contacter autrement »). Les 5 meilleurs :`)
        for (const p of toCall.slice(0, 5)) L.push(`  - ${p.company} (${p.trade}, ${p.city}) : ${p.phone || 'pas de téléphone, passer à ' + (p.address || p.city)}. ${p.callHook ? '« ' + p.callHook + ' »' : ''}`)
    }
    const hot = state.prospects.filter((p) => p.steps?.followUp1 && !p.steps?.followUp2 && p.level === 'CHAUD' && !p.tracking?.mockup)
    if (dateOf(day).getDay() === 3 && hot.length) L.push(`- **Maquette offerte** pour les prospects chauds (prompt « 05 - Maquette de prospection ») : ${hot.map((p) => p.company).join(', ')}.`)
    if (!replies.length && !approve.length && !toCall.length) L.push('- Rien aujourd\'hui.')
    L.push('', '## Ce que l\'outil a fait')
    for (const n of notes) L.push(`- ${n}`)
    for (const e of events) L.push(`- ${new Date(e.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} : ${e.text}`)
    if (!notes.length && !events.length) L.push('- Rien.')
    L.push('', '## État')
    L.push(`- E-mails envoyés aujourd'hui : ${f.emails} / ${dailyLimit(day)}${dailyLimit(day) < cfg.maxEmailsPerDay ? " (montée en charge de l'adresse)" : ''}. En attente d'envoi (validés) : ${queue.length}.`)
    L.push(`- Prospects prêts en réserve : ${ready} / ${cfg.readyReserve}. Prochain jour d'envoi : ${dayName(nextSendDay(addDays(day, 1)))}.`)
    const used = usage(new Date().toISOString().slice(0, 10))
    const searchedToday = state.prospects.filter((p) => p.addedOn === day)
    if (searchedToday.length) L.push(`- Recherche du jour : ${searchedToday.length} entreprises étudiées, ${searchedToday.filter((p) => p.status === 'ready').length} avec e-mail retenues, ${searchedToday.filter((p) => p.status === 'otherChannel').length} à contacter autrement.`)
    if (used.calls) L.push(`- Claude : ${used.calls} appels aujourd'hui (valeur équivalente API : ${String(used.usd).replace('.', ',')} $, compris dans l'abonnement ; si la limite de l'abonnement est atteinte, baisser « Recherches web par jour » dans Réglages, Avancé).`)
    if (upcoming.length) L.push(`- Relances prévues : ${upcoming.slice(0, 15).map(({ p, n }) => `${p.company} (${STEP_NAME[n.step]}, ${frenchDate(n.due)})`).join(' ; ')}${upcoming.length > 15 ? '...' : ''}.`)
    if (dateOf(day).getDay() === 5) L.push('', ...weeklyReview(state))
    const folder = path.join(cfg.dataFolder, 'Rapports', day.slice(0, 4))
    fs.mkdirSync(folder, { recursive: true })
    const file = path.join(folder, `${day} - Rapport.md`)
    fs.writeFileSync(file, L.join('\n') + '\n')
    if (googleActive() && googleOptions().docs) publishReport(`${day} - Rapport`, L.join('\n')).catch((e) => log('Rapport Google Docs non publié :', e.message))
    return file
}

function weeklyReview(state) {
    const day = today()
    const monday = addDays(day, -4)
    const L = [`## Bilan de la semaine (du ${frenchDate(monday)} au ${frenchDate(day)})`, '']
    const week = figures(state, monday, day), all = figures(state)
    L.push('| | Semaine | Depuis le début |', '|---|---|---|')
    for (const [label, k] of [['Prospects trouvés', 'found'], ['Contactés (1er e-mail)', 'contacted'], ['E-mails envoyés', 'emails'], ['Réponses', 'replies'], ['Appels', 'calls'], ['Propositions', 'proposals'], ['Clients', 'clients'], ['STOP', 'stops']])
        L.push(`| ${label} | ${week[k]} | ${all[k]} |`)
    L.push('', '| Indicateur | Depuis le début | Objectif | Verdict |', '|---|---|---|---|')
    for (const [label, k, goal, reached, advice] of GOALS) {
        const v = all[k]
        const base = { replyRate: all.contacted, meetingRate: all.replies, signingRate: all.proposals, stopRate: all.contacted }[k]
        L.push(`| ${label} | ${String(v).replace('.', ',')} % | ${goal} | ${base < 30 && k !== 'signingRate' ? 'pas encore assez d\'e-mails (30 minimum)' : reached(v) ? 'OK' : advice} |`)
    }
    const byZone = zoneNames(state).map((z) => ({ z, f: figures(state, '0000', '9999', z) })).sort((a, b) => b.f.replyRate - a.f.replyRate)
    L.push('', '**Quelle zone répond le mieux ?**', '', '| Zone | Contactés | Réponses | Taux | Clients |', '|---|---|---|---|---|')
    for (const { z, f } of byZone) L.push(`| ${z} | ${f.contacted} | ${f.replies} | ${String(f.replyRate).replace('.', ',')} % | ${f.clients} |`)
    const trades = figuresByTrade(state).sort((a, b) => b.replyRate - a.replyRate || b.found - a.found)
    L.push('', '**Quel métier répond le mieux ?**', '', '| Métier | Trouvés | Refusent la prospection | Contactés | Réponses | Taux |', '|---|---|---|---|---|---|')
    for (const r of trades) L.push(`| ${r.trade} | ${r.found} | ${r.opposed} | ${r.contacted} | ${r.replies} | ${String(r.replyRate).replace('.', ',')} % |`)
    const weak = trades.filter((r) => r.contacted >= 20 && r.replyRate < 2)
    if (weak.length) L.push('', `Conseil : ${weak.map((r) => r.trade).join(', ')} ne répond presque pas après 20 e-mails ou plus : désactive ce métier (Réglages, Avancé, Métiers) ou change l'offre qui lui est proposée.`)
    const subjects = figuresBySubject(state)
    L.push('', "**Quel style d'objet marche le mieux ?**", '', '| Style | Contactés | Réponses | Taux |', '|---|---|---|---|')
    for (const s of subjects) L.push(`| ${s.style} : ${s.style === 'A' ? 'question courte' : 'nom + bénéfice'} | ${s.contacted} | ${s.replies} | ${String(s.replyRate).replace('.', ',')} % |`)
    if (subjects.every((s) => s.contacted >= 30)) {
        const [best, other] = [...subjects].sort((a, b) => b.replyRate - a.replyRate)
        if (best.replyRate - other.replyRate >= 2) L.push('', `L'objet ${best.style} répond mieux (${String(best.replyRate).replace('.', ',')} % contre ${String(other.replyRate).replace('.', ',')} %) : garde-le dans tes prompts.`)
    } else L.push('', 'Comparaison des objets : il faut au moins 30 e-mails de chaque style pour conclure.')
    L.push('', 'Rappel du plan : tester une seule chose à la fois (objet, accroche ou offre) sur au moins 30 e-mails avant de conclure.')
    return L
}
