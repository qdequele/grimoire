import metas from 'virtual:story-metas'

// The original stories of stories/ (CC BY, the marketplace's free stories) as public pages. The list
// needs only each story's meta (bundled); a story's page loads its story.json on demand (one chunk per
// story), and the build's prerender and a first visit load it before rendering (preloadStory).

/** The parts of meta the list and the page read (spec §2). */
export interface StoryMeta {
  id: string
  title: string
  lang: string
  summary?: string
  players?: { min?: number; max?: number }
  duration?: string
  era?: string
  setting?: string
  author?: string
  license?: string
  contentWarnings?: string[]
}

export interface StoryRoll {
  type: 'skill' | 'characteristic' | 'luck' | 'san' | 'damage' | 'opposed' | 'group'
  options?: string[]
  label?: string
  san?: string
  dice?: string
  difficulty?: 'regular' | 'hard' | 'extreme'
  bonus?: number
  against?: { npc?: string; skill?: string }
}

export interface FlowStep {
  title: string
  text?: string
  roll?: StoryRoll
  test?: string
  success?: string
  failure?: string
  pushed?: string
  extra?: string
  branch?: string
}

export interface NoteBlock {
  title?: string
  items?: string[]
}

export interface Scene {
  id: string
  title: string
  lead?: string
  readAloud?: string[]
  flow?: FlowStep[]
  notes?: NoteBlock[]
  notesAfter?: NoteBlock[]
  notesFirst?: boolean
  callout?: string
  npcs?: string[]
  handouts?: string[]
  optional?: boolean
}

export interface Npc {
  id: string
  name: string
  role?: string
  kind?: string
  description?: string
  personality?: string
  knows?: string[]
  characteristics?: Record<string, number>
  hp?: number
  dodge?: number
  armor?: number | string
  damageBonus?: string
  build?: number
  sanLoss?: string
  attacksPerRound?: number
  attacks?: Array<{ name: string; skill?: number; damage?: string; note?: string }>
  skills?: Record<string, number>
  special?: string | string[]
}

export interface Handout {
  id: string
  title: string
  text?: string
  scene?: string
}

export interface PublicStory {
  meta: StoryMeta
  overview?: { secret?: string; steps?: string[]; mustNotMiss?: string[]; branches?: string[]; ifStuck?: string[]; keeperTips?: string[] }
  acts: Array<{ id: string; title: string; scenes: Scene[] }>
  npcs?: Npc[]
  handouts?: Handout[]
  knowledge?: Array<{ need: string; best?: string; backup?: string }>
  trackers?: Array<{ id: string; label: string; max?: number; unit?: string; help?: string }>
}

const loaders = import.meta.glob<PublicStory>('/stories/*/story.json', { import: 'default' })

/** Every story, the app's languages' order: French first, then by title. */
export const STORY_METAS: StoryMeta[] = [...metas].sort(
  (a, b) => Number(a.lang !== 'fr') - Number(b.lang !== 'fr') || a.title.localeCompare(b.title, a.lang),
)

const pathOf = (id: string) => Object.keys(loaders).find((p) => p.split('/').at(-2) === id)

const loaded = new Map<string, PublicStory>()

/** The story if it is already loaded (synchronous, so a preloaded page renders whole at once). */
export const storyIfLoaded = (id: string): PublicStory | undefined => loaded.get(id)

export const storyExists = (id: string): boolean => Boolean(pathOf(id))

export async function preloadStory(id: string): Promise<PublicStory | undefined> {
  const path = pathOf(id)
  if (!path) return undefined
  if (!loaded.has(id)) loaded.set(id, await loaders[path]())
  return loaded.get(id)
}
