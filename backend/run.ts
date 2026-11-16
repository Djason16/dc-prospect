// DC Prospect without window (fallback): npm run engine, or node out/backend/run.js [--open]
import { exec } from 'node:child_process'
import { startEngine, stopEngine, address } from './engine.js'
import { notify } from './services/system.js'
import { isWindows, openWithSystem } from './services/platform.js'

const open = () => (isWindows ? exec(`start "" "${address}"`) : openWithSystem(address))
if (!(await startEngine({ open, notify }))) { open(); process.exit(0) } // already running: just show the page
for (const s of isWindows ? ['SIGINT', 'SIGTERM', 'SIGBREAK'] : ['SIGINT', 'SIGTERM']) process.on(s, () => { stopEngine(); process.exit(0) })
if (process.argv.includes('--open')) open()
