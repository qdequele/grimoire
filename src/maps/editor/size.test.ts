import { describe, expect, it } from 'vitest'
import { settledSize, sizeWithin } from './size'

describe('the map editor’s width and height fields', () => {
  it('reads a size only from a whole number within the limits', () => {
    expect(sizeWithin('30', 6, 48)).toBe(30)
    expect(sizeWithin('6', 6, 48)).toBe(6)
    // What is on screen while a size is being typed: not a size yet.
    for (const text of ['', ' ', '3', '60', '12.5', '1e1x', '-8']) expect(sizeWithin(text, 6, 48), text).toBeNull()
  })

  it('settles on the typed number, brought within the limits, when the keeper leaves the field', () => {
    expect(settledSize('30', 6, 48, 24)).toBe(30)
    expect(settledSize('3', 6, 48, 24)).toBe(6)
    expect(settledSize('60', 6, 48, 24)).toBe(48)
    expect(settledSize('12.4', 6, 48, 24)).toBe(12)
  })

  it('keeps the map’s size when the field was left empty or unreadable', () => {
    expect(settledSize('', 6, 48, 24)).toBe(24)
    expect(settledSize('  ', 6, 48, 24)).toBe(24)
    expect(settledSize('abc', 6, 48, 24)).toBe(24)
  })
})
