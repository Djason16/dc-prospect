// Small message at the bottom right, and the "button action" helper (disables the button, shows the result)
import { $ } from '../../utils/dom.js'

export function toast(text: string | undefined, isError = false): void {
    const t = document.createElement('div')
    t.className = 'toast' + (isError ? ' error' : '')
    t.textContent = text ?? ''
    $('#toasts').append(t)
    setTimeout(() => t.remove(), isError ? 9000 : 5000)
}

// successMessage: a text, or a function of the result (« 3 lignes en cours de vérification »)
export async function runAction<T>(button: HTMLButtonElement | null, work: () => Promise<T>, successMessage?: string | ((result: T) => string)): Promise<T | null> {
    if (button) { button.disabled = true; button.classList.add('loading') }
    try {
        const r = await work()
        if (successMessage) toast(typeof successMessage === 'function' ? successMessage(r) : successMessage)
        return r
    } catch (e) {
        toast((e as Error).message, true)
        return null
    } finally {
        if (button) { button.disabled = false; button.classList.remove('loading') }
    }
}

// Second click needed (no browser dialog, they block the app)
export function confirmClick(button: HTMLButtonElement, text = 'Confirmer'): boolean {
    if (button.dataset.armed) return true
    button.dataset.armed = '1'
    const before = button.textContent
    button.textContent = text
    setTimeout(() => { delete button.dataset.armed; button.textContent = before }, 4000)
    return false
}
