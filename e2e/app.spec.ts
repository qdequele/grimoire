import { createServer, type Server } from 'node:http'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { expect, test } from '@playwright/test'
import { createJournalist, signUp } from './helpers.ts'

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
  test.setTimeout(90_000) // long flow: wizard, then game(s)
  await signUp(page)

  await page.getByRole('link', { name: /^Investigateurs/ }).click()
  await page.getByRole('button', { name: 'Nouvel investigateur' }).click()
  await createJournalist(page, 'Ada Lark')
  await expect(page.getByRole('link', { name: 'Ada Lark' })).toBeVisible()
  await expect(page.getByText('PV 13')).toBeVisible() // (CON 60 + SIZ 70) / 10
  await expect(page.getByText('SAN 60')).toBeVisible() // = POW

  // Marketplace story → start a game with that investigator
  await page.getByRole('link', { name: 'Histoires', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Bibliothèque' })).toHaveAttribute('aria-current', 'page')
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
  test.setTimeout(90_000) // long flow: wizard, then game(s)
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
  await expect(page.getByRole('combobox', { name: 'Joueur' }).locator('option:checked')).toHaveText('Camille')
})

test('game screen: the original engine runs a story, rolls, saves to the account and returns to the menu', async ({ page }) => {
  test.setTimeout(90_000) // long flow: wizard, then game(s)
  await signUp(page)
  await page.goto('/characters/new')
  await createJournalist(page, 'Vera Holt')
  await page.goto('/stories')
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

  // The narrator is a floating window from the toolbar, like the dice and the sounds
  const narrator = game.locator('#narrPanel')
  await expect(narrator).toBeHidden()
  await game.locator('#qaNarr').click()
  await expect(narrator).toBeVisible()
  await expect(game.locator('#qaNarr')).toHaveAttribute('aria-pressed', 'true')
  await game.locator('#narrClose').click()
  await expect(narrator).toBeHidden()
  await game.locator('#scene').press('a') // keyboard shortcut
  await expect(narrator).toBeVisible()
  await game.locator('body').press('Escape')
  await expect(narrator).toBeHidden()

  // Investigators fold like the journal and the notes
  await game.locator('[data-ptog="investigateurs"]').click()
  await expect(game.locator('#invView')).toBeHidden()
  await game.locator('[data-ptog="investigateurs"]').click()
  await expect(game.locator('#invView .nm')).toHaveText('Vera Holt')

  // Phones update points and notebooks while the keeper types: focus, caret and text stay; notes are text
  await game.locator('#invView .tog').first().click()
  const note = game.locator('#invView textarea').first()
  await note.click()
  await note.pressSequentially('hello')
  const live = page.frames().find((f) => f.url().includes('play.html'))!
  await live.evaluate(() => {
    const g = eval as (s: string) => unknown
    const S = g('S') as { chars: Array<{ id: string }> }
    const api = (window as unknown as { GRIMOIRE_ENGINE: { setPoints: (c: string, v: object) => void; setNotebooks: (n: object) => void } }).GRIMOIRE_ENGINE
    const cid = S.chars[0].id
    api.setPoints(cid, { pv: 3, san: 20, chance: 30, pm: 4 })
    api.setNotebooks({ [cid]: [{ id: 'n1', body: '<img src=x onerror=window.__xss=1>', createdAt: new Date().toISOString() }] })
  })
  await expect(note).toBeFocused()
  await expect(note).toHaveValue('hello')
  await expect(game.locator('#invView .stat .v').first()).toContainText('3')
  await expect(game.locator('#invView .carnet')).toContainText('<img src=x onerror=window.__xss=1>')
  await expect(game.locator('#invView .carnet img')).toHaveCount(0)
  expect(await live.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()

  // An investigator whose values hold markup (as a hostile phone sheet would, past the database's
  // checks and toLegacyCharacter): the engine's own renders escape them.
  const bad = '<img src=x onerror=window.__xss=2>'
  const leaked = await live.evaluate((bad) => {
    const g = eval as (s: string) => unknown
    const api = (window as unknown as { GRIMOIRE_ENGINE: { addMember: (c: object, player: string) => void } }).GRIMOIRE_ENGINE
    const c = { id: 'hostile', custom: true, n: 'Hostile', job: 'x', pv: 10, san: 50, chance: 50, pm: 10, dex: bad, imp: bad,
      car: { FOR: bad, CON: bad, TAI: bad, DEX: bad, APP: bad, INT: bad, POU: bad, ÉDU: bad }, sk: '', bg: {} }
    api.addMember(c, '')
    // The investigator's sheet (home list and card), rendered off-screen: an <img> would load and fire.
    const box = document.createElement('div')
    box.innerHTML = (g('charCard') as (c: object) => string)(c)
    ;(g('renderHome') as () => void)()
    return box.querySelectorAll('img').length + document.querySelectorAll('img[src="x"]').length
  }, bad)
  expect(leaked).toBe(0)
  const hostileCard = game.locator('#invView .inv').filter({ hasText: 'Hostile' })
  await hostileCard.locator('.tog').click()
  await expect(hostileCard.locator('.job')).toContainText(bad)
  await expect(game.locator('img[src="x"]')).toHaveCount(0)
  await page.waitForTimeout(200) // an onerror handler would have run by now
  expect(await live.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()

  // Next scene, then reload without the browser copy: the account copy brings it back
  const gameSaved = page.waitForResponse((r) => r.url().includes('/rest/v1/rpc/save_game_state') && r.ok())
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
  await page.goto('/stories')
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

test('story packs: import a .zip with its files, download it back, re-import updates, folders of packs', async ({ page }, testInfo) => {
  const story = JSON.parse(readFileSync('stories/the-silent-light/story.json', 'utf8'))
  story.meta.id = 'lighthouse-pack'
  story.meta.title = 'Lighthouse Pack'
  const map = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3])
  const zip = Buffer.from(zipSync({ 'lighthouse/story.json': strToU8(JSON.stringify(story)), 'lighthouse/images/map.png': map }))

  await signUp(page)
  await page.goto('/stories/import')
  await page.getByTestId('pack-zip-input').setInputFiles({ name: 'lighthouse.zip', mimeType: 'application/zip', buffer: zip })
  const list = page.getByRole('list', { name: 'Packs à importer' })
  await expect(list.getByText('Lighthouse Pack')).toBeVisible()
  await expect(list.getByText('6 scènes')).toBeVisible()
  await expect(list.getByText('1 fichier')).toBeVisible()
  await page.getByRole('button', { name: 'Importer 1 histoire' }).click()
  await expect(list.getByText('Importée')).toBeVisible()

  // The story, with its pack in Storage
  await list.getByRole('link', { name: 'Ouvrir' }).click()
  await expect(page.getByRole('heading', { name: 'Lighthouse Pack', level: 1 })).toBeVisible()
  await expect(page.getByText('Pack : story.json + 1 fichier')).toBeVisible()

  // Download gives back the same files
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Télécharger le pack (.zip)' }).click()])
  expect(download.suggestedFilename()).toBe('lighthouse-pack.zip')
  const back = unzipSync(new Uint8Array(readFileSync(await download.path())))
  expect(JSON.parse(strFromU8(back['story.json'])).meta.title).toBe('Lighthouse Pack')
  expect([...back['images/map.png']]).toEqual([...map])

  // Same pack again: updates the story instead of duplicating it
  await page.goto('/stories/import')
  await page.getByTestId('pack-zip-input').setInputFiles({ name: 'lighthouse.zip', mimeType: 'application/zip', buffer: zip })
  await expect(list.getByText('remplacera l’histoire existante')).toBeVisible()
  await page.getByRole('button', { name: 'Importer 1 histoire' }).click()
  await expect(list.getByText('Mise à jour')).toBeVisible()
  await page.goto('/stories/mine')
  await expect(page.getByRole('link', { name: 'Lighthouse Pack' })).toHaveCount(1)

  // A folder holding several pack folders imports them all
  const dir = testInfo.outputPath('scans')
  for (const [id, title] of [['pack-one', 'Pack One'], ['pack-two', 'Pack Two']]) {
    mkdirSync(`${dir}/${id}/images`, { recursive: true })
    writeFileSync(`${dir}/${id}/story.json`, JSON.stringify({ ...story, meta: { ...story.meta, id, title } }))
    writeFileSync(`${dir}/${id}/images/cover.png`, map)
  }
  await page.goto('/stories/import')
  await page.getByTestId('pack-dir-input').setInputFiles(dir)
  await expect(list.getByText('Pack One')).toBeVisible()
  await expect(list.getByText('Pack Two')).toBeVisible()
  await page.getByRole('button', { name: 'Importer 2 histoires' }).click()
  await expect(list.getByText('Importée')).toHaveCount(2)
})

test('keeper copies a marketplace story into their own stories', async ({ page }) => {
  await signUp(page)
  await page.goto('/stories')
  await page.getByRole('link', { name: 'The Silent Light' }).click()
  await page.getByRole('button', { name: 'Copier dans mes histoires' }).click()
  await expect(page.getByText('Mon histoire')).toBeVisible()
  await page.getByRole('link', { name: 'Histoires', exact: true }).click()
  await page.getByRole('link', { name: 'Mes histoires' }).click()
  await expect(page.getByRole('link', { name: 'The Silent Light' })).toBeVisible()
})

test('main menu: stories, investigators with their players, settings', async ({ page }) => {
  test.setTimeout(90_000) // includes the creation wizard
  await signUp(page)
  const menu = page.getByRole('list').first()
  await expect(menu.getByRole('link')).toHaveText([/^Nouvelle partie/, /^Histoires/, /^Investigateurs/, /^Réglages/])

  // Histoires: library, my stories, import
  await menu.getByRole('link', { name: /^Histoires/ }).click()
  const storyTabs = page.getByRole('navigation', { name: 'Histoires' })
  await expect(storyTabs.getByRole('link')).toHaveText(['Bibliothèque', 'Mes histoires', 'Importer'])
  await expect(storyTabs.getByRole('link', { name: 'Mes histoires' })).toHaveAttribute('aria-current', 'page')
  await storyTabs.getByRole('link', { name: 'Importer' }).click()
  await expect(page.getByRole('tab', { name: 'Packs Grimoire' })).toBeVisible()

  // Investigateurs → Joueurs: add a player, create their investigator from their card
  await page.getByRole('link', { name: 'Investigateurs', exact: true }).first().click()
  await page.getByRole('navigation', { name: 'Investigateurs' }).getByRole('link', { name: 'Joueurs' }).click()
  await expect(page.getByText('Aucun joueur')).toBeVisible()
  await page.getByRole('textbox', { name: 'Prénom' }).fill('Jo')
  await page.getByRole('button', { name: 'Ajouter un joueur' }).click()
  const jo = page.getByRole('article', { name: 'Jo' })
  await expect(jo.getByText('0 personnage')).toBeVisible()
  await page.getByRole('textbox', { name: 'Prénom' }).fill(' jo ')
  await page.getByRole('button', { name: 'Ajouter un joueur' }).click()
  await expect(page.getByText('Tu as déjà un joueur avec ce prénom.')).toBeVisible()

  await jo.getByRole('button', { name: 'Créer un personnage' }).click()
  await expect(page.getByRole('combobox', { name: 'Joueur' }).locator('option:checked')).toHaveText('Jo')
  await createJournalist(page, 'Nell Price', null)
  await expect(page).toHaveURL(/\/characters\/joueurs$/)
  await expect(jo.getByText('1 personnage')).toBeVisible()
  await jo.getByRole('button', { name: /Nell Price/ }).click()
  await expect(jo.getByText('Pas encore joué.')).toBeVisible()

  // Rename; remove → the investigator stays, without player
  await jo.getByRole('button', { name: 'Renommer' }).click()
  await jo.getByRole('textbox', { name: 'Prénom' }).fill('Joanna')
  await jo.getByRole('button', { name: 'Renommer' }).click()
  const joanna = page.getByRole('article', { name: 'Joanna' })
  await expect(joanna).toBeVisible()
  await page.getByRole('navigation', { name: 'Investigateurs' }).getByRole('link', { name: 'Investigateurs' }).click()
  await expect(page.getByText('joué par Joanna')).toBeVisible()
  await page.getByRole('navigation', { name: 'Investigateurs' }).getByRole('link', { name: 'Joueurs' }).click()
  await joanna.getByRole('button', { name: 'Retirer' }).click()
  await joanna.getByRole('button', { name: 'Oui' }).click()
  await expect(page.getByRole('heading', { name: 'Sans joueur' })).toBeVisible()

  // Réglages: theme and language, remembered
  await page.getByRole('link', { name: 'Réglages' }).click()
  await page.getByRole('tab', { name: 'Classique' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'classic')
  await page.getByRole('tab', { name: 'English' }).click()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'classic')
  await expect(page.getByRole('tab', { name: 'English' })).toHaveAttribute('aria-selected', 'true')
  expect(await page.evaluate(() => localStorage.getItem('gardien-lang'))).toBe('en')
})

test('the whole app follows the language chosen in settings', async ({ page }) => {
  await signUp(page)
  await page.getByRole('link', { name: /^Réglages/ }).click()
  await page.getByRole('tab', { name: 'English' }).click()
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')

  await page.getByRole('link', { name: 'Grimoire' }).click()
  await expect(page.getByText('Good evening, Keeper')).toBeVisible()
  const menu = page.getByRole('list').first()
  await expect(menu.getByRole('link')).toHaveText([/^New game/, /^Stories/, /^Investigators/, /^Settings/])

  await menu.getByRole('link', { name: /^Stories/ }).click()
  await expect(page.getByRole('navigation', { name: 'Stories' }).getByRole('link')).toHaveText(['Library', 'My stories', 'Import'])
  await page.getByRole('link', { name: 'Library' }).click()
  await page.getByRole('link', { name: 'The Silent Light' }).click()
  await expect(page.getByRole('button', { name: 'Start the game' })).toBeVisible()

  // Creation wizard: rules texts and skill names in English too
  await page.goto('/characters/new')
  await expect(page.getByRole('heading', { name: 'Create an investigator' })).toBeVisible()
  await expect(page.getByLabel('Occupation')).toContainText('Private eye')
  await page.getByRole('navigation', { name: 'Creation steps' }).getByRole('button', { name: /Occupation skills/ }).click()
  await expect(page.getByLabel('Skill to add')).toContainText('Spot Hidden')

  await page.goto('/characters/joueurs')
  await expect(page.getByRole('button', { name: 'Add a player' })).toBeVisible()

  // Back to French
  await page.goto('/settings')
  await page.getByRole('tab', { name: 'Français' }).click()
  await expect(page.getByRole('heading', { name: 'Réglages', level: 1 })).toBeVisible()
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
    test.setTimeout(90_000) // long flow: wizard, then game(s)
    await signUp(page)
    await page.goto('/characters/new')
    await createJournalist(page, 'Nora Quill')
    await page.goto('/stories')
    await page.getByRole('link', { name: 'The Silent Light' }).click()
    await page.getByLabel(/Nora Quill/).check()
    await page.getByRole('button', { name: 'Lancer la partie' }).click()
    const game = page.frameLocator('iframe[title="Partie"]')
    await expect(game.locator('#scene h2')).toHaveText('The harbour')
    await game.locator('#qaNarr').click()
    await game.locator('#ninput').fill('Décris le port pour les joueurs.')
    await game.locator('#ninput').press('Enter')
    await expect(game.locator('#nlog .na').last()).toHaveText('Les vagues battent la jetée.')
  })

  test('keeper imports page images into a private story', async ({ page }) => {
    await signUp(page)
    await page.getByRole('link', { name: /^Histoires/ }).click()
    await page.getByRole('link', { name: 'Importer', exact: true }).click()
    await page.getByRole('tab', { name: 'Pages scannées (IA)' }).click()
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

    await page.getByRole('link', { name: 'Histoires', exact: true }).click()
    await page.getByRole('link', { name: 'Mes histoires' }).click()
    await expect(page.getByRole('link', { name: 'Clockwork' })).toBeVisible()
    await expect(page.getByText('Import privé')).toBeVisible()
  })
})
