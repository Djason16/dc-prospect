// What I decide in the interface: approve or reject an e-mail, note what happened with a prospect, prepare the day now
import { jour, noter } from '../services/base.mjs'
import { prospect, NOM_ETAPE } from '../services/prospection.mjs'
import { controlerTexte } from '../services/claude.mjs'
import { ErreurApi } from '../utils/ResponseHelper.mjs'

const enVeille = (app) => { if (app.veille) throw new ErreurApi(`L'outil tourne sur le PC ${app.veille} : valide et note depuis ce PC-là (celui-ci est en veille).`, 409, 'CONFLICT') }

export const ProspectsController = {
    // POST /api/brouillons { id, etape, action: valider | annuler | rejeter, objet?, corps? }
    brouillon(app, d) {
        enVeille(app)
        const p = prospect(app.etat, d.id), b = p?.brouillons?.[d.etape]
        if (!b || !['a_valider', 'valide'].includes(b.statut)) throw new ErreurApi('Brouillon introuvable', 404, 'NOT_FOUND')
        if (typeof d.objet === 'string') b.objet = d.objet.trim()
        if (typeof d.corps === 'string') b.corps = d.corps.replace(/\r/g, '').trim()
        b.problemes = controlerTexte(b.objet, b.corps)
        if (d.action === 'valider') {
            if (b.problemes.length) throw new ErreurApi('À corriger avant validation : ' + b.problemes.join(', '))
            b.statut = 'valide'; b.valideLe = new Date().toISOString()
        } else if (d.action === 'annuler') {
            b.statut = 'a_valider'
        } else if (d.action === 'rejeter') {
            b.statut = 'rejete'
            if (d.etape === 'j0') { p.statut = 'ecarte'; p.raison = 'refusé à la validation' } else { p.statut = 'termine'; p.raison = 'relance refusée à la validation' }
            noter(app.etat, 'validation', `${p.entreprise} : ${NOM_ETAPE[d.etape]} refusé, prospect retiré de la séquence`, { id: p.id })
        } else throw new ErreurApi('Action inconnue')
        app.changement()
        return { problemes: b.problemes }
    },

    // POST /api/suivi { id, action: appel | maquette | proposition | client | traite | refus | stop | ecarter }
    suivi(app, d) {
        enVeille(app)
        const etat = app.etat, p = prospect(etat, d.id)
        if (!p) throw new ErreurApi('Prospect introuvable', 404, 'NOT_FOUND')
        p.suivi = p.suivi || {}
        const j = jour(), a = d.action
        if (['appel', 'maquette', 'proposition', 'client'].includes(a)) p.suivi[a] = j
        if (['traite', 'appel', 'maquette', 'proposition', 'client'].includes(a) && p.reponse) p.suivi.traite = j
        if (a === 'client') p.statut = 'client'
        if (a === 'refus' || a === 'stop') {
            p.statut = 'stop'; p.stopLe = j; p.suivi.resultat = a === 'refus' ? 'Refus' : 'STOP'
            if (p.email && !etat.stop.includes(p.email)) etat.stop.push(p.email)
            for (const b of Object.values(p.brouillons || {})) if (['a_valider', 'valide'].includes(b.statut)) b.statut = 'annule'
        }
        if (a === 'ecarter') { p.statut = 'ecarte'; p.raison = 'retiré à la main' }
        noter(etat, 'suivi', `${p.entreprise} : ${a}`, { id: p.id })
        app.changement()
        return {}
    },

    // POST /api/preparation : research and batch of the day, now
    preparer(app) {
        enVeille(app)
        app.lancerJournee(true)
        return {}
    },
}
