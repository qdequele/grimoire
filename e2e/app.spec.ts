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
  await expect(page.getByText(`Bonsoir, ${name}`)).toBeVisible()
}

/** Walks the 7-step creation wizard (the legacy app's rules) for a journalist. */
async function createJournalist(page: Page, name: string) {
  const next = (label: string) => page.getByRole('button', { name: new RegExp(label, 'i') }).last().click()

  // 1. Concept (Journaliste is the default occupation)
  await expect(page.getByRole('heading', { name: 'Créer un investigateur' })).toBeVisible()
  await page.getByLabel('Nom', { exact: true }).fill(name)
  await page.getByLabel('Joueur').fill('Camille')
  await next('Caractéristiques')

  // 2. Characteristics: place the fixed values, roll luck
  const values: Record<string, string> = {
    Force: '50', Constitution: '60', Taille: '70', Dextérité: '50', Apparence: '40', Intelligence: '80', Pouvoir: '60', Éducation: '50',
  }
  for (const [label, v] of Object.entries(values)) await page.getByLabel(label, { exact: true }).selectOption(v)
  await expect(page.getByText('toutes placées ✓')).toBeVisible()
  await page.getByRole('button', { name: /Lancer/i }).click()
  await next('Valeurs dérivées')

  // 3. Derived values
  await expect(page.getByText('Points de vie')).toBeVisible()
  await next("Compétences d'occupation")

  // 4. Occupation: 5 imposed skills + a social skill + 2 free, then place 70/60/60/50/50/50/40/40/40
  const add = page.getByLabel('Compétence à ajouter')
  for (const skill of ['Charme', 'Écouter', 'Trouver Objet Caché']) await add.selectOption({ label: skill })
  await expect(page.getByText('8 / 8 compétences')).toBeVisible()
  for (const v of ['70', '60', '60', '50', '50', '50', '40', '40', '40']) {
    const empty = page.locator('select[aria-label^="Valeur"]').filter({ has: page.locator('option[value=""]:checked') }).first()
    await empty.selectOption(v)
  }
  await next('Intérêts personnels')

  // 5. Personal interests: 4 skills at +20
  for (const skill of ['Grimper', 'Nager', 'Sauter', 'Occultisme']) {
    await page.getByRole('checkbox', { name: `Intérêt personnel : ${skill}` }).check()
  }
  await expect(page.getByText('4 / 4')).toBeVisible()
  await next('Profil')

  // 6. Profile
  await page.getByLabel('Trait', { exact: true }).fill('Curieuse, têtue')
  await next('Récapitulatif')

  // 7. Summary and save
  await expect(page.getByText('Tout est prêt')).toBeVisible()
  await page.getByRole('button', { name: 'Enregistrer le personnage' }).click()
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

  await page.getByRole('link', { name: /^Investigateurs/ }).click()
  await page.getByRole('button', { name: 'Nouvel investigateur' }).click()
  await createJournalist(page, 'Ada Lark')
  await expect(page.getByRole('link', { name: 'Ada Lark' })).toBeVisible()
  await expect(page.getByText('PV 13')).toBeVisible() // (CON 60 + SIZ 70) / 10
  await expect(page.getByText('SAN 60')).toBeVisible() // = POW

  // Marketplace story → start a game with that investigator
  await page.getByRole('link', { name: 'Bibliothèque' }).click()
  const card = page.getByRole('link', { name: 'The Silent Light' })
  await expect(card).toBeVisible()
  await card.click()
  await expect(page.getByRole('heading', { name: 'The Silent Light', level: 1 })).toBeVisible()
  await page.getByLabel(/Ada Lark/).check()
  await page.getByRole('button', { name: 'Lancer la partie' }).click()
  await expect(page).toHaveURL(/\/games\//)
  // The original game engine, full screen, on this story
  await expect(page.frameLocator('iframe[title="Partie"]').locator('#scene h2')).toBeVisible()

  // …and the game shows up as in progress on the home page
  await page.goto('/')
  await expect(page.getByRole('link', { name: /Reprendre la partie/ })).toBeVisible()
})

test('creation draft survives a reload, and editing reopens the wizard', async ({ page }) => {
  await signUp(page)
  await page.goto('/characters/new')
  await page.getByLabel('Nom', { exact: true }).fill('Brouillon Test')
  await page.getByLabel('Occupation').selectOption({ label: 'Médecin' })
  await page.reload()
  await expect(page.getByLabel('Nom', { exact: true })).toHaveValue('Brouillon Test')
  await expect(page.getByLabel('Occupation')).toHaveValue('doctor')

  // Saving is blocked until everything is filled in
  await page.getByRole('navigation', { name: 'Étapes de création' }).getByRole('button', { name: /Récapitulatif/ }).click()
  await expect(page.getByText(/À compléter avant d'enregistrer/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Enregistrer le personnage' })).toBeDisabled()
  // …and says where to go: the step list marks Concept done (a name is set), Caractéristiques to do
  const steps = page.getByRole('navigation', { name: 'Étapes de création' })
  await expect(steps.getByRole('button', { name: /Concept/ }).getByLabel('complet')).toBeVisible()
  await expect(steps.getByRole('button', { name: /Caractéristiques/ }).getByLabel('à compléter')).toBeVisible()
  await page.getByRole('button', { name: 'Chance manquante → Caractéristiques' }).click()
  await expect(page.getByRole('heading', { name: 'Caractéristiques', level: 1 })).toBeVisible()

  await page.getByRole('navigation', { name: 'Étapes de création' }).getByRole('button', { name: /Concept/ }).click()
  await page.getByLabel('Occupation').selectOption({ label: 'Journaliste' })
  await createJournalist(page, 'Edith Vale')
  await page.getByRole('link', { name: 'Edith Vale' }).click()
  await expect(page.getByRole('heading', { name: 'Modifier un investigateur' })).toBeVisible()
  await expect(page.getByLabel('Nom', { exact: true })).toHaveValue('Edith Vale')
  await expect(page.getByLabel('Joueur')).toHaveValue('Camille')
})

test('game screen: the original engine runs a story, rolls, saves to the account and returns to the menu', async ({ page }) => {
  await signUp(page)
  await page.goto('/characters/new')
  await createJournalist(page, 'Vera Holt')
  await page.goto('/marketplace')
  await page.getByRole('link', { name: 'The Silent Light' }).click()
  await page.getByLabel(/Vera Holt/).check()
  await page.getByRole('button', { name: 'Lancer la partie' }).click()
  await expect(page).toHaveURL(/\/games\//)
  const gameId = page.url().split('/games/')[1]

  const game = page.frameLocator('iframe[title="Partie"]')
  await expect(game.locator('#scene h2')).toHaveText('The harbour')
  // The investigator from the account, with the player name from the wizard
  await expect(game.locator('#invView .nm')).toHaveText('Vera Holt')
  await expect(game.locator('#invView .player')).toHaveText('Camille')

  // A roll line of the story becomes buttons; rolling logs the result in the journal
  await game.locator('#scene .chip[data-kind="test"]').first().click()
  await expect(game.locator('#pick')).toBeVisible()
  await game.locator('#pkGo').click()
  await expect(game.locator('#pick .pres li').first()).toBeVisible()
  await game.locator('#pkClose').click()
  await expect(game.locator('#jList li').first()).toBeVisible()

  // Next scene, then reload without the browser copy: the account copy brings it back
  const gameSaved = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().includes('/rest/v1/games'))
  await game.locator('#scene .scene-foot .btn.prim[data-go]').click()
  await expect(game.locator('#scene h2')).not.toHaveText('The harbour')
  const second = (await game.locator('#scene h2').textContent()) ?? ''
  await gameSaved // the delayed save reached the account
  await page.evaluate((id) => localStorage.removeItem(`grimoire-game-${id}`), gameId)
  await page.reload()
  await expect(page.frameLocator('iframe[title="Partie"]').locator('#scene h2')).toHaveText(second)

  // Progression is the investigator's: written in this game…
  const frame = () => page.frames().find((f) => f.url().includes('play.html'))!
  const progressSaved = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().includes('/rest/v1/characters'))
  await frame().evaluate(() => {
    const g = eval as (s: string) => unknown
    const S = g('S') as { chars: Array<{ id: string }> }
    const P_ = g('P_') as (id: string) => { hist: Array<{ at: number; txt: string }> }
    P_(S.chars[0].id).hist.unshift({ at: Date.now(), txt: 'Survived the lighthouse' })
    ;(g('save') as () => void)()
  })
  await progressSaved

  // The game menu's quit goes back to the app, where the game can be resumed
  const again = page.frameLocator('iframe[title="Partie"]')
  await again.locator('#menuBtn').click()
  await again.locator('#gmQuit').click()
  await expect(page.getByRole('link', { name: /Reprendre la partie/ })).toBeVisible()

  // …and found again when the same investigator starts another game.
  await page.goto('/marketplace')
  await page.getByRole('link', { name: 'The Silent Light' }).click()
  await page.getByLabel(/Vera Holt/).check()
  await page.getByRole('button', { name: 'Lancer la partie' }).click()
  await expect(page.frameLocator('iframe[title="Partie"]').locator('#scene h2')).toHaveText('The harbour')
  const history = await frame().evaluate(() => {
    const g = eval as (s: string) => unknown
    const S = g('S') as { chars: Array<{ id: string }> }
    return (g('P_') as (id: string) => { hist: Array<{ txt: string }> })(S.chars[0].id).hist.map((h) => h.txt)
  })
  expect(history).toContain('Survived the lighthouse')
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

test.describe('AI features (fake Claude API)', () => {
  // One fake server on port 4010 for every test in here, so they must not run in parallel.
  test.describe.configure({ mode: 'serial' })
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
    const profile = {
      description: 'Grande, imperméable usé', ideology: 'La vérité finit par sortir',
      significantPeople: 'Son frère, Tom', meaningfulLocations: 'La salle de rédaction du Globe',
      treasuredPossessions: 'Un Kodak Brownie', traits: 'Têtue, curieuse',
    }
    mock = createServer((req, res) => {
      let raw = ''
      req.on('data', (c) => (raw += c))
      req.on('end', () => {
        // The import streams a structured draft; the narrator streams free text; profile
        // suggestions are a plain JSON message.
        const body = JSON.parse(raw || '{}')
        if (body.stream) {
          res.writeHead(200, { 'content-type': 'text/event-stream' })
          res.end(events(body.output_config?.format ? draft : 'Les vagues battent la jetée.'))
        } else {
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify({
            id: 'm', type: 'message', role: 'assistant', model: 'claude-opus-5-5',
            content: [{ type: 'text', text: JSON.stringify(profile) }],
            stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
          }))
        }
      })
    })
    await new Promise<void>((r) => mock.listen(4010, '0.0.0.0', r))
  })

  test.afterAll(() => new Promise<void>((r) => mock.close(() => r())))

  test('AI suggests the profile, keeping what the keeper wrote', async ({ page }) => {
    await signUp(page)
    await page.goto('/characters/new?etape=6')
    await page.getByLabel('Idéologie', { exact: true }).fill('Rien ne vaut un bon scoop')
    await page.getByRole('button', { name: 'Compléter les 5 champs vides' }).click()
    await expect(page.getByLabel('Personne importante', { exact: true })).toHaveValue('Son frère, Tom')
    await expect(page.getByLabel('Idéologie', { exact: true })).toHaveValue('Rien ne vaut un bon scoop')
    await expect(page.getByLabel('Trait', { exact: true })).toHaveValue('Têtue, curieuse')

    // ↻ on one field replaces just that field
    await page.getByLabel('Idéologie', { exact: true }).fill('')
    await page.getByRole('button', { name: 'Autre idée pour Idéologie' }).click()
    await expect(page.getByLabel('Idéologie', { exact: true })).toHaveValue('La vérité finit par sortir')
  })

  test('the narrator answers inside the game, through Claude', async ({ page }) => {
    await signUp(page)
    await page.goto('/characters/new')
    await createJournalist(page, 'Nora Quill')
    await page.goto('/marketplace')
    await page.getByRole('link', { name: 'The Silent Light' }).click()
    await page.getByLabel(/Nora Quill/).check()
    await page.getByRole('button', { name: 'Lancer la partie' }).click()
    const game = page.frameLocator('iframe[title="Partie"]')
    await expect(game.locator('#scene h2')).toHaveText('The harbour')
    await game.locator('#ninput').fill('Décris le port pour les joueurs.')
    await game.locator('#ninput').press('Enter')
    await expect(game.locator('#nlog .na').last()).toHaveText('Les vagues battent la jetée.')
  })

  test('keeper imports page images into a private story', async ({ page }) => {
    await signUp(page)
    await page.getByRole('link', { name: /^Importer une histoire/ }).click()
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
