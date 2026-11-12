// Local server of the app (http://localhost:4747): serves frontend/ and the API under /api. Reachable from this PC only.
// Every API answer has the DC Scaffold format: { success: true, ...data } or { success: false, error, type }.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { cfg, root } from './services/base.mjs'
import { ResponseHelper, ApiError } from './utils/ResponseHelper.mjs'
import { StateController } from './controllers/StateController.mjs'
import { ProspectsController } from './controllers/ProspectsController.mjs'
import { SettingsController } from './controllers/SettingsController.mjs'
import { AccountsController } from './controllers/AccountsController.mjs'
import { signatureHtml } from './services/mail.mjs'

const frontendFolder = path.join(root, 'frontend')
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' }

// METHOD /path -> handler(app, data)
const ROUTES = {
    'GET /api/state': (app) => StateController.getAll(app),
    'POST /api/drafts': (app, d) => ProspectsController.draft(app, d),
    'POST /api/tracking': (app, d) => ProspectsController.track(app, d),
    'POST /api/prepare': (app) => ProspectsController.prepare(app),
    'POST /api/replies/draft': (app, d) => ProspectsController.draftReply(app, d),
    'POST /api/replies/send': (app, d) => ProspectsController.sendReply(app, d),
    'POST /api/drafts/rewrite': (app, d) => ProspectsController.rewrite(app, d),
    'POST /api/notes': (app, d) => ProspectsController.notes(app, d),
    'POST /api/restore': (app, d) => ProspectsController.restore(app, d),
    'POST /api/import': (app, d) => ProspectsController.importLeads(app, d),
    'POST /api/do-not-contact': (app, d) => ProspectsController.doNotContact(app, d),
    'POST /api/erase': (app, d) => ProspectsController.erase(app, d),
    'POST /api/calls': (app, d) => ProspectsController.call(app, d),
    'POST /api/replies/kind': (app, d) => ProspectsController.replyKind(app, d),
    'POST /api/accounts/key': (app, d) => AccountsController.saveKey(app, d),
    'DELETE /api/accounts/key': (app, d) => AccountsController.forgetKey(app, d),
    'POST /api/accounts/deliverability': (app) => AccountsController.deliverability(app),
    'POST /api/accounts/auto-setup': (app) => AccountsController.autoSetup(app),
    'POST /api/accounts/detect-mail': (app) => AccountsController.detectMail(app),
    'POST /api/sample-email': (app) => AccountsController.sampleEmail(app),
    'POST /api/local-ai/download': (app, d) => AccountsController.downloadLocalAi(app, d),
    'DELETE /api/local-ai': (app, d) => AccountsController.deleteLocalAi(app, d),
    'GET /api/settings': (app) => SettingsController.getAll(app),
    'GET /api/templates': (app) => SettingsController.templates(app),
    'PUT /api/templates': (app, d) => SettingsController.saveTemplate(app, d),
    'POST /api/zones/around': (app, d) => SettingsController.zoneAround(app, d),
    'PUT /api/settings': (app, d) => SettingsController.update(app, d),
    'POST /api/accounts/gmail': (app, d) => AccountsController.gmail(app, d),
    'DELETE /api/accounts/gmail': (app) => AccountsController.forgetGmail(app),
    'POST /api/accounts/password': (app, d) => AccountsController.password(app, d),
    'PUT /api/accounts/sending-mode': (app, d) => AccountsController.sendingMode(app, d),
    'POST /api/accounts/test-email': (app) => AccountsController.testEmail(app),
    'POST /api/accounts/check': (app) => AccountsController.check(app),
    'POST /api/host': (app, d) => AccountsController.host(app, d),
}

export function startServer(app) {
    const server = http.createServer(async (req, res) => {
        // Only this PC (no other website through DNS tricks)
        if (!/^(localhost|127\.0\.0\.1):\d+$/.test(req.headers.host || '')) return ResponseHelper.error(res, 'Interdit', 403, 'FORBIDDEN')
        const url = new URL(req.url, 'http://localhost')
        try {
            if (url.pathname.startsWith('/api/')) {
                // a page from another website cannot send this header without the browser asking first: blocks forged requests
                if (req.method !== 'GET' && req.headers['x-prospection'] !== '1') throw new ApiError('Interdit', 403, 'FORBIDDEN')
                const preview = url.pathname.match(/^\/api\/preview\/([^/]+)\/(first|followUp1|followUp2)$/)
                if (req.method === 'GET' && preview) return ResponseHelper.html(res, StateController.preview(app, { id: decodeURIComponent(preview[1]), step: preview[2] }))
                if (req.method === 'GET' && url.pathname === '/api/signature-preview') return ResponseHelper.html(res, `<!doctype html><meta charset="utf-8"><title>Signature</title><body style="margin:24px;background:#fff">${signatureHtml('main')}</body>`)
                const route = ROUTES[`${req.method} ${url.pathname}`]
                if (!route) throw new ApiError('Introuvable', 404, 'NOT_FOUND')
                const data = req.method === 'GET' ? {} : JSON.parse((await readBody(req)) || '{}')
                return ResponseHelper.success(res, await route(app, data))
            }
            // Windows app pages (Google login answer...)
            if (app.host?.routes?.[url.pathname]) return app.host.routes[url.pathname](url, res)
            // frontend: / -> pages/index.html, /assets/..., /js/...
            const relative = url.pathname === '/' ? 'pages/index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '')
            const file = path.normalize(path.join(frontendFolder, relative))
            if (!file.startsWith(frontendFolder + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return ResponseHelper.send(res, 404, 'Introuvable', 'text/plain; charset=utf-8')
            return ResponseHelper.send(res, 200, fs.readFileSync(file), TYPES[path.extname(file)] || 'application/octet-stream')
        } catch (e) {
            if (e instanceof ApiError) return ResponseHelper.error(res, e.message, e.code, e.type)
            return ResponseHelper.error(res, e.message, 500, 'SERVER_ERROR')
        }
    })
    return new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(cfg.port, '127.0.0.1', () => resolve(server))
    })
}

const readBody = (req) => new Promise((resolve, reject) => {
    let s = ''
    req.on('data', (d) => { s += d; if (s.length > 1e6) req.destroy() })
    req.on('end', () => resolve(s))
    req.on('error', reject)
})
