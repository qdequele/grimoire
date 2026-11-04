/** A source of randomness: returns a float in [0, 1). Injectable so rolls are testable. */
export type Rng = () => number

export const defaultRng: Rng = Math.random

/** Roll one die with `sides` faces: 1..sides. */
export function die(sides: number, rng: Rng = defaultRng): number {
  return 1 + Math.floor(rng() * sides)
}

/** An Rng that replays the given die faces for the given die sizes, for tests. */
export function scriptedRng(faces: Array<[face: number, sides: number]>): Rng {
  let i = 0
  return () => {
    const next = faces[i++]
    if (!next) throw new Error(`scriptedRng exhausted after ${faces.length} rolls`)
    const [face, sides] = next
    // Middle of the bucket that maps to `face` in die().
    return (face - 0.5) / sides
  }
}
