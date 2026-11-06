// Small message at the bottom right, and the "button action" helper (disables the button, shows the result)
import { $ } from '../../utils/dom.js'

export function toast(texte, erreur = false) {
    const t = document.createElement('div')
    t.className = 'toast' + (erreur ? ' erreur' : '')
    t.textContent = texte
    $('#toasts').append(t)
    setTimeout(() => t.remove(), erreur ? 9000 : 5000)
}

export async function action(bouton, f, succes) {
    if (bouton) bouton.disabled = true, bouton.classList.add('charge')
    try {
        const r = await f()
        if (succes) toast(typeof succes === 'function' ? succes(r) : succes)
        return r
    } catch (e) {
        toast(e.message, true)
        return null
    } finally {
        if (bouton) bouton.disabled = false, bouton.classList.remove('charge')
    }
}

// Second click needed (no browser dialog, they block the app)
export function confirmer(bouton, texte = 'Confirmer') {
    if (bouton.dataset.sur) return true
    bouton.dataset.sur = '1'
    const avant = bouton.textContent
    bouton.textContent = texte
    setTimeout(() => { delete bouton.dataset.sur; bouton.textContent = avant }, 4000)
    return false
}
