// What the creation wizard needs from where it runs: the keeper's account pages, or a player's
// phone opened from a table link (no account). Steps read it with useWizardHost().
import { createContext, useContext, type ComponentType } from 'react'
import { newDraft, type CreationDraft } from '@/engine/creation'
import { supabase } from '@/lib/supabase'
import type { ProfileField } from '@/rules/d100'
import type { Lang } from '@/settings/lang'
import { usePlayers } from '../api'
import { PlayerField } from './PlayerField'

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
  /** Throws the function's error (FunctionsHttpError) when it refuses. */
  suggestProfile: (body: ProfileRequest) => Promise<ProfileSuggestions>
  /** localStorage key of the unsaved draft. */
  draftKey: string
}

/** Calls suggest-profile with the given extra body fields (the keeper's session goes in the headers). */
export async function invokeSuggestProfile(body: ProfileRequest & { link?: string }): Promise<ProfileSuggestions> {
  const { data, error } = await supabase.functions.invoke<{ suggestions: ProfileSuggestions }>('suggest-profile', { body })
  if (error) throw error
  return data?.suggestions ?? {}
}

export const keeperWizardHost: WizardHost = {
  PlayerInput: PlayerField,
  usePlayerName: (playerId) => {
    const players = usePlayers()
    return players.data?.find((p) => p.id === playerId)?.name
  },
  suggestProfile: (body) => invokeSuggestProfile(body),
  // Unsaved new investigator, kept per browser so a reload doesn't lose it (like the legacy S.draft).
  draftKey: 'grimoire-character-draft',
}

const WizardHostContext = createContext<WizardHost>(keeperWizardHost)
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
