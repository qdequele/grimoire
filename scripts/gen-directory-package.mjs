// Prepares the ChatGPT and Claude directory submissions (directory/README.md):
//   - renders public/favicon.svg to directory/chatgpt/assets/logo.png and directory/claude-icon.png (512 px);
//   - checks directory/chatgpt/plugin.json against the limits OpenAI documents;
//   - zips directory/chatgpt into directory/grimoire-chatgpt.zip (refused while a required field is empty).
// Run: pnpm directory:package          (pnpm directory:package --icons-only to render the icons only)
import { chromium } from '@playwright/test'
import { zipSync } from 'fflate'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = 'directory/chatgpt'
const iconsOnly = process.argv.includes('--icons-only')

async function renderIcons() {
  const svg = readFileSync('public/favicon.svg', 'utf8')
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } })
  await page.setContent(`<style>*{margin:0}</style><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="512" height="512">`)
  const png = await page.screenshot({ type: 'png' })
  await browser.close()
  writeFileSync(join(ROOT, 'assets/logo.png'), png)
  writeFileSync('directory/claude-icon.png', png)
}

/** Every problem OpenAI's submission page would reject (limits quoted from its field tables). */
function problems(plugin, mcp) {
  const out = []
  const ext = plugin.extensions?.['com.openai'] ?? {}
  const ui = ext.interface ?? {}
  const max = (label, value, n) => {
    if (!value) out.push(`${label} is empty`)
    else if (value.length > n) out.push(`${label} is ${value.length} characters (max ${n})`)
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(plugin.name ?? '') || plugin.name.length > 64) out.push('name: lowercase letters, digits and single hyphens, 64 max')
  max('interface.displayName', ui.displayName, 30)
  max('interface.shortDescription', ui.shortDescription, 30)
  max('interface.longDescription', ui.longDescription, 4000)
  max('interface.developerName', ui.developerName, 80)
  if (!ui.category) out.push('interface.category is empty')
  for (const k of ['websiteURL', 'supportURL', 'privacyPolicyURL', 'termsOfServiceURL']) {
    if (!/^https:\/\/[^@\s]+$/.test(ui[k] ?? '') || ui[k].length > 1024) out.push(`interface.${k} must be an https URL`)
  }
  if ((ui.capabilities ?? []).length > 20 || (ui.capabilities ?? []).some((c) => c.length > 120)) out.push('interface.capabilities: 20 items of 120 characters max')
  const prompts = ui.defaultPrompt ?? []
  if (prompts.length > 3 || prompts.some((p) => p.length > 128) || new Set(prompts).size !== prompts.length) out.push('interface.defaultPrompt: 3 unique prompts of 128 characters max')
  for (const k of ['brandColor', 'brandColorDark']) if (ui[k] && !/^#[0-9A-Fa-f]{6}$/.test(ui[k])) out.push(`interface.${k} must be #RRGGBB`)
  if (!ui.logo) out.push('interface.logo is required')
  for (const k of ['logo', 'logoDark', 'composerIcon', 'composerIconDark']) {
    if (ui[k]) {
      try {
        statSync(join(ROOT, ui[k]))
      } catch {
        out.push(`interface.${k}: ${ui[k]} is missing`)
      }
    }
  }
  const cases = ext.review?.test_cases ?? {}
  if (cases.positive?.length !== 5) out.push('review.test_cases.positive: exactly 5')
  if (cases.negative?.length !== 3) out.push('review.test_cases.negative: exactly 3')
  for (const c of cases.positive ?? []) for (const k of ['description', 'prompt', 'tools_triggered', 'expected_behavior']) if (!c[k]) out.push(`positive case "${c.description}": ${k} is empty`)
  if (!/^https:\/\//.test(ext.review?.demo_recording_url ?? '')) out.push('review.demo_recording_url: the link to your demo video (see directory/README.md)')
  for (const [locale, tr] of Object.entries(ext.publication?.translations ?? {})) {
    if ((tr.subtitle ?? '').length > 30 || /\n/.test(tr.subtitle ?? '')) out.push(`translations.${locale}.subtitle: one line, 30 characters max`)
    if ((tr.description ?? '').length > 4000) out.push(`translations.${locale}.description: 4000 characters max`)
  }
  const servers = Object.values(mcp.mcpServers ?? {})
  if (servers.length !== 1 || servers[0].type !== 'streamable-http' || !/^https:\/\//.test(servers[0].url)) out.push('mcp.json: exactly one streamable-http server with an https url')
  return out
}

const files = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]))

await renderIcons()
console.log('Icons: directory/chatgpt/assets/logo.png, directory/claude-icon.png (512 × 512)')
if (!iconsOnly) {
  const plugin = JSON.parse(readFileSync(join(ROOT, 'plugin.json'), 'utf8'))
  const mcp = JSON.parse(readFileSync(join(ROOT, 'mcp.json'), 'utf8'))
  const bad = problems(plugin, mcp)
  if (bad.length) {
    console.error(`Not zipped, plugin.json needs:\n  - ${bad.join('\n  - ')}`)
    process.exit(1)
  }
  const zip = zipSync(Object.fromEntries(files(ROOT).map((f) => [relative(ROOT, f), readFileSync(f)])), { level: 9 })
  writeFileSync('directory/grimoire-chatgpt.zip', zip)
  console.log(`Zipped: directory/grimoire-chatgpt.zip (${(zip.length / 1024).toFixed(0)} KB)`)
}
