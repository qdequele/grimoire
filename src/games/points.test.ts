import { describe, expect, it } from 'vitest'
import { keeperPatch, mergeRow, type PointField } from './points'

const none: ReadonlySet<PointField> = new Set()
const pts = (pv: number, san: number, chance = 50, pm = 10) => ({ pv, san, chance, pm })

describe('mergeRow (a game_points row into the engine)', () => {
  it('keeps a keeper change not written yet when the phone changes another field', () => {
    // The table held pv 10, san 54. The keeper applied damage (pv 4, still in the save delay);
    // the phone then lowered SAN: its row still carries the table's pv 10.
    const m = mergeRow(pts(10, 53), pts(10, 54), pts(4, 54), none)
    expect(m.engine).toEqual(pts(4, 53))
    expect(m.changed).toBe(true)
    // What the table holds: the next save sees pv 4 ≠ 10 and writes it.
    expect(m.table).toEqual(pts(10, 53))
  })

  it('takes every field the table changed', () => {
    const m = mergeRow(pts(9, 53, 40, 8), pts(10, 54, 50, 10), pts(10, 54, 50, 10), none)
    expect(m.engine).toEqual(pts(9, 53, 40, 8))
    expect(m.table).toEqual(pts(9, 53, 40, 8))
  })

  it('takes the whole row when nothing is known of the table yet (an investigator joining)', () => {
    expect(mergeRow(pts(9, 53), undefined, pts(12, 60), none).engine).toEqual(pts(9, 53))
    expect(mergeRow(pts(9, 53), undefined, undefined, none)).toEqual({ engine: pts(9, 53), changed: true, table: pts(9, 53) })
  })

  it('changes nothing when the row is what the table was known to hold', () => {
    const m = mergeRow(pts(10, 54), pts(10, 54), pts(4, 54), none)
    expect(m.engine).toEqual(pts(4, 54))
    expect(m.changed).toBe(false)
  })

  it('leaves a field whose keeper write is still on its way: the row read is older than that write', () => {
    // pv 4 was sent (the table is assumed to hold it), the row read still shows pv 10 and the phone's SAN.
    const m = mergeRow(pts(10, 53), pts(4, 54), pts(4, 54), new Set<PointField>(['pv']))
    expect(m.engine).toEqual(pts(4, 53))
    expect(m.table).toEqual(pts(4, 53))
  })
})

describe('keeperPatch (keeper values to game_points)', () => {
  const now = { ...pts(4, 54), checks: ['spot-hidden'] }

  it('sends only the fields the keeper changed, so a phone change to another field stays', () => {
    expect(keeperPatch(now, { ...pts(10, 54), checks: ['spot-hidden'] }, true)).toEqual({ pv: 4 })
    expect(keeperPatch(now, { ...pts(10, 54), checks: [] }, true)).toEqual({ pv: 4, checks: ['spot-hidden'] })
    expect(keeperPatch(now, { ...pts(4, 54), checks: [] }, true)).toEqual({ checks: ['spot-hidden'] })
  })

  it('sends nothing when nothing changed', () => {
    expect(keeperPatch(now, { ...pts(4, 54), checks: ['spot-hidden'] }, true)).toBeNull()
    expect(keeperPatch(now, { ...pts(4, 54), checks: ['spot-hidden'] }, false)).toBeNull()
  })

  it('sends the whole row when the table has none yet', () => {
    expect(keeperPatch(now, { ...pts(10, 54), checks: ['spot-hidden'] }, false)).toEqual({ ...pts(4, 54), checks: ['spot-hidden'] })
    expect(keeperPatch(now, undefined, true)).toEqual({ ...pts(4, 54), checks: ['spot-hidden'] })
  })
})
