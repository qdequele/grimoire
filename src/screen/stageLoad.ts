// When the Stage loads a scene's picture (again). Pure, so it is tested without a browser.

/** What the Stage last drew: the scene's key, the picture URL it tried and whether that picture loaded. */
export interface Drawn {
  key: string
  url: string | undefined
  ok: boolean
}

/** Does this scene (its key, its picture's signed URL) need loading, given what was last drawn? */
export function needsLoad(drawn: Drawn | null, key: string, url: string | undefined): boolean {
  if (drawn?.key !== key) return true
  // The same background re-sent (check-in, new signature): nothing to redraw once its picture is there.
  // If the picture failed (expired signature, network error), another URL is worth one try; the same URL
  // is not, since the same state comes back at every check-in.
  return !drawn.ok && !!url && url !== drawn.url
}

/** Once loaded: does the scene fade in as a new layer? Not when the same scene's picture failed again. */
export const addsLayer = (drawn: Drawn | null, key: string, ok: boolean): boolean => ok || drawn?.key !== key
