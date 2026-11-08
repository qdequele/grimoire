// The keeper's wizard host: their players list and the suggest-profile function, under their session.
import { supabase } from '@/lib/supabase'
import { usePlayers } from '../api'
import { KEEPER_DRAFT_KEY, type ProfileRequest, type ProfileSuggestions, type WizardHost } from './host'
import { PlayerField } from './PlayerField'

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
  // The public tool hands its investigator over to the account through this same key.
  draftKey: KEEPER_DRAFT_KEY,
}
