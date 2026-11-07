// Drawn décor: cavern (placeholder, to be drawn). See the decor-artist skill.
import { type Draw, Layer, Moon, P, ridge } from '../placeKit'

export const cavern: Draw = (id) => (
  <>
    <Layer depth="far">
      <Moon x={1200} y={180} r={44} id={id} />
      <P d={ridge(700, 40, 1)} />
    </Layer>
  </>
)
