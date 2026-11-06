// MCP server "contact-mail": lets Claude Code send an e-mail from the pro address (Gmail "send as" or the mailbox server set in the app)
// with the signature of the profile, and read the prospecting status.
import fs from 'node:fs'
import path from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { cfg, chargerEtat, dossierDonnees, jour, dateFr } from './services/base.mjs'
import { envoyer, lireReponses, parGmail } from './services/mail.mjs'
import { aValider, fileEnvoi, NOM_ETAPE } from './services/prospection.mjs'

const serveur = new McpServer({ name: 'contact-mail', version: '1.0.0' })
const texte = (t) => ({ content: [{ type: 'text', text: t }] })

serveur.registerTool('envoyer_email', {
    title: `Envoyer un e-mail depuis ${cfg.expediteur.adresse || "l'adresse pro"}`,
    description: `Envoie un e-mail depuis ${cfg.expediteur.adresse || "l'adresse pro de l'utilisateur"} avec sa signature (profil de DC Prospect). `
        + 'N\'appelle cet outil qu\'après avoir montré à l\'utilisateur le destinataire, l\'objet et le texte exacts et reçu son accord explicite pour CET envoi. '
        + 'Le texte est brut (paragraphes séparés par une ligne vide), sans signature : elle est ajoutée automatiquement. '
        + `signature = "principale" (prospection, suivi, propositions) ou "secondaire" (${cfg.profil?.nomSignatureSecondaire || 'deuxième signature du profil'}, par exemple devis et factures). `
        + 'stop = true pour un e-mail de prospection (ajoute la phrase de désinscription STOP).',
    inputSchema: {
        a: z.string().email().describe('Adresse du destinataire'),
        objet: z.string().min(1),
        texte: z.string().min(1).describe('Corps de l\'e-mail, de la salutation à la formule de politesse'),
        signature: z.enum(['principale', 'secondaire', 'developpeur', 'comptabilite']).default('principale'),
        stop: z.boolean().default(false),
        cc: z.string().email().optional(),
    },
}, async ({ a, objet, texte: corps, signature, stop, cc }) => {
    if (/[—–]/.test(objet + corps)) return texte('Refusé : le texte contient un tiret long (« — » ou « – »), interdit par les conventions. Corrige puis recommence.')
    const { messageId: id } = await envoyer({ a, objet, corps, signature, stop, cc })
    fs.mkdirSync(dossierDonnees, { recursive: true })
    fs.appendFileSync(path.join(dossierDonnees, 'envois-mcp.jsonl'), JSON.stringify({ date: new Date().toISOString(), a, cc, objet, signature, messageId: id }) + '\n')
    return texte(`Envoyé depuis ${cfg.expediteur.adresse} à ${a} (${parGmail() ? 'par Gmail, copie dans Envoyés de Gmail' : 'copie rangée dans Envoyés'}). Message-ID : ${id}`)
})

serveur.registerTool('etat_prospection', {
    title: 'État de la prospection',
    description: 'Résumé de la prospection automatique : e-mails à valider, en attente d\'envoi, réponses à traiter, chiffres du jour.',
    inputSchema: {},
}, async () => {
    const etat = chargerEtat()
    const L = [`Aujourd'hui : ${etat.envois[jour()] || 0} / ${cfg.maxEmailsParJour} e-mails envoyés. Page de validation : http://localhost:${cfg.port}`]
    const v = aValider(etat), f = fileEnvoi(etat)
    L.push(`À valider : ${v.length}${v.length ? ' (' + v.map(({ p, etape }) => `${p.entreprise} : ${NOM_ETAPE[etape]}`).join(' ; ') + ')' : ''}`)
    L.push(`Validés en attente d'envoi : ${f.length}`)
    const rep = etat.prospects.filter((p) => p.statut === 'repondu' && !p.suivi?.traite)
    L.push(`Réponses à traiter : ${rep.length}${rep.length ? '\n' + rep.map((p) => `- ${p.entreprise} (${p.email}, ${dateFr(p.reponse.date)}) : « ${p.reponse.extrait} »`).join('\n') : ''}`)
    const parStatut = {}
    for (const p of etat.prospects) parStatut[p.statut] = (parStatut[p.statut] || 0) + 1
    L.push('Prospects par statut : ' + Object.entries(parStatut).map(([k, n]) => `${k} ${n}`).join(', '))
    return texte(L.join('\n'))
})

serveur.registerTool('lire_boite_contact', {
    title: "Lire les derniers e-mails reçus sur l'adresse pro",
    description: 'Liste les e-mails reçus (adresse pro ou Gmail branché) ces derniers jours (expéditeur, objet, début du texte). Lecture seule.',
    inputSchema: { jours: z.number().int().min(1).max(30).default(3) },
}, async ({ jours }) => {
    const m = await lireReponses(jours)
    if (!m.length) return texte('Aucun e-mail reçu sur cette période.')
    return texte(m.slice(-40).map((x) => `- ${x.date?.slice(0, 16).replace('T', ' ')} · ${x.de} · ${x.objet}\n  ${x.texte.replace(/\s+/g, ' ').slice(0, 300)}`).join('\n'))
})

await serveur.connect(new StdioServerTransport())
