// A print sheet of item cards: A4 pages of nine cards at playing-card size (63 × 88 mm), with cut
// lines, and optionally a page of backs after each page of fronts, its rows mirrored so that printed
// two-sided (flipped on the long edge) every back lands behind its card. Shown only when printing
// (items.css, .isheet), in the cards' own colours even on the black-on-white tool pages.
import { Fragment } from 'react'
import type { CatalogItem } from './catalog'
import { CardBack } from './CardViewer'
import { ItemCard } from './ItemCard'

const PER_PAGE = 9
const COLUMNS = 3

/** Pages of nine; the last one padded with empty cells so the backs still mirror. */
export function sheetPages<T>(cards: T[]): Array<Array<T | null>> {
  const pages: Array<Array<T | null>> = []
  for (let i = 0; i < cards.length; i += PER_PAGE) {
    const page: Array<T | null> = cards.slice(i, i + PER_PAGE)
    while (page.length < PER_PAGE) page.push(null)
    pages.push(page)
  }
  return pages
}

/** A page's cells as their backs fall when the sheet is turned over on its long edge: each row reversed. */
export function mirrored<T>(page: T[]): T[] {
  const rows: T[][] = []
  for (let i = 0; i < page.length; i += COLUMNS) rows.push(page.slice(i, i + COLUMNS).reverse())
  return rows.flat()
}

export function PrintSheet({ cards, backs }: { cards: CatalogItem[]; backs: boolean }) {
  return (
    <div className="isheet" aria-hidden="true">
      {sheetPages(cards).map((page, i) => (
        <Fragment key={i}>
          <section className="isheet-page">
            {page.map((c, j) => (
              <div key={j} className="isheet-cell">
                {c && <ItemCard card={c.card} source={{ kind: 'catalog', id: c.id }} eager />}
              </div>
            ))}
          </section>
          {backs && (
            <section className="isheet-page">
              {mirrored(page).map((c, j) => (
                <div key={j} className="isheet-cell">{c && <CardBack />}</div>
              ))}
            </section>
          )}
        </Fragment>
      ))}
    </div>
  )
}
