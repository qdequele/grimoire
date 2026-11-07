// Keeper side of the ambiance screen: its link (like the table links) and the controller that turns
// game events and the keeper's choices into games.screen, with signed picture URLs.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Json } from '@/lib/database.types'
import { supabase, type Tables } from '@/lib/supabase'
import { findScene, sceneAmbiance, type StoryForScreen } from '@/screen/ambiance'
import {
  imagesOf, INITIAL_SCREEN, sameScreen, screenReducer, toScreenScene,
  type ImageRef, type ScreenAction, type ScreenHandout, type ScreenScene, type ScreenState,
} from '@/screen/state'
import { packFolder } from '@/stories/packStorage'

export type ScreenLink = Tables<'screen_links'>

export const screenLinkKeys = {
  game: (gameId: string) => ['screen_links', gameId] as const,
}

/** What the TV opens (QR code or copied link). */
export const screenUrl = (token: string): string => `${location.origin}/screen/${token}`

/** The game's active screen link, if any. */
export function useScreenLink(gameId: string) {
  return useQuery({
    queryKey: screenLinkKeys.game(gameId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('screen_links')
        .select('*')
        .eq('game_id', gameId)
        .is('revoked_at', null)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useCreateScreenLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ gameId }: { gameId: string }) => {
      const { data, error } = await supabase.from('screen_links').insert({ game_id: gameId }).select('*').single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, { gameId }) => qc.invalidateQueries({ queryKey: screenLinkKeys.game(gameId) }),
  })
}

/** Revokes the screen link (the screen moves to a new topic), then makes a new one. */
export function useReplaceScreenLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ linkId, gameId }: { linkId: string; gameId: string }) => {
      const r = await supabase.rpc('revoke_screen_link', { p_link: linkId })
      if (r.error) throw r.error
      const { data, error } = await supabase.from('screen_links').insert({ game_id: gameId }).select('*').single()
      if (error) throw error
      return data
    },
    onSettled: (_d, _e, { gameId }) => qc.invalidateQueries({ queryKey: screenLinkKeys.game(gameId) }),
  })
}

// ------------------------------------------------------------------ pictures

export const SCREEN_BUCKET = 'screen-images'
/** Signed URLs live this long; they are renewed well before (see REFRESH_MS). */
const SIGN_TTL_S = 8 * 3600
/** Renew a signature when less than this is left. */
const RENEW_BEFORE_MS = 3 * 3600_000
/** How often a long session checks its signatures. */
const REFRESH_MS = 3600_000

/** Pictures the keeper uploaded during this game (newest first), as refs for the screen. */
export async function listUploads(ownerId: string, gameId: string): Promise<ImageRef[]> {
  const folder = `${ownerId}/${gameId}`
  const { data, error } = await supabase.storage.from(SCREEN_BUCKET).list(folder, { sortBy: { column: 'created_at', order: 'desc' } })
  if (error) throw error
  return data.filter((f) => f.id).map((f) => ({ bucket: SCREEN_BUCKET, path: `${folder}/${f.name}` }))
}

/** Stores a picture from the keeper's disk for this game's screen. */
export async function uploadPicture(ownerId: string, gameId: string, file: File): Promise<ImageRef> {
  const ext = (file.name.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? 'jpg').toLowerCase()
  const path = `${ownerId}/${gameId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from(SCREEN_BUCKET).upload(path, file, { contentType: file.type || undefined })
  if (error) throw error
  return { bucket: SCREEN_BUCKET, path }
}

// ------------------------------------------------------------------ controller

export interface ScreenStory {
  content: StoryForScreen
  /** Storage folder of the story pack, and its files (images/…). */
  folder: string
  files: string[]
}

export const screenStory = (story: { id: string; owner_id: string | null; pack_files: string[]; content: unknown }): ScreenStory => ({
  content: story.content as StoryForScreen,
  folder: packFolder(story),
  files: story.pack_files,
})

/** A handout's picture in the pack: the spec says "relative path in images/", written either way. */
export const handoutImagePath = (image: string | undefined): string | undefined =>
  image ? (image.startsWith('images/') ? image : `images/${image}`) : undefined

/** A picture of the story pack, if the pack really has it. */
export const packImage = (story: ScreenStory, path: string | undefined): ImageRef | null =>
  path && story.files.includes(path) ? { bucket: 'story-packs', path: `${story.folder}/${path}` } : null

/** A story document as the screen shows it; null if it has neither text nor a picture the pack has. */
export function storyHandout(story: ScreenStory, id: string): ScreenHandout | null {
  const h = story.content.handouts?.find((x) => x.id === id)
  if (!h) return null
  const image = packImage(story, handoutImagePath(h.image))
  if (!image && !h.text) return null
  return { key: `handout:${h.id}`, title: h.title, ...(h.text ? { text: h.text } : {}), image }
}

/** Query params of /screen-preview for a scene (the picture as a signed URL). */
export function previewParams(scene: ScreenScene, imageUrl: string | undefined): URLSearchParams {
  const p = new URLSearchParams({ preset: scene.preset })
  if (scene.place) p.set('place', scene.place)
  if (scene.time) p.set('time', scene.time)
  if (imageUrl) p.set('image', imageUrl)
  return p
}

/**
 * Holds the screen state for one game: reduces game events and keeper actions, then publishes
 * (signs the pictures, writes games.screen; the database broadcasts it to the screen). Publications
 * run one at a time and only the newest state is written.
 */
export class ScreenControl {
  private state: ScreenState
  private published: ScreenState | null
  private scene: string | undefined
  private listeners = new Set<() => void>()
  private signed = new Map<string, { url: string; until: number }>()
  private running: Promise<void> | null = null
  private dirty = false
  private timer: ReturnType<typeof setInterval>
  private gameId: string
  private story: ScreenStory

  constructor(gameId: string, story: ScreenStory, saved: ScreenState | null) {
    this.gameId = gameId
    this.story = story
    this.state = saved ?? INITIAL_SCREEN
    this.published = saved
    this.timer = setInterval(() => this.renew(), REFRESH_MS)
    // Signed URLs saved in an earlier session have expired (or soon will): sign again.
    queueMicrotask(() => this.renew())
  }

  dispose() {
    clearInterval(this.timer)
    this.listeners.clear()
  }

  // For useSyncExternalStore.
  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => void this.listeners.delete(fn)
  }
  get = (): ScreenState => this.state

  /** The game's current scene id (the one the screen follows). */
  get currentScene(): string | undefined {
    return this.scene
  }

  ambianceOf(sceneId: string | undefined): ScreenScene {
    return toScreenScene(sceneAmbiance(this.story.content, sceneId, this.story.files), this.story.folder)
  }

  /** The page drawing a scene's ambiance small (/screen-preview), and the ambiance it draws. */
  async preview(sceneId: string): Promise<{ src: string; scene: ScreenScene } | null> {
    if (!findScene(this.story.content, sceneId)) return null
    const scene = this.ambianceOf(sceneId)
    const url = scene.image ? await this.sign(scene.image) : undefined
    return { src: `/screen-preview?${previewParams(scene, url)}`, scene }
  }

  /** Shows one of the story's documents on the screen; false if it has nothing to show. */
  showHandout(id: string): boolean {
    const handout = storyHandout(this.story, id)
    if (!handout) return false
    this.dispatch({ type: 'show', handout })
    return true
  }

  /** A signed URL of a document's picture, if the pack has one. */
  async handoutImage(id: string): Promise<string | null> {
    const image = storyHandout(this.story, id)?.image
    return image ? ((await this.sign(image)) ?? null) : null
  }

  /** The engine shows a scene (called on every engine save: only a change counts). */
  sceneChanged(sceneId: string | undefined) {
    if (!sceneId || sceneId === this.scene || !findScene(this.story.content, sceneId)) return
    this.scene = sceneId
    this.dispatch({ type: 'scene', scene: this.ambianceOf(sceneId) })
  }

  dispatch(action: ScreenAction) {
    const a = action.type === 'follow' && action.on && !action.scene ? { ...action, scene: this.ambianceOf(this.scene) } : action
    const next = screenReducer(this.state, a)
    if (next === this.state) return
    this.state = next
    for (const fn of this.listeners) fn()
    this.publish()
  }

  /** A signed URL for a picture (cached until close to expiry). */
  async sign(ref: ImageRef): Promise<string | undefined> {
    const id = `${ref.bucket}/${ref.path}`
    const hit = this.signed.get(id)
    if (hit && hit.until - Date.now() > RENEW_BEFORE_MS) return hit.url
    const { data, error } = await supabase.storage.from(ref.bucket).createSignedUrl(ref.path, SIGN_TTL_S)
    if (error || !data) {
      console.error('Screen picture signing failed', error)
      return undefined
    }
    this.signed.set(id, { url: data.signedUrl, until: Date.now() + SIGN_TTL_S * 1000 })
    return data.signedUrl
  }

  private publish(force = false) {
    if (this.running) {
      this.dirty = true
      return
    }
    this.running = (async () => {
      do {
        this.dirty = false
        const state = this.state
        if (!force && this.published && sameScreen(state, this.published) && !this.needsRenewal()) break
        force = false
        const signed = await this.withUrls(state)
        const { error } = await supabase.from('games').update({ screen: signed as unknown as Json }).eq('id', this.gameId)
        if (error) console.error('Screen save failed', error)
        else this.published = signed
      } while (this.dirty)
    })().finally(() => {
      this.running = null
    })
  }

  /** Signatures on screen that will expire soon. */
  private needsRenewal(): boolean {
    return imagesOf(this.state).some((i) => {
      const hit = this.signed.get(`${i.bucket}/${i.path}`)
      return !hit || hit.until - Date.now() <= RENEW_BEFORE_MS
    })
  }

  private renew() {
    if (this.needsRenewal()) this.publish(true)
  }

  private async withUrls(s: ScreenState): Promise<ScreenState> {
    const sign = async (i: ImageRef | null): Promise<ImageRef | null> => {
      if (!i) return null
      const url = await this.sign(i)
      return { bucket: i.bucket, path: i.path, ...(url ? { url } : {}) }
    }
    const [sceneImage, handoutImage] = await Promise.all([sign(s.scene?.image ?? null), sign(s.handout?.image ?? null)])
    return {
      ...s,
      scene: s.scene ? { ...s.scene, image: sceneImage } : null,
      handout: s.handout ? { ...s.handout, image: handoutImage } : null,
    }
  }
}
