// Examples by activity, to fill the profile in one click (« Exemple pour mon activité »): what I offer, the signs that a
// business needs me (read by the AI when it searches), and the trades worth prospecting. Shown to the user: in French.
export const ACTIVITIES = [
    { match: /photo/i, offer: 'Shooting produits et plats dès 290 €, photos de l\'équipe et des locaux, abonnement photos pour les réseaux sociaux.',
        need: 'pas de photos professionnelles sur son site ou ses réseaux, photos floues, sombres ou prises au téléphone, images de banque d\'images génériques',
        trades: ['Restaurant', 'Institut de beauté', 'Commerce de proximité', 'Agence immobilière', 'Chambres d\'hôtes et gîtes'] },
    { match: /vid[ée]/i, offer: 'Vidéo de présentation dès 490 €, vidéos courtes pour les réseaux sociaux, film de l\'équipe au travail.',
        need: 'aucune vidéo sur son site ni ses réseaux, présentation uniquement en texte, réseaux peu actifs',
        trades: ['Restaurant', 'Hôtel', 'Coach et sport', 'Garage', 'Agence immobilière'] },
    { match: /graphi|design|logo|identit/i, offer: 'Logo et identité visuelle dès 350 €, cartes de visite, flyers, enseigne et habillage de vitrine.',
        need: 'logo daté ou de mauvaise qualité, pas d\'identité visuelle cohérente entre le site, les réseaux et l\'enseigne',
        trades: ['Restaurant', 'Commerce de proximité', 'Artisan du bâtiment', 'Coiffure', 'Traiteur'] },
    { match: /community|r[ée]seaux sociaux|social media/i, offer: 'Gestion des réseaux sociaux dès 290 € par mois, création de publications, réponses aux avis, publicité locale.',
        need: 'page Facebook ou Instagram abandonnée (pas de publication depuis des mois), peu d\'abonnés, avis Google sans réponse',
        trades: ['Restaurant', 'Coiffure', 'Institut de beauté', 'Coach et sport', 'Boulangerie'] },
    { match: /r[ée]dact|copywrit|contenu/i, offer: 'Textes de site dès 150 € la page, articles de blog, fiche Google réécrite.',
        need: 'site avec très peu de texte, fautes d\'orthographe, pas d\'actualités ni de blog, services mal expliqués',
        trades: ['Artisan du bâtiment', 'Paramédical', 'Agence immobilière', 'Avocat', 'Expert-comptable'] },
    { match: /seo|r[ée]f[ée]renc/i, offer: 'Audit de visibilité offert, référencement local dès 190 € par mois, fiche Google optimisée.',
        need: 'titre de la page sans la ville, pas de description pour Google, site lent, absent des premiers résultats de son métier dans sa ville',
        trades: ['Plombier chauffagiste', 'Électricien', 'Garage', 'Paramédical', 'Restaurant'] },
    { match: /web|site|d[ée]velopp|int[ée]grat|wordpress/i, offer: 'Site vitrine dès 490 €, refonte de site, référencement local, maintenance mensuelle.',
        need: 'pas de site, site daté ou lent, pas adapté au téléphone, fait avec Wix, Google Sites ou Canva, réservation seulement via une plateforme, peu de contenu',
        trades: ['Coiffure', 'Institut de beauté', 'Restaurant', 'Garage', 'Artisan du bâtiment'] },
]

export const activityExample = (activity) => ACTIVITIES.find((a) => a.match.test(activity || '')) || null
