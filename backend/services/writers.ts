// Who searches and who writes, as chosen in Settings (Formule): the AI engine or the search and writing without AI.
// Shared by the search (leadSearch.ts), the batch of the day and the rewrites (prospecting.ts).
import { cfg } from './base.js'
import { writeFirstEmail, writeFollowUp } from './claude.js'
import { providerCanSearch, provider } from './ai.js'
import { modelInstalled } from './localAi.js'
import { localFirstEmail, localFollowUp } from './localWriter.js'
import { pickArm } from './learning.js'
import { templateFirstEmail, templateFollowUp } from './templates.js'
import type { WritingOptions } from './templates.js'
import type { Prospect, State, StepName, WrittenEmail, SubjectStyle, BodyStyle } from '../types.js'

// Engines chosen in Settings, Moteur: research with the AI (web) or without AI (register + web search API + site audit),
// writing with the AI or with the templates. An AI that cannot search the web falls back on the search without AI.
export const searchEngine = (): 'free' | 'ai' => (cfg.searchEngine === 'free' || !providerCanSearch() ? 'free' : 'ai')
// the built-in AI not downloaded yet: the templates write meanwhile
export const writingEngine = (): 'templates' | 'ai' => (cfg.writingEngine === 'templates' || (provider() === 'local' && !modelInstalled()) ? 'templates' : 'ai')
// the built-in AI polishes the templates (localWriter.ts): a small model must not write from nothing
const local = () => provider() === 'local'
export const firstEmail = (p: Prospect, options: WritingOptions): WrittenEmail | Promise<WrittenEmail> => (writingEngine() === 'templates' ? templateFirstEmail(p, options) : local() ? localFirstEmail(p, options) : writeFirstEmail(p, options))
export const followUp = (p: Prospect, step: StepName, fix?: string[]): { body: string } | Promise<{ body: string }> => (writingEngine() === 'templates' ? templateFollowUp(p, step) : local() ? localFollowUp(p, step, fix) : writeFollowUp(p, step, fix))
// Style of subject of the next first e-mail: each style is tried, then the one that makes people reply is used more (bandit)
export const nextSubjectStyle = (state: State) => pickArm<SubjectStyle>(state, ['A', 'B'], (p) => p.drafts?.first?.subjectStyle)
// Length of the first e-mail when it comes from the templates (without AI or built-in AI): standard or short, the one that makes people reply wins
export const nextBodyStyle = (state: State) => (writingEngine() === 'templates' || local() ? pickArm<BodyStyle>(state, ['standard', 'short'], (p) => p.drafts?.first?.bodyStyle) : null)
