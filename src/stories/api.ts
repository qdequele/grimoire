import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/auth/auth'
import type { Json } from '@/lib/database.types'
import { supabase, type Tables } from '@/lib/supabase'
import type { PackFile } from './pack'
import { copyPackFiles, deletePack, writePack, writeStoryJson } from './packStorage'

/** The parts of story.json the UI reads directly. The full shape is spec/story.schema.json. */
export interface StoryContent {
  format: 'grimoire-story/1'
  meta: {
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
    tags?: string[]
    contentWarnings?: string[]
  }
  overview?: { secret?: string; steps?: string[] }
  acts: Array<{ id: string; title: string; scenes: Array<{ id: string; title: string; lead?: string }> }>
  npcs?: Array<{ id: string; name: string; role?: string }>
}

/** meta.tags entry of stories written with the story creator (set by the create-story function). */
export const CREATOR_TAG = 'grimoire-creator'

export type StoryRow = Omit<Tables<'stories'>, 'content'> & { content: StoryContent }

export const storyKeys = {
  all: ['stories'] as const,
  marketplace: () => [...storyKeys.all, 'marketplace'] as const,
  mine: (userId: string | undefined) => [...storyKeys.all, 'mine', userId] as const,
  one: (id: string) => [...storyKeys.all, 'one', id] as const,
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * A saved story as the screens read it: `acts` is always a list of acts, each with its list of
 * scenes. Stories saved before the pack import checked that (or changed by hand) may lack them;
 * without this the story list and the story page would fail on them, with no way to delete them.
 */
export function storyContent(content: unknown): StoryContent {
  const story = (isObj(content) ? content : {}) as Record<string, unknown>
  const acts = (Array.isArray(story.acts) ? story.acts : []).filter(isObj).map((act) => ({
    ...act,
    scenes: (Array.isArray(act.scenes) ? act.scenes : []).filter(isObj),
  }))
  return { ...story, acts } as unknown as StoryContent
}

const asStory = (row: Tables<'stories'>): StoryRow => ({ ...row, content: storyContent(row.content) })

export function useMarketplaceStories() {
  return useQuery({
    queryKey: storyKeys.marketplace(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .eq('visibility', 'marketplace')
        .order('published_at', { ascending: false })
      if (error) throw error
      return data.map(asStory)
    },
  })
}

export function useMyStories() {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: storyKeys.mine(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stories')
        .select('*')
        .eq('owner_id', userId!)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data.map(asStory)
    },
  })
}

export function useStory(id: string | undefined) {
  return useQuery({
    queryKey: storyKeys.one(id ?? ''),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('stories').select('*').eq('id', id!).single()
      if (error) throw error
      return asStory(data)
    },
  })
}

/** Copy a marketplace story into the user's private stories so they can change it. */
export function useCopyStory() {
  const qc = useQueryClient()
  const { session } = useAuth()
  return useMutation({
    mutationFn: async (story: StoryRow) => {
      const content: StoryContent = {
        ...story.content,
        meta: { ...story.content.meta, id: `${story.content.meta.id}-copy` },
      }
      const { data, error } = await supabase
        .from('stories')
        .insert({ owner_id: session!.user.id, visibility: 'private', content: content as unknown as Json, copied_from: story.id })
        .select('*')
        .single()
      if (error) throw error
      // The copy gets its own pack: same files, its own story.json.
      await writeStoryJson(data, content)
      await copyPackFiles(story, data)
      return asStory(data)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: storyKeys.all }),
  })
}

export function useDeleteStory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (story: StoryRow) => {
      const { error } = await supabase.from('stories').delete().eq('id', story.id)
      if (error) throw error
      await deletePack(story)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: storyKeys.all }),
  })
}

export function sceneCount(story: StoryContent) {
  return story.acts.reduce((n, a) => n + a.scenes.length, 0)
}

/**
 * Import a story pack as a private story with its files in Storage. A story with the same meta.id
 * is updated in place (its games keep working), otherwise a new one is created.
 */
export function useImportPack() {
  const qc = useQueryClient()
  const { session } = useAuth()
  return useMutation({
    mutationFn: async ({
      story,
      files,
      onProgress,
    }: {
      story: Record<string, unknown>
      files: PackFile[]
      onProgress?: (done: number, total: number) => void
    }): Promise<{ row: StoryRow; replaced: boolean }> => importPack(packStore, session!.user.id, story, files, onProgress),
    onSuccess: () => qc.invalidateQueries({ queryKey: storyKeys.all }),
  })
}

/** What a pack import reads and writes: the keeper's stories and their Storage folders. */
export interface PackStore {
  /** The keeper's story with this meta.id, if any. */
  find(owner: string, metaId: string): Promise<Tables<'stories'> | null>
  insert(owner: string, content: Json): Promise<Tables<'stories'>>
  setContent(id: string, content: Json): Promise<Tables<'stories'>>
  setPackFiles(id: string, files: string[]): Promise<void>
  remove(id: string): Promise<void>
  writePack: typeof writePack
  writeStoryJson: typeof writeStoryJson
  deletePack: typeof deletePack
}

const packStore: PackStore = {
  find: async (owner, metaId) => {
    const { data } = await supabase.from('stories').select('*').eq('owner_id', owner).eq('content->meta->>id', metaId).maybeSingle()
    return data
  },
  insert: async (owner, content) => {
    const { data, error } = await supabase.from('stories').insert({ owner_id: owner, visibility: 'private', content }).select('*').single()
    if (error) throw error
    return data
  },
  setContent: async (id, content) => {
    const { data, error } = await supabase.from('stories').update({ content }).eq('id', id).select('*').single()
    if (error) throw error
    return data
  },
  setPackFiles: async (id, files) => {
    const { error } = await supabase.from('stories').update({ pack_files: files }).eq('id', id)
    if (error) throw error
  },
  remove: async (id) => {
    const { error } = await supabase.from('stories').delete().eq('id', id)
    if (error) throw error
  },
  writePack,
  writeStoryJson,
  deletePack,
}

/**
 * The import itself, apart from React and Supabase so it can be tested.
 *
 * The files go to Storage first and the story's content changes last, so a failed upload (a
 * refused file, a network drop) leaves the keeper's story as it was. What a failed import did
 * upload is never left unlisted: a new story is removed with its files, an existing one lists
 * them in `pack_files`, where deleting the story or importing again finds them.
 */
export async function importPack(
  store: PackStore,
  owner: string,
  story: Record<string, unknown>,
  files: PackFile[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ row: StoryRow; replaced: boolean }> {
  const metaId = (story.meta as { id: string }).id
  const content = story as unknown as Json
  const paths = files.map((f) => f.path)
  const existing = await store.find(owner, metaId)
  // Cleaning up after a failure must not hide the failure itself.
  const quietly = (work: Promise<unknown>) => work.catch(() => undefined)

  if (!existing) {
    // The folder is named after the row, so the row comes first; it goes away if the files don't arrive.
    const created = await store.insert(owner, content)
    try {
      await store.writePack(created, story, files, onProgress)
    } catch (e) {
      await quietly(store.remove(created.id))
      await quietly(store.deletePack({ ...created, pack_files: paths }))
      throw e
    }
    return { row: asStory({ ...created, pack_files: paths }), replaced: false }
  }

  // writePack reports story.json, then each file in order: `arrived` counts the files stored.
  let arrived = 0
  try {
    await store.writePack(existing, story, files, (done, total) => {
      arrived = done - 1
      onProgress?.(done, total)
    })
  } catch (e) {
    // writePack stops at the first refused file, before it removes anything: the old files are
    // all still there, next to the new ones that did arrive.
    await quietly(store.writeStoryJson(existing, existing.content))
    await quietly(store.setPackFiles(existing.id, [...new Set([...existing.pack_files, ...paths.slice(0, arrived)])]))
    throw e
  }
  try {
    const updated = await store.setContent(existing.id, content)
    return { row: asStory({ ...updated, pack_files: paths }), replaced: true }
  } catch (e) {
    await quietly(store.writeStoryJson(existing, existing.content))
    throw e
  }
}
