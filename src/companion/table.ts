// The table around a player's sheet, on a computer (a group playing online): what the ambiance
// screen shows (the scene's décor and the place's name), the documents the keeper showed, kept to
// read again, and everyone's last rolls. One read through the link's token (`companion_table`);
// the game's topic only says when to read it again.
import { useQuery, type QueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { parseScreen, type ScreenState } from '@/screen/state'
import { CompanionError, companionKeys } from './api'
import { asTableRoll, type TableRoll } from './rolls'

export interface TableDocument {
  id: string
  /** Same key as the ambiance screen's handout: the document being shown is found by it. */
  key: string
  title: string
  /** Story rich text. */
  text?: string
  /** The picture's signed URL, made by the keeper's game screen. */
  image?: string
  createdAt: string
}

export interface TableView {
  screen: ScreenState
  /** Newest first. */
  documents: TableDocument[]
  /** Newest first: every investigator's rolls, the keeper's for them included. */
  rolls: TableRoll[]
}

export const tableKey = (token: string) => companionKeys.table(token)

const objects = (v: unknown): Array<Record<string, unknown>> =>
  Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : []

/** A document row as the link gives it, checked; null when it has nothing to show. */
export function asDocument(d: Record<string, unknown>): TableDocument | null {
  if (typeof d.id !== 'string' || typeof d.key !== 'string') return null
  const text = typeof d.text === 'string' && d.text ? d.text : undefined
  const img = d.image && typeof d.image === 'object' ? (d.image as Record<string, unknown>).url : undefined
  // Only web URLs reach an <img>.
  const image = typeof img === 'string' && /^https?:\/\//.test(img) ? img : undefined
  if (!text && !image) return null
  return {
    id: d.id,
    key: d.key,
    title: typeof d.title === 'string' ? d.title : '',
    ...(text ? { text } : {}),
    ...(image ? { image } : {}),
    createdAt: typeof d.createdAt === 'string' ? d.createdAt : '',
  }
}

export function asTable(raw: unknown): TableView {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    screen: parseScreen(r.screen),
    documents: objects(r.documents).map(asDocument).filter((d): d is TableDocument => !!d),
    rolls: objects(r.rolls).map(asTableRoll).filter((x): x is TableRoll => !!x),
  }
}

/** How often the table checks in without any hint (a laptop asleep, a network blip). */
const REFRESH_MS = 60_000

/** The table of the link's game. Only read where it is shown (`enabled`: a computer). */
export function useTable(token: string, enabled: boolean): UseQueryResult<TableView, CompanionError> {
  return useQuery<TableView, CompanionError>({
    queryKey: tableKey(token),
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc('companion_table', { p_token: token }).abortSignal(signal)
      if (error) throw new CompanionError(error.message.trim() === 'link_invalid' ? 'link_invalid' : 'network', error.message)
      return asTable(data)
    },
    enabled,
    retry: (count, e) => e.code !== 'link_invalid' && count < 2,
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })
}

/**
 * Something changed at the table (`screen`, `documents`, `roll` on the game's topic, which anyone
 * with a link can send on): read it again. A read under way may predate the change: it is given up.
 */
export function tableChanged(qc: QueryClient, token: string): void {
  void qc.invalidateQueries({ queryKey: tableKey(token) }, { cancelRefetch: true })
}

// ------------------------------------------------------------------ this computer's choices

const soundKey = 'grimoire-table-sound'

/** Whether this computer plays the scene's ambience (off until the player turns it on). */
export function useTableSound(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(false)
  useEffect(() => {
    try {
      // Browsers only start sound after a click: a remembered "on" still waits for one (see TableView).
      setOn(localStorage.getItem(soundKey) === '1')
    } catch {
      /* private mode: off */
    }
  }, [])
  return [
    on,
    (next) => {
      setOn(next)
      try {
        localStorage.setItem(soundKey, next ? '1' : '0')
      } catch {
        /* not remembered */
      }
    },
  ]
}

/** True on a computer-sized window (Tailwind's `lg`), where the sheet becomes the table. */
export function useIsWide(): boolean {
  const query = '(min-width: 1024px)'
  const [wide, setWide] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches)
  useEffect(() => {
    const m = matchMedia(query)
    const on = () => setWide(m.matches)
    on()
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return wide
}
