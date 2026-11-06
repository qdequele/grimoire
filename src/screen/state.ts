// What the ambiance screen shows (games.screen), and how the keeper's actions change it. Pure.
// The keeper's game screen owns this state: it reduces actions, signs the image URLs and saves it;
// the screen only reads it (screen_open, then Realtime broadcasts of every change).
import { asFire, isPlace, isPreset, isTime, type FirePlace, type PlaceId, type PresetId, type SceneAmbiance, type TimeOfDay } from './ambiance'

/** A picture in Storage. `url` is a short-lived signed URL the keeper adds when publishing. */
export interface ImageRef {
  bucket: 'story-packs' | 'screen-images'
  path: string
  url?: string
}

export interface ScreenScene {
  preset: PresetId
  image: ImageRef | null
  /** Library ambience ids, played by the screen when `sound` is on. */
  sounds: string[]
  /** Where the fire is in the picture (hearth preset); absent: the default place. */
  fire?: FirePlace
  /** Drawn décor (church, graveyard…), shown when there is no picture; absent: none. */
  place?: PlaceId
  /** Time of day; absent: the preset's own. */
  time?: TimeOfDay
}

export interface ScreenHandout {
  /** What was pushed (handout id, image path…): same key = same handout, no re-animation. */
  key: string
  title: string
  text?: string
  image: ImageRef | null
}

export interface ScreenState {
  v: 1
  /** Follow the game's current scene (else the screen stays on the pinned one). */
  follow: boolean
  /** Play the scene's ambience sounds on the screen. */
  sound: boolean
  scene: ScreenScene | null
  /** The keeper's choice of preset for the scene on screen; reset when the screen moves to another scene. */
  override: PresetId | null
  /** The keeper's choice of décor for the scene on screen ('none': no décor); reset like `override`. */
  placeOverride: PlaceId | 'none' | null
  /** The keeper's choice of time of day for the scene on screen; reset like `override`. */
  timeOverride: TimeOfDay | null
  handout: ScreenHandout | null
}

export const INITIAL_SCREEN: ScreenState = { v: 1, follow: true, sound: false, scene: null, override: null, placeOverride: null, timeOverride: null, handout: null }

export type ScreenAction =
  /** The game moved to a scene (ignored while pinned). */
  | { type: 'scene'; scene: ScreenScene }
  /** Follow the game again (jumping to its current scene) or pin the screen where it is. */
  | { type: 'follow'; on: boolean; scene?: ScreenScene }
  | { type: 'preset'; preset: PresetId | null }
  | { type: 'place'; place: PlaceId | 'none' | null }
  | { type: 'time'; time: TimeOfDay | null }
  | { type: 'sound'; on: boolean }
  | { type: 'show'; handout: ScreenHandout }
  | { type: 'clear' }

export function screenReducer(state: ScreenState, action: ScreenAction): ScreenState {
  switch (action.type) {
    case 'scene':
      if (!state.follow || sameScene(state.scene, action.scene)) return state
      return { ...state, scene: action.scene, override: null, placeOverride: null, timeOverride: null }
    case 'follow':
      if (!action.on) return state.follow ? { ...state, follow: false } : state
      if (action.scene && !sameScene(state.scene, action.scene)) return { ...state, follow: true, scene: action.scene, override: null, placeOverride: null, timeOverride: null }
      return state.follow ? state : { ...state, follow: true }
    case 'preset':
      return state.override === action.preset ? state : { ...state, override: action.preset }
    case 'place':
      return state.placeOverride === action.place ? state : { ...state, placeOverride: action.place }
    case 'time':
      return state.timeOverride === action.time ? state : { ...state, timeOverride: action.time }
    case 'sound':
      return state.sound === action.on ? state : { ...state, sound: action.on }
    case 'show':
      return state.handout && sameHandout(state.handout, action.handout) ? state : { ...state, handout: action.handout }
    case 'clear':
      return state.handout ? { ...state, handout: null } : state
  }
}

/** The scene as the screen draws it: the keeper's preset, décor and time, if any, over the scene's own. */
export function shownScene(state: ScreenState): ScreenScene | null {
  const { override, placeOverride, timeOverride } = state
  if (!state.scene && !override && !placeOverride && !timeOverride) return null
  const { place, time, ...scene }: ScreenScene = state.scene ?? { preset: 'fog', image: null, sounds: [] }
  const shownPlace = placeOverride === 'none' ? undefined : (placeOverride ?? place)
  const shownTime = timeOverride ?? time
  return { ...scene, preset: override ?? scene.preset, ...(shownPlace ? { place: shownPlace } : {}), ...(shownTime ? { time: shownTime } : {}) }
}

/** Identity of a background on screen: a new key crossfades, the same key keeps the layers running. */
export const sceneKey = (s: ScreenScene | null): string =>
  s ? `${s.preset}|${s.image?.bucket ?? ''}|${s.image?.path ?? ''}${s.fire ? `|${s.fire.x},${s.fire.y},${s.fire.width}` : ''}${s.place ? `|@${s.place}` : ''}${s.time ? `|~${s.time}` : ''}` : 'idle'

const sameImage = (a: ImageRef | null, b: ImageRef | null) => a?.bucket === b?.bucket && a?.path === b?.path
const sameScene = (a: ScreenScene | null, b: ScreenScene | null) =>
  !!a && !!b && a.preset === b.preset && sameImage(a.image, b.image) && a.sounds.join() === b.sounds.join() && a.place === b.place && a.time === b.time &&
  JSON.stringify(a.fire ?? null) === JSON.stringify(b.fire ?? null)
const sameHandout = (a: ScreenHandout, b: ScreenHandout) =>
  a.key === b.key && a.title === b.title && a.text === b.text && sameImage(a.image, b.image)

/** Scene ambiance (pack paths) → what the screen state stores (Storage refs). */
export function toScreenScene(a: SceneAmbiance, packFolder: string): ScreenScene {
  return {
    preset: a.preset,
    image: a.image ? { bucket: 'story-packs', path: `${packFolder}/${a.image}` } : null,
    sounds: a.sounds,
    ...(a.fire ? { fire: a.fire } : {}),
    ...(a.place ? { place: a.place } : {}),
    ...(a.time ? { time: a.time } : {}),
  }
}

/** Every picture of the state, to sign before publishing. */
export const imagesOf = (s: ScreenState): ImageRef[] =>
  [s.scene?.image, s.handout?.image].filter((i): i is ImageRef => !!i)

/** Same state, ignoring signed URLs: nothing to publish when only those would change. */
export const sameScreen = (a: ScreenState, b: ScreenState): boolean => JSON.stringify(withoutUrls(a)) === JSON.stringify(withoutUrls(b))

function withoutUrls(s: ScreenState): ScreenState {
  const strip = (i: ImageRef | null): ImageRef | null => (i ? { bucket: i.bucket, path: i.path } : null)
  return {
    ...s,
    scene: s.scene ? { ...s.scene, image: strip(s.scene.image) } : null,
    handout: s.handout ? { ...s.handout, image: strip(s.handout.image) } : null,
  }
}

// ------------------------------------------------------------------ reading games.screen

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null)
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

function asImage(v: unknown): ImageRef | null {
  const o = obj(v)
  const path = str(o?.path)
  if (!o || !path || (o.bucket !== 'story-packs' && o.bucket !== 'screen-images')) return null
  const url = str(o.url)
  // Only web URLs reach an <img>: anything else in the row is ignored.
  return { bucket: o.bucket, path, ...(url && /^https?:\/\//.test(url) ? { url } : {}) }
}

function asScene(v: unknown): ScreenScene | null {
  const o = obj(v)
  if (!o || !isPreset(o.preset)) return null
  const sounds = Array.isArray(o.sounds) ? o.sounds.filter((x): x is string => typeof x === 'string') : []
  const fire = asFire(o.fire)
  return { preset: o.preset, image: asImage(o.image), sounds, ...(fire ? { fire } : {}), ...(isPlace(o.place) ? { place: o.place } : {}), ...(isTime(o.time) ? { time: o.time } : {}) }
}

function asHandout(v: unknown): ScreenHandout | null {
  const o = obj(v)
  const key = str(o?.key)
  if (!o || !key) return null
  const text = str(o.text)
  return { key, title: str(o.title) ?? '', ...(text ? { text } : {}), image: asImage(o.image) }
}

/** games.screen (any JSON, possibly null or from an older version) → a valid state. */
export function parseScreen(raw: unknown): ScreenState {
  const o = obj(raw)
  if (!o || o.v !== 1) return INITIAL_SCREEN
  return {
    v: 1,
    follow: o.follow !== false,
    sound: o.sound === true,
    scene: asScene(o.scene),
    override: isPreset(o.override) ? o.override : null,
    placeOverride: isPlace(o.placeOverride) || o.placeOverride === 'none' ? o.placeOverride : null,
    timeOverride: isTime(o.timeOverride) ? o.timeOverride : null,
    handout: asHandout(o.handout),
  }
}
