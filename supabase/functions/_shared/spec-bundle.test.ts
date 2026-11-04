import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
// @ts-expect-error plain .mjs build script without type declarations
import { buildSpecBundle } from '../../../scripts/gen-spec-bundle.mjs'

describe('spec-bundle.ts', () => {
  it('is up to date with spec/ (run `pnpm spec:bundle` if this fails)', () => {
    const onDisk = readFileSync('supabase/functions/_shared/spec-bundle.ts', 'utf8')
    expect(onDisk).toBe((buildSpecBundle as () => string)())
  })
})
