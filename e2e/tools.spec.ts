import { expect, test } from '@playwright/test'

// The free public tools: no account, no database. Structural selectors only (no story text).

test('dice roller: a d100 against a value, then free dice', async ({ page }) => {
  await page.goto('/outils/lanceur-de-des')
  await expect(page).toHaveTitle(/Lanceur de dés/)
  await page.getByLabel('Valeur de la compétence ou de la caractéristique').fill('60')
  await expect(page.getByText('≤ 30')).toBeVisible()
  await page.getByRole('button', { name: 'Lancer 1D100' }).click()
  const result = page.getByTestId('roll-result').first()
  await expect(result).toBeVisible({ timeout: 5000 })
  const value = Number(await result.locator('output').textContent())
  expect(value).toBeGreaterThanOrEqual(1)
  expect(value).toBeLessThanOrEqual(100)
  await expect(page.getByRole('heading', { name: 'Derniers jets' })).toBeVisible()

  await page.getByRole('radio', { name: 'D20' }).click()
  await page.getByRole('button', { name: 'Lancer 1D20' }).click()
  await expect(page.getByTestId('roll-result')).toHaveCount(2, { timeout: 5000 })
})

test('investigator creator: at random, then the sheet to print, in English', async ({ page }) => {
  await page.goto('/tools/investigator-generator')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Create an investigator')
  // The wizard runs without an account: no AI help on the background step.
  await page.getByRole('button', { name: /Profile/ }).click()
  await expect(page.getByRole('button', { name: /Suggest with AI/ })).toHaveCount(0)

  await page.getByRole('button', { name: 'A random investigator' }).click()
  await expect(page.getByText('Investigator sheet')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'The other skills, at their base value' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Print the sheet' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit' }).click()
  await expect(page.getByRole('navigation', { name: 'Creation steps' })).toBeVisible()

  // Same page in the other language.
  await page.getByRole('link', { name: 'Français' }).click()
  await expect(page).toHaveURL(/\/outils\/creer-un-investigateur/)
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
})

test('blank sheet and scenarios: printable pages, linked from the tools hub', async ({ page }) => {
  await page.goto('/outils')
  await page.getByRole('link', { name: /Fiche d’investigateur vierge/ }).first().click()
  await expect(page).toHaveURL(/fiche-investigateur-vierge/)
  await expect(page.getByRole('heading', { name: 'Compétences' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Imprimer la fiche' })).toBeVisible()

  await page.getByRole('navigation', { name: 'Outils gratuits' }).first().getByRole('link', { name: 'Scénarios' }).click()
  await expect(page).toHaveURL(/\/scenarios$/)
  await page.getByRole('link', { name: /Lire le scénario/ }).first().click()
  await expect(page).toHaveURL(/\/scenarios\/[\w-]+$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('#secret')).toBeVisible()
  await expect(page.locator('[id^="scene-"]').first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Imprimer le scénario|Print the scenario/ })).toBeVisible()
})

test('landing page links to the free tools', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: /Lanceur de dés|Dice roller/ }).first().click()
  await expect(page).toHaveURL(/lanceur-de-des|dice-roller/)
})

test('item cards: search, open a card, download it as PNG, print a sheet; in English too', async ({ page }) => {
  await page.goto('/outils/cartes-objets')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cartes d’objets à imprimer')
  await page.getByRole('searchbox', { name: 'Chercher un objet' }).fill('grimper')
  await expect(page.getByText('2 cartes', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Corde de chanvre (15 m)' }).click()
  const view = page.getByRole('dialog', { name: 'Corde de chanvre (15 m)' })
  const download = page.waitForEvent('download')
  await view.getByRole('button', { name: 'Télécharger en PNG' }).click()
  expect((await download).suggestedFilename()).toBe('corde-de-chanvre-15-m.png')
  await page.keyboard.press('Escape')

  // Printing draws the sheet of the cards shown (fronts, then mirrored backs), then opens the print dialog.
  await page.evaluate(() => {
    ;(window as unknown as { printed: number }).printed = 0
    window.print = () => { (window as unknown as { printed: number }).printed++ }
  })
  await page.getByRole('button', { name: 'Imprimer les 2 cartes' }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1)
  await expect(page.locator('.isheet-page')).toHaveCount(2)
  await expect(page.locator('.isheet .icard')).toHaveCount(2)
  await expect(page.locator('.isheet .icard-back')).toHaveCount(2)

  await page.goto('/tools/item-cards')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Printable item cards')
  await expect(page.getByRole('button', { name: 'Crowbar' })).toBeVisible()
})
