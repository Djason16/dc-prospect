// State of the day for the interface (GET /api/etat) and preview of an e-mail with the signature (GET /api/apercu/:id/:etape)
import { cfg, jour, ajouterJours, dateDe, dateFr, nomJour, prochainJourEnvoi, dansFenetre } from '../services/base.mjs'
import { aValider, fileEnvoi, prospect, envoyesLe, prochaineEtape, NOM_ETAPE } from '../services/prospection.mjs'
import { composer } from '../services/mail.mjs'
import { zoneDeLaSemaine } from '../services/reglages.mjs'
import { chiffres } from '../services/rapport.mjs'
import { ErreurApi } from '../utils/ResponseHelper.mjs'

const STATUT = {
    pret: 'Prêt', en_sequence: 'En séquence', repondu: 'A répondu', stop: 'STOP', termine: 'Séquence finie',
    ecarte: 'Écarté', autre_canal: 'À appeler', client: 'Client',
}

export const EtatController = {
    getAll(app) {
        const etat = app.etat
        const carte = ({ p, etape, b }) => ({
            id: p.id, etape, nomEtape: NOM_ETAPE[etape], objet: b.objet, corps: b.corps, lot: b.lot, problemes: b.problemes || [],
            statut: b.statut, entreprise: p.entreprise, metier: p.metier, ville: p.ville, zone: p.zone, email: p.email, sourceEmail: p.sourceEmail,
            siteWeb: p.siteWeb, plateforme: p.plateforme, signal: p.signal, noteGoogle: p.noteGoogle, detail: p.detail, score: p.score, niveau: p.niveau,
            envoyeJ0: dateFr(p.etapes?.j0?.envoyeLe),
        })
        const lundi = ajouterJours(jour(), -((dateDe(jour()).getDay() + 6) % 7))
        const zones = [...new Set([...cfg.zones.map((z) => z.nom), ...etat.prospects.map((p) => p.zone).filter(Boolean)])]
        return {
            aujourdhui: nomJour(jour()), zone: zoneDeLaSemaine() || 'aucune',
            occupe: app.occupe, avancement: app.avancement,
            erreur: app.veille ? `Ce PC est en veille : l'outil tourne sur le PC ${app.veille}.` : app.erreur,
            envoyes: envoyesLe(etat), max: cfg.maxEmailsParJour, fenetre: dansFenetre(), fenetres: cfg.fenetres.map((f) => f.join(' - ')).join(' et '),
            prochainEnvoi: nomJour(prochainJourEnvoi()),
            aValider: aValider(etat).map(carte),
            file: fileEnvoi(etat).map(carte),
            reponses: etat.prospects.filter((p) => p.statut === 'repondu' && !p.suivi?.traite)
                .map((p) => ({ id: p.id, entreprise: p.entreprise, ville: p.ville, email: p.email, date: dateFr(p.reponse.date), extrait: p.reponse.extrait })),
            suivi: etat.prospects.filter((p) => p.statut !== 'ecarte')
                .sort((a, b) => (b.etapes?.j0?.envoyeLe || b.ajouteLe || '').localeCompare(a.etapes?.j0?.envoyeLe || a.ajouteLe || '')).slice(0, 400)
                .map((p) => {
                    const n = prochaineEtape(p)
                    return {
                        id: p.id, entreprise: p.entreprise, metier: p.metier, ville: p.ville, zone: p.zone, email: p.email, statut: STATUT[p.statut] || p.statut, score: p.score,
                        j0: dateFr(p.etapes?.j0?.envoyeLe), r1: dateFr(p.etapes?.r1?.envoyeLe), r2: dateFr(p.etapes?.r2?.envoyeLe),
                        prochaine: n && n.due ? `${NOM_ETAPE[n.etape]} le ${dateFr(n.due)}` : '', reponse: p.reponse?.extrait || '',
                    }
                }),
            stats: {
                zones: zones.map((z) => ({ zone: z, ...chiffres(etat, '0000', '9999', z) })),
                semaine: chiffres(etat, lundi, ajouterJours(lundi, 6)), total: chiffres(etat),
                prets: etat.prospects.filter((p) => p.statut === 'pret' && p.brouillons?.j0?.statut === 'en_reserve').length, reserve: cfg.reserveProspectsPrets,
            },
            sante: app.sante(),
            journal: etat.journal.slice(-40).reverse().map((j) => ({ heure: new Date(j.date).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }), texte: j.texte })),
        }
    },

    // HTML page of the e-mail as the prospect will see it
    apercu(app, { id, etape }) {
        const b = prospect(app.etat, id)?.brouillons?.[etape]
        if (!b) throw new ErreurApi('E-mail introuvable', 404, 'NOT_FOUND')
        return `<!doctype html><meta charset="utf-8"><title>Aperçu</title><body style="margin:24px;background:#fff">${composer(b.corps, { stop: true }).html}</body>`
    },
}
