// Common trades and their NAF codes (official register): typing a trade fills its codes, so DC Prospect can keep
// only the businesses that accept prospecting. Name shown -> NAF codes
export const TRADE_NAF = {
    'Coiffure': ['96.02A'], 'Institut de beauté': ['96.02B'], 'Spa et bien-être': ['96.04Z'], 'Tatoueur': ['96.09Z'], 'Toilettage': ['96.09Z'],
    'Boulangerie': ['10.71C', '10.71D'], 'Boucherie charcuterie': ['47.22Z', '10.13B'], 'Fleuriste': ['47.76Z'], 'Caviste': ['47.25Z'], 'Épicerie fine': ['47.29Z'],
    'Restaurant': ['56.10A', '56.10C'], 'Bar et café': ['56.30Z'], 'Traiteur': ['56.21Z'], 'Hôtel': ['55.10Z'], 'Chambres d\'hôtes et gîtes': ['55.20Z'],
    'Garage': ['45.20A', '45.20B'], 'Auto-école': ['85.53Z'], 'Taxi et VTC': ['49.32Z'], 'Déménagement': ['49.42Z'],
    'Plombier chauffagiste': ['43.22A', '43.22B'], 'Électricien': ['43.21A'], 'Menuisier': ['43.32A'], 'Peintre en bâtiment': ['43.34Z'], 'Maçon': ['43.99C'],
    'Couvreur': ['43.91B'], 'Carreleur': ['43.33Z'], 'Serrurier': ['43.32B'], 'Paysagiste': ['81.30Z'], 'Nettoyage': ['81.21Z'],
    'Artisan du bâtiment': ['43.21A', '43.22A', '43.32A', '43.34Z', '43.99C'],
    'Kinésithérapeute': ['86.90E'], 'Infirmier': ['86.90D'], 'Ostéopathe et psychologue': ['86.90F'], 'Paramédical': ['86.90E', '86.90F'], 'Dentiste': ['86.23Z'],
    'Vétérinaire': ['75.00Z'], 'Opticien': ['47.78A'], 'Coach et sport': ['85.51Z', '93.13Z'], 'Club sportif': ['93.12Z'],
    'Photographe': ['74.20Z'], 'Graphiste': ['74.10Z'], 'Architecte': ['71.11Z'], 'Avocat': ['69.10Z'], 'Expert-comptable': ['69.20Z'], 'Agence immobilière': ['68.31Z'],
    'Formation': ['85.59A'], 'Dépannage informatique': ['95.11Z'], 'Cordonnerie': ['95.23Z'], 'Pressing': ['96.01B'], 'Commerce de vêtements': ['47.71Z'],
    'Commerce de proximité': ['47.76Z', '10.71C', '47.22Z', '47.29Z'],
}
const plain = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
// NAF codes of a trade typed by the user (exact name, or a name that contains it), or []
export function nafOf(name) {
    const n = plain(name)
    if (!n) return []
    const exact = Object.entries(TRADE_NAF).find(([k]) => plain(k) === n)
    if (exact) return exact[1]
    return Object.entries(TRADE_NAF).find(([k]) => plain(k).includes(n) || n.includes(plain(k).split(' ')[0]))?.[1] || []
}
