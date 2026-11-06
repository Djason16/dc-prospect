// Checks everything the tool needs, without sending anything: npm run tester
import fs from 'node:fs'
import { cfg } from './services/base.mjs'
import { testerConnexion, envoiBranche, modeEnvoi, signatureHtml } from './services/mail.mjs'
import { verifierClaude } from './services/claude.mjs'

const ok = (t) => console.log('  OK     ' + t)
const ko = (t, e) => console.log('  ÉCHEC  ' + t + ' : ' + (e?.message || e))
console.log('\nVérification de DC Prospect\n')
try { fs.accessSync(cfg.dossierDrive); ok('Dossier des données : ' + cfg.dossierDrive) } catch (e) { ko('Dossier des données', e) }
try { signatureHtml().includes('<table') ? ok('Signature HTML trouvée') : ko('Signature', 'bloc introuvable') } catch (e) { ko('Signature', e) }
if (!envoiBranche()) ko('Envoi', `pas encore branché (${modeEnvoi() === 'gmail' ? 'Gmail' : 'boîte pro'}) : Réglages, Comptes, dans l'application`)
else try { await testerConnexion(); ok(`Envoi et lecture (${modeEnvoi() === 'gmail' ? 'Gmail' : cfg.smtp.hote})`) } catch (e) { ko('Envoi et lecture', e) }
try { (await verifierClaude()) ? ok('Claude Code répond') : ko('Claude Code', 'réponse inattendue') } catch (e) { ko('Claude Code', e) }
try { const r = await fetch('https://recherche-entreprises.api.gouv.fr/search?q=boulangerie&per_page=1'); r.ok ? ok('Registre des entreprises joignable') : ko('Registre', 'HTTP ' + r.status) } catch (e) { ko('Registre', e) }
console.log('')
