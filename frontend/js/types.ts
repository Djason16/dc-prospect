// Shapes of the data the interface receives from the local API (backend/controllers): state of the day, settings, accounts.
// Written from the controllers' answers; optional fields are the ones the engine can leave out.

// Every answer: { success: true, ...data } or { success: false, error, status }
export type ApiFailure = { success: false; error?: string; status?: number; type?: string }
export type ApiSuccess<T> = { success: true } & T
export type ApiResult<T> = ApiSuccess<T> | ApiFailure

export type Step = 'first' | 'followUp1' | 'followUp2'
export type ReplyKind = 'interested' | 'question' | 'later' | 'no'

// ---------- GET /api/state ----------
// One e-mail to approve or waiting for its time slot
export interface EmailCardData {
    id: string; step: Step; stepName: string; subject: string; body: string; batch?: string; problems: string[]
    status: string; autoApproved: boolean; hints?: string[]; company: string; trade: string; city: string; zone?: string; email: string
    emailSource?: string; website?: string; platform?: string; signal?: string; googleRating?: string | number; detail?: string
    score?: number; level?: string; facts?: string[]; emailChecked: boolean; chance: number | null; subjectStyle: string | null
    writer: string | null; firstSentOn: string
}

export interface ReplyCard {
    id: string; company: string; city: string; email: string; date: string; excerpt: string; kind: ReplyKind; kindLabel: string
    recontact: boolean; kindConfirmed: boolean; answer: { body: string } | null; answered: boolean
}

export interface CallCard {
    id: string; company: string; trade: string; city: string; phone?: string; website?: string; signal?: string; level?: string
    callHook?: string; contact?: string; calls: number
}

export interface DiscardedCard { id: string; company: string; trade?: string; city?: string; reason: string; restorable: boolean }

// One line of the table of the prospects (and its card when opened)
export interface TrackedProspect {
    id: string; company: string; trade: string; city: string; zone?: string; email?: string; status: string; score?: number
    first: string; followUp1: string; followUp2: string; next: string; reply: string
    website: string; phone: string; contact: string; level: string; facts: string[]; notes: string
    sent: { step: string; on: string; subject: string; body: string }[]
    calls: string[]; reason: string; remindOn: string
}

// Figures of a period (report.mjs figures())
export interface Figures {
    emails: number; contacted: number; replies: number; stops: number; calls: number; proposals: number; clients: number; found: number
    replyRate: number; meetingRate: number; signingRate: number; stopRate: number
}
export interface TradeFigures { trade: string; found: number; opposed: number; toCall: number; hot: number; contacted: number; replies: number; replyRate: number; clients: number }
export interface SubjectFigures { style: string; contacted: number; replies: number; replyRate: number }
export interface Moment { moment: string; sent: number; replies: number; replyRate: number }
export interface ArmStat { given: number; settled: number; wins: number }

export interface Stats {
    zones: (Figures & { zone: string })[]; week: Figures; total: Figures; trades: TradeFigures[]; subjects: SubjectFigures[]
    ready: number; reserve: number
    learning: { n: number; positives: number; trainedOn: string; helps: string[]; hurts: string[] } | null
    moments: { days: Moment[]; parts: Moment[] } | null
    sending: { sent: number; bounceRate: number; stopRate: number; slowed: boolean; advice: string[] }
    bodies: Record<string, ArmStat | undefined>
}

export interface Health {
    password?: boolean; mailbox?: boolean; claude?: boolean; drive?: boolean; machine?: string; version?: string
    standby?: string | null; inApp?: boolean; update?: { version: string; file?: string; notes?: string } | null
}

export interface DayState {
    today: string; zone: string; busy: boolean; progress: string; error: string; sent: number; max: number; inWindow: boolean
    windows: string; sendDays: string; nextSendDay: string; pauseUntil: string | null
    toApprove: EmailCardData[]; queue: EmailCardData[]; replies: ReplyCard[]; toCall: CallCard[]
    searchAdvice: { found: number; examined: number; tips: string[] } | null
    blockedDomains: number; testEmailDone: boolean; discarded: DiscardedCard[]; tracked: TrackedProspect[]
    stats: Stats; health: Health; log: { time: string; text: string }[]
}

// ---------- GET /api/settings ----------
export interface Profile {
    firstName?: string; lastName?: string; company?: string; activity?: string; offer?: string; website?: string; city?: string
    phone?: string; title?: string; need?: string; bookingUrl?: string; mainSignature?: string; secondSignature?: string; secondSignatureName?: string
}
export interface Zone { name: string; departments: string[]; postalCodes: string[]; active: boolean }
export interface Trade { name: string; naf: string[]; active: boolean }
export type TimeSlot = [string, string]

export interface LocalModel { name: string; label: string; text: string; sizeGb: number; installed: boolean }
export interface LocalAiStatus {
    id: string; name: string; installed: boolean; sizeGb: number; suggested: string; models: Record<string, LocalModel>
    downloading: string | null; progress: number; error?: string | null
}

export interface EngineSettings {
    provider: string; baseUrl?: string; searchModel?: string; writingModel?: string
    providers: Record<string, { name: string; web: boolean; key: boolean; keySaved: boolean }>
    canSearch: boolean; searchEngine: 'ai' | 'free'; writingEngine: 'ai' | 'templates'; searchKey: boolean; speedKey: boolean
    local: LocalAiStatus; chosen: boolean; aiReady: boolean; ready: boolean; usesAi: boolean
}

export interface ClaudeStatus { installed: boolean; connected: boolean; email?: string; plan?: string; expires?: string }
export interface GoogleStatus {
    client: boolean; connected: boolean; email: string | null; canRead: boolean; options?: { sheets?: boolean; docs?: boolean }
    folder: string | null; spreadsheet: string | null
}
// Accounts: those of the Windows app (claude, google, update...) only when the page runs inside it
export interface Accounts {
    claude?: ClaudeStatus; google?: GoogleStatus; mailbox?: { password: boolean }; folder?: string; update?: { version: string } | null
    version?: string; mcp?: string | null; gmail?: { configured: boolean; address?: string }; sendingMode?: 'gmail' | 'mailbox'
}

export interface Mailbox { name: string; address: string; smtpHost: string; smtpPort: number | string; imapHost: string; imapPort: number | string }

export interface Settings {
    firstSearchDone: boolean; profile: Profile; profileComplete: boolean; defaultNeed: string; zonesReady: boolean
    zones: Zone[]; trades: Trade[]; tradeYield?: Record<string, number>; zoneOfTheWeek: string | null
    maxSearchesPerDay: number; readyReserve: number; firstEmailsPerDay?: Record<string, number>; maxEmailsPerDay: number
    sendWindows: TimeSlot[]; sendDays: number[]; searchDays: number[]; followUpDays?: { first: number; second: number }
    gapMinutes?: [number, number]; skipHolidays: boolean; sender: string; mailbox: Mailbox; dataFolder: string; inApp: boolean
    accounts: Accounts; engine: EngineSettings; warmup: { enabled?: boolean; limitToday: number }
    pauseUntil: string | null; dailyDigest: boolean; autoApproveFollowUps: boolean; autoStart: boolean | null
}

// Steps for my mail provider (POST /api/accounts/auto-setup)
export interface MailGuide { name: string | null; mode?: string; steps: string[]; warning?: string }
// Mail host found from my address (POST /api/accounts/detect-mail)
export interface MailHost { name: string; gmail: boolean; smtpHost?: string; smtpPort?: number; imapHost?: string; imapPort?: number }
// SPF, DKIM, DMARC of the sending domain (POST /api/accounts/deliverability)
export interface DomainCheck { ok?: boolean; webmail?: boolean; mx?: boolean; spf?: boolean; dkim?: boolean; dmarc?: boolean; advice: string[] }
export interface Template { name: string; label: string; text: string; custom?: boolean }
export interface SampleEmail { company: string; writer: string; subject: string; body: string; hints?: string[] }
