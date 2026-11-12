// « Mes modèles d'e-mails » (Réglages, Avancé): the texts used when the templates write (without AI, or polished by
// the built-in AI), edited here without touching any file. Saved in the data folder: all my PCs use them.
import { $, esc } from '../../../utils/dom.js'
import { api, ensureSuccess } from '../../../api.js'
import { runAction } from '../../ui/Toast.js'

const VARIABLES = [
    ['{{BONJOUR}}', '« Bonjour Sylvie, » ou « Bonjour, »'], ['{{ENTREPRISE}}', 'nom du prospect'], ['{{RECHERCHE}}', '« coiffure Compiègne » sur Google'],
    ['{{CONSTAT}}', 'ce qui a été vérifié sur son site'], ['{{ACCROCHE}}', 'ce que l\'entreprise dit d\'elle'], ['{{CONSEIL}}', 'un conseil lié au constat (relance)'],
    ['{{NOM}} {{ACTIVITE}} {{MA_VILLE}}', 'ton profil'], ['{{OFFRE}}', 'la 1re ligne de ce que tu proposes'], ['{{RESERVATION}}', 'ton lien de rendez-vous'],
    ['{phrase 1|phrase 2}', 'une des phrases au hasard'],
]
let list = []

export const templatesSection = () => `<details class="section" id="templates-section"><summary class="label eyebrow" style="cursor:pointer">Mes modèles d'e-mails</summary>
    <p class="muted" style="margin-top:.8rem">Les textes utilisés quand les e-mails sont écrits sans IA, ou rendus naturels par l'IA intégrée. Modifie-les à ton goût : ils sont gardés dans ton dossier de données, pour tous tes PC.</p>
    <div id="templates-editor" class="muted small">Chargement...</div></details>`

function editor() {
    if (!list.length) return '<p class="muted small">Modèles introuvables.</p>'
    return `<div class="grid g2"><div>
        <select id="template-name">${list.map((t) => `<option value="${t.name}">${esc(t.label)}${t.custom ? ' (modifié)' : ''}</option>`).join('')}</select>
        <textarea id="template-text" style="min-height:260px;margin-top:.6rem;font-family:inherit"></textarea>
        <div class="actions"><button class="btn primary small" data-template-save>Enregistrer</button><button class="btn link small" data-template-reset>Remettre l'original</button></div></div>
        <div class="tile"><p class="label">Mots remplis tout seuls</p>${VARIABLES.map(([k, t]) => `<p class="small" style="margin:.25rem 0"><code>${esc(k)}</code> ${esc(t)}</p>`).join('')}
        <p class="muted small" style="margin-top:.6rem">Ta signature et la phrase de désinscription sont ajoutées à l'envoi. Finis par « Bien à vous, ».</p></div></div>`
}

const show = () => { const t = list.find((x) => x.name === $('#template-name').value) || list[0]; $('#template-text').value = t?.text || '' }

// Loaded when the section opens
export async function loadTemplates() {
    const r = await api.get('/templates')
    if (!r.success) return
    list = r.templates
    const keep = $('#template-name')?.value
    $('#templates-editor').innerHTML = editor()
    if (keep) $('#template-name').value = keep
    show()
}

export async function onTemplatesClick(b) {
    const name = $('#template-name')?.value
    if (b.hasAttribute('data-template-save')) {
        const r = await runAction(b, () => ensureSuccess(api.put('/templates', { name, text: $('#template-text').value })), 'Modèle enregistré : il sert dès le prochain e-mail')
        if (r) { list = r.templates; await loadTemplates() }
        return true
    }
    if (b.hasAttribute('data-template-reset')) {
        const r = await runAction(b, () => ensureSuccess(api.put('/templates', { name, text: null })), 'Modèle d\'origine remis')
        if (r) { list = r.templates; await loadTemplates() }
        return true
    }
    return false
}

export function onTemplatesChange(i) {
    if (i.id !== 'template-name') return false
    show()
    return true
}
