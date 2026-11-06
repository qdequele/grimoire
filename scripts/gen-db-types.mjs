// Regenerates the typed database client (`pnpm db:types`) so the result is reproducible: the Supabase CLI's
// raw output is normalised to the committed style (jsonb not-null columns typed `Json`, no semicolons,
// no ComputedFields lines), then written to the app copy and the Edge Functions copy.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const targets = ['src/lib/database.types.ts', 'supabase/functions/_shared/database.types.ts']

const raw = execFileSync('supabase', ['gen', 'types', 'typescript', '--local'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})
const cleaned = raw.replace(/NonNullable<Json>/g, 'Json').replace(/^ *ComputedFields: never\n/gm, '')

const dir = mkdtempSync(join(tmpdir(), 'db-types-'))
try {
  const file = join(dir, 'database.types.ts')
  writeFileSync(file, cleaned)
  execFileSync('npx', ['--yes', 'prettier@3.6.2', '--no-semi', '--parser', 'typescript', '--write', file], { stdio: 'ignore' })
  const out = readFileSync(file, 'utf8')
  for (const t of targets) writeFileSync(t, out)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
