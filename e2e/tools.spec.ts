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

test('map maker: rooms, a door, a bed, a secret room, the players’ copy', async ({ page }) => {
  await page.goto('/outils/generateur-de-plans')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Générateur de plans pour le jeu de rôle')
  const drawing = page.getByTestId('map-drawing')
  await expect(drawing.locator('svg')).toBeVisible()

  await page.getByRole('button', { name: 'Page blanche' }).click()
  await page.getByLabel('Titre', { exact: true }).fill('Test map')
  const canvas = page.getByTestId('map-canvas')
  /** The middle of a square, in page pixels. */
  const cell = async (x: number, y: number) =>
    canvas.evaluate((el, [cx, cy]) => {
      // Centred, so the sticky header doesn't cover the top rows.
      el.scrollIntoView({ block: 'center' })
      const svg = el as SVGSVGElement
      const vb = svg.viewBox.baseVal
      const rect = svg.getBoundingClientRect()
      const scale = rect.width / vb.width
      // The grid starts at (44, 96) in the drawing when the map has a title (render.ts, mapLayout).
      return { x: rect.left + (44 + (cx + 0.5) * 40) * scale, y: rect.top + (96 + (cy + 0.5) * 40) * scale }
    }, [x, y])
  const drag = async (a: [number, number], b: [number, number]) => {
    const p = await cell(...a)
    const q = await cell(...b)
    await page.mouse.move(p.x, p.y)
    await page.mouse.down()
    await page.mouse.move(q.x, q.y, { steps: 8 })
    await page.mouse.up()
  }
  const click = async (x: number, y: number) => {
    const p = await cell(x, y)
    await page.mouse.click(p.x, p.y)
  }

  await page.getByRole('button', { name: 'Pièce', exact: true }).click()
  await drag([1, 1], [6, 5])
  await drag([6, 1], [11, 5])
  await page.getByRole('group', { name: 'Sol' }).getByRole('button', { name: 'Porte', exact: true }).click()
  await click(6, 3)
  await page.getByRole('group', { name: 'Objets' }).getByRole('button', { name: 'Lit', exact: true }).click()
  await click(3, 3)
  await page.getByRole('button', { name: 'Secret', exact: true }).click()
  await drag([7, 2], [10, 4])

  // Keeper's copy: the bed, and the secret squares in red.
  await expect(drawing.locator('use[href="#st-bed"]')).toHaveCount(1)
  await expect(drawing.locator('[stroke="#9a3020"]')).toHaveCount(1)
  // Undo and redo the secret.
  await page.getByRole('button', { name: 'Annuler', exact: true }).click()
  await expect(drawing.locator('[stroke="#9a3020"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Rétablir', exact: true }).click()
  await expect(drawing.locator('[stroke="#9a3020"]')).toHaveCount(1)

  // Players' copy: nothing red.
  await page.getByRole('button', { name: 'Joueurs', exact: true }).click()
  await expect(drawing.locator('[stroke="#9a3020"], [fill="#9a3020"]')).toHaveCount(0)
  await expect(drawing.locator('use[href="#st-bed"]')).toHaveCount(1)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Dessin (SVG)' }).click()
  expect((await download).suggestedFilename()).toBe('test-map-joueurs.svg')

  // The draft is kept.
  await page.reload()
  await expect(page.getByLabel('Titre', { exact: true })).toHaveValue('Test map')
  await expect(drawing.locator('use[href="#st-bed"]')).toHaveCount(1)

  // The same page in English, linked from the hub.
  await page.goto('/tools')
  await page.getByRole('link', { name: /Map maker/ }).first().click()
  await expect(page).toHaveURL(/\/tools\/map-maker$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A map maker for roleplaying games')
})
