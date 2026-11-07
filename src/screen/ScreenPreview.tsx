// What the ambiance screen draws for a scene, from query params, without an account or a link: the
// game screen shows it small beside each scene's sounds (scripts/engine-ui/ui.engine.js, scrPrevHTML).
//   /screen-preview?preset=rain&place=manor&time=dusk[&image=<signed Storage URL>]
// A picture is only taken from this project's Storage (a signed URL the keeper's game made).
import { useSearchParams } from 'react-router'
import { previewScene } from './preview'
import { Stage } from './Stage'

export function ScreenPreview() {
  const [params] = useSearchParams()
  return (
    <div className="scr-root">
      <Stage scene={previewScene(params)} handout={null} />
    </div>
  )
}
