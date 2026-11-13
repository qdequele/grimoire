// The migration files' versions: production records each applied migration by its version alone, so
// two files with one version make the deploy apply the second again (or never), and it fails there
// (20261111090000 had both character_items and ai_usage_map). The deploy runs these tests first.
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const dir = join(import.meta.dirname, '../../migrations')
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()

describe('migrations', () => {
  it('are named <14-digit version>_<name>.sql', () => {
    for (const f of files) expect(f).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/)
  })

  it('each have their own version', () => {
    const versions = files.map((f) => f.slice(0, 14))
    const twice = versions.filter((v, i) => versions.indexOf(v) !== i)
    expect(twice, `versions used by more than one file: ${twice.join(', ')}`).toEqual([])
  })
})
