// DC Prospect without window (fallback): npm run engine, or node out/backend/run.js [--open]
import { exec } from 'node:child_process'
import { startEngine, stopEngine, address } from './engine.js'
import { notify } from './services/system.js'

const open = () => exec(`start "" "${address}"`)
if (!(await startEngine({ open, notify }))) { open(); process.exit(0) } // already running: just show the page
for (const s of ['SIGINT', 'SIGTERM', 'SIGBREAK']) process.on(s, () => { stopEngine(); process.exit(0) })
if (process.argv.includes('--open')) open()
