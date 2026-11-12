// Settings: config.json (defaults) + Données\settings.json (shared), and local.json (this PC only)

// ---------- Settings ----------
export interface Profile {
    firstName?: string
    lastName?: string
    company?: string
    activity?: string
    offer?: string
    website?: string
    city?: string
    phone?: string
    title?: string
    need?: string
    bookingUrl?: string
    mainSignature?: string
    secondSignature?: string
    secondSignatureName?: string
}
export type ProfileField = keyof Profile

export interface Zone {
    name: string
    departments: string[]
    postalCodes: string[]
    active?: boolean
    /** number of towns in a « town and N km around » zone */
    towns?: number
}

export interface Trade {
    name: string
    naf: string[]
    active?: boolean
}

export type ProviderId = 'local' | 'claude-code' | 'gemini' | 'anthropic' | 'openai'

export interface AiSettings {
    provider: ProviderId
    baseUrl: string
    searchModel: string
    writingModel: string
}

export interface MailServer {
    host: string
    port: number
}

export interface Config {
    dataFolder: string
    promptsFolder?: string
    signature?: string
    sender: { name: string, address: string }
    smtp: MailServer
    imap: MailServer
    profile: Profile
    port: number
    searchModel?: string
    writingModel?: string
    parallelSearches: number
    maxSearchesPerDay: number
    readyReserve: number
    /** day of the week (0 = Sunday) -> first e-mails that day */
    firstEmailsPerDay: Record<string, number>
    sendDays: number[]
    searchDays: number[]
    skipHolidays: boolean
    maxEmailsPerDay: number
    sendWindows: [string, string][]
    gapMinutes: [number, number]
    followUpDays: { first: number, second: number }
    forgetAfterDays: number
    zones: Zone[]
    trades: Trade[]
    ai?: Partial<AiSettings>
    searchEngine?: 'free' | 'ai'
    writingEngine?: 'templates' | 'ai'
    warmup?: { enabled: boolean, startedOn: string | null }
    localModel?: LocalModelId
    pauseUntil?: string | null
    dailyDigest?: boolean
    autoApproveFollowUps?: boolean
}

export type LocalModelId = 'qwen3-4b' | 'ministral-8b'

/** Settings of this PC only (%APPDATA%\prospection-auto\local.json) */
export interface LocalSettings {
    dataFolder?: string
    promptsFolder?: string
    signature?: string
    sendingMode?: 'gmail' | 'mailbox'
    autoStart?: boolean
    mcpPath?: string
    mcpDeclaredAt?: string
}
