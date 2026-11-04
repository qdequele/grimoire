import { describe, expect, it } from 'vitest'
import { applyDamage, type Health } from './damage'

const healthy = (hp: number, maxHp = hp): Health => ({ hp, maxHp, state: 'ok' })

describe('applyDamage', () => {
  it('a minor hit just removes HP', () => {
    expect(applyDamage(healthy(12), 3)).toEqual({ health: { hp: 9, maxHp: 12, state: 'ok' }, outcome: 'none' })
  })

  it('a hit of at least max HP kills outright', () => {
    expect(applyDamage(healthy(12), 12)).toEqual({ health: { hp: 0, maxHp: 12, state: 'dead' }, outcome: 'killedOutright' })
  })

  it('a hit of at least half max HP is a major wound', () => {
    const r = applyDamage(healthy(12), 6)
    expect(r.health.state).toBe('majorWound')
    expect(r.outcome).toBe('majorWound')
  })

  it('half max HP rounds up', () => {
    expect(applyDamage(healthy(11), 5).outcome).toBe('none')
    expect(applyDamage(healthy(11), 6).outcome).toBe('majorWound')
  })

  it('a major wound that reaches 0 HP leaves them dying', () => {
    const r = applyDamage(healthy(7, 12), 7)
    expect(r.health).toEqual({ hp: 0, maxHp: 12, state: 'dying' })
  })

  it('reaching 0 HP while already wounded is dying', () => {
    const r = applyDamage({ hp: 2, maxHp: 12, state: 'majorWound' }, 3)
    expect(r.outcome).toBe('dyingFromWound')
  })

  it('reaching 0 HP without a major wound is unconscious', () => {
    const r = applyDamage(healthy(2, 12), 3)
    expect(r.health).toEqual({ hp: 0, maxHp: 12, state: 'unconscious' })
  })
})
