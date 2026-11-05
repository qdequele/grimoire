import { expect, test, type Browser, type BrowserContext, type FrameLocator, type Page } from '@playwright/test'
import { createJournalist, signUp } from './helpers.ts'

// Player companion: the keeper (desktop, signed in) and a player's phone (390×844, no account),
// as two browser contexts against the local Supabase stack. Live changes must show within 5 s.

const LIVE = { timeout: 5_000 }
const PHONE = { width: 390, height: 844 }

test.describe.configure({ timeout: 120_000 }) // each test walks the creation wizard, then plays

const errors: string[] = []
const watch = (page: Page) => page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`))

test.beforeEach(() => {
  errors.length = 0
})
test.afterEach(() => {
  expect(errors, 'uncaught page errors').toEqual([])
})

interface Table {
  keeperContext: BrowserContext
  keeper: Page
  game: FrameLocator
  gameId: string
  /** The table link's URL, as the keeper's dialog shows it. */
  tableUrl: string
  phone: Page
}

const engine = (page: Page) => page.frameLocator('iframe[title="Partie"]')
/** An investigator's card on the game screen. */
const card = (game: FrameLocator, name: string) => game.locator('#invView .inv').filter({ has: game.locator('.nm', { hasText: name }) })
/** One of HP / SAN / Luck / MP on a card ('pv', 'san', 'chance', 'pm'). */
const engineStat = (game: FrameLocator, name: string, key: string) =>
  card(game, name).locator(`.stat:has(button[data-k="${key}"]) .v`)
/** Unfolds an investigator's card (stats, notebook). */
async function unfold(game: FrameLocator, name: string) {
  const toggle = card(game, name).locator('button.tog')
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click()
  await expect(card(game, name).locator('.ibody')).toBeVisible()
}
const phoneStat = (phone: Page, label: string) => phone.locator(`output[aria-label="${label}"]`)
const tableDialog = (keeper: Page) => keeper.getByRole('dialog', { name: 'Liens des joueurs' })

async function openPhone(browser: Browser, baseURL: string | undefined): Promise<Page> {
  const phone = await (await browser.newContext({ viewport: PHONE, baseURL })).newPage()
  watch(phone)
  return phone
}

/** Opens a game of the keeper on the game screen, waiting for the engine. */
async function openGame(keeper: Page, gameId: string): Promise<FrameLocator> {
  await keeper.goto(`/games/${gameId}`)
  const game = engine(keeper)
  await expect(game.locator('#scene h2')).toBeVisible()
  return game
}

/**
 * A keeper with one investigator ("Alpha", HP 13, SAN 60) in a game of the first library story, the
 * table link created from the game screen's "Joueurs à la table" dialog, and a phone (not opened yet).
 */
async function setUpTable(browser: Browser, baseURL: string | undefined): Promise<Table> {
  const keeperContext = await browser.newContext({ baseURL })
  const keeper = await keeperContext.newPage()
  watch(keeper)
  await signUp(keeper)
  await keeper.goto('/characters/new')
  await createJournalist(keeper, 'Alpha')

  await keeper.goto('/stories')
  await keeper.locator('[data-slot="card"] a[href^="/stories/"]').first().click()
  await keeper.getByLabel(/Alpha/).check()
  await keeper.getByRole('button', { name: 'Lancer la partie' }).click()
  await expect(keeper).toHaveURL(/\/games\//)
  const gameId = keeper.url().split('/games/')[1]
  const game = engine(keeper)
  await expect(card(game, 'Alpha')).toBeVisible()

  // The engine's toolbar opens the app's dialog above the iframe
  await game.locator('#qaTable').click()
  const dialog = tableDialog(keeper)
  await dialog.getByRole('button', { name: 'Créer le lien de la table' }).click()
  const url = dialog.locator('code').first()
  await expect(url).toHaveText(/\/t\/[\w-]+$/)
  const tableUrl = (await url.textContent()) ?? ''
  await dialog.getByRole('button', { name: 'Fermer' }).click()
  await expect(dialog).toBeHidden()

  return { keeperContext, keeper, game, gameId, tableUrl, phone: await openPhone(browser, baseURL) }
}

/** The phone opens the table link and picks the investigator. */
async function pick(phone: Page, tableUrl: string, name: string) {
  await phone.goto(tableUrl)
  await phone.getByRole('link', { name: new RegExp(name) }).click()
  await expect(phone).toHaveURL(/\/t\/[\w-]+\/c\/[\w-]+$/)
  await expect(phone.getByRole('heading', { name, level: 1 })).toBeVisible()
}

/** Taps − / + on a phone tile and waits until the server has it. */
async function tap(phone: Page, button: string) {
  const written = phone.waitForResponse((r) => r.url().includes('/rest/v1/rpc/companion_set_point') && r.ok())
  await phone.getByRole('button', { name: button }).click()
  await written
}

test('keeper shows the table link; a player picks an investigator and sees their sheet', async ({ browser, baseURL }) => {
  const { tableUrl, phone } = await setUpTable(browser, baseURL)
  expect(tableUrl.startsWith(`${baseURL}/t/`)).toBe(true)

  await phone.goto(tableUrl)
  await expect(phone.getByRole('heading', { name: 'Qui êtes-vous ?' })).toBeVisible()
  await expect(phone.getByRole('button', { name: 'Créer mon investigateur' })).toBeVisible()
  await phone.getByRole('link', { name: /Alpha/ }).click()
  await expect(phone).toHaveURL(/\/t\/[\w-]+\/c\/[\w-]+$/)
  await expect(phone.getByRole('heading', { name: 'Alpha', level: 1 })).toBeVisible()
  await expect(phoneStat(phone, 'PV')).toHaveText('13 / 13')
  await expect(phoneStat(phone, 'SAN')).toHaveText('60')
  await expect(phone.getByRole('heading', { name: 'Compétences' })).toBeVisible()
  await expect(phone.getByRole('navigation', { name: 'Fiche' }).getByRole('link')).toHaveText(['Fiche', 'Carnet', 'Profil'])

  // This phone remembers its investigator: the table link goes straight to the sheet
  await phone.goto(tableUrl)
  await expect(phone.getByRole('heading', { name: 'Alpha', level: 1 })).toBeVisible()
})

test('SAN removed on the game screen shows on the phone, and HP changed on the phone shows on the game screen', async ({ browser, baseURL }) => {
  const { game, tableUrl, phone } = await setUpTable(browser, baseURL)
  await pick(phone, tableUrl, 'Alpha')
  await expect(phone.getByText('En direct avec le gardien')).toBeVisible()

  await unfold(game, 'Alpha')
  await card(game, 'Alpha').locator('button[data-k="san"][data-d="-1"]').click()
  await expect(engineStat(game, 'Alpha', 'san')).toHaveText('59')
  await expect(phoneStat(phone, 'SAN')).toHaveText('59', LIVE)

  await tap(phone, 'Retirer 1 PV')
  await expect(phoneStat(phone, 'PV')).toHaveText('12 / 13')
  await expect(engineStat(game, 'Alpha', 'pv')).toHaveText('12/13', LIVE)
  // The keeper's change stays
  await expect(engineStat(game, 'Alpha', 'san')).toHaveText('59')
})

test('a note written on the phone appears on the investigator card of the game screen and on the Investigateurs page', async ({ browser, baseURL }) => {
  const { keeper, game, tableUrl, phone } = await setUpTable(browser, baseURL)
  await pick(phone, tableUrl, 'Alpha')
  await phone.getByRole('navigation', { name: 'Fiche' }).getByRole('link', { name: 'Carnet' }).click()
  await expect(phone.getByText('Carnet vide.')).toBeVisible()
  await phone.getByRole('textbox', { name: 'Écrire une note…' }).fill('First note from the phone')
  await phone.getByRole('button', { name: 'Ajouter', exact: true }).click()
  await expect(phone.getByRole('listitem').filter({ hasText: 'First note from the phone' })).toBeVisible()

  // Game screen: the card's folded notebook
  await unfold(game, 'Alpha')
  const notebook = card(game, 'Alpha').locator('details.carnet')
  await expect(notebook.locator('summary')).toHaveText('Carnet (1)', LIVE)
  await notebook.locator('summary').click()
  await expect(notebook.locator('.cnote')).toContainText('First note from the phone')

  // Investigateurs page: the card's notebook, where the keeper edits and deletes notes
  await keeper.goto('/characters')
  await keeper.getByRole('button', { name: 'Carnet (1)' }).click()
  const dialog = keeper.getByRole('dialog', { name: 'Alpha' })
  const notes = dialog.getByRole('list', { name: 'Notes' }).getByRole('listitem')
  await expect(notes).toHaveText([/First note from the phone/])

  await dialog.getByRole('button', { name: 'Modifier la note' }).click()
  await dialog.getByRole('textbox', { name: 'Texte de la note' }).fill('   ')
  await expect(dialog.getByRole('button', { name: 'Enregistrer', exact: true })).toBeDisabled()
  await dialog.getByRole('textbox', { name: 'Texte de la note' }).fill('Edited by the keeper')
  await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(keeper.getByText('Note modifiée.')).toBeVisible()
  await expect(notes).toHaveText([/Edited by the keeper/])
  await phone.reload()
  await expect(phone.getByRole('listitem').filter({ hasText: 'Edited by the keeper' })).toBeVisible()

  await dialog.getByRole('button', { name: 'Supprimer la note' }).click()
  await dialog.getByRole('group', { name: 'Supprimer cette note ?' }).getByRole('button', { name: 'Oui' }).click()
  await expect(keeper.getByText('Note supprimée.')).toBeVisible()
  await expect(dialog.getByText('Carnet vide.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Fermer' }).click()
  await expect(keeper.getByRole('button', { name: 'Carnet (0)' })).toBeVisible()
})

test("a player creates an investigator from the phone; it joins the keeper's game without reload, and is still there after the keeper reloads", async ({ browser, baseURL }) => {
  const { keeper, game, tableUrl, phone } = await setUpTable(browser, baseURL)
  await phone.goto(tableUrl)
  await phone.getByRole('button', { name: 'Créer mon investigateur' }).click()
  await createJournalist(phone, 'Bravo', null, {
    fillPlayer: (p) => p.getByLabel('Ton prénom').fill('Bea'),
    savedUrl: /\/t\/[\w-]+\/c\/[\w-]+$/,
  })
  await expect(phone.getByRole('heading', { name: 'Bravo', level: 1 })).toBeVisible()
  await expect(phoneStat(phone, 'PV')).toHaveText('13 / 13')

  await expect(game.locator('#invView .nm')).toHaveText(['Alpha', 'Bravo'], LIVE)
  await expect(card(game, 'Bravo').locator('.player')).toHaveText('Bea')

  await keeper.reload()
  await expect(engine(keeper).locator('#invView .nm')).toHaveText(['Alpha', 'Bravo'])
  // The keeper can give Bravo a personal link
  await engine(keeper).locator('#qaTable').click()
  await expect(tableDialog(keeper).getByRole('button', { name: 'Créer le lien de Bravo' })).toBeVisible()
})

test('revoking the link shows "link no longer valid" on the phone after reload', async ({ browser, baseURL }) => {
  const { keeper, game, tableUrl, phone } = await setUpTable(browser, baseURL)
  await pick(phone, tableUrl, 'Alpha')

  await game.locator('#qaTable').click()
  const dialog = tableDialog(keeper)
  await dialog.getByRole('button', { name: 'Révoquer et remplacer' }).click()
  await expect(dialog.locator('code').first()).not.toHaveText(tableUrl)

  await phone.reload()
  await expect(phone.getByRole('alert')).toHaveText("Ce lien n'est plus valide. Demande un nouveau code au gardien.")
  await phone.goto(tableUrl)
  await expect(phone.getByRole('alert')).toHaveText("Ce lien n'est plus valide. Demande un nouveau code au gardien.")
})

test("phone changes made while the keeper's tab is closed are there when the game reopens", async ({ browser, baseURL }) => {
  const { keeperContext, keeper, gameId, tableUrl, phone } = await setUpTable(browser, baseURL)
  await pick(phone, tableUrl, 'Alpha')
  await keeper.close()

  await tap(phone, 'Retirer 1 PV')
  await tap(phone, 'Retirer 1 SAN')
  await expect(phoneStat(phone, 'PV')).toHaveText('12 / 13')
  await expect(phoneStat(phone, 'SAN')).toHaveText('59')

  const again = await keeperContext.newPage()
  watch(again)
  const game = await openGame(again, gameId)
  await unfold(game, 'Alpha')
  await expect(engineStat(game, 'Alpha', 'pv')).toHaveText('12/13', LIVE)
  await expect(engineStat(game, 'Alpha', 'san')).toHaveText('59', LIVE)
})
