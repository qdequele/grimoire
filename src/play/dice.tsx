// 3D dice in the game screen (inside the engine's iframe): the dice panel's result and the roll
// picker's lines throw the dice the engine rolled before showing the number. The engine calls
// window.GRIMOIRE_DICE.throw (extraction patches, scripts/engine-dice.mjs); without it, or for dice
// that can't be drawn, it keeps its old spinning number.
import { createRoot } from 'react-dom/client'
import { DiceTray } from '@/companion/dice3d/DiceTray'
import { engineDice } from './diceRecord'
import './dice.css'

export interface EngineDice {
  /**
   * Throws the dice of `record` in `el`, then calls `done` once they rest. Returns a function that
   * removes them (a new roll, the result cleared), or null when there is nothing to draw: the engine
   * then shows its result as before.
   */
  throw(el: HTMLElement, record: unknown, done: () => void, maxSize?: number): (() => void) | null
}

let throws = 0

export const engineDiceApi: EngineDice = {
  throw(el, record, done, maxSize) {
    const dice = engineDice(record)
    if (!dice) return null
    const root = createRoot(el)
    let live = true
    const key = `t${++throws}`
    root.render(
      <DiceTray
        dice={dice}
        throwKey={key}
        maxSize={maxSize}
        style={{ padding: 0 }}
        onSettled={() => {
          if (!live) return
          live = false
          done()
        }}
      />,
    )
    return () => {
      live = false
      // Not while React may be rendering (the engine calls this from its own handlers).
      setTimeout(() => root.unmount(), 0)
    }
  },
}
