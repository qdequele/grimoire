// The story creator's questionnaire: choices shown to the keeper and the form schema.
// Same ids as supabase/functions/_shared/story-create.ts (a unit test keeps them in sync); the
// function has the English descriptions sent to Claude, this file the French labels (en.ts translates).
import { z } from 'zod'

export const TONES = [
  { id: 'classic', label: 'Enquête classique', hint: 'archives, témoins, une angoisse qui monte' },
  { id: 'pulp', label: 'Pulp', hint: 'action, poursuites, héros audacieux' },
  { id: 'gothic', label: 'Gothique', hint: 'vieille demeure, secrets de famille' },
  { id: 'cosmic', label: 'Horreur cosmique', hint: 'une vérité trop vaste pour l’esprit humain' },
  { id: 'folk', label: 'Folklorique', hint: 'village isolé, rites anciens' },
  { id: 'noir', label: 'Noir', hint: 'crime, corruption, pluie sur la ville' },
] as const

export const THREATS = [
  { id: 'cult', label: 'Une secte', hint: 'un groupe secret et son projet' },
  { id: 'creature', label: 'Une créature', hint: 'quelque chose qui chasse ou attend' },
  { id: 'haunting', label: 'Une hantise', hint: 'un mort sans repos, un lieu maudit' },
  { id: 'sorcerer', label: 'Un sorcier', hint: 'un érudit qui joue avec l’interdit' },
  { id: 'human', label: 'Le mal humain', hint: 'meurtrier, famille, village qui se tait' },
] as const

export const LENGTHS = [
  { id: 'short', label: 'Courte soirée', hint: 'environ 2 heures, 4 à 6 scènes' },
  { id: 'oneshot', label: 'Une séance', hint: '3 à 4 heures, 6 à 9 scènes' },
  { id: 'multi', label: '2 ou 3 séances', hint: '10 à 14 scènes' },
] as const

/** Suggestions under the free-text fields (one click fills the field). */
export const ERA_CHOICES = ['Années 1920', 'Époque victorienne', 'Années 1950', 'De nos jours'] as const
export const PLACE_CHOICES = ['Un village côtier', 'Une grande ville', 'Un manoir isolé', 'Une université', 'Une expédition lointaine'] as const

const ids = <T extends readonly { id: string }[]>(list: T) => list.map((x) => x.id) as [T[number]['id'], ...T[number]['id'][]]

export const briefSchema = z.object({
  lang: z.enum(['fr', 'en']),
  era: z.string().max(120),
  place: z.string().max(160),
  tone: z.union([z.enum(ids(TONES)), z.literal('')]),
  threat: z.union([z.enum(ids(THREATS)), z.literal('')]),
  hook: z.string().max(600),
  ideas: z.string().max(1500),
  avoid: z.string().max(600),
  investigators: z.number().int().min(1).max(8),
  length: z.enum(ids(LENGTHS)),
})

export type Brief = z.infer<typeof briefSchema>
export type IdeaField = 'era' | 'place' | 'hook' | 'ideas'

export const emptyBrief = (lang: 'fr' | 'en'): Brief => ({
  lang, era: '', place: '', tone: '', threat: '', hook: '', ideas: '', avoid: '', investigators: 4, length: 'oneshot',
})

/** The outline the create-story function returns (StoryOutline in _shared/story-create.ts). */
export interface OutlineScene {
  id: string
  title: string
  summary: string
  clues: string[]
  npcs: string[]
  next: string[]
}
export interface Outline {
  title: string
  summary: string
  era: string
  setting: string
  contentWarnings: string[]
  overview: { secret: string; steps: string[]; mustNotMiss: string[]; branches: string[]; ifStuck: string[]; keeperTips: string[] }
  acts: Array<{ id: string; title: string; scenes: OutlineScene[] }>
  npcs: Array<{ id: string; name: string; kind: 'person' | 'creature'; role: string; description: string }>
}

export const sceneTotal = (o: Outline) => o.acts.reduce((n, a) => n + a.scenes.length, 0)

/** Remove a scene from the outline (and the links to it); acts left empty go too. */
export function removeScene(o: Outline, sceneId: string): Outline {
  return {
    ...o,
    acts: o.acts
      .map((a) => ({
        ...a,
        scenes: a.scenes.filter((s) => s.id !== sceneId).map((s) => ({ ...s, next: s.next.filter((n) => n !== sceneId) })),
      }))
      .filter((a) => a.scenes.length),
  }
}
