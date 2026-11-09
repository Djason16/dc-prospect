// MCP server "contact-mail": lets Claude Code send an e-mail from the pro address (Gmail "send as" or the mailbox server set in the app)
// with the signature of the profile, and read the prospecting status. Titles and descriptions are read by Claude for the user: in French.
import fs from 'node:fs'
import path from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { cfg, loadState, dataFolder, today, frenchDate } from './services/base.mjs'
import { send, readReplies, viaGmail } from './services/mail.mjs'
import { toApprove, sendQueue, STEP_NAME } from './services/prospecting.mjs'

const server = new McpServer({ name: 'contact-mail', version: '1.1.0' })
const reply = (t) => ({ content: [{ type: 'text', text: t }] })

server.registerTool('send_email', {
    title: `Envoyer un e-mail depuis ${cfg.sender.address || "l'adresse pro"}`,
    description: `Envoie un e-mail depuis ${cfg.sender.address || "l'adresse pro de l'utilisateur"} avec sa signature (profil de DC Prospect). `
        + 'N\'appelle cet outil qu\'après avoir montré à l\'utilisateur le destinataire, l\'objet et le texte exacts et reçu son accord explicite pour CET envoi. '
        + 'Le texte est brut (paragraphes séparés par une ligne vide), sans signature : elle est ajoutée automatiquement. '
        + `signature = "main" (prospection, suivi, propositions) ou "second" (${cfg.profile?.secondSignatureName || 'deuxième signature du profil'}, par exemple devis et factures). `
        + 'stop = true pour un e-mail de prospection (ajoute la phrase de désinscription STOP).',
    inputSchema: {
        to: z.string().email().describe('Adresse du destinataire'),
        subject: z.string().min(1).describe('Objet de l\'e-mail'),
        text: z.string().min(1).describe('Corps de l\'e-mail, de la salutation à la formule de politesse'),
        signature: z.enum(['main', 'second']).default('main'),
        stop: z.boolean().default(false),
        cc: z.string().email().optional(),
    },
}, async ({ to, subject, text, signature, stop, cc }) => {
    if (/[—–]/.test(subject + text)) return reply('Refusé : le texte contient un tiret long (« — » ou « – »), interdit par les conventions. Corrige puis recommence.')
    const { messageId } = await send({ to, subject, body: text, signature, stop, cc })
    fs.mkdirSync(dataFolder, { recursive: true })
    fs.appendFileSync(path.join(dataFolder, 'mcp-sends.jsonl'), JSON.stringify({ date: new Date().toISOString(), to, cc, subject, signature, messageId }) + '\n')
    return reply(`Envoyé depuis ${cfg.sender.address} à ${to} (${viaGmail() ? 'par Gmail, copie dans Envoyés de Gmail' : 'copie rangée dans Envoyés'}). Message-ID : ${messageId}`)
})

server.registerTool('prospecting_status', {
    title: 'État de la prospection',
    description: 'Résumé de la prospection automatique : e-mails à valider, en attente d\'envoi, réponses à traiter, chiffres du jour.',
    inputSchema: {},
}, async () => {
    const state = loadState()
    const L = [`Aujourd'hui : ${state.sendsPerDay[today()] || 0} / ${cfg.maxEmailsPerDay} e-mails envoyés. Page de validation : http://localhost:${cfg.port}`]
    const approve = toApprove(state), queue = sendQueue(state)
    L.push(`À valider : ${approve.length}${approve.length ? ' (' + approve.map(({ p, step }) => `${p.company} : ${STEP_NAME[step]}`).join(' ; ') + ')' : ''}`)
    L.push(`Validés en attente d'envoi : ${queue.length}`)
    const replies = state.prospects.filter((p) => p.status === 'replied' && !p.tracking?.handled)
    L.push(`Réponses à traiter : ${replies.length}${replies.length ? '\n' + replies.map((p) => `- ${p.company} (${p.email}, ${frenchDate(p.reply.date)}) : « ${p.reply.excerpt} »`).join('\n') : ''}`)
    const byStatus = {}
    for (const p of state.prospects) byStatus[p.status] = (byStatus[p.status] || 0) + 1
    L.push('Prospects par statut : ' + Object.entries(byStatus).map(([k, n]) => `${k} ${n}`).join(', '))
    return reply(L.join('\n'))
})

server.registerTool('read_inbox', {
    title: "Lire les derniers e-mails reçus sur l'adresse pro",
    description: 'Liste les e-mails reçus (adresse pro ou Gmail branché) ces derniers jours (expéditeur, objet, début du texte). Lecture seule.',
    inputSchema: { days: z.number().int().min(1).max(30).default(3) },
}, async ({ days }) => {
    const messages = await readReplies(days)
    if (!messages.length) return reply('Aucun e-mail reçu sur cette période.')
    return reply(messages.slice(-40).map((m) => `- ${m.date?.slice(0, 16).replace('T', ' ')} · ${m.from} · ${m.subject}\n  ${m.text.replace(/\s+/g, ' ').slice(0, 300)}`).join('\n'))
})

await server.connect(new StdioServerTransport())
