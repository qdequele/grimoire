// Dev-only gallery of the drawn décors (registered in App.tsx only when import.meta.env.DEV).
//   /dev/places?place=church&preset=fog&time=night   one place, full screen
//   /dev/places?sheet=1&preset=night&time=dusk       every place side by side (contact sheet)
// A place left out gets its own preset (PLACE_PRESET); a time left out, the preset's own.
import { useSearchParams } from 'react-router'
import { isPlace, isPreset, isTime, PLACE_PRESET, PLACES, type PlaceId } from './ambiance'
import { Stage } from './Stage'
import type { ScreenScene } from './state'

function sceneFor(place: PlaceId, params: URLSearchParams): ScreenScene {
  const p = params.get('preset')
  const t = params.get('time')
  return {
    preset: isPreset(p) ? p : PLACE_PRESET[place],
    image: null,
    sounds: [],
    place,
    ...(isTime(t) ? { time: t } : {}),
  }
}

export function PlacesGallery() {
  const [params] = useSearchParams()
  if (params.get('sheet')) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, padding: 6, background: '#000', minHeight: '100vh' }}>
        {PLACES.map((place) => (
          <div key={place} className="scr-root" style={{ position: 'relative', aspectRatio: '16 / 9' }}>
            <Stage scene={sceneFor(place, params)} handout={null} />
            <span style={{ position: 'absolute', left: 8, top: 6, font: '12px monospace', color: '#fff', textShadow: '0 0 3px #000' }}>{place}</span>
          </div>
        ))}
      </div>
    )
  }
  const p = params.get('place')
  const place: PlaceId = isPlace(p) ? p : 'church'
  return (
    <div className="scr-root">
      <Stage scene={sceneFor(place, params)} handout={null} />
    </div>
  )
}
