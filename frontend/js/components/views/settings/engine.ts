// "How DC Prospect works": four simple formulas (free on this PC, free online with Google Gemini, my Claude subscription, an API key),
// and the options for those who want to go further, folded. Used by Settings and by the getting started (Today).
import { $, esc } from '../../../utils/dom.js'
import { store } from '../../../stores/state.js'
import { api, ensureSuccess, hostAction } from '../../../api.js'
import { runAction, toast } from '../../ui/Toast.js'
import type { ClaudeStatus, EngineSettings, SampleEmail, Settings } from '../../../types.js'
import { VAULT } from '../../../utils/os.js'

type Formula = 'free' | 'gemini' | 'claude' | 'api'

// Formula of the current settings
const formulaOf = (e: Partial<EngineSettings>): Formula => (e.provider === 'local' ? 'free' : e.provider === 'gemini' ? 'gemini' : e.provider === 'claude-code' ? 'claude' : 'api')
const FORMULAS: Record<Formula, [string, string]> = {
    free: ['Gratuit, sur ce PC', 'Une IA intégrée à DC Prospect écrit tes e-mails. Pas de compte, pas d\'abonnement, rien qui sort de ton PC. Téléchargement unique de 2,5 Go.'],
    gemini: ['Gratuit, en ligne (Google)', 'L\'IA Gemini de Google, avec une clé gratuite créée en 1 minute : elle cherche aussi les prospects sur Google. Limite gratuite par jour.'],
    claude: ['Avec mon abonnement Claude', 'La meilleure qualité si tu as Claude Pro ou Max : il cherche les prospects sur le web et écrit les e-mails.'],
    api: ['Avec une clé API', 'Pour ceux qui ont déjà une clé : Anthropic, OpenAI, Mistral, Groq, OpenRouter, ou Ollama sur ce PC. Payé à l\'usage chez le fournisseur.'],
}

export function claudeBlock(s: Settings): string {
    const c: Partial<ClaudeStatus> = s.accounts?.claude || {}
    const inApp = s.inApp
    return `<div class="card account"><div class="avatar ${c.connected ? 'ok' : ''}">C</div><div style="flex:1">
        <strong class="display display-s">Claude</strong>
        <p class="muted small">${!inApp ? 'Visible dans l\'application DC Prospect.' : !c.installed ? 'Claude Code n\'est pas encore installé sur ce PC : un clic suffit.' : c.connected ? `Connecté : ${esc(c.email)} (abonnement ${esc(c.plan || '')})` : 'Pas encore connecté : clique, ton navigateur s\'ouvre, connecte-toi à ton compte Claude.'}</p>
        <div class="actions">${!inApp ? '' : !c.installed ? '<button class="btn primary small" data-host="installClaude">Installer Claude Code</button>' : c.connected ? '<button class="btn small" data-host="disconnectClaude">Se déconnecter</button>' : '<button class="btn primary small" data-host="connectClaude">Se connecter à Claude</button>'}
        <button class="btn link small" data-refresh>Actualiser</button></div></div></div>`
}

const gb = (n: number): string => String(n).replace('.', ',')
function localBlock(e: Partial<EngineSettings>): string {
    const l: Partial<EngineSettings['local']> = e.local || {}, models = l.models || {}
    const cards = Object.entries(models).map(([id, m]) => `<button class="tile" data-local-model="${id}" style="text-align:left;cursor:pointer;font:inherit;color:var(--paper);background:var(--panel);width:100%;${id === l.id ? 'outline:2px solid var(--mint)' : ''}">
        <p class="label">${id === l.id ? 'Choisi · ' : id === l.suggested ? 'Conseillé pour ton PC · ' : ''}${esc(m.label)}</p>
        <p class="small" style="margin:.3rem 0 0"><strong>${esc(m.name)}</strong>, ${gb(m.sizeGb)} Go${m.installed ? ' · <span style="color:var(--mint)">téléchargé</span>' : ''}</p><p class="muted small" style="margin:.3rem 0 0">${esc(m.text)}</p></button>`).join('')
    const state = l.downloading
        ? `<p class="small">Téléchargement de ${esc(models[l.downloading]?.name || 'l\'IA intégrée')} : ${l.progress ?? 0} %. Tu peux continuer à utiliser DC Prospect.</p><div class="gauge" style="max-width:420px"><span style="width:${l.progress ?? 0}%"></span></div>`
        : l.installed
            ? `<p class="small"><span style="color:var(--mint)">IA intégrée prête</span> (${esc(l.name)}). Elle écrit les e-mails et les réponses sur ce PC ; DC Prospect trouve les prospects avec le registre officiel et leur site. <button class="btn link small" data-local-ai-delete="${l.id}">Supprimer ce modèle</button></p>`
            : `${l.error ? `<p class="small" style="color:var(--red)">${esc(l.error)}</p>` : ''}
               <p class="small">Dernière étape : télécharger l'IA choisie. Une seule fois, quelques minutes selon ta connexion ; ensuite elle marche même sans internet.</p>
               <div class="actions"><button class="btn primary small" data-local-ai-download="${l.id}">Télécharger ${esc(l.name)} (${gb(l.sizeGb ?? 0)} Go)</button></div>
               <p class="muted small">En attendant, les e-mails sont écrits à partir de modèles tout prêts : tu peux déjà commencer.</p>`
    return `<p class="small" style="margin-bottom:.5rem">Quelle IA intégrée ? Elles sont toutes gratuites et sous licence libre.</p><div class="grid g2" style="margin-bottom:.8rem">${cards}</div>${state}`
}

function geminiBlock(e: Partial<EngineSettings>): string {
    const saved = e.providers?.gemini?.keySaved
    return saved
        ? `<p class="small"><span style="color:var(--mint)">Gemini branché.</span> Il cherche les prospects sur Google et écrit les e-mails. L'offre gratuite a une limite par jour : au-delà, la recherche reprend le lendemain. Google peut utiliser les échanges de l'offre gratuite pour améliorer ses services (ce sont des informations publiques d'entreprises). <button class="btn link small" data-key-forget="gemini">Oublier la clé</button></p>`
        : `<ol class="small" style="padding-left:1.2rem;margin:.2rem 0 .7rem">
            <li>Ouvre <a href="https://aistudio.google.com/apikey" target="_blank">aistudio.google.com/apikey</a> et connecte-toi avec ton compte Google.</li>
            <li>Clique sur « Create API key » (Créer une clé API).</li>
            <li>Copie la clé et colle-la ici.</li></ol>
           <div class="key-row"><input type="password" id="gemini-key" placeholder="Colle ta clé Gemini" autocomplete="off"><button class="btn primary small" data-key-save="gemini">Enregistrer</button></div>`
}

const OPENAI_HOSTS: Record<string, string> = { OpenAI: 'https://api.openai.com/v1', Groq: 'https://api.groq.com/openai/v1', Mistral: 'https://api.mistral.ai/v1', OpenRouter: 'https://openrouter.ai/api/v1', Cerebras: 'https://api.cerebras.ai/v1', 'Ollama (ce PC)': 'http://localhost:11434/v1' }
function apiBlock(e: Partial<EngineSettings>): string {
    const p = e.provider === 'openai' ? 'openai' : 'anthropic', info = e.providers?.[p]
    return `<div class="actions" style="margin:.2rem 0 .6rem">
            <button class="btn small ${p === 'anthropic' ? 'primary' : ''}" data-provider="anthropic">Anthropic (Claude)</button>
            <button class="btn small ${p === 'openai' ? 'primary' : ''}" data-provider="openai">OpenAI, Mistral, Ollama...</button></div>
        <p class="muted small">${p === 'anthropic' ? 'Clé à créer sur console.anthropic.com. La recherche web est comprise.' : 'Clé OpenAI, Mistral, Groq ou OpenRouter, avec l\'adresse de leur API. Pour Ollama sur ce PC : adresse http://localhost:11434/v1, sans clé. Ces IA ne cherchent pas sur le web : DC Prospect trouve alors les prospects sans IA.'}</p>
        <div class="grid g2">
            ${p === 'openai' ? `<div style="grid-column:1/-1"><p class="muted small" style="margin:0">Fournisseur : ${Object.entries(OPENAI_HOSTS).map(([name, url]) => `<button class="btn link small" data-api-host="${esc(url)}">${esc(name)}</button>`).join('')} (Groq, Mistral, OpenRouter et Cerebras ont une offre gratuite limitée)</p></div>
            <div><label class="label field" for="ai-base">Adresse de l'API</label><input type="text" id="ai-base" value="${esc(e.baseUrl || '')}" placeholder="https://api.openai.com/v1"></div>` : ''}
            <div><label class="label field" for="ai-key">Clé API ${info?.keySaved ? `(enregistrée, chiffrée par ${VAULT})` : ''}</label><input type="password" id="ai-key" placeholder="${info?.keySaved ? 'Coller une nouvelle clé pour la remplacer' : 'Colle ta clé'}" autocomplete="off"></div>
            <div><label class="label field" for="ai-search-model">Modèle pour chercher (facultatif)</label><input type="text" id="ai-search-model" value="${esc(e.searchModel || '')}" placeholder="par défaut"></div>
            <div><label class="label field" for="ai-writing-model">Modèle pour écrire (facultatif)</label><input type="text" id="ai-writing-model" value="${esc(e.writingModel || '')}" placeholder="par défaut"></div>
        </div>
        <div class="actions"><button class="btn primary small" data-save-engine="${p}">Enregistrer</button>${info?.keySaved ? `<button class="btn link small" data-key-forget="${p}">Oublier la clé</button>` : ''}</div>`
}

// start: shown in the getting started (the recommended formula is put forward, the options are hidden)
export function engineBlock(s: Settings, { start = false }: { start?: boolean } = {}): string {
    const e: Partial<EngineSettings> = s.engine || {}
    const f = e.chosen || s.accounts?.claude?.connected ? formulaOf(e) : null
    const recommended = s.accounts?.claude?.connected ? 'claude' : 'free'
    const detail: Record<Formula, () => string> = { free: () => localBlock(e), gemini: () => geminiBlock(e), claude: () => claudeBlock(s), api: () => apiBlock(e) }
    const choice = (attr: string, value: string, current: string | undefined, text: string): string => `<button class="btn small ${value === current ? 'primary' : ''}" ${attr}="${value}">${text}</button>`
    return `<div class="card">
        <strong class="display display-s">Comment DC Prospect travaille</strong>
        <p class="muted small">Choisis une formule, tu pourras en changer à tout moment. ${e.ready ? '<span style="color:var(--mint)">Prêt.</span>' : '<span style="color:var(--red)">Encore une étape ci-dessous.</span>'}</p>
        <div class="grid g2" style="margin:.6rem 0 1rem">${(Object.entries(FORMULAS) as [Formula, [string, string]][]).map(([k, [title, text]]) => `<button class="tile formula" data-formula="${k}" style="text-align:left;cursor:pointer;font:inherit;color:var(--paper);background:var(--panel);width:100%;${k === f ? 'outline:2px solid var(--mint)' : ''}">
            <p class="label">${k === f ? 'Choisi · ' : !f && k === recommended ? 'Conseillé · ' : ''}${title}</p><p class="small" style="margin:.4rem 0 0">${text}</p></button>`).join('')}</div>
        ${!f ? '<p class="small">Clique sur une formule pour la choisir. Sans abonnement Claude, prends « Gratuit, sur ce PC ».</p>' : detail[f]()}
        ${f ? `<div class="actions" style="margin-top:1rem"><button class="btn small" data-sample>Voir un exemple d'e-mail</button><span class="muted small" style="align-self:center">ce que DC Prospect écrirait avec ton profil, à une entreprise fictive</span></div><div id="sample-email"></div>` : ''}
        ${start ? '' : `<details style="margin-top:1.2rem"><summary class="small" style="cursor:pointer">Options pour aller plus loin (facultatif)</summary>
        <div class="grid g2" style="margin-top:.8rem">
            <div class="tile"><p class="label">Trouver les prospects</p>
                ${e.canSearch ? `<div class="actions" style="margin:.5rem 0">${choice('data-search-engine', 'ai', e.searchEngine, 'Avec l\'IA')}${choice('data-search-engine', 'free', e.searchEngine, 'Sans IA')}</div>` : ''}
                <p class="muted small">${e.searchEngine === 'free' ? 'Sans IA : DC Prospect prend dans le registre officiel les entreprises qui acceptent la prospection, retrouve leur site et le lit. Ça marche sans rien de plus ; avec une clé Brave (brave.com/search/api, crédit gratuit de 5 $ par mois), il retrouve beaucoup plus de sites.' : 'L\'IA cherche sur le web parmi les entreprises autorisées par le registre, puis DC Prospect vérifie leur site.'}</p>
                ${e.searchEngine === 'free' ? `<div class="key-row"><input type="password" id="brave-key" placeholder="${e.searchKey ? 'Clé Brave enregistrée : coller une nouvelle' : 'Clé Brave Search (facultatif)'}" autocomplete="off"><button class="btn small" data-key-save="brave">Enregistrer</button>${e.searchKey ? '<button class="btn link small" data-key-forget="brave">Oublier</button>' : ''}</div>` : ''}</div>
            <div class="tile"><p class="label">Écrire les e-mails</p>
                <div class="actions" style="margin:.5rem 0">${choice('data-writing-engine', 'ai', e.writingEngine, 'Avec l\'IA')}${choice('data-writing-engine', 'templates', e.writingEngine, 'Avec mes modèles')}</div>
                <p class="muted small">${e.writingEngine === 'templates' ? 'Des modèles remplis avec ce qui a été vérifié sur le site du prospect. Tu peux les réécrire (dossier « modèles » de ton dossier de prompts).' : 'L\'IA écrit chaque e-mail avec ton profil et ce qui a été vérifié sur le site du prospect.'}</p></div>
            <div class="tile"><p class="label">Mesure de vitesse Google ${e.speedKey ? '<span style="color:var(--mint)">branchée</span>' : ''}</p>
                <p class="muted small">Avec une clé gratuite Google PageSpeed (console.cloud.google.com, activer « PageSpeed Insights API », Identifiants, Créer une clé API), chaque site est chronométré par Google sur téléphone. Les e-mails deviennent plus concrets.</p>
                <div class="key-row"><input type="password" id="pagespeed-key" placeholder="${e.speedKey ? 'Coller une nouvelle clé' : 'Clé Google PageSpeed'}" autocomplete="off"><button class="btn small" data-key-save="pagespeed">Enregistrer</button>${e.speedKey ? '<button class="btn link small" data-key-forget="pagespeed">Oublier</button>' : ''}</div></div>
        </div></details>`}
    </div>`
}

// Clicks of the engine block; true when handled
export async function onEngineClick(b: HTMLButtonElement, reload: () => Promise<unknown>): Promise<unknown> {
    const engine: Partial<EngineSettings> = store.settings?.engine || {}
    const save = (changes: object, done: string) => runAction(b, () => ensureSuccess(api.put('/settings', changes)), done)
    if (b.dataset.formula) {
        const f = b.dataset.formula as Formula
        const providers: Partial<Record<Formula, string>> = { free: 'local', gemini: 'gemini', claude: 'claude-code' }
        const provider = providers[f] || (engine.provider === 'openai' ? 'openai' : 'anthropic')
        await save({ ai: { provider, baseUrl: engine.baseUrl, searchModel: '', writingModel: '' }, searchEngine: f === 'free' ? 'free' : 'ai', writingEngine: 'ai' }, `Formule choisie : ${FORMULAS[f][0]}`)
        return reload()
    }
    if (b.hasAttribute('data-local-ai-download')) {
        const r = await runAction(b, () => ensureSuccess(api.post('/local-ai/download', { id: b.dataset.localAiDownload })), 'Téléchargement lancé : tu peux continuer pendant ce temps')
        if (r) {
            const timer = setInterval(async () => {
                const s = await api.get<Settings>('/settings')
                if (!s.success) return
                store.settings = s
                await reload()
                if (!s.engine?.local?.downloading) { clearInterval(timer); if (s.engine?.local?.installed) toast('IA intégrée prête') }
            }, 3000)
        }
        return true
    }
    if (b.hasAttribute('data-local-ai-delete')) {
        if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Confirmer la suppression'; return true }
        await runAction(b, () => ensureSuccess(api.delete('/local-ai', { id: b.dataset.localAiDelete })), 'Modèle supprimé')
        return reload()
    }
    if (b.hasAttribute('data-sample')) {
        $('#sample-email').innerHTML = "<p class=\"muted small\">Rédaction de l'exemple (quelques secondes, jusqu'à une minute avec Claude)...</p>"
        const r = await runAction(b, () => ensureSuccess(api.post<{ sample: SampleEmail }>('/sample-email')))
        const x = r?.sample
        $('#sample-email').innerHTML = x ? `<div class="tile" style="margin-top:.8rem"><p class="label">Exemple pour « ${esc(x.company)} » · écrit par ${esc(x.writer)}</p>
            <p class="small"><strong>Objet : ${esc(x.subject)}</strong></p><div class="small" style="white-space:pre-wrap">${esc(x.body)}</div>
            ${x.hints?.length ? `<p class="muted small">Conseil : ${esc(x.hints.join(' ; '))}.</p>` : ''}
            <p class="muted small">Ta signature et la phrase de désinscription sont ajoutées à l'envoi. Rien n'est envoyé : c'est un exemple.</p></div>` : ''
        return true
    }
    if (b.dataset.localModel) { await save({ localModel: b.dataset.localModel }, 'Modèle choisi'); return reload() }
    if (b.dataset.apiHost) { const i = $<HTMLInputElement>('#ai-base'); if (i) i.value = b.dataset.apiHost; toast('Adresse remplie : colle ta clé puis Enregistrer'); return true }
    if (b.hasAttribute('data-refresh')) { await runAction(b, () => hostAction('claudeStatus')); return reload() }
    if (b.dataset.provider) { await save({ ai: { provider: b.dataset.provider, baseUrl: engine.baseUrl, searchModel: '', writingModel: '' } }, 'Fournisseur choisi'); return reload() }
    if (b.dataset.searchEngine) { await save({ searchEngine: b.dataset.searchEngine }, b.dataset.searchEngine === 'free' ? 'Recherche sans IA' : 'Recherche avec l\'IA'); return reload() }
    if (b.dataset.writingEngine) { await save({ writingEngine: b.dataset.writingEngine }, b.dataset.writingEngine === 'templates' ? 'Rédaction avec tes modèles' : 'Rédaction avec l\'IA'); return reload() }
    if (b.dataset.saveEngine) {
        const p = b.dataset.saveEngine, key = $<HTMLInputElement>('#ai-key')?.value.trim()
        const ok = await runAction(b, async () => {
            if (key) await ensureSuccess(api.post('/accounts/key', { name: p, key }))
            return ensureSuccess(api.put('/settings', { ai: { provider: p, baseUrl: $<HTMLInputElement>('#ai-base')?.value || '', searchModel: $<HTMLInputElement>('#ai-search-model').value, writingModel: $<HTMLInputElement>('#ai-writing-model').value } }))
        }, 'Enregistré')
        return ok ? reload() : true
    }
    if (b.dataset.keySave) {
        const key = $<HTMLInputElement>(`#${b.dataset.keySave}-key`).value.trim()
        if (!key) { toast('Colle d\'abord la clé', true); return true }
        await runAction(b, () => ensureSuccess(api.post('/accounts/key', { name: b.dataset.keySave, key })), 'Clé enregistrée et testée')
        return reload()
    }
    if (b.dataset.keyForget) { await runAction(b, () => ensureSuccess(api.delete('/accounts/key', { name: b.dataset.keyForget })), 'Clé oubliée'); return reload() }
    return false
}
