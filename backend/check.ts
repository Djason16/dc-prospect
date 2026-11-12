// Checks everything the tool needs, without sending anything: npm run check (compiles, then runs out/backend/check.js)
import fs from 'node:fs'
import { cfg } from './services/base.js'
import { testConnection, sendingReady, sendingMode, signatureHtml } from './services/mail.js'
import { checkClaude } from './services/claude.js'
import { errorMessage } from './utils/ResponseHelper.js'

const ok = (t: string): void => console.log('  OK     ' + t)
const failed = (t: string, e: unknown): void => console.log('  ÉCHEC  ' + t + ' : ' + errorMessage(e))
console.log('\nVérification de DC Prospect\n')
try { fs.accessSync(cfg.dataFolder); ok('Dossier des données : ' + cfg.dataFolder) } catch (e) { failed('Dossier des données', e) }
try { signatureHtml().includes('<table') ? ok('Signature HTML trouvée') : failed('Signature', 'bloc introuvable') } catch (e) { failed('Signature', e) }
if (!sendingReady()) failed('Envoi', `pas encore branché (${sendingMode() === 'gmail' ? 'Gmail' : 'boîte pro'}) : Réglages, Comptes, dans l'application`)
else try { await testConnection(); ok(`Envoi et lecture (${sendingMode() === 'gmail' ? 'Gmail' : cfg.smtp.host})`) } catch (e) { failed('Envoi et lecture', e) }
try { (await checkClaude()) ? ok('Claude Code répond') : failed('Claude Code', 'réponse inattendue') } catch (e) { failed('Claude Code', e) }
try { const r = await fetch('https://recherche-entreprises.api.gouv.fr/search?q=boulangerie&per_page=1'); r.ok ? ok('Registre des entreprises joignable') : failed('Registre', 'HTTP ' + r.status) } catch (e) { failed('Registre', e) }
console.log('')
