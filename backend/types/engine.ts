// Search results (register, AI or without AI, site audit) and the engine shared with the server and the Windows app
import type { State } from './prospects.js'

// ---------- Search ----------
/** A business of the register that may be prospected */
export interface AllowedBusiness {
    name: string
    legalName: string
    siren: string
    postalCode: string
    city: string
    contact: string | null
}

export interface Town {
    name: string
    postalCode: string
    population: number
}

/** A business found by a search (AI or without AI), before the checks */
export interface FoundCompany {
    name: string
    city?: string
    postalCode?: string | null
    email?: string | null
    emailSource?: string | null
    website?: string | null
    platform?: string
    usesBooking?: string
    signal?: string
    detail?: string | null
    contact?: string | null
    phone?: string | null
    callHook?: string | null
    googleRating?: string | null
    socials?: string | null
    score?: number | string
    level?: string
    pack?: string
    siren?: string
    /** already audited by the search without AI (null: no site) */
    audit?: SiteAudit | null
}

/** Result of the reading of a site (siteAudit.ts) */
export interface SiteAudit {
    website: string
    reachable: boolean
    finalUrl: string
    https: boolean
    ms: number
    bytes: number
    platform: string | null
    mobile: boolean | null
    copyrightYear: number | null
    title: string
    emails: string[]
    phones: string[]
    hasForm: boolean
    signals: string[]
    needScore: number
    checkedOn: string
    description?: boolean
    wordpress?: string | null
    tagline?: string | null
}

/** A written e-mail: subject and text */
export interface WrittenEmail {
    subject: string
    body: string
}

// ---------- Engine ----------
/** What the Windows app gives the engine (electron/main.ts), or run.ts without a window */
export interface Host {
    open(): void
    notify(title: string, text: string): void
    version?: string
    autoStart?: () => boolean
    health?: () => Record<string, unknown>
    accounts?: () => Record<string, unknown>
    actions?: Record<string, (value?: unknown) => unknown>
    routes?: Record<string, (url: URL, res: import('node:http').ServerResponse) => void>
}

export interface App {
    state: State
    busy: boolean
    progress: string
    error: string
    standby: string | null
    claudeOk: boolean
    mailboxOk: boolean
    notes: string[]
    lastSync: number
    pageOpenedOn: string | null
    timer: NodeJS.Timeout | null
    host?: Host
    health(): Record<string, unknown>
    changed(): void
    writeReports(): Promise<void>
    sync(): Promise<void>
    runDay(force?: boolean): Promise<void>
    tick(): Promise<void>
}

/** Body of an API request, as sent by the interface (checked by each controller) */
export type RequestData = Record<string, unknown>
