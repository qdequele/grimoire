// The keeper's items, under RLS: list an investigator's cards, give one, spend or regain uses, reload, take back.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Json } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'
import { asHeld, fullUses, sortHeld, type Condition, type HeldItem, type ItemCard } from './item'

export const itemKeys = {
  all: ['items'] as const,
  character: (id: string) => [...itemKeys.all, 'character', id] as const,
  counts: () => [...itemKeys.all, 'counts'] as const,
}

/** An investigator's cards (or several investigators'), checked and in display order. */
export async function fetchItems(characterIds: string[]): Promise<HeldItem[]> {
  if (!characterIds.length) return []
  const { data, error } = await supabase.from('character_items').select('*').in('character_id', characterIds)
  if (error) throw error
  return sortHeld(data.map((r) => asHeld(r as unknown as Record<string, unknown>)).filter((h): h is HeldItem => !!h))
}

export function useCharacterItems(characterId: string | undefined) {
  return useQuery({
    queryKey: itemKeys.character(characterId ?? ''),
    enabled: !!characterId,
    queryFn: () => fetchItems([characterId!]),
  })
}

/** How many cards each of the keeper's investigators holds (the Investigateurs list). */
export function useItemCounts() {
  return useQuery({
    queryKey: itemKeys.counts(),
    queryFn: async () => {
      const { data, error } = await supabase.from('character_items').select('character_id')
      if (error) throw error
      const counts = new Map<string, number>()
      for (const r of data) counts.set(r.character_id, (counts.get(r.character_id) ?? 0) + 1)
      return counts
    },
  })
}

export interface Gift {
  characterId: string
  card: ItemCard
  catalogId?: string
  story?: { id: string; itemId: string }
}

export function useGiveItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ characterId, card, catalogId, story }: Gift) => {
      const held = qc.getQueryData<HeldItem[]>(itemKeys.character(characterId)) ?? []
      const { error } = await supabase.from('character_items').insert({
        character_id: characterId,
        card: card as unknown as Json,
        uses: fullUses(card),
        catalog_id: catalogId ?? null,
        story_id: story?.id ?? null,
        story_item: story?.itemId ?? null,
        position: held.reduce((m, h) => Math.max(m, h.position), 0) + 1,
      })
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: itemKeys.all }),
  })
}

/** Uses + or − (kept within the card by the database). The cache moves at once. */
export function useUseItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ item, delta }: { item: HeldItem; delta: number }) => {
      const { error } = await supabase.rpc('use_item', { p_item: item.id, p_delta: delta })
      if (error) throw error
    },
    onMutate: ({ item, delta }) => {
      const key = itemKeys.character(item.characterId)
      const before = qc.getQueryData<HeldItem[]>(key)
      if (before && item.card.uses !== undefined) {
        const cap = item.card.uses
        qc.setQueryData<HeldItem[]>(key, before.map((h) => (h.id === item.id ? { ...h, uses: Math.max(0, Math.min(cap, (h.uses ?? 0) + delta)) } : h)))
      }
      return { before }
    },
    onError: (_e, { item }, ctx) => {
      if (ctx?.before) qc.setQueryData(itemKeys.character(item.characterId), ctx.before)
    },
    onSettled: (_d, _e, { item }) => qc.invalidateQueries({ queryKey: itemKeys.character(item.characterId) }),
  })
}

/** Moves rounds from the matching ammunition into the weapon; resolves to how many moved. */
export function useReloadItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (item: HeldItem) => {
      const { data, error } = await supabase.rpc('reload_item', { p_weapon: item.id })
      if (error) throw error
      return data ?? 0
    },
    onSettled: (_d, _e, item) => qc.invalidateQueries({ queryKey: itemKeys.character(item.characterId) }),
  })
}

export function useRemoveItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (item: HeldItem) => {
      const { error } = await supabase.from('character_items').delete().eq('id', item.id)
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: itemKeys.all }),
  })
}

/** A weapon's condition (keeper only). The card changes at once; rolled back if refused. */
export function useSetCondition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ item, condition }: { item: HeldItem; condition: Condition }) => {
      const { error } = await supabase.from('character_items').update({ condition }).eq('id', item.id)
      if (error) throw error
    },
    onMutate: ({ item, condition }) => {
      const key = itemKeys.character(item.characterId)
      const before = qc.getQueryData<HeldItem[]>(key)
      if (before) qc.setQueryData<HeldItem[]>(key, before.map((h) => (h.id === item.id ? { ...h, condition } : h)))
      return { before }
    },
    onError: (_e, { item }, ctx) => {
      if (ctx?.before) qc.setQueryData(itemKeys.character(item.characterId), ctx.before)
    },
    onSettled: (_d, _e, { item }) => qc.invalidateQueries({ queryKey: itemKeys.character(item.characterId) }),
  })
}

