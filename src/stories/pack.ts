// Story packs (spec/STORY_FORMAT.md): a folder or .zip with story.json, images/ and sounds/.
// Reading, checking and writing packs. Pure: no network, unit-tested.
import Ajv2020 from 'ajv/dist/2020'
import { strToU8, unzipSync, zipSync } from 'fflate'
import storySchema from '../../spec/story.schema.json'

export interface PackFile {
  /** Path inside the pack, e.g. "images/map.jpg". Never "story.json". */
  path: string
  data: Uint8Array
  type: string
}

export interface ReadPack {
  story: Record<string, unknown> | null
  files: PackFile[]
  /** Blocking problems: the story can't be imported. */
  errors: string[]
  /** Schema deviations and skipped files: importable, but worth a look. */
  warnings: string[]
}

const MIME: Record<string, string> = {
  json: 'application/json',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4',
  pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown',
}

export const mimeOf = (path: string) => MIME[path.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream'

/** OS clutter and anything that could escape the pack folder. */
const junk = (p: string) =>
  p.split('/').some((part) => part.startsWith('.') || part === '__MACOSX' || part === '..' || part === '') ||
  /(^|\/)(Thumbs\.db|desktop\.ini)$/i.test(p)

const ajv = new Ajv2020({ allErrors: true, strict: false })
const validateStory = ajv.compile(storySchema)

/**
 * Read a pack from its files (paths relative to what the keeper picked: a zip's content or a
 * folder). story.json may sit at the top or inside one folder (a zipped folder); everything else
 * is kept relative to that folder.
 */
export function readPack(entries: Array<{ path: string; data: Uint8Array }>): ReadPack {
  const errors: string[] = []
  const warnings: string[] = []
  const clean = entries.map((e) => ({ ...e, path: e.path.replace(/\\/g, '/').replace(/^\.?\//, '') })).filter((e) => !junk(e.path))

  const candidates = clean.filter((e) => e.path === 'story.json' || e.path.endsWith('/story.json'))
  candidates.sort((a, b) => a.path.split('/').length - b.path.split('/').length)
  const main = candidates[0]
  if (!main) return { story: null, files: [], errors: ['Aucun fichier story.json dans ce pack.'], warnings }
  if (candidates.length > 1 && candidates[1].path.split('/').length === main.path.split('/').length) {
    return { story: null, files: [], errors: ['Ce pack contient plusieurs histoires : importe-les une par une.'], warnings }
  }
  const root = main.path.slice(0, main.path.length - 'story.json'.length)

  let story: Record<string, unknown>
  try {
    story = JSON.parse(new TextDecoder().decode(main.data)) as Record<string, unknown>
  } catch {
    return { story: null, files: [], errors: ['story.json n’est pas un JSON valide.'], warnings }
  }

  // What the app needs to store and play the story at all.
  const meta = (story.meta ?? {}) as Record<string, unknown>
  if (story.format !== 'grimoire-story/1') errors.push('format doit valoir "grimoire-story/1".')
  if (typeof meta.id !== 'string' || !meta.id) errors.push('meta.id manquant.')
  if (typeof meta.title !== 'string' || !meta.title.trim()) errors.push('meta.title manquant.')
  if (typeof meta.lang !== 'string' || !meta.lang) errors.push('meta.lang manquant.')
  const acts = story.acts as Array<{ scenes?: unknown[] }> | undefined
  if (!Array.isArray(acts) || !acts.some((a) => Array.isArray(a?.scenes) && a.scenes.length)) errors.push('Aucune scène.')

  if (!validateStory(story)) {
    for (const e of (validateStory.errors ?? []).slice(0, 20)) warnings.push(`${e.instancePath || '/'} ${e.message ?? ''}`.trim())
  }

  const files: PackFile[] = []
  for (const e of clean) {
    if (e === main) continue
    if (!e.path.startsWith(root)) {
      warnings.push(`Ignoré (hors du dossier de l’histoire) : ${e.path}`)
      continue
    }
    const path = e.path.slice(root.length)
    files.push({ path, data: e.data, type: mimeOf(path) })
  }
  return { story: errors.length ? null : story, files, errors, warnings }
}

/** Entries of a .zip. */
export function unzipPack(zip: Uint8Array): Array<{ path: string; data: Uint8Array }> {
  return Object.entries(unzipSync(zip))
    .filter(([path]) => !path.endsWith('/'))
    .map(([path, data]) => ({ path, data }))
}

/** A .zip of a pack: story.json at the top, then its files. */
export function zipPack(story: unknown, files: Array<{ path: string; data: Uint8Array }>): Uint8Array {
  const entries: Record<string, Uint8Array> = { 'story.json': strToU8(JSON.stringify(story, null, 2) + '\n') }
  for (const f of files) entries[f.path] = f.data
  return zipSync(entries, { level: 6 })
}

/** Scene count, for summaries. */
export function packSceneCount(story: Record<string, unknown>): number {
  return ((story.acts ?? []) as Array<{ scenes?: unknown[] }>).reduce((n, a) => n + (a.scenes?.length ?? 0), 0)
}

/**
 * Split picked files into packs: each story.json starts one, and every other file goes to the
 * closest story.json above it. A folder holding several pack folders imports them all at once.
 */
export function splitPacks(entries: Array<{ path: string; data: Uint8Array }>): Array<{ name: string; entries: Array<{ path: string; data: Uint8Array }> }> {
  const clean = entries
    .map((e) => ({ ...e, path: e.path.replace(/\\/g, '/').replace(/^\.?\//, '') }))
    .filter((e) => !junk(e.path))
  const roots = clean
    .filter((e) => e.path === 'story.json' || e.path.endsWith('/story.json'))
    .map((e) => e.path.slice(0, -'story.json'.length))
    .sort((a, b) => b.length - a.length) // deepest first
  if (!roots.length) return [{ name: '', entries: clean }]
  const packs = new Map(roots.map((r) => [r, [] as Array<{ path: string; data: Uint8Array }>]))
  for (const e of clean) {
    const root = roots.find((r) => e.path.startsWith(r))
    if (root !== undefined) packs.get(root)!.push(e)
  }
  return [...packs.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([root, list]) => ({ name: root.replace(/\/$/, '').split('/').pop() || 'story', entries: list }))
}
