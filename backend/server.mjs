// Local server of the app (http://localhost:4747): serves frontend/ and the API under /api. Reachable from this PC only.
// Every API answer has the DC Scaffold format: { success: true, ...data } or { success: false, error, type }.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { cfg, racine } from './services/base.mjs'
import { ResponseHelper, ErreurApi } from './utils/ResponseHelper.mjs'
import { EtatController } from './controllers/EtatController.mjs'
import { ProspectsController } from './controllers/ProspectsController.mjs'
import { ReglagesController } from './controllers/ReglagesController.mjs'
import { ComptesController } from './controllers/ComptesController.mjs'
import { signatureHtml } from './services/mail.mjs'

const dossierFront = path.join(racine, 'frontend')
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' }

// METHOD /path -> handler(app, data, params)
const ROUTES = {
    'GET /api/etat': (app) => EtatController.getAll(app),
    'POST /api/brouillons': (app, d) => ProspectsController.brouillon(app, d),
    'POST /api/suivi': (app, d) => ProspectsController.suivi(app, d),
    'POST /api/preparation': (app) => ProspectsController.preparer(app),
    'GET /api/reglages': (app) => ReglagesController.getAll(app),
    'PUT /api/reglages': (app, d) => ReglagesController.update(app, d),
    'POST /api/comptes/gmail': (app, d) => ComptesController.gmail(app, d),
    'DELETE /api/comptes/gmail': (app) => ComptesController.oublierGmail(app),
    'POST /api/comptes/mot-de-passe': (app, d) => ComptesController.motDePasse(app, d),
    'PUT /api/comptes/envoi': (app, d) => ComptesController.modeEnvoi(app, d),
    'POST /api/comptes/test-envoi': (app) => ComptesController.testEnvoi(app),
    'POST /api/comptes/tester': (app) => ComptesController.tester(app),
    'POST /api/hote': (app, d) => ComptesController.hote(app, d),
}

export function demarrerServeur(app) {
    const serveur = http.createServer(async (req, res) => {
        // Only this PC (no other website through DNS tricks)
        if (!/^(localhost|127\.0\.0\.1):\d+$/.test(req.headers.host || '')) return ResponseHelper.error(res, 'Interdit', 403, 'FORBIDDEN')
        const url = new URL(req.url, 'http://localhost')
        try {
            if (url.pathname.startsWith('/api/')) {
                // a page from another website cannot send this header without the browser asking first: blocks forged requests
                if (req.method !== 'GET' && req.headers['x-prospection'] !== '1') throw new ErreurApi('Interdit', 403, 'FORBIDDEN')
                const apercu = url.pathname.match(/^\/api\/apercu\/([^/]+)\/(j0|r1|r2)$/)
                if (req.method === 'GET' && apercu) return ResponseHelper.html(res, EtatController.apercu(app, { id: decodeURIComponent(apercu[1]), etape: apercu[2] }))
                if (req.method === 'GET' && url.pathname === '/api/apercu-signature') return ResponseHelper.html(res, `<!doctype html><meta charset="utf-8"><title>Signature</title><body style="margin:24px;background:#fff">${signatureHtml('principale')}</body>`)
                const route = ROUTES[`${req.method} ${url.pathname}`]
                if (!route) throw new ErreurApi('Introuvable', 404, 'NOT_FOUND')
                const donnees = req.method === 'GET' ? {} : JSON.parse((await lire(req)) || '{}')
                return ResponseHelper.success(res, await route(app, donnees))
            }
            // Windows app pages (Google login answer...)
            if (app.hote?.routes?.[url.pathname]) return app.hote.routes[url.pathname](url, res)
            // frontend: / -> pages/index.html, /assets/..., /js/...
            const relatif = url.pathname === '/' ? 'pages/index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '')
            const fichier = path.normalize(path.join(dossierFront, relatif))
            if (!fichier.startsWith(dossierFront + path.sep) || !fs.existsSync(fichier) || fs.statSync(fichier).isDirectory()) return ResponseHelper.envoyer(res, 404, 'Introuvable', 'text/plain; charset=utf-8')
            return ResponseHelper.envoyer(res, 200, fs.readFileSync(fichier), TYPES[path.extname(fichier)] || 'application/octet-stream')
        } catch (e) {
            if (e instanceof ErreurApi) return ResponseHelper.error(res, e.message, e.code, e.type)
            return ResponseHelper.error(res, e.message, 500, 'SERVER_ERROR')
        }
    })
    return new Promise((resolve, reject) => {
        serveur.once('error', reject)
        serveur.listen(cfg.port, '127.0.0.1', () => resolve(serveur))
    })
}

const lire = (req) => new Promise((resolve, reject) => {
    let s = ''
    req.on('data', (d) => { s += d; if (s.length > 1e6) req.destroy() })
    req.on('end', () => resolve(s))
    req.on('error', reject)
})
