// Parity: the new app's game screen must render every scene exactly like the original app.
// Runs where both the private legacy app and the converted private stories exist, against the
// local Supabase stack. For each scene: same #scene HTML in both, after the same navigation.
import { existsSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { expect, test, type Page } from '@playwright/test'

const SCENARIOS: Array<[id: string, lang: 'fr' | 'en']> = [['livres', 'fr'], ['frontiere', 'fr'], ['frontiere-en', 'en']]
const hasPrivate = existsSync('legacy/index.html') && SCENARIOS.every(([s]) => existsSync(`private/stories/${s}/story.json`))
const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

test.skip(!hasPrivate || !url || !serviceKey, 'needs the private legacy app, private/stories and SUPABASE_* env (pnpm e2e:parity)')

const LEGACY = 'http://localhost:8000'
const APP = 'http://localhost:5173'

/** Same markup modulo whitespace and the live clock. */
const normalize = (html: string) =>
  html
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .replace(/\d{1,2}:\d{2}/g, 'HH:MM')
    .trim()

async function legacyScenes(page: Page, scenario: string, lang: string) {
  await page.goto(LEGACY + '/')
  await page.evaluate((l) => {
    localStorage.clear()
    localStorage.setItem('gardien-lang', l)
  }, lang)
  await page.goto(LEGACY + '/#histoire')
  await page.locator(`#storyList [data-newgame="${scenario}"]`).click()
  await page.locator('#setAdd').click()
  await page.locator('#setAddName').fill('Alice')
  await page.locator('#setAddOk').click()
  const sel = page.locator('select[data-sjc]').first()
  await sel.selectOption((await sel.locator('option[value]:not([value=""]):not([value="__new"])').first().getAttribute('value')) ?? '')
  await page.locator('#setGo').click()
  await expect(page.locator('#scene h2')).toBeVisible()
  return renderAll(page)
}

/** Visit every scene with the engine's own go(), collect #scene HTML per scene id. */
async function renderAll(target: Page | import('@playwright/test').Frame) {
  return target.evaluate(() => {
    const g = eval as (s: string) => unknown // indirect eval: reads the page's globals
    const sc = (g('SC') as () => { acts: Array<{ scenes: Array<{ id: string }> }> })()
    const go = g('go') as (id: string) => void
    const out: Record<string, string> = {}
    const html = (sel: string) => document.querySelector(sel)?.innerHTML ?? '(missing)'
    const click = (sel: string) => (document.querySelector(sel) as HTMLElement | null)?.click()
    for (const s of sc.acts.flatMap((a) => a.scenes)) {
      go(s.id)
      out[s.id] = html('#scene')
      out[`${s.id} · scene NPCs`] = html('#npcPanel')
    }
    // Panels that don't depend on the party (only where the scenario has them: otherwise they are
    // hidden, and the original's hidden copy held another scenario's texts).
    const scenario = sc as unknown as { ritual: boolean; who: boolean }
    if (scenario.ritual) out['ritual panel'] = html('#ritPanel')
    click('#qaNpc')
    out['NPCs and monsters'] = html('#npcPanel')
    click('#qaNpc')
    if (scenario.who) {
      click('#tabWho')
      out['who knows what'] = html('#invView')
    }
    click('#qaSnd')
    out['sounds'] = html('#sndBody')
    click('#qaRules')
    out['rules'] = html('#rulesSheetBody')
    return out
  })
}

async function newAppScenes(page: Page, scenario: string, lang: string) {
  const admin = createClient(url!, serviceKey!, { auth: { persistSession: false } })
  const email = `parity-${crypto.randomUUID()}@test.local`
  const { data: created, error } = await admin.auth.admin.createUser({ email, password: 'correct-horse-battery', email_confirm: true })
  if (error) throw error
  const owner = created.user.id
  const content = JSON.parse(readFileSync(`private/stories/${scenario}/story.json`, 'utf8'))
  const { data: story } = await admin.from('stories').insert({ owner_id: owner, visibility: 'private', content }).select('id').single()
  const { data: character } = await admin
    .from('characters')
    .insert({ owner_id: owner, data: { name: 'Ada', player: 'Alice', characteristics: { DEX: 50 }, hp: 10, san: 50, luck: 50, mp: 10, skills: {} } })
    .select('id')
    .single()
  const firstScene = content.acts[0].scenes[0].id
  const { data: game } = await admin
    .from('games')
    .insert({ owner_id: owner, story_id: story!.id, state: { scene: firstScene, done: [], party: [{ characterId: character!.id }] } })
    .select('id')
    .single()

  await page.goto(APP + '/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Mot de passe').fill('correct-horse-battery')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await page.waitForURL(APP + '/')
  await page.evaluate((l) => localStorage.setItem('gardien-lang', l), lang)
  await page.goto(`${APP}/games/${game!.id}`)
  await expect(page.frameLocator('iframe[title="Partie"]').locator('#scene h2')).toBeVisible({ timeout: 15000 })
  const frame = page.frame({ url: /play\.html/ })!
  return renderAll(frame)
}

for (const [scenario, lang] of SCENARIOS) {
  test(`every scene of "${scenario}" (${lang}) renders like the original`, async ({ browser }) => {
    const legacyPage = await (await browser.newContext()).newPage()
    const appPage = await (await browser.newContext()).newPage()
    const [before, after] = await Promise.all([legacyScenes(legacyPage, scenario, lang), newAppScenes(appPage, scenario, lang)])
    expect(Object.keys(after)).toEqual(Object.keys(before))
    expect(Object.keys(before).length).toBeGreaterThan(20)
    // In English the engine's glossary and translation passes race (in the original too): glossary
    // boxes land in a timing-dependent place, and the scene NPC panel title comes out as "PNJ de la
    // scène", "Scene NPCs" or "Scene <abbr>NPCs</abbr>". English is compared without glossary boxes
    // and with that title settled; the glossary itself is compared strictly in French.
    const KNOWN = (html: string) =>
      lang === 'en'
        ? html.replace(/<abbr class="gl"[^>]*>(.*?)<\/abbr>/g, '$1').replace('<span>PNJ de la scène</span>', '<span>Scene NPCs</span>')
        : html
    // Also in English, the original showed the ritual panel and the rules sheet in French until the
    // language was switched by hand; the new app shows them in English. Compared in French only.
    if (lang === 'en') {
      for (const k of ['ritual panel', 'rules']) {
        delete before[k]
        delete after[k]
      }
    }
    for (const id of Object.keys(before)) {
      if (!id.includes(' ')) expect(before[id].length, `scene ${id} rendered`).toBeGreaterThan(200)
      expect.soft(normalize(KNOWN(after[id])), `scene ${id}`).toBe(normalize(KNOWN(before[id])))
    }
  })
}
