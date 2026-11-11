import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
// @ts-expect-error plain JS build script
import { BUNDLE_DIR, buildMapBundle } from '../../../scripts/gen-map-bundle.mjs'

describe('map kit bundle', () => {
  it('is the app’s map kit, copied as it is (pnpm maps:bundle)', () => {
    const files = (buildMapBundle as () => { name: string; text: string }[])()
    expect(files.map((f) => f.name)).toEqual(['model.ts', 'random.ts', 'render.ts', 'stamps.ts'])
    for (const { name, text } of files) expect(readFileSync(`${BUNDLE_DIR as string}/${name}`, 'utf8'), name).toBe(text)
  })
})
