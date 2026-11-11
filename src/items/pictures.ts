// The catalogue cards' pictures: SVGs drawn by QuiverAI, checked and trimmed by
// scripts/item-arts-ship.mjs into src/items/pictures/<catalogue id>.svg. Each is its own file (an
// asset URL, fetched only when a card shows it) and shown as an <img>, so nothing in it can run.
// Cards without one (the keeper's own, story items, catalogue cards not generated yet) keep their
// line drawing (arts.ts).
import type { ItemSource } from './item'

const files = import.meta.glob<string>('./pictures/*.svg', { query: '?url', import: 'default', eager: true })

/** Picture URL by catalogue id. */
export const PICTURES: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.slice('./pictures/'.length, -'.svg'.length), url]),
)

/** The picture of a card, if it comes from the catalogue and has one. */
export const pictureOf = (source: ItemSource | undefined): string | undefined =>
  source?.kind === 'catalog' ? PICTURES[source.id] : undefined
