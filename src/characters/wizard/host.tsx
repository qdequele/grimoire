// What the creation wizard needs from where it runs: the keeper's account pages (keeperHost.ts), a
// player's phone opened from a table link (no account), or the free public tool (no account, no
// server). Steps read it with useWizardHost(). Nothing here talks to Supabase, so the public tool
// can be rendered at build time.
import { createContext, useContext, type ComponentType } from 'react'
import { newDraft, type CreationDraft } from '@/engine/creation'
import type { ProfileField } from '@/rules/d100'
import type { Lang } from '@/settings/lang'

/** What the suggest-profile function needs to know (see supabase/functions/_shared/profile.ts). */
export interface ProfileRequest {
  name: string
  occupation: string
  age: number
  /** The investigator's link with the story. */
  storyLink: string
  characteristics: CreationDraft['characteristics']
  /** Best skills, already labelled, e.g. "Bibliothèque 70". */
  skills: string[]
  profile: CreationDraft['profile']
  /** Only regenerate this field (↻). */
  field?: ProfileField
  lang: Lang
}

export type ProfileSuggestions = Partial<Record<ProfileField, string>>

export interface WizardHost {
  /** "Who plays this investigator" on the concept step. */
  PlayerInput: ComponentType<{ value: string; onChange: (playerId: string) => void }>
  /**
   * The player's name for the summary. A hook (called once per render of the summary step): the
   * keeper's version reads the players list.
   */
  usePlayerName: (playerId: string | undefined) => string | undefined
  /** Throws the function's error (FunctionsHttpError) when it refuses. Absent: no AI help (the public tool). */
  suggestProfile?: (body: ProfileRequest) => Promise<ProfileSuggestions>
  /** localStorage key of the unsaved draft. */
  draftKey: string
  /**
   * Refuse < > & " in the name and the specialties: on a phone, where the database refuses them
   * (they would build HTML on the keeper's game screen). The keeper's own sheets may hold them.
   */
  noMarkup?: boolean
}

/** localStorage key of the keeper's unsaved new investigator (the public tool hands its draft over through it). */
export const KEEPER_DRAFT_KEY = 'grimoire-character-draft'

/** Each page provides its host; this one only keeps the context typed. */
const noHost: WizardHost = {
  PlayerInput: () => null,
  usePlayerName: () => undefined,
  draftKey: KEEPER_DRAFT_KEY,
}

const WizardHostContext = createContext<WizardHost>(noHost)
export const WizardHostProvider = WizardHostContext.Provider
export const useWizardHost = (): WizardHost => useContext(WizardHostContext)

export function loadLocalDraft(key: string): CreationDraft {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as CreationDraft
  } catch {
    /* unavailable or corrupt: start fresh */
  }
  return newDraft()
}

export function saveLocalDraft(key: string, d: CreationDraft | null) {
  try {
    if (d) localStorage.setItem(key, JSON.stringify(d))
    else localStorage.removeItem(key)
  } catch {
    /* not remembered, that's fine */
  }
}
