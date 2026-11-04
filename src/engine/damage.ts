/**
 * Health states. Legacy save codes in brackets, for the save-file migration later:
 * ok [—], majorWound [bless], unconscious [incon], dying [mour], dead [mort].
 */
export type HealthState = 'ok' | 'majorWound' | 'unconscious' | 'dying' | 'dead'

/** Why the state changed, so the UI can explain it (and cite the rule) in the right language. */
export type DamageOutcome =
  | 'none'
  | 'killedOutright' // a single hit ≥ max HP
  | 'majorWoundDying' // major wound that drops HP to 0
  | 'majorWound' // hit ≥ half max HP: CON roll or fall unconscious
  | 'dyingFromWound' // already wounded, now at 0 HP
  | 'unconscious' // 0 HP without a major wound

export interface Health {
  hp: number
  maxHp: number
  state: HealthState
}

export interface DamageResult {
  health: Health
  outcome: DamageOutcome
}

/** Apply one hit of `amount` damage. Pure: returns the new health. */
export function applyDamage(current: Health, amount: number): DamageResult {
  const { maxHp } = current
  const hp = Math.max(0, current.hp - amount)
  const next = (state: HealthState, outcome: DamageOutcome, hpOverride = hp): DamageResult => ({
    health: { maxHp, hp: hpOverride, state },
    outcome,
  })

  if (amount >= maxHp) return next('dead', 'killedOutright', 0)
  if (amount >= Math.ceil(maxHp / 2)) {
    return hp === 0 ? next('dying', 'majorWoundDying') : next('majorWound', 'majorWound')
  }
  if (hp === 0 && current.state === 'majorWound') return next('dying', 'dyingFromWound')
  if (hp === 0) return next('unconscious', 'unconscious')
  return next(current.state, 'none')
}
