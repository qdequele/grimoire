// The map editor's width and height fields. A size being typed passes through numbers the keeper
// never meant ("3" on the way to "30"): resizing on each of them would cut the map and lose what
// was beyond. So what is typed is only text until the keeper leaves the field or presses Enter.

/** The size a field's text says, when it is a whole number within the limits; null otherwise. */
export function sizeWithin(text: string, min: number, max: number): number | null {
  const n = Number(text)
  return text.trim() !== '' && Number.isInteger(n) && n >= min && n <= max ? n : null
}

/** The size a field settles on when the keeper is done: the typed number within the limits, or the map's size when nothing usable was typed. */
export function settledSize(text: string, min: number, max: number, current: number): number {
  const n = Math.round(Number(text))
  return text.trim() === '' || !Number.isFinite(n) ? current : Math.min(max, Math.max(min, n))
}
