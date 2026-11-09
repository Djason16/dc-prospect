// DC Prospect without window (fallback): node backend/run.mjs [--open]
import { exec } from 'node:child_process'
import { startEngine, stopEngine, address } from './engine.mjs'
import { notify } from './services/system.mjs'

const open = () => exec(`start "" "${address}"`)
if (!(await startEngine({ open, notify }))) { open(); process.exit(0) } // already running: just show the page
for (const s of ['SIGINT', 'SIGTERM', 'SIGBREAK']) process.on(s, () => { stopEngine(); process.exit(0) })
if (process.argv.includes('--open')) open()
