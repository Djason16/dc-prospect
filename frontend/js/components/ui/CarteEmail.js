// Card of one e-mail: to approve (editable) or approved (waiting for its time slot)
import { esc } from '../../utils/dom.js'

export function carteEmail(c, modifiable) {
    const meta = [
        `${esc(c.metier)}, ${esc(c.ville)}`, esc(c.email),
        c.siteWeb ? `<a href="${esc(c.siteWeb)}" target="_blank" rel="noopener">${esc(c.siteWeb.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a>` : '',
        c.noteGoogle ? `Google ${esc(c.noteGoogle)}` : '', c.envoyeJ0 ? `1er e-mail le ${esc(c.envoyeJ0)}` : '',
    ].filter(Boolean).join(' · ')
    return `<div class="carte" data-id="${esc(c.id)}" data-etape="${c.etape}">
        <div class="haut"><div><span class="etiquette${c.etape === 'j0' ? '' : ' jaune'}">${esc(c.nomEtape)}</span><strong class="display display-s">${esc(c.entreprise)}</strong></div>
        <a class="btn lien" href="/api/apercu/${encodeURIComponent(c.id)}/${c.etape}" target="_blank">Voir comme le client</a></div>
        <div class="meta">${meta}${c.signal ? `<br>Pourquoi lui : ${esc(c.signal)}` : ''}</div>
        ${modifiable ? `<input type="text" data-objet value="${esc(c.objet)}" aria-label="Objet" ${c.etape === 'j0' ? '' : 'readonly'}>
        <textarea data-corps spellcheck="true" aria-label="Texte de l'e-mail" style="margin-top:.6rem">${esc(c.corps)}</textarea>` : `<p class="muted">Objet : ${esc(c.objet)}</p>`}
        ${c.problemes.length ? `<div class="pb">À corriger : ${esc(c.problemes.join(', '))}</div>` : ''}
        <div class="actions">${modifiable
            ? '<button class="btn primaire" data-brouillon="valider">Valider</button><button class="btn danger" data-brouillon="rejeter">Ne pas envoyer</button>'
            : '<button class="btn petit" data-brouillon="annuler">Annuler la validation</button>'}</div></div>`
}
