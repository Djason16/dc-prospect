// Engine of DC Prospect: prepares the day, serves the app page, sends approved e-mails in the plan's time slots.
// Used by the Windows app (electron/main.mjs) and by run.mjs (without window). hote = { ouvrir(), notifier(titre, texte), version, ... }
import fs from 'node:fs'
import { cfg, jour, estJourRecherche, chargerEtat, sauverEtat, log } from './services/base.mjs'
import { synchroniserReponses, rechercher, preparerLot, envoyerSuivant, oublier, aValider } from './services/prospection.mjs'
import { ecrireRapport, ecrireTableau } from './services/rapport.mjs'
import { demarrerServeur } from './server.mjs'
import { envoiBranche } from './services/mail.mjs'
import { profilComplet, zonesActives } from './services/reglages.mjs'
import { machine, version, prendreVerrou, rendreVerrou, nettoyerJournaux } from './services/systeme.mjs'

export const adresse = `http://localhost:${cfg.port}`
let hote = { ouvrir() {}, notifier() {} }
const ouvrirPage = () => hote.ouvrir()
const notifier = (t, x) => hote.notifier(t, x)
const aRepondre = (etat) => etat.prospects.filter((p) => p.statut === 'repondu' && !p.suivi?.traite)

export const app = {
    etat: chargerEtat(),
    occupe: false, avancement: '', erreur: '', veille: null, claudeOk: true, messagerieOk: true,
    infos: [], derniereSynchro: 0, pageOuverteLe: null, minuteur: null,
    sante() {
        return {
            motDePasse: envoiBranche(), messagerie: this.messagerieOk, claude: this.claudeOk,
            drive: fs.existsSync(cfg.dossierDrive), machine, version: hote.version || version(), veille: this.veille, ...(hote.sante ? hote.sante() : {}),
        }
    },
    changement() {
        if (this.veille) return
        sauverEtat(this.etat)
        clearTimeout(this.minuteur)
        this.minuteur = setTimeout(() => this.ecrireRapports(), 5000)
    },
    async ecrireRapports() {
        try {
            ecrireRapport(this.etat, { infos: this.infos })
            await ecrireTableau(this.etat)
        } catch (e) { log('Rapport non écrit :', e.message) }
    },
    async synchro() {
        const avant = aRepondre(this.etat).length
        try {
            const n = await synchroniserReponses(this.etat)
            this.derniereSynchro = Date.now()
            this.messagerieOk = true
            if (this.erreur.startsWith('Messagerie')) this.erreur = ''
            if (n) this.changement()
            const nouvelles = aRepondre(this.etat).length - avant
            if (nouvelles > 0) notifier('DC Prospect : réponse reçue', `${nouvelles} prospect(s) ont répondu. Ouvre DC Prospect pour la suite.`)
        } catch (e) {
            this.messagerieOk = false
            this.erreur = 'Messagerie : ' + e.message
            log(this.erreur)
        }
    },
    async lancerJournee(force = false) {
        if (this.occupe || this.veille) return
        this.occupe = true; this.erreur = ''; this.infos = []
        const aujourdhui = jour()
        const avancer = (t) => { this.avancement = t; log(t) }
        try {
            nettoyerJournaux()
            avancer('lecture des réponses et des STOP')
            await this.synchro()
            oublier(this.etat)
            // research and sending each follow their own days (Settings, Calendar)
            if (estJourRecherche(aujourdhui) || force) {
                avancer('recherche de nouveaux prospects')
                const r = await rechercher(this.etat, { surAvancement: avancer })
                this.claudeOk = !(r.essais && r.erreurs === r.essais)
                if (r.essais) this.infos.push(`${r.essais} recherches : ${r.trouves} prospects prêts.`)
                this.changement()
            } else {
                this.infos.push('Pas un jour de recherche (Réglages, Calendrier).')
            }
            avancer('préparation du lot du jour')
            await preparerLot(this.etat, { surAvancement: avancer }) // does nothing outside the sending days
            if (!profilComplet()) this.erreur = "Remplis ton profil (Aujourd'hui, Mise en route) : DC Prospect en a besoin pour chercher et écrire."
            else if (!zonesActives().length) this.erreur = "Choisis au moins une zone (Aujourd'hui, Mise en route)."
            else if (!envoiBranche()) this.erreur = "Envoi pas encore branché : ton Gmail ou ta boîte pro (Aujourd'hui, Mise en route). Rien ne peut partir avant."
            if (!this.claudeOk) this.erreur = 'Claude ne répond pas (connexion ou limite de l\'abonnement atteinte) : la recherche reprendra demain.'
            this.etat.derniereJournee = aujourdhui
            this.changement()
            await this.ecrireRapports()
        } catch (e) {
            this.erreur = 'Préparation interrompue : ' + e.message
            log(this.erreur, e.stack)
            this.changement()
        } finally {
            this.occupe = false; this.avancement = ''
        }
        const valider = aValider(this.etat).length, reponses = aRepondre(this.etat).length
        if ((valider || reponses || this.erreur) && this.pageOuverteLe !== aujourdhui) {
            this.pageOuverteLe = aujourdhui
            ouvrirPage()
            notifier('DC Prospect', [valider && `${valider} e-mail(s) à valider`, reponses && `${reponses} réponse(s) à traiter`, this.erreur].filter(Boolean).join(' · '))
        }
    },
    // Every minute: lock, new day, replies, an approved e-mail to send
    async tic() {
        const autre = prendreVerrou()
        if (autre) {
            if (!this.veille) log(`Le PC ${autre} fait déjà tourner l'outil : ce PC passe en veille`)
            this.veille = autre
            this.etat = chargerEtat() // show the data of the active PC
            return
        }
        if (this.veille) { log('Plus d\'autre PC actif : ce PC reprend'); this.veille = null; this.etat = chargerEtat() }
        if (this.occupe) return
        if (this.etat.derniereJournee !== jour()) { this.lancerJournee(); return } // not awaited: the lock keeps being refreshed every minute
        try {
            const enAttente = this.etat.prospects.some((p) => Object.values(p.brouillons || {}).some((b) => b.statut === 'valide'))
            if (Date.now() - this.derniereSynchro > (enAttente ? 5 : 15) * 60e3) await this.synchro()
            if (enAttente && this.messagerieOk) {
                const envoye = await envoyerSuivant(this.etat)
                if (envoye) this.changement()
            }
        } catch (e) {
            this.erreur = 'Envoi : ' + e.message
            log(this.erreur)
        }
    },
}

// Starts the engine; returns false if another copy already runs on this PC (port taken)
export async function demarrerMoteur(h = {}) {
    hote = { ...hote, ...h }
    app.hote = hote
    for (const p of app.etat.prospects) if (p.zone === 'IDF') p.zone = 'Île-de-France' // zone renamed in the settings
    try {
        await demarrerServeur(app)
    } catch (e) {
        if (e.code === 'EADDRINUSE') return false
        throw e
    }
    log(`DC Prospect ${hote.version || version()} démarrée sur ${machine} : ${adresse}`)
    let tourne = false
    const boucle = async () => { if (tourne) return; tourne = true; try { await app.tic() } catch (e) { log('Erreur :', e.message) } finally { tourne = false } }
    await boucle()
    setInterval(boucle, 60e3)
    return true
}

export function arreterMoteur() {
    try { if (!app.veille) sauverEtat(app.etat) } catch {}
    rendreVerrou()
}
