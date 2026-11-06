// Settings shared on the Drive: zones, trades, volumes, sender and mail servers (GET and PUT /api/reglages)
import fs from 'node:fs'
import { cfg, noter } from '../services/base.mjs'
import { rendementParMetier } from '../services/prospection.mjs'
import { zoneDeLaSemaine, enregistrerReglages, profil, profilComplet, zonesActives, besoinParDefaut } from '../services/reglages.mjs'
import { statutGmail, modeEnvoi, fichierSecret } from '../services/mail.mjs'
import { ErreurApi } from '../utils/ResponseHelper.mjs'

export const ReglagesController = {
    getAll(app) {
        return {
            profil: profil(), profilComplet: profilComplet(), besoinParDefaut, zonesPretes: zonesActives().length > 0,
            zones: cfg.zones, secteurs: cfg.secteurs, rendement: rendementParMetier(app.etat), zoneDeLaSemaine: zoneDeLaSemaine(),
            maxRecherchesParJour: cfg.maxRecherchesParJour, reserveProspectsPrets: cfg.reserveProspectsPrets, j0ParJour: cfg.j0ParJour,
            maxEmailsParJour: cfg.maxEmailsParJour, fenetres: cfg.fenetres,
            joursEnvoi: cfg.joursEnvoi, joursRecherche: cfg.joursRecherche || [1, 2, 3, 4, 5], relances: cfg.relances, ecartMinutes: cfg.ecartMinutes, sauterFeries: cfg.sauterFeries !== false, expediteur: cfg.expediteur.adresse,
            messagerie: { nom: cfg.expediteur.nom, adresse: cfg.expediteur.adresse, smtpHote: cfg.smtp.hote, smtpPort: cfg.smtp.port, imapHote: cfg.imap.hote, imapPort: cfg.imap.port },
            dossierDrive: cfg.dossierDrive, application: !!app.hote?.actions,
            comptes: { ...(app.hote?.comptes ? app.hote.comptes() : {}), gmail: statutGmail(), envoi: modeEnvoi(), messagerie: { motDePasse: fs.existsSync(fichierSecret) } },
            demarrageAuto: app.hote?.demarrageAuto ? app.hote.demarrageAuto() : null,
        }
    },

    update(app, d) {
        const err = enregistrerReglages(d)
        if (err) throw new ErreurApi(err)
        noter(app.etat, 'reglages', 'Réglages modifiés')
        return { reglages: ReglagesController.getAll(app) }
    },
}
