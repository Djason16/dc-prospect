// Small DOM helpers
// $ is for elements the view has just drawn (they are there): typed as found, a missing one shows up as an error in the
// console, like before. Ask for the precise type when a field is read: $<HTMLInputElement>('#search').value
export const $ = <T extends Element = HTMLElement>(s: string, el: ParentNode = document): T => el.querySelector<T>(s) as T
export const $$ = <T extends Element = HTMLElement>(s: string, el: ParentNode = document): T[] => [...el.querySelectorAll<T>(s)]
const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
export const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, (c) => ENTITIES[c] ?? c)
// 12.5 -> "12,5 %" (French decimal comma)
export const pct = (v: number | string): string => String(v).replace('.', ',') + ' %'

// Tables become cards in a narrow window (tables.css): each cell gets the title of its column, shown before its value.
// Lines that do not follow the columns (a prospect's card, « pas encore de données ») keep no title.
export function labelCells(root: ParentNode = document): void {
    for (const table of $$<HTMLTableElement>('table.table', root)) {
        const titles = $$('thead th', table).map((th) => th.textContent?.replace(/[↑↓]/g, '').trim() || '')
        for (const row of $$<HTMLTableRowElement>('tbody tr', table)) {
            if (row.cells.length !== titles.length) continue
            for (const [i, cell] of [...row.cells].entries()) if (titles[i]) cell.dataset.label = titles[i]
        }
    }
}
