// The AI engine, whichever is chosen in Settings (Moteur), so DC Prospect does not depend on one product:
//   claude-code   Claude Code on this PC, with the user's Claude subscription (default; web search included)
//   anthropic     Anthropic API with a key (pay per use; web search included, no Claude Code needed)
//   local         the AI built into DC Prospect (localAi.mjs): free, on this PC, downloaded once (no web search)
//   openai        any OpenAI-compatible API with a key: OpenAI, Mistral, Groq, OpenRouter, or a local model (Ollama)
//                 (no web search: the search then goes through the search without AI, discovery.mjs)
// Keys are typed in the app and kept encrypted by Windows (vault.mjs), never in the settings files.
//   const text = await runAi(prompt, { web: true, task: 'search' })
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { cfg, localFolder, log } from './base.mjs'
import { readSecret, hasSecret } from './vault.mjs'
import { runLocal, modelInstalled } from './localAi.mjs'

export const PROVIDERS = {
    local: { name: 'IA intégrée (gratuite, sur ce PC)', web: false, key: null },
    'claude-code': { name: 'Claude Code (abonnement Claude)', web: true, key: null },
    gemini: { name: 'Google Gemini (clé gratuite)', web: true, key: 'ai-gemini' },
    anthropic: { name: 'API Anthropic (clé, paiement à l\'usage)', web: true, key: 'ai-anthropic' },
    openai: { name: 'API compatible OpenAI (OpenAI, Mistral, Ollama...)', web: false, key: 'ai-openai' },
}
// Default models of each provider: [search, writing]
const DEFAULT_MODELS = { 'claude-code': ['haiku', 'sonnet'], anthropic: ['claude-haiku-5-5', 'claude-sonnet-5-5'], openai: ['gpt-4o-mini', 'gpt-4o'], local: ['', ''], gemini: ['', ''] }

export const aiSettings = () => ({ provider: 'claude-code', baseUrl: '', searchModel: '', writingModel: '', ...(cfg.ai || {}) })
export const provider = () => (PROVIDERS[aiSettings().provider] ? aiSettings().provider : 'claude-code')
export const providerCanSearch = () => PROVIDERS[provider()].web
// Ready to work: Claude Code is checked by the app (installed and logged in); an API needs its key
export const providerHasKey = (p = provider()) => (p === 'local' ? modelInstalled() : !PROVIDERS[p].key || hasSecret(PROVIDERS[p].key))

function model(task) {
    const s = aiSettings(), p = provider(), [search, writing] = DEFAULT_MODELS[p]
    // settings before 1.3.0: searchModel / writingModel at the top of the settings, for Claude Code
    if (p === 'claude-code') return (task === 'search' ? s.searchModel || cfg.searchModel || search : s.writingModel || cfg.writingModel || writing)
    return task === 'search' ? s.searchModel || search : s.writingModel || writing
}

// ---------- Usage per day (calls, and the API-equivalent value when known) ----------
const usageFile = path.join(localFolder, 'claude-usage.json')
export function countUsage(usd = 0) {
    let days = {}
    try { days = JSON.parse(fs.readFileSync(usageFile, 'utf8')) } catch {}
    const d = new Date().toISOString().slice(0, 10)
    days[d] = { calls: (days[d]?.calls || 0) + 1, usd: Math.round(((days[d]?.usd || 0) + usd) * 100) / 100 }
    fs.writeFileSync(usageFile, JSON.stringify(days))
}
export function usage(day) {
    try { return JSON.parse(fs.readFileSync(usageFile, 'utf8'))[day] || { calls: 0, usd: 0 } } catch { return { calls: 0, usd: 0 } }
}

// ---------- Claude Code (headless, the user's subscription) ----------
export const claudeExe = () => [path.join(process.env.USERPROFILE || '', '.local', 'bin', 'claude.exe')].find((f) => fs.existsSync(f)) || 'claude'

function runClaudeCode(prompt, { web, minutes, task }) {
    return new Promise((resolve, reject) => {
        const exe = claudeExe()
        const args = ['-p', '--output-format', 'json', '--model', model(task), '--setting-sources', '', '--strict-mcp-config', '--no-session-persistence']
        if (web) args.push('--allowedTools', 'WebSearch', 'WebFetch')
        args.push('--disallowedTools', 'Bash', 'Edit', 'Write', 'NotebookEdit', 'Agent')
        // Neutral working folder: no CLAUDE.md, no project files
        const cwd = path.join(localFolder, 'claude')
        fs.mkdirSync(cwd, { recursive: true })
        const child = spawn(exe, args, { cwd, shell: exe === 'claude', windowsHide: true })
        let out = '', err = ''
        const timer = setTimeout(() => { child.kill(); reject(new Error('Claude : délai dépassé')) }, minutes * 60e3)
        child.stdout.on('data', (d) => (out += d))
        child.stderr.on('data', (d) => (err += d))
        child.on('error', (e) => { clearTimeout(timer); reject(new Error(e.code === 'ENOENT' ? 'Claude Code n\'est pas installé' : e.message)) })
        child.on('close', (code) => {
            clearTimeout(timer)
            try {
                const res = JSON.parse(out)
                countUsage(res.total_cost_usd || 0)
                if (res.is_error) return reject(new Error('Claude : ' + (res.result || res.subtype)))
                resolve(res.result || '')
            } catch {
                reject(new Error(`Claude (code ${code}) : ${(err || out).slice(0, 300)}`))
            }
        })
        child.stdin.end(prompt)
    })
}

// ---------- Anthropic API (key) ----------
async function runAnthropic(prompt, { web, minutes, task }) {
    const key = readSecret(PROVIDERS.anthropic.key)
    if (!key) throw new Error('Clé API Anthropic pas encore enregistrée (Réglages, Moteur)')
    const body = { model: model(task), max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }
    if (web) body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 12 }]
    const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', signal: AbortSignal.timeout(minutes * 60e3),
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(`API Anthropic : ${j.error?.message || 'HTTP ' + r.status}`)
    countUsage(0)
    // the answer is the last text block (the web search blocks come before)
    return (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n')
}

// ---------- OpenAI-compatible API (key; base address for Mistral, Groq, OpenRouter, Ollama...) ----------
async function runOpenAi(prompt, { web, minutes, task }) {
    if (web) throw new Error('Ce moteur ne cherche pas sur le web : choisis « Recherche sans IA » (Réglages, Moteur)')
    const key = readSecret(PROVIDERS.openai.key)
    const base = (aiSettings().baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')
    // a local model (Ollama) needs no key
    if (!key && !/localhost|127\.0\.0\.1/.test(base)) throw new Error('Clé API pas encore enregistrée (Réglages, Moteur)')
    const r = await fetch(`${base}/chat/completions`, {
        method: 'POST', signal: AbortSignal.timeout(minutes * 60e3),
        headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
        body: JSON.stringify({ model: model(task), messages: [{ role: 'user', content: prompt }], temperature: 0.7 }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(`API : ${j.error?.message || 'HTTP ' + r.status}`)
    countUsage(0)
    return j.choices?.[0]?.message?.content || ''
}

// ---------- Google Gemini (free key from aistudio.google.com; web search through Google Search grounding) ----------
// The model is found by the API itself (the newest « flash » of the free plan), so new versions are used without an update
let geminiModel = null
async function bestGeminiModel(key) {
    if (geminiModel) return geminiModel
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(20000) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(`Gemini : ${j.error?.message || 'HTTP ' + r.status}`)
    const version = (n) => Number((n.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0)
    const usable = (j.models || []).map((m) => m.name.replace(/^models\//, ''))
        .filter((n) => /^gemini-\d/.test(n) && /flash/.test(n) && !/lite|image|tts|audio|live|thinking|exp|preview/.test(n))
        .sort((a, b) => version(b) - version(a) || a.length - b.length)
    if (!usable.length) throw new Error('Gemini : aucun modèle disponible pour cette clé')
    return (geminiModel = usable[0])
}

// Check of a key just typed: it lists the models (no quota used)
export async function testGeminiKey() { geminiModel = null; return bestGeminiModel(readSecret(PROVIDERS.gemini.key) || '') }

async function runGemini(prompt, { web, minutes, task }) {
    const key = readSecret(PROVIDERS.gemini.key)
    if (!key) throw new Error('Clé Google Gemini pas encore enregistrée (Réglages, Formule)')
    const chosen = model(task) || await bestGeminiModel(key)
    const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.6 } }
    if (web) body.tools = [{ google_search: {} }]
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${chosen}:generateContent`, {
        method: 'POST', signal: AbortSignal.timeout(minutes * 60e3),
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body),
    })
    const j = await r.json().catch(() => ({}))
    if (r.status === 429) throw new Error('Gemini : limite gratuite du jour atteinte, reprise demain')
    if (!r.ok) throw new Error(`Gemini : ${j.error?.message || 'HTTP ' + r.status}`)
    countUsage(0)
    return (j.candidates?.[0]?.content?.parts || []).map((x) => x.text || '').join('\n')
}

// One call to the chosen engine; returns its text
// schema (optional): JSON schema of the answer, forced on the built-in AI
export async function runAi(prompt, { web = false, minutes = 8, task = 'writing', schema = null } = {}) {
    const p = provider()
    if (p === 'local' && web) throw new Error('L\'IA intégrée ne cherche pas sur le web : la recherche se fait sans IA')
    const run = p === 'local' ? runLocal : p === 'gemini' ? runGemini : p === 'anthropic' ? runAnthropic : p === 'openai' ? runOpenAi : runClaudeCode
    try {
        return await run(prompt, { web, minutes, task, schema })
    } catch (e) {
        log(`Moteur ${p} en échec :`, e.message)
        throw e
    }
}

export function extractJson(text) {
    const start = text.indexOf('{'), end = text.lastIndexOf('}')
    if (start < 0 || end < start) throw new Error('Réponse du moteur sans JSON')
    return JSON.parse(text.slice(start, end + 1))
}

export async function checkAi() {
    return extractJson(await runAi('Réponds uniquement : {"ok":true}', { minutes: 2, task: 'search', schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] } })).ok === true
}
