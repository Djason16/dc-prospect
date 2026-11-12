// What the interface knows: state of the day (day), settings (settings), current view, whether I am typing in an e-mail
import type { DayState, MailGuide, Settings } from '../types.js'

export type View = 'today' | 'prospects' | 'settings' | 'help'

export interface Store {
    day: DayState | null
    settings: Settings | null
    view: View
    editing: boolean // typing in an e-mail to approve: the refresh does not redraw them
    replying: boolean // typing an answer to a prospect
    sort?: { key: string; desc: boolean } // column of the prospects table
    openDetail?: string | null // id of the prospect whose card is open
    firstSearchAsked?: boolean
    autoSetupFor?: string // sending address whose servers were already looked for
    mailGuide?: MailGuide
}

export const store: Store = { day: null, settings: null, view: 'today', editing: false, replying: false }
