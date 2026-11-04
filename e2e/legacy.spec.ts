import { expect, test, type Page } from '@playwright/test'

// Smoke tests that pin down the legacy app's behaviour before it is rebuilt.
// Selectors are structural on purpose: no scenario text may appear in this public file.

const errors: string[] = []

test.beforeEach(async ({ page }) => {
  errors.length = 0
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.goto('/#accueil')
})

test.afterEach(() => {
  expect(errors, 'uncaught page errors').toEqual([])
})

// New game: pick a story, add one player, give them the first available investigator, start.
async function openFirstScenario(page: Page) {
  await page.goto('/#histoire')
  await page.locator('[data-newgame]').first().click()
  await expect(page.locator('#vSetup')).toBeVisible()
  await page.locator('#setAdd').click()
  await page.locator('#setAddName').fill('Alice')
  await page.locator('#setAddOk').click()
  const select = page.locator('select[data-sjc]').first()
  const firstChar = await select.locator('option[value]:not([value=""]):not([value="__new"])').first().getAttribute('value')
  await select.selectOption(firstChar ?? '')
  await page.locator('#setGo').click()
  await expect(page.locator('#vPlay')).toBeVisible()
  await expect(page.locator('#scene h2')).not.toBeEmpty()
}

test('home menu renders', async ({ page }) => {
  await expect(page.locator('#vHome')).toBeVisible()
  await expect(page.locator('#vPlay')).toBeHidden()
})

test('story list offers playable stories', async ({ page }) => {
  await page.goto('/#histoire')
  await expect(page.locator('[data-newgame]').first()).toBeVisible()
})

test('opening a scenario shows a scene and navigation', async ({ page }) => {
  await openFirstScenario(page)
  await expect(page.locator('#nav')).not.toBeEmpty()
})

test('next scene button moves to another scene', async ({ page }) => {
  await openFirstScenario(page)
  const first = await page.locator('#scene h2').textContent()
  await page.locator('#scene .scene-foot [data-go]').last().click()
  await expect(page.locator('#scene h2')).not.toHaveText(first ?? '')
})

test('a skill test chip opens the roll picker and rolls', async ({ page }) => {
  await openFirstScenario(page)
  // Walk scenes until one has a clickable test chip.
  for (let i = 0; i < 15; i++) {
    if (await page.locator('#scene .chip[data-kind="test"]').count()) break
    await page.locator('#scene .scene-foot .btn.prim[data-go]').click()
  }
  await page.locator('#scene .chip[data-kind="test"]').first().click()
  await expect(page.locator('#pick')).toBeVisible()
  // Give every selected investigator a value so the roll always happens.
  for (const input of await page.locator('#pick .pv-in').all()) {
    if (!(await input.inputValue())) await input.fill('50')
  }
  await page.locator('#pick .pk input[type="checkbox"]:not(:disabled)').first().check()
  await page.locator('#pkGo').click()
  await expect(page.locator('#pick .pres li').first()).toBeVisible()
})

test('state survives a reload', async ({ page }) => {
  await openFirstScenario(page)
  await page.locator('#scene .scene-foot .btn.prim[data-go]').click()
  const title = await page.locator('#scene h2').textContent()
  await page.reload()
  await expect(page.locator('#scene h2')).toHaveText(title ?? '')
})

test('language toggle switches the UI to English', async ({ page }) => {
  const btn = page.locator('#homeLang')
  const before = await btn.textContent()
  await btn.click()
  await expect(btn).not.toHaveText(before ?? '')
})

test('theme toggle switches skin', async ({ page }) => {
  const before = await page.locator('html').getAttribute('data-skin')
  await page.locator('#homeSkin').click()
  await expect(page.locator('html')).not.toHaveAttribute('data-skin', before ?? '')
})
