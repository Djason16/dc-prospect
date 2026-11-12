// Local server of the app (http://localhost:4747): serves frontend/ and the API under /api. Reachable from this PC only.
// Every API answer has the DC Scaffold format: { success: true, ...data } or { success: false, error, type }.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { cfg, root } from './services/base.js'
import { ResponseHelper, ApiError, errorMessage } from './utils/ResponseHelper.js'
import { StateController } from './controllers/StateController.js'
import { ProspectsController } from './controllers/ProspectsController.js'
import { SettingsController } from './controllers/SettingsController.js'
import { AccountsController } from './controllers/AccountsController.js'
import { signatureHtml } from './services/mail.js'
import type { App, RequestData, StepName } from './types.js'

const frontendFolder = path.join(root, 'frontend')
// The interface's scripts are written in TypeScript and compiled to out/frontend/js (npm run build:ts): /js/... comes from there
const scriptsFolder = path.join(root, 'out', 'frontend', 'js')
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' }

// The body of a request is the JSON sent by the interface (outside data): each handler declares the shape it expects
// and checks the values that matter, so the parsed object is handed over as that shape here, in one place
type Handler = (app: App, data: RequestData) => unknown
const handle = <T>(handler: (app: App, data: T) => unknown): Handler => (app, data) => handler(app, data as unknown as T)

// METHOD /path -> handler(app, data)
const ROUTES: Record<string, Handler> = {
    'GET /api/state': handle(StateController.getAll),
    'POST /api/drafts': handle(ProspectsController.draft),
    'POST /api/tracking': handle(ProspectsController.track),
    'POST /api/prepare': handle(ProspectsController.prepare),
    'POST /api/replies/draft': handle(ProspectsController.draftReply),
    'POST /api/replies/send': handle(ProspectsController.sendReply),
    'POST /api/drafts/rewrite': handle(ProspectsController.rewrite),
    'POST /api/notes': handle(ProspectsController.notes),
    'POST /api/restore': handle(ProspectsController.restore),
    'POST /api/import': handle(ProspectsController.importLeads),
    'POST /api/do-not-contact': handle(ProspectsController.doNotContact),
    'POST /api/erase': handle(ProspectsController.erase),
    'POST /api/calls': handle(ProspectsController.call),
    'POST /api/replies/kind': handle(ProspectsController.replyKind),
    'POST /api/accounts/key': handle(AccountsController.saveKey),
    'DELETE /api/accounts/key': handle(AccountsController.forgetKey),
    'POST /api/accounts/deliverability': handle(AccountsController.deliverability),
    'POST /api/accounts/auto-setup': handle(AccountsController.autoSetup),
    'POST /api/accounts/detect-mail': handle(AccountsController.detectMail),
    'POST /api/sample-email': handle(AccountsController.sampleEmail),
    'POST /api/local-ai/download': handle(AccountsController.downloadLocalAi),
    'DELETE /api/local-ai': handle(AccountsController.deleteLocalAi),
    'GET /api/settings': handle(SettingsController.getAll),
    'GET /api/templates': handle(SettingsController.templates),
    'PUT /api/templates': handle(SettingsController.saveTemplate),
    'POST /api/zones/around': handle(SettingsController.zoneAround),
    'PUT /api/settings': handle(SettingsController.update),
    'POST /api/accounts/gmail': handle(AccountsController.gmail),
    'DELETE /api/accounts/gmail': handle(AccountsController.forgetGmail),
    'POST /api/accounts/password': handle(AccountsController.password),
    'PUT /api/accounts/sending-mode': handle(AccountsController.sendingMode),
    'POST /api/accounts/test-email': handle(AccountsController.testEmail),
    'POST /api/accounts/check': handle(AccountsController.check),
    'POST /api/host': handle(AccountsController.host),
}

export function startServer(app: App): Promise<http.Server> {
    const server = http.createServer(async (req, res) => {
        // Only this PC (no other website through DNS tricks)
        if (!/^(localhost|127\.0\.0\.1):\d+$/.test(req.headers.host || '')) return ResponseHelper.error(res, 'Interdit', 403, 'FORBIDDEN')
        const url = new URL(req.url || '/', 'http://localhost')
        try {
            if (url.pathname.startsWith('/api/')) {
                // a page from another website cannot send this header without the browser asking first: blocks forged requests
                if (req.method !== 'GET' && req.headers['x-prospection'] !== '1') throw new ApiError('Interdit', 403, 'FORBIDDEN')
                const preview = url.pathname.match(/^\/api\/preview\/([^/]+)\/(first|followUp1|followUp2)$/)
                if (req.method === 'GET' && preview) return ResponseHelper.html(res, StateController.preview(app, { id: decodeURIComponent(preview[1]), step: preview[2] as StepName }))
                if (req.method === 'GET' && url.pathname === '/api/signature-preview') return ResponseHelper.html(res, `<!doctype html><meta charset="utf-8"><title>Signature</title><body style="margin:24px;background:#fff">${signatureHtml('main')}</body>`)
                const route = ROUTES[`${req.method} ${url.pathname}`]
                if (!route) throw new ApiError('Introuvable', 404, 'NOT_FOUND')
                // the body is outside data: an object of the interface, checked by each controller
                const data = (req.method === 'GET' ? {} : JSON.parse((await readBody(req)) || '{}')) as RequestData
                return ResponseHelper.success(res, (await route(app, data)) as object)
            }
            // Windows app pages (Google login answer...)
            const hostRoute = app.host?.routes?.[url.pathname]
            if (hostRoute) return hostRoute(url, res)
            // frontend: / -> pages/index.html, /assets/..., and /js/... from the compiled scripts
            const relative = url.pathname === '/' ? 'pages/index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '')
            const scripts = /^js\//.test(relative)
            const folder = scripts ? scriptsFolder : frontendFolder
            const file = path.normalize(path.join(folder, scripts ? relative.slice(3) : relative))
            if (!file.startsWith(folder + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return ResponseHelper.send(res, 404, 'Introuvable', 'text/plain; charset=utf-8')
            return ResponseHelper.send(res, 200, fs.readFileSync(file), TYPES[path.extname(file)] || 'application/octet-stream')
        } catch (e) {
            if (e instanceof ApiError) return ResponseHelper.error(res, e.message, e.code, e.type)
            return ResponseHelper.error(res, errorMessage(e), 500, 'SERVER_ERROR')
        }
    })
    return new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(cfg.port, '127.0.0.1', () => resolve(server))
    })
}

const readBody = (req: http.IncomingMessage): Promise<string> => new Promise((resolve, reject) => {
    let s = ''
    req.on('data', (d: Buffer) => { s += d; if (s.length > 1e6) req.destroy() })
    req.on('end', () => resolve(s))
    req.on('error', reject)
})
