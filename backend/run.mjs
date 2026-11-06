// DC Prospect without window (fallback): node backend/run.mjs [--ouvrir]
import { exec } from 'node:child_process'
import { demarrerMoteur, arreterMoteur, adresse } from './moteur.mjs'
import { notifier } from './services/systeme.mjs'

const ouvrir = () => exec(`start "" "${adresse}"`)
if (!(await demarrerMoteur({ ouvrir, notifier }))) { ouvrir(); process.exit(0) } // already running: just show the page
for (const s of ['SIGINT', 'SIGTERM', 'SIGBREAK']) process.on(s, () => { arreterMoteur(); process.exit(0) })
if (process.argv.includes('--ouvrir')) ouvrir()
