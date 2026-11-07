import { describe, expect, it } from 'vitest'
import { initials, isPhoto, PHOTO_MAX, photoOr, squareCrop } from './photo'

describe('photo', () => {
  it('accepts base64 JPEG, PNG and WebP data URLs only', () => {
    expect(isPhoto('data:image/jpeg;base64,/9j/4AAQSkZJRg==')).toBe(true)
    expect(isPhoto('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==')).toBe(true)
    expect(isPhoto('data:image/webp;base64,UklGRiQAAABXRUJQ')).toBe(true)
    for (const v of [
      null, '', 42, 'https://example.com/a.jpg',
      'data:image/svg+xml;base64,PHN2Zz4=',
      'data:image/jpeg;base64,/9j/");x:url(y',
      'data:image/png;base64,/9j/AAAA',
      'data:image/jpeg;base64,/9j/' + 'A'.repeat(PHOTO_MAX),
    ]) expect(isPhoto(v)).toBe(false)
    expect(photoOr('nope')).toBeNull()
  })

  it('initials like the game screen', () => {
    expect(initials('Ada Lovelace')).toBe('AL')
    expect(initials('  émile  zola  de ')).toBe('ÉZ')
    expect(initials('Solo')).toBe('S')
    expect(initials('')).toBe('')
  })

  it('crops the centred square', () => {
    expect(squareCrop(400, 300)).toEqual({ sx: 50, sy: 0, side: 300 })
    expect(squareCrop(300, 401)).toEqual({ sx: 0, sy: 51, side: 300 })
    expect(squareCrop(10, 10)).toEqual({ sx: 0, sy: 0, side: 10 })
  })
})
