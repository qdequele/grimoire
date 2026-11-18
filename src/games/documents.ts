// The documents the players keep (game_documents): every document the keeper shows to the table is
// copied there, so players at a computer find it again in their Documents. Players never read
// Storage: the keeper's game screen signs each picture for a long time and renews it when the game
// is opened again.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Json } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import type { ScreenHandout } from '@/screen/state'

/** A kept document's picture is signed for a week: players read it between two evenings too. */
export const DOC_TTL_S = 7 * 24 * 3600
/** Signed again when less than this is left (whenever the keeper's game screen is open). */
export const DOC_RENEW_MS = 4 * 24 * 3600_000

export interface KeptDocument { id: string; key: string; title: string }

export const documentKeys = {
  game: (gameId: string) => ['game_documents', gameId] as const,
}

interface StoredImage { bucket: string; path: string; url?: string; until?: number }

const asStored = (v: unknown): StoredImage | null => {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  if (!o || typeof o.bucket !== 'string' || typeof o.path !== 'string') return null
  return {
    bucket: o.bucket,
    path: o.path,
    ...(typeof o.url === 'string' ? { url: o.url } : {}),
    ...(typeof o.until === 'number' ? { until: o.until } : {}),
  }
}

/** A stored picture whose signature is missing or runs out soon. */
export const needsSigning = (image: unknown, now: number): boolean => {
  const i = asStored(image)
  return !!i && (!i.url || !i.until || i.until - now < DOC_RENEW_MS)
}

async function signed(bucket: string, path: string): Promise<StoredImage | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, DOC_TTL_S)
  if (error || !data) {
    console.error('Document picture signing failed', error)
    return null
  }
  return { bucket, path, url: data.signedUrl, until: Date.now() + DOC_TTL_S * 1000 }
}

/** What the row holds for a handout, without its picture; null when it would have nothing to show. */
export function documentRow(gameId: string, h: ScreenHandout, image: StoredImage | null) {
  const body = h.text?.slice(0, 20_000) || null
  if (!body && !image) return null
  return { game_id: gameId, key: h.key.slice(0, 300), title: h.title.slice(0, 200), body, image: image as unknown as Json | null, updated_at: new Date().toISOString() }
}

/** Keeps a copy of a document shown to the table (showing it again updates the copy). */
export async function keepDocument(gameId: string, h: ScreenHandout): Promise<void> {
  const image = h.image ? await signed(h.image.bucket, h.image.path) : null
  const row = documentRow(gameId, h, image)
  if (!row) return
  const { error } = await supabase.from('game_documents').upsert(row, { onConflict: 'game_id,key' })
  if (error) console.error('Document not kept for the players', error)
}

/** Signs again the kept pictures whose signature runs out soon. */
export async function renewDocuments(gameId: string): Promise<void> {
  const { data, error } = await supabase.from('game_documents').select('id, image').eq('game_id', gameId).not('image', 'is', null)
  if (error) return
  const now = Date.now()
  for (const row of data) {
    const image = asStored(row.image)
    if (!image || !needsSigning(image, now)) continue
    const fresh = await signed(image.bucket, image.path)
    if (fresh) await supabase.from('game_documents').update({ image: fresh as unknown as Json }).eq('id', row.id)
  }
}

/** The documents the players of this game keep, newest first. */
export function useGameDocuments(gameId: string, enabled: boolean) {
  return useQuery({
    queryKey: documentKeys.game(gameId),
    enabled,
    queryFn: async (): Promise<KeptDocument[]> => {
      const { data, error } = await supabase
        .from('game_documents').select('id, key, title').eq('game_id', gameId).order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

/** Takes a document back from the players. */
export function useRemoveDocument(gameId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('game_documents').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: documentKeys.game(gameId) }),
  })
}
