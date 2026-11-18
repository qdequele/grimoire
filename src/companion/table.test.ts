import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { currentT } from '@/i18n/t'
import { asTableRoll, rollMessage, asRoll } from './rolls'
import { asDocument, asTable } from './table'

describe('the table a link reads', () => {
  it('keeps a document with text or a web picture, and drops anything else', () => {
    expect(asDocument({ id: 'a', key: 'handout:x', title: 'Lettre', text: 'Cher **ami**', image: null, createdAt: '2026-11-18' }))
      .toEqual({ id: 'a', key: 'handout:x', title: 'Lettre', text: 'Cher **ami**', createdAt: '2026-11-18' })
    expect(asDocument({ id: 'a', key: 'k', title: 'Plan', text: null, image: { bucket: 'story-packs', path: 'p', url: 'https://x.test/p.png?token=1' } }))
      .toMatchObject({ image: 'https://x.test/p.png?token=1' })
    // A picture address that isn't a web one never reaches an <img>; nothing left to show: no document.
    expect(asDocument({ id: 'a', key: 'k', title: 'Plan', image: { url: 'javascript:alert(1)' } })).toBeNull()
    expect(asDocument({ id: 'a', key: 'k', title: 'Plan', image: { bucket: 'b', path: 'p' } })).toBeNull()
    expect(asDocument({ key: 'k', text: 'x' })).toBeNull()
  })

  it('reads any answer: a missing screen is the idle one, malformed rows are left out', () => {
    const t = asTable({ screen: null, documents: [null, { id: 'a', key: 'k', text: 'x' }, 3], rolls: [{ kind: 'nope' }] })
    expect(t.screen.scene).toBeNull()
    expect(t.documents).toHaveLength(1)
    expect(t.rolls).toEqual([])
    expect(asTable(undefined)).toMatchObject({ documents: [], rolls: [] })
  })
})

describe('rolls shared at the table', () => {
  const t = currentT()
  const base = { id: 'r', characterId: 'c', createdAt: '2026-11-18T10:00:00Z' }

  it('a SAN roll says what it cost', () => {
    const roll = asTableRoll({ ...base, kind: 'check', subject: 'san', target: 54, net: 0, dice: { tens: [7], units: 1 }, result: 71, level: 'failure', source: 'phone', effect: { field: 'san', delta: -4, from: 54, to: 50, formula: '1D6' } })
    expect(roll).toMatchObject({ kind: 'check', effect: { field: 'san', delta: -4, from: 54, to: 50, formula: '1D6' } })
    expect(roll && 'source' in roll).toBe(false)
    expect(rollMessage(t, roll!, 'Ada').text).toBe('71 — Échec · −4 SAN (54 → 50)')
  })

  it('a roll that cost nothing says so', () => {
    const roll = asTableRoll({ ...base, kind: 'check', subject: 'san', target: 54, net: 0, dice: { tens: [1], units: 1 }, result: 11, level: 'hard', effect: { field: 'san', delta: 0, from: 54, to: 54, formula: '0' } })
    expect(rollMessage(t, roll!, 'Ada').text).toBe('11 — Réussite majeure · SAN : aucune perte')
  })

  it('the keeper’s rolls: a test named in the keeper’s words, and damage with the HP it cost', () => {
    const test = asTableRoll({ ...base, kind: 'check', subject: 'label:Bibliothèque', target: 60, net: 0, dice: { tens: [3], units: 4 }, result: 34, level: 'regular', source: 'keeper' })
    expect(test).toMatchObject({ source: 'keeper' })
    expect(rollMessage(t, test!, 'Ada').title).toBe('Ada · Bibliothèque (60)')
    const raw = { ...base, kind: 'damage', subject: 'label:Chute', dice: { formula: '1D6', total: 4 }, result: 4, source: 'keeper', effect: { field: 'pv', delta: -4, from: 11, to: 7 } }
    const damage = asTableRoll(raw)
    expect(rollMessage(t, damage!, 'Ada')).toEqual({ title: 'Ada · Chute', text: '1D6 = 4 dégâts · −4 PV (11 → 7)' })
    // Damage is not a player's roll: the keeper's toasts and the phone's history never get one.
    expect(asRoll(raw)).toBeNull()
  })

  it('ignores a malformed cost', () => {
    const roll = asTableRoll({ ...base, kind: 'check', subject: 'san', target: 54, net: 0, dice: { tens: [1], units: 1 }, result: 11, level: 'hard', effect: { field: 'luck', delta: 'x' } })
    expect(roll && 'effect' in roll).toBe(false)
  })
})
