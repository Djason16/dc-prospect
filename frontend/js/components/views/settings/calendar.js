// Calendar of the settings: research days, sending days and their first e-mails, time slots, follow-ups, rhythm, holidays
import { esc } from '../../../utils/dom.js'

const switchField = (id, on, text) => `<label class="switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}> ${text}</label>`

// ---------- Calendar: research days, sending days and their first e-mails, time slots, follow-ups, rhythm, holidays ----------
// [day of the week (0 = Sunday), name shown]
const DAYS = [[1, 'Lundi'], [2, 'Mardi'], [3, 'Mercredi'], [4, 'Jeudi'], [5, 'Vendredi'], [6, 'Samedi'], [0, 'Dimanche']]
export const slotRow = ([start, end]) => `<div class="slot" style="display:flex;gap:.7rem;align-items:center;margin-bottom:.5rem"><input type="time" data-slot="start" value="${esc(start)}" style="width:9rem"><span class="muted">à</span><input type="time" data-slot="end" value="${esc(end)}" style="width:9rem"><button class="btn link small" data-remove-slot>Supprimer</button></div>`

export function calendarBlock(s) {
    const sendDays = s.sendDays || [2, 3, 4], searchDays = s.searchDays || [1, 2, 3, 4, 5]
    return `<div class="section"><p class="label eyebrow">Calendrier</p>
        <p class="muted">Quand DC Prospect cherche, quand il envoie, et à quel rythme. Les réponses et les STOP, eux, sont lus tous les jours, toutes les 15 minutes.</p>
        <div class="grid g2">
            <div class="tile"><p class="label">Jours de recherche</p><p class="muted small">Recherche de prospects et rédaction des 1ers e-mails</p>
                <div style="display:flex;flex-wrap:wrap;gap:.8rem 1.4rem;margin-top:.7rem">${DAYS.map(([d, name]) => `<label class="switch"><input type="checkbox" data-search-day="${d}" ${searchDays.includes(d) ? 'checked' : ''}> ${name}</label>`).join('')}</div></div>
            <div class="tile"><p class="label">Jours d'envoi et 1ers e-mails par jour</p><p class="muted small">Les relances dues partent ces jours-là en premier ; puis les 1ers e-mails, jusqu'au maximum par jour</p>
                <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:.6rem 1.4rem;margin-top:.7rem">${DAYS.map(([d, name]) => `<div style="display:flex;align-items:center;gap:.7rem"><label class="switch" style="min-width:8.5rem"><input type="checkbox" data-send-day="${d}" ${sendDays.includes(d) ? 'checked' : ''}> ${name}</label><input type="number" min="0" max="40" data-first-emails="${d}" value="${esc(s.firstEmailsPerDay?.[d] ?? 0)}" title="1ers e-mails le ${name.toLowerCase()}" style="width:5rem;padding:.4rem .6rem"></div>`).join('')}</div></div>
            <div class="tile"><p class="label">Créneaux d'envoi</p><p class="muted small">Heures où les e-mails validés partent (les mêmes pour chaque jour d'envoi)</p>
                <div id="slots" style="margin-top:.7rem">${(s.sendWindows || []).map(slotRow).join('')}</div>
                <button class="btn small" data-add-slot>Ajouter un créneau</button></div>
            <div class="tile"><p class="label">Relances et rythme</p>
                <div style="display:grid;grid-template-columns:auto 6rem;gap:.6rem 1rem;align-items:center;margin-top:.7rem">
                    <span>Relance 1 : jours après le 1er e-mail</span><input type="number" min="1" max="30" id="cal-first" value="${esc(s.followUpDays?.first ?? 4)}">
                    <span>Relance 2 : jours après le 1er e-mail</span><input type="number" min="2" max="60" id="cal-second" value="${esc(s.followUpDays?.second ?? 11)}">
                    <span>Écart entre deux e-mails : minimum (minutes)</span><input type="number" min="1" max="60" id="cal-gap-min" value="${esc(s.gapMinutes?.[0] ?? 2)}">
                    <span>Écart entre deux e-mails : maximum (minutes)</span><input type="number" min="1" max="60" id="cal-gap-max" value="${esc(s.gapMinutes?.[1] ?? 4)}">
                </div>
                <div style="margin-top:1rem">${switchField('cal-holidays', s.skipHolidays !== false, 'Ne rien chercher ni envoyer les jours fériés')}</div>
                <div style="margin-top:.6rem">${switchField('auto-follow-ups', s.autoApproveFollowUps, 'Relances validées toutes seules (sans faute dans le texte)')}</div>
                <p class="muted small" style="margin:.3rem 0 0">Les premiers e-mails restent toujours validés par toi ; une relance avec un problème dans le texte attend ta validation.</p>
                <p class="muted small" style="margin:.6rem 0 0">Une relance qui tombe un jour sans envoi part au jour d'envoi suivant.</p></div>
        </div>
        <div class="actions"><button class="btn primary small" data-save="calendar">Enregistrer le calendrier</button></div></div>`
}
