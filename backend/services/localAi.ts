// AI built into DC Prospect: an open model that runs on this PC with node-llama-cpp. No account, no key, no internet once
// downloaded (once). Uses the graphics card when there is one (NVIDIA, AMD, Intel, through Vulkan), otherwise the processor.
// It writes the e-mails and the answers (localWriter.ts); it does not search the web (search without AI, discovery.ts).
// Two models, both under the Apache 2.0 licence (free to use in an app that is sold):
//   const status = localAiStatus()        // chosen model, installed, download progress, suggestion for this PC
//   downloadModel('ministral-8b')         // in the background
//   const text = await runLocal(prompt)   // JSON text, like the other engines (ai.ts)
import fs from 'node:fs'
import path from 'node:path'
import { cfg, localFolder, log } from './base.js'
import type { LocalModelId } from '../types.js'
import type { Llama, LlamaModel, LlamaGrammar, LlamaChatSession as ChatSession } from 'node-llama-cpp'
import type { JsonSchema } from './ai.js'

interface LocalModel { name: string, label: string, size: number, file: string, url: string, text: string }
interface LoadedModel { id: LocalModelId, llama: Llama, model: LlamaModel, LlamaChatSession: typeof ChatSession, grammar: LlamaGrammar }

const HF = 'https://huggingface.co'
export const MODELS: Record<LocalModelId, LocalModel> = {
    'qwen3-4b': { name: 'Qwen3 4B', label: 'Rapide et fiable', size: 2.5e9, file: 'Qwen3-4B-Q4_K_M.gguf', url: `${HF}/Qwen/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf`,
        text: 'Le meilleur choix pour la plupart : suit bien les consignes, quelques secondes par e-mail, marche sur tous les PC.' },
    'ministral-8b': { name: 'Ministral 3 8B (Mistral)', label: 'Plus naturel', size: 5.2e9, file: 'Ministral-3-8B-Instruct-2512-Q4_K_M.gguf', url: `${HF}/mistralai/Ministral-3-8B-Instruct-2512-GGUF/resolve/main/Ministral-3-8B-Instruct-2512-Q4_K_M.gguf`,
        text: "Modèle de Mistral, une entreprise française : écrit de façon plus vivante, mais plus lent et s'écarte plus souvent des consignes (son texte est alors remplacé par le brouillon). 16 Go de mémoire conseillés." },
}
const folder = path.join(localFolder, 'models')
const pathOf = (id: LocalModelId) => path.join(folder, MODELS[id].file)
const isInstalled = (id: LocalModelId) => fs.existsSync(pathOf(id))
const isModelId = (id: unknown): id is LocalModelId => typeof id === 'string' && id in MODELS

// The model chosen in the settings; otherwise the best one already downloaded; otherwise the light one
export function chosenModel(): LocalModelId {
    if (isModelId(cfg.localModel)) return cfg.localModel
    return (['qwen3-4b', 'ministral-8b'] as const).find(isInstalled) || 'qwen3-4b'
}
export const modelInstalled = () => isInstalled(chosenModel())

// Suggestion: Qwen3 4B for every PC (tested: its texts pass the checks, 2 to 3 times faster than Ministral 8B)
export const suggestedModel = () => 'qwen3-4b'

const download: { id: LocalModelId | null, running: boolean, received: number, total: number, error: string } = { id: null, running: false, received: 0, total: 0, error: '' }
export function localAiStatus() {
    const id = chosenModel(), m = MODELS[id]
    return {
        id, name: m.name, installed: isInstalled(id), sizeGb: Math.round(m.size / 1e8) / 10, suggested: suggestedModel(),
        models: Object.fromEntries((Object.entries(MODELS) as [LocalModelId, LocalModel][]).map(([k, x]) => [k, { name: x.name, label: x.label, text: x.text, sizeGb: Math.round(x.size / 1e8) / 10, installed: isInstalled(k) }])),
        downloading: download.running ? download.id : null, progress: download.total ? Math.round((download.received / download.total) * 100) : 0, error: download.error,
    }
}

// Download of a model, in the background; the .part file is renamed when complete (an interrupted download starts again)
// id comes from the interface: checked before use
export function downloadModel(id: unknown = chosenModel()) {
    if (!isModelId(id) || download.running || isInstalled(id)) return localAiStatus()
    const m = MODELS[id]
    Object.assign(download, { id, running: true, received: 0, total: m.size, error: '' })
    ;(async () => {
        const part = pathOf(id) + '.part'
        try {
            fs.mkdirSync(folder, { recursive: true })
            const r = await fetch(m.url)
            if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`)
            download.total = Number(r.headers.get('content-length')) || m.size
            const out = fs.createWriteStream(part)
            for await (const chunk of r.body) {
                download.received += chunk.length
                if (!out.write(chunk)) await new Promise<void>((resolve) => out.once('drain', () => resolve()))
            }
            await new Promise<void>((resolve, reject) => out.end((e?: Error | null) => (e ? reject(e) : resolve())))
            if (fs.statSync(part).size < download.total * 0.99) throw new Error('fichier incomplet')
            fs.renameSync(part, pathOf(id))
            log(`IA intégrée téléchargée (${m.name})`)
        } catch (e) {
            download.error = 'Téléchargement interrompu : ' + (e as Error).message
            log(download.error)
            try { fs.unlinkSync(part) } catch {}
        } finally { download.running = false }
    })()
    return localAiStatus()
}

export function deleteModel(id: unknown = chosenModel()) {
    if (!isModelId(id)) return localAiStatus()
    if (loaded?.id === id) unload()
    try { fs.unlinkSync(pathOf(id)) } catch {}
    return localAiStatus()
}

// ---------- Running the model: loaded on first use, freed after 10 minutes without use; one answer at a time ----------
let loaded: LoadedModel | null = null, idleTimer: NodeJS.Timeout | undefined, queue: Promise<unknown> = Promise.resolve()

async function load(): Promise<LoadedModel> {
    const id = chosenModel()
    if (loaded?.id === id) return loaded
    if (loaded) unload()
    if (!isInstalled(id)) throw new Error('IA intégrée pas encore téléchargée (Réglages, Formule)')
    const { getLlama, LlamaChatSession } = await import('node-llama-cpp')
    // prebuilt binaries only (never compiled on the user's PC): graphics card through Vulkan or CUDA when present, else the processor
    const llama = await getLlama({ build: 'never' })
    const model = await llama.loadModel({ modelPath: pathOf(id) })
    loaded = { id, llama, model, LlamaChatSession, grammar: await llama.getGrammarFor('json') }
    log(`IA intégrée chargée (${MODELS[id].name}, ${llama.gpu || 'processeur'})`)
    return loaded
}

function unload() {
    clearTimeout(idleTimer)
    const l = loaded
    loaded = null
    if (l) l.model.dispose().catch(() => {})
}

// One answer (JSON text). Each call has its own fresh conversation
export function runLocal(prompt: string, { minutes = 8, schema = null }: { minutes?: number, schema?: JsonSchema | null } = {}): Promise<string> {
    const job = queue.then(async () => {
        const l = await load()
        clearTimeout(idleTimer)
        const context = await l.model.createContext({ contextSize: 8192 })
        try {
            const session = new l.LlamaChatSession({ contextSequence: context.getSequence() })
            const timeout = AbortSignal.timeout(minutes * 60e3)
            const text = await session.prompt(prompt, { grammar: schema ? await l.llama.createGrammarForJsonSchema<JsonSchema>(schema) : l.grammar, maxTokens: 1500, temperature: 0.6, budgets: { thoughtTokens: 0 }, signal: timeout })
            return text
        } finally {
            await context.dispose()
            idleTimer = setTimeout(unload, 10 * 60e3)
        }
    })
    queue = job.catch(() => {})
    return job
}
