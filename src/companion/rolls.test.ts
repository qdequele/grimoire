import { describe, expect, it } from 'vitest'
import { makeT } from '@/i18n/t'
import { SKILLS } from '@/rules/d100'
import {
  asRoll, diceDetail, diceFormula, keptTens, parseSubject, rollableSkillKey, rollMessage, subjectKey, subjectName,
  type CheckRoll, type RollSubject,
} from './rolls'

const fr = makeT('fr')
const en = makeT('en')

const check = (over: Partial<CheckRoll> = {}): CheckRoll => ({
  id: 'r1', characterId: 'c1', kind: 'check', subject: 'skill:spot-hidden', target: 60, net: 0,
  tens: [2], units: 3, result: 23, level: 'hard', createdAt: '2026-11-06T10:00:00Z', ...over,
})

describe('skills', () => {
  it('every skill says what it is for', () => {
    expect(SKILLS.filter((s) => s.what.trim().length < 10).map((s) => s.id)).toEqual([])
  })
})

describe('roll subjects', () => {
  it('round-trips through the server key', () => {
    const subjects: RollSubject[] = [
      { kind: 'skill', key: 'spot-hidden' },
      { kind: 'skill', key: 'art-craft:Photographie' },
      { kind: 'char', id: 'POW' },
      { kind: 'san' },
      { kind: 'luck' },
    ]
    for (const s of subjects) expect(parseSubject(subjectKey(s))).toEqual(s)
    expect(parseSubject('char:XYZ')).toBeNull()
    expect(parseSubject('skill:')).toBeNull()
    expect(parseSubject('whatever')).toBeNull()
  })

  it('names the subject in the current language', () => {
    expect(subjectName(en, 'skill:spot-hidden')).toBe('Spot Hidden')
    expect(subjectName(en, 'skill:art-craft:Photographie')).toBe('Art/Craft (Photography)')
    expect(subjectName(fr, 'char:STR')).toBe('Force')
    expect(subjectName(en, 'luck')).toBe('Luck')
  })

  it('only offers skill keys the server accepts', () => {
    expect(rollableSkillKey('spot-hidden')).toBe(true)
    expect(rollableSkillKey('language-other:Latin')).toBe(true)
    expect(rollableSkillKey('Spot Hidden')).toBe(false)
    expect(rollableSkillKey('art-craft:<b>')).toBe(false)
  })
})

describe('asRoll', () => {
  it('reads the RPC answer and the table row alike', () => {
    const rpc = {
      id: 'r1', characterId: 'c1', kind: 'check', subject: 'skill:spot-hidden', target: 60, net: 1,
      dice: { tens: [5, 2], units: 3 }, result: 23, level: 'hard', createdAt: '2026-11-06T10:00:00Z',
    }
    const row = {
      id: 'r1', character_id: 'c1', kind: 'check', subject: 'skill:spot-hidden', target: 60, net: 1,
      dice: { tens: [5, 2], units: 3 }, result: 23, level: 'hard', created_at: '2026-11-06T10:00:00Z',
      game_id: 'g', owner_id: 'o',
    }
    expect(asRoll(rpc)).toEqual(check({ net: 1, tens: [5, 2] }))
    expect(asRoll(row)).toEqual(asRoll(rpc))
  })

  it('reads free dice', () => {
    expect(asRoll({
      id: 'r2', characterId: 'c1', kind: 'dice', dice: { count: 2, sides: 6, modifier: 1, results: [4, 3] },
      result: 8, createdAt: 'x',
    })).toEqual({ id: 'r2', characterId: 'c1', kind: 'dice', count: 2, sides: 6, modifier: 1, results: [4, 3], result: 8, createdAt: 'x' })
  })

  it('refuses anything malformed', () => {
    expect(asRoll(null)).toBeNull()
    expect(asRoll({ ...check(), dice: { tens: [], units: 3 } })).toBeNull()
    expect(asRoll({ id: 'r', characterId: 'c', kind: 'check', subject: 'san', target: 50, net: 0, dice: { tens: [1], units: 1 }, result: 11, level: 'great', createdAt: 'x' })).toBeNull()
    expect(asRoll({ id: 'r', characterId: 'c', kind: 'dice', dice: { count: 1, sides: 6, modifier: 0, results: ['6'] }, result: 6, createdAt: 'x' })).toBeNull()
  })
})

describe('reading a roll', () => {
  it('writes dice formulas and details', () => {
    expect(diceFormula({ count: 2, sides: 6, modifier: 1 })).toBe('2D6+1')
    expect(diceFormula({ count: 1, sides: 4, modifier: -1 })).toBe('1D4-1')
    expect(diceFormula({ count: 1, sides: 100, modifier: 0 })).toBe('1D100')
    const roll = { id: 'r', characterId: 'c', kind: 'dice' as const, count: 2, sides: 6, results: [4, 3], result: 8, createdAt: 'x' }
    expect(diceDetail({ ...roll, modifier: 1 })).toBe('4 + 3 + 1')
    expect(diceDetail({ ...roll, modifier: -2, result: 5 })).toBe('4 + 3 − 2')
  })

  it('finds the kept tens die, 00 + 0 reading 100', () => {
    expect(keptTens(check({ net: 1, tens: [5, 2], result: 23 }))).toBe(1)
    expect(keptTens(check({ net: -1, tens: [0, 4], units: 0, result: 100 }))).toBe(0)
  })

  it('makes the keeper’s toast', () => {
    expect(rollMessage(fr, check({ net: 1, tens: [5, 2] }), 'Ada')).toEqual({
      title: 'Ada · Trouver Objet Caché (60)',
      text: '23 — Réussite majeure · 1 dé bonus',
    })
    expect(rollMessage(en, check({ subject: 'san', target: 45, result: 80, level: 'failure', tens: [8], units: 0 }), 'Ada')).toEqual({
      title: 'Ada · SAN (45)',
      text: '80 — Failed',
    })
    expect(rollMessage(en, { id: 'r', characterId: 'c', kind: 'dice', count: 1, sides: 6, modifier: 0, results: [5], result: 5, createdAt: 'x' }, 'Ada'))
      .toEqual({ title: 'Ada rolls 1D6', text: '5' })
  })
})
