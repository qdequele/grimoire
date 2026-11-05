// Pushes the Auth e-mail templates (and only them) to the linked hosted Supabase project.
//
//   pnpm emails:push            regenerates supabase/templates, shows the diff, asks before writing
//   pnpm emails:push --diff     only shows the diff, writes nothing
//   pnpm emails:push --yes      writes without asking (after you have read a --diff)
//
// `supabase config push` sends every property config.toml declares, and ours declares local
// settings (site URL 127.0.0.1, no e-mail confirmation…). So the push runs from a temporary folder
// whose config.toml declares only the [auth.email.template.*] sections: undeclared properties are
// left unchanged on the hosted project (Supabase CLI ≥ 3).
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

if (!existsSync('supabase/.temp/project-ref')) throw new Error('Not linked to a hosted project: run `supabase link --project-ref <ref>` first.')

execFileSync('node', ['scripts/gen-email-templates.mjs'], { stdio: 'inherit' })

// The template sections of config.toml, verbatim.
const sections = []
let keep = false
for (const line of readFileSync('supabase/config.toml', 'utf8').split('\n')) {
  if (line.startsWith('[')) keep = line.startsWith('[auth.email.template.')
  if (keep) sections.push(line)
}
if (!sections.length) throw new Error('No [auth.email.template.*] section in supabase/config.toml')

const work = mkdtempSync(path.join(tmpdir(), 'grimoire-emails-'))
try {
  mkdirSync(path.join(work, 'supabase', '.temp'), { recursive: true })
  cpSync('supabase/templates', path.join(work, 'supabase', 'templates'), { recursive: true })
  cpSync('supabase/.temp/project-ref', path.join(work, 'supabase', '.temp', 'project-ref'))
  writeFileSync(path.join(work, 'supabase', 'config.toml'), `project_id = "grimoire"\n\n${sections.join('\n')}\n`)

  const args = process.argv.slice(2)
  const diffOnly = args.includes('--diff')
  const cli = diffOnly ? ['config', 'diff'] : ['config', 'push', ...args.filter((a) => a === '--yes')]
  const { status } = spawnSync('supabase', [...cli, '--workdir', work], { stdio: 'inherit' })
  process.exitCode = status ?? 1
} finally {
  rmSync(work, { recursive: true, force: true })
}
