// The state file (Données\prospects.json): prospects, their drafts, sent steps, replies and tracking

// ---------- Prospects ----------
export type StepName = 'first' | 'followUp1' | 'followUp2'
export type ProspectStatus = 'ready' | 'inSequence' | 'replied' | 'stopped' | 'discarded' | 'finished' | 'client' | 'otherChannel'
export type DraftStatus = 'reserved' | 'toApprove' | 'approved' | 'sent' | 'rejected' | 'cancelled'
export type ReplyKindName = 'interested' | 'question' | 'later' | 'no'
/** what an answer to a reply is about: a kind, or the « later » prospect whose date has come */
export type AnswerKind = ReplyKindName | 'recontact'
export type SubjectStyle = 'A' | 'B'
export type BodyStyle = 'standard' | 'short'

export interface Draft {
    subject: string
    body: string
    status: DraftStatus
    preparedOn?: string
    batch?: string
    subjectStyle?: SubjectStyle
    bodyStyle?: BodyStyle
    writer?: 'templates' | 'ai'
    problems?: string[]
    approvedAt?: string
    autoApproved?: boolean
}

export interface SentStep {
    sentOn: string
    at?: string
    messageId?: string
    threadId?: string
    subject?: string
}

export interface Reply {
    date: string
    subject?: string
    excerpt: string
    read?: boolean
    messageId?: string
    kind: ReplyKindName
    kindConfirmed?: boolean
    byPhone?: boolean
    /** a « later » prospect whose date has come */
    recontact?: boolean
    /** answer prepared for this reply, and the answer sent */
    answer?: ReplyAnswer | null
    answered?: { on: string, messageId?: string, body: string } | null
}

export interface ReplyAnswer { body: string, preparedOn: string, problems: string[] }

export interface Tracking {
    call?: string
    mockup?: string
    proposal?: string
    client?: string
    handled?: string | null
    result?: string
}

export interface CallRecord {
    on: string
    outcome: 'interested' | 'no' | 'later' | 'noAnswer'
}

export interface PageSpeedResult {
    performance: number | null
    seo: number | null
    lcp: number | null
}

/** What the site audit keeps on the prospect */
export interface ProspectAudit {
    signals: string[]
    platform?: string | null
    https?: boolean
    mobile?: boolean | null
    ms?: number
    copyrightYear?: number | null
    checkedOn?: string
    tagline?: string | null
    speed?: PageSpeedResult
}

export interface Prospect {
    id: string
    company: string
    legalName?: string
    trade: string
    naf?: string
    association?: boolean
    city: string
    postalCode?: string
    zone?: string
    address?: string
    source?: string
    addedOn: string
    status: ProspectStatus
    reason?: string
    steps: Partial<Record<StepName, SentStep>>
    drafts: Partial<Record<StepName, Draft>>
    email: string | null
    emailSource?: string | null
    emailChecked?: boolean
    contact?: string | null
    website?: string | null
    platform?: string | null
    usesBooking?: string
    phone?: string | null
    signal: string
    googleRating?: string | null
    socials?: string | null
    /** saved by the AI research of older versions */
    instagram?: string | null
    detail?: string | null
    score: number
    level?: string
    pack?: string
    siren?: string | null
    audit?: ProspectAudit | null
    callHook?: string | null
    chance?: number | null
    reply?: Reply
    tracking?: Tracking
    calls?: CallRecord[]
    callBackOn?: string
    remindOn?: string
    stoppedOn?: string
    notes?: string
    imported?: boolean
}

export interface LogEntry {
    date: string
    type: string
    text: string
    id?: string
    [extra: string]: unknown
}

export interface LastSearch {
    day: string
    engine: 'free' | 'ai'
    attempts: number
    examined: number
    found: number
    toCall: number
    skipped: number
    errors: number
    pairsLeft: number
    brave: boolean
}

export interface ReplyModel {
    weights: Record<string, number>
    n: number
    positives: number
    baseRate: number
    trainedOn: string
}

export interface State {
    version: number
    prospects: Prospect[]
    stop: string[]
    blockedDomains?: string[]
    forgottenIds?: string[]
    sendsPerDay: Record<string, number>
    searchesPerDay: Record<string, number>
    searchedPairs?: Record<string, string>
    seenMessages: string[]
    log: LogEntry[]
    replyModel?: ReplyModel | null
    lastSentAt?: string
    nextGapMinutes?: number
    lastSearch?: LastSearch
    lastDay?: string
    firstSearchOn?: string
    testEmailOn?: string
    digestOn?: string
}
