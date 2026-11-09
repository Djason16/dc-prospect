// Card of one e-mail: to approve (editable) or approved (waiting for its time slot)
import { esc } from '../../utils/dom.js'

export function emailCard(c, editable) {
    const meta = [
        `${esc(c.trade)}, ${esc(c.city)}`, esc(c.email),
        c.website ? `<a href="${esc(c.website)}" target="_blank" rel="noopener">${esc(c.website.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a>` : '',
        c.googleRating ? `Google ${esc(c.googleRating)}` : '', c.firstSentOn ? `1er e-mail le ${esc(c.firstSentOn)}` : '',
    ].filter(Boolean).join(' · ')
    return `<div class="card" data-id="${esc(c.id)}" data-step="${c.step}">
        <div class="top"><div><span class="tag${c.step === 'first' ? '' : ' yellow'}">${esc(c.stepName)}</span><strong class="display display-s">${esc(c.company)}</strong></div>
        <a class="btn link" href="/api/preview/${encodeURIComponent(c.id)}/${c.step}" target="_blank">Voir comme le client</a></div>
        <div class="meta">${meta}${c.signal ? `<br>Pourquoi lui : ${esc(c.signal)}` : ''}</div>
        ${editable ? `<input type="text" data-subject value="${esc(c.subject)}" aria-label="Objet" ${c.step === 'first' ? '' : 'readonly'}>
        <textarea data-body spellcheck="true" aria-label="Texte de l'e-mail" style="margin-top:.6rem">${esc(c.body)}</textarea>` : `<p class="muted">Objet : ${esc(c.subject)}</p>`}
        ${c.problems.length ? `<div class="problem">À corriger : ${esc(c.problems.join(', '))}</div>` : ''}
        <div class="actions">${editable
            ? '<button class="btn primary" data-draft="approve">Valider</button><button class="btn danger" data-draft="reject">Ne pas envoyer</button>'
            : '<button class="btn small" data-draft="cancel">Annuler la validation</button>'}</div></div>`
}
