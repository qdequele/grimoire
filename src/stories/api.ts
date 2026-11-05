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

const asStory = (row: Tables<'stories'>): StoryRow => ({ ...row, content: row.content as unknown as StoryContent })

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
    }): Promise<{ row: StoryRow; replaced: boolean }> => {
      const owner = session!.user.id
      const metaId = (story.meta as { id: string }).id
      const content = story as unknown as Json
      const { data: existing } = await supabase
        .from('stories')
        .select('*')
        .eq('owner_id', owner)
        .eq('content->meta->>id', metaId)
        .maybeSingle()
      const { data, error } = existing
        ? await supabase.from('stories').update({ content }).eq('id', existing.id).select('*').single()
        : await supabase.from('stories').insert({ owner_id: owner, visibility: 'private', content }).select('*').single()
      if (error) throw error
      await writePack(data, story, files, onProgress)
      return { row: asStory({ ...data, pack_files: files.map((f) => f.path) }), replaced: !!existing }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: storyKeys.all }),
  })
}
