import { createServer, type Server } from 'node:http'
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// The new app against the local Supabase stack (`supabase start`, plus
// `supabase functions serve --env-file supabase/tests/functions.env` for the import test).

const errors: string[] = []

test.beforeEach(({ page }) => {
  errors.length = 0
  page.on('pageerror', (e) => errors.push(e.message))
})

test.afterEach(() => {
  expect(errors, 'uncaught page errors').toEqual([])
})

async function signUp(page: Page, name = 'Keeper') {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await page.getByRole('tab', { name: 'Créer un compte' }).click()
  await page.getByLabel('Nom affiché').fill(name)
  await page.getByLabel('E-mail').fill(`e2e-${crypto.randomUUID()}@test.local`)
  await page.getByLabel('Mot de passe').fill('correct-horse-battery')
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  await expect(page.getByRole('heading', { name: `Bonsoir, ${name}` })).toBeVisible()
}

test('signed-out visitors are sent to the login page', async ({ page }) => {
  await page.goto('/characters')
  await expect(page).toHaveURL(/\/login$/)
})

test('login form validates input', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill('not-an-email')
  await page.getByLabel('Mot de passe').fill('short')
  await page.getByRole('button', { name: 'Se connecter' }).click()
  await expect(page.getByText('Adresse e-mail invalide')).toBeVisible()
  await expect(page.getByText('Au moins 8 caractères')).toBeVisible()
})

test('keeper creates an investigator, then plays a marketplace story', async ({ page }) => {
  await signUp(page)

  // Investigator, with HP/MP/SAN derived from characteristics
  await page.getByRole('link', { name: 'Investigateurs' }).first().click()
  await page.getByRole('button', { name: 'Nouvel investigateur' }).click()
  await page.getByLabel('Nom', { exact: true }).fill('Ada Lark')
  await page.getByLabel('Profession').fill('Librarian')
  await page.getByLabel('CON').fill('50')
  await page.getByLabel('SIZ').fill('60')
  await page.getByLabel('POW').fill('65')
  await page.getByLabel('Compétences').fill('Bibliothèque 70\nTrouver Objet Caché 50')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('link', { name: 'Ada Lark' })).toBeVisible()
  await expect(page.getByText('PV 11')).toBeVisible()
  await expect(page.getByText('SAN 65')).toBeVisible()

  // Marketplace story → start a game with that investigator
  await page.getByRole('link', { name: 'Bibliothèque' }).click()
  const card = page.getByRole('link', { name: 'The Silent Light' })
  await expect(card).toBeVisible()
  await card.click()
  await expect(page.getByRole('heading', { name: 'The Silent Light', level: 1 })).toBeVisible()
  await page.getByLabel(/Ada Lark/).check()
  await page.getByRole('button', { name: 'Lancer la partie' }).click()
  await expect(page).toHaveURL(/\/games\//)
  const firstScene = await page.getByRole('heading', { level: 1 }).textContent()

  // Moving to the next scene is saved to the account
  await page.getByRole('button', { name: 'Scène suivante' }).click()
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(firstScene ?? '')
  const second = await page.getByRole('heading', { level: 1 }).textContent()
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(second ?? '')

  // …and shows up as a game in progress on the home page
  await page.getByRole('link', { name: 'Grimoire' }).click()
  await expect(page.getByRole('heading', { name: 'Parties en cours' })).toBeVisible()
})

test('keeper copies a marketplace story into their own stories', async ({ page }) => {
  await signUp(page)
  await page.goto('/marketplace')
  await page.getByRole('link', { name: 'The Silent Light' }).click()
  await page.getByRole('button', { name: 'Copier dans mes histoires' }).click()
  await expect(page.getByText('Mon histoire')).toBeVisible()
  await page.getByRole('link', { name: 'Mes histoires' }).click()
  await expect(page.getByRole('link', { name: 'The Silent Light' })).toBeVisible()
})

test.describe('import', () => {
  let mock: Server
  const draft = readFileSync('supabase/tests/fixtures/draft-batch.json', 'utf8')

  // Fake Claude API, reached by the Edge Function through ANTHROPIC_BASE_URL (supabase/tests/functions.env).
  test.beforeAll(async () => {
    const events = (text: string) =>
      [
        ['message_start', { type: 'message_start', message: { id: 'm', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } }],
        ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
        ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }],
        ['content_block_stop', { type: 'content_block_stop', index: 0 }],
        ['message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } }],
        ['message_stop', { type: 'message_stop' }],
      ]
        .map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`)
        .join('')
    mock = createServer((req, res) => {
      req.resume()
      req.on('end', () => {
        res.writeHead(200, { 'content-type': 'text/event-stream' })
        res.end(events(draft))
      })
    })
    await new Promise<void>((r) => mock.listen(4010, '0.0.0.0', r))
  })

  test.afterAll(() => new Promise<void>((r) => mock.close(() => r())))

  test('keeper imports page images into a private story', async ({ page }) => {
    await signUp(page)
    await page.getByRole('link', { name: 'Importer' }).first().click()
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    await page.getByTestId('page-input').setInputFiles([1, 2, 3].map((n) => ({ name: `page-${n}.png`, mimeType: 'image/png', buffer: png })))
    await expect(page.getByAltText('Page 3')).toBeVisible()
    await page.getByLabel('Titre').fill('Clockwork')
    await page.getByRole('tab', { name: 'English' }).click()
    await page.getByRole('button', { name: 'Importer 3 pages' }).click()

    await expect(page.getByText('Import terminé')).toBeVisible({ timeout: 60_000 })
    await page.getByRole('link', { name: "Ouvrir l'histoire" }).click()
    await expect(page.getByRole('heading', { name: 'Clockwork', level: 1 })).toBeVisible()
    await expect(page.getByText('Mon histoire')).toBeVisible()
    await expect(page.getByText('Front room')).toBeVisible()

    await page.getByRole('link', { name: 'Mes histoires' }).click()
    await expect(page.getByRole('link', { name: 'Clockwork' })).toBeVisible()
    await expect(page.getByText('Import privé')).toBeVisible()
  })
})
