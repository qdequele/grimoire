import { expect, test, type Browser, type BrowserContext, type FrameLocator, type Page } from '@playwright/test'
import type { SupabaseClient } from '@supabase/supabase-js'
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
  await expect(phone.getByRole('navigation', { name: 'Fiche' }).getByRole('link')).toHaveText(['Fiche', 'Dés', 'Objets', 'Carnet', 'Profil'])

  // This phone remembers its investigator: the table link goes straight to the sheet
  await phone.goto(tableUrl)
  await expect(phone.getByRole('heading', { name: 'Alpha', level: 1 })).toBeVisible()
})

test('on a computer (a table playing online), the sheet keeps its tabs in a side column', async ({ browser, baseURL }) => {
  const { tableUrl } = await setUpTable(browser, baseURL)
  const desk = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, baseURL })).newPage()
  watch(desk)
  await pick(desk, tableUrl, 'Alpha')

  // One tab list, beside the sheet (the phone's bottom bar is hidden)
  const tabs = desk.getByRole('navigation', { name: 'Fiche' })
  await expect(tabs.getByRole('link')).toHaveText(['Fiche', 'Dés', 'Objets', 'Carnet', 'Profil'])
  const side = await tabs.boundingBox()
  const skills = await desk.getByRole('heading', { name: 'Compétences' }).boundingBox()
  expect(side && skills && side.x + side.width < skills.x).toBe(true)
  await expect(desk.getByText('Clique sur une compétence pour savoir à quoi elle sert et la lancer.')).toBeVisible()

  // Ctrl+Enter adds a note
  await tabs.getByRole('link', { name: 'Carnet' }).click()
  await desk.getByRole('textbox', { name: 'Écrire une note…' }).fill('Note du bureau')
  await desk.getByRole('textbox', { name: 'Écrire une note…' }).press('Control+Enter')
  await expect(desk.getByText('Note du bureau')).toBeVisible(LIVE)
  await expect(desk.getByRole('textbox', { name: 'Écrire une note…' })).toHaveValue('')
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

  // Both changes are in the Journal; the phone's taps within a few seconds share one line, as the keeper's do.
  const journal = game.locator('#jList li')
  await expect(journal.filter({ hasText: 'Alpha : SAN 60 → 59' })).toHaveCount(1)
  await expect(journal.filter({ hasText: 'Alpha : PV 13 → 12' })).toHaveCount(1)
  await tap(phone, 'Retirer 1 PV')
  await expect(engineStat(game, 'Alpha', 'pv')).toHaveText('11/13', LIVE)
  await expect(journal.filter({ hasText: 'Alpha : PV 13 → 11' })).toHaveCount(1)
  await expect(journal.filter({ hasText: 'Alpha : PV' })).toHaveCount(1)
  await game.locator('#jFilters [data-jf="pv"]').click()
  await expect(journal).toHaveText([/Alpha : PV 13 → 11/])
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
  await keeper.goto('/characters/mine')
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

test('revoking the link shows "link no longer valid" on the phone at once; a phone on another link stays live', async ({ browser, baseURL }) => {
  const { keeper, game, tableUrl, phone } = await setUpTable(browser, baseURL)
  await pick(phone, tableUrl, 'Alpha')

  // A second phone on Alpha's personal link.
  await game.locator('#qaTable').click()
  const dialog = tableDialog(keeper)
  await dialog.getByRole('button', { name: 'Créer le lien de Alpha' }).click()
  const personalCode = dialog.locator('code').filter({ hasNotText: tableUrl })
  await expect(personalCode).toHaveText(/\/t\/[\w-]+$/)
  const personalUrl = (await personalCode.textContent()) ?? ''
  const other = await openPhone(browser, baseURL)
  await other.goto(personalUrl)
  await expect(other.getByRole('heading', { name: 'Alpha', level: 1 })).toBeVisible()
  await expect(other.getByText('En direct avec le gardien')).toBeVisible()

  await dialog.getByRole('button', { name: 'Révoquer et remplacer' }).click()
  await expect(dialog.locator('code').first()).not.toHaveText(tableUrl)

  // The revoke tells the phones on the old channel (rotate): no reload needed.
  await expect(phone.getByRole('alert')).toHaveText("Ce lien n'est plus valide. Demande un nouveau code au gardien.", LIVE)
  await phone.reload()
  await expect(phone.getByRole('alert')).toHaveText("Ce lien n'est plus valide. Demande un nouveau code au gardien.")
  await phone.goto(tableUrl)
  await expect(phone.getByRole('alert')).toHaveText("Ce lien n'est plus valide. Demande un nouveau code au gardien.")

  // The personal link moved to the game's new channel: still live both ways.
  await dialog.getByRole('button', { name: 'Fermer' }).click()
  await expect(other.getByText('En direct avec le gardien')).toBeVisible(LIVE)
  await unfold(game, 'Alpha')
  await card(game, 'Alpha').locator('button[data-k="san"][data-d="-1"]').click()
  await expect(phoneStat(other, 'SAN')).toHaveText('59', LIVE)
  await tap(other, 'Retirer 1 PV')
  await expect(engineStat(game, 'Alpha', 'pv')).toHaveText('12/13', LIVE)
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
  // ... and in the Journal.
  await expect(game.locator('#jList li').filter({ hasText: 'Alpha : PV 13 → 12' })).toHaveCount(1)
  await expect(game.locator('#jList li').filter({ hasText: 'Alpha : SAN 60 → 59' })).toHaveCount(1)
})

test('broadcasts are hints: forged ones change nothing on the game screen, and phones clamp what they show', async ({ browser, baseURL }) => {
  const { keeper, game, tableUrl, phone } = await setUpTable(browser, baseURL)
  await pick(phone, tableUrl, 'Alpha')
  await expect(phone.getByText('En direct avec le gardien')).toBeVisible()
  await unfold(game, 'Alpha')
  // The tap, and the refetch after it (it would overwrite what the forged broadcast shows).
  const refetched = phone.waitForResponse((r) => r.url().includes('/rest/v1/rpc/companion_open') && r.ok())
  await tap(phone, 'Retirer 1 PV')
  await refetched
  await expect(engineStat(game, 'Alpha', 'pv')).toHaveText('12/13', LIVE)
  await expect(phoneStat(phone, 'PV')).toHaveText('12 / 13')

  // Anyone holding a link learns the channel from companion_open and can send on it.
  const forger = await (await browser.newContext({ baseURL })).newPage()
  await forger.goto('/login')
  const token = tableUrl.split('/t/')[1]
  await forger.evaluate(async (token) => {
    // The app's own client, as the dev server serves it.
    interface Channel {
      subscribe: (cb: (status: string) => void) => void
      send: (m: { type: 'broadcast'; event: string; payload: object }) => Promise<unknown>
    }
    interface Client {
      rpc: (fn: string, args: object) => Promise<{ data: unknown }>
      channel: (topic: string) => Channel
    }
    const path = '/src/lib/supabase.ts'
    const { supabase } = (await import(/* @vite-ignore */ path)) as { supabase: Client }
    const { data } = await supabase.rpc('companion_open', { p_token: token })
    const view = data as { game: { channel: string }; party: Array<{ id: string }> }
    const ch = supabase.channel(`companion:${view.game.channel}`)
    await new Promise<void>((resolve) => ch.subscribe((status) => status === 'SUBSCRIBED' && resolve()))
    const characterId = view.party[0].id
    // Dated ahead: the phone drops payloads older than what it holds (the server's clock may lead ours).
    await ch.send({ type: 'broadcast', event: 'points', payload: { characterId, pv: 500, san: 0, chance: 0, pm: 0, checks: [], source: 'phone', updatedAt: new Date(Date.now() + 60_000).toISOString() } })
    ;(window as unknown as { forged: Channel }).forged = ch
  }, token)

  // The phone shows the forged values within the server's bounds (HP at most the sheet's 13)…
  await expect(phoneStat(phone, 'PV')).toHaveText('13 / 13', LIVE)
  await expect(phoneStat(phone, 'SAN')).toHaveText('0', LIVE)
  // (A member hint makes phones refetch, so it goes after the phone checks.)
  await forger.evaluate(async () => {
    const ch = (window as unknown as { forged: { send: (m: object) => Promise<unknown> } }).forged
    await ch.send({ type: 'broadcast', event: 'member', payload: { characterId: crypto.randomUUID() } })
  })
  // …the game screen re-reads the database, which still holds nothing from a phone.
  await keeper.waitForTimeout(1_500)
  await expect(engineStat(game, 'Alpha', 'pv')).toHaveText('12/13')
  await expect(engineStat(game, 'Alpha', 'san')).toHaveText('60')
  await expect(game.locator('#invView .nm')).toHaveText(['Alpha'])

  // A real tap still goes through, from the server's values.
  await phone.reload()
  await expect(phoneStat(phone, 'SAN')).toHaveText('60')
  await tap(phone, 'Retirer 1 SAN')
  await expect(engineStat(game, 'Alpha', 'san')).toHaveText('59', LIVE)
})

test("a keeper change that never reached the live points is written on the next save, and nothing is when they agree", async ({ browser, baseURL }) => {
  const { keeperContext, keeper, game, gameId, tableUrl, phone } = await setUpTable(browser, baseURL)
  const pointsWrite = (page: Page) =>
    page.waitForResponse((r) => r.url().includes('/rest/v1/game_points') && r.request().method() === 'POST' && r.ok())
  await unfold(game, 'Alpha')
  const first = pointsWrite(keeper)
  await card(game, 'Alpha').locator('button[data-k="san"][data-d="-1"]').click()
  await first

  // The next change reaches the game's state but not game_points (as when the tab closes first).
  await keeper.route('**/rest/v1/game_points**', (r) => (r.request().method() === 'POST' ? r.abort() : r.continue()))
  const saved = keeper.waitForResponse((r) => r.url().includes('/rest/v1/rpc/save_game_state') && r.ok())
  await card(game, 'Alpha').locator('button[data-k="san"][data-d="-1"]').click()
  await expect(engineStat(game, 'Alpha', 'san')).toHaveText('58')
  await saved
  await keeper.close()

  const again = await keeperContext.newPage()
  watch(again)
  const reopened = await openGame(again, gameId)
  await unfold(reopened, 'Alpha')
  await expect(engineStat(reopened, 'Alpha', 'san')).toHaveText('58')
  const frame = () => again.frames().find((f) => f.url().includes('play.html'))!
  const repaired = pointsWrite(again)
  await frame().evaluate(() => (eval('save') as () => void)())
  const body = (await repaired).request().postDataJSON() as Array<{ san: number }> | { san: number }
  expect(Array.isArray(body) ? body[0].san : body.san).toBe(58)
  await pick(phone, tableUrl, 'Alpha')
  await expect(phoneStat(phone, 'SAN')).toHaveText('58')

  // Database and game agree: a save sends no points.
  let writes = 0
  again.on('request', (r) => { if (r.url().includes('/rest/v1/game_points') && r.method() === 'POST') writes++ })
  const stateSaved = again.waitForResponse((r) => r.url().includes('/rest/v1/rpc/save_game_state') && r.ok())
  await frame().evaluate(() => (eval('save') as () => void)())
  await stateSaved
  expect(writes).toBe(0)
})

test('a skill name and a first name holding markup show as text on the game screen, never as HTML', async ({ browser, baseURL }) => {
  const keeper = await (await browser.newContext({ baseURL })).newPage()
  watch(keeper)
  await signUp(keeper)
  const bad = '<img src=x onerror="window.__xss=1">'
  // Straight into the account with the keeper's session, past companion_create_character's checks
  // (an older row, a hand edit): the game screen must not trust what the database holds.
  await keeper.evaluate(async (bad) => {
    const path = '/src/lib/supabase.ts' // the app's own client, served by Vite
    const { supabase } = (await import(/* @vite-ignore */ path)) as { supabase: SupabaseClient }
    const { data: auth } = await supabase.auth.getUser()
    const owner_id = auth.user!.id
    const player = await supabase.from('players').insert({ owner_id, name: bad }).select('id').single()
    if (player.error) throw player.error
    const data = { name: 'Zed', characteristics: { DEX: 50 }, hp: 10, san: 50, luck: 50, mp: 10, skills: { [bad]: 99 } }
    const ch = await supabase.from('characters').insert({ owner_id, player_id: player.data.id, data })
    if (ch.error) throw ch.error
  }, bad)

  await keeper.goto('/stories')
  await keeper.locator('[data-slot="card"] a[href^="/stories/"]').first().click()
  await keeper.getByLabel(/Zed/).check()
  await keeper.getByRole('button', { name: 'Lancer la partie' }).click()
  await expect(keeper).toHaveURL(/\/games\//)
  const game = engine(keeper)
  await expect(card(game, 'Zed')).toBeVisible()
  const frame = keeper.frames().find((f) => f.url().includes('play.html'))!
  const xss = () => frame.evaluate(() => (window as unknown as { __xss?: number }).__xss)

  // Roll the skill: a success ticks it, and the result's level line names it.
  await frame.evaluate(() => { Math.random = () => 0.01 }) // 2 on the D100: an extreme success
  await game.locator('#qaDice').click()
  await game.locator('#dWho').selectOption({ label: `Zed · ${bad}` })
  await game.locator('#dSk').selectOption(bad)
  await game.locator('#rollTest').click()
  await expect(game.locator('#result .lvl')).toContainText(`${bad} cochée`)
  await expect(game.locator('#result .det')).toContainText(bad)

  // "Modifier la partie": with no investigator chosen, the warning names the player.
  await game.locator('#diceClose').click()
  await game.locator('#gmEdit2').click()
  await game.locator('select[data-sjc]').selectOption('')
  await expect(game.locator('.pool .mut')).toContainText(`personnage à choisir pour ${bad}`)

  await expect(game.locator('img[src="x"]')).toHaveCount(0)
  await keeper.waitForTimeout(200) // an onerror handler would have run by now
  expect(await xss()).toBeUndefined()
})

test('a skill explains itself on the phone; rolls made on the phone show on the game screen', async ({ browser, baseURL }) => {
  const { keeper, tableUrl, phone } = await setUpTable(browser, baseURL)
  await pick(phone, tableUrl, 'Alpha')

  // Tapping a skill: what it is for, its thresholds, then a d100 rolled by the server.
  await phone.getByRole('button', { name: /^Bibliothèque \d+/ }).click()
  const dialog = phone.getByRole('dialog', { name: 'Bibliothèque' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText(/Trouver un livre/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Plus : Dés bonus ou de pénalité' }).click()
  await expect(dialog.locator('output[aria-label="Dés bonus ou de pénalité"]')).toHaveText('1 dé bonus')
  const rolled = phone.waitForResponse((r) => r.url().includes('/rest/v1/rpc/companion_roll_check') && r.ok())
  await dialog.getByRole('button', { name: 'Lancer 1D100' }).click()
  const roll = (await (await rolled).json()) as { result: number; target: number }
  // The dice are thrown first (one tens die per bonus die plus one, and the units die), then the result shows.
  await expect(dialog.getByTestId('dice-tray').locator(':scope > div')).toHaveCount(3)
  await expect(dialog.getByTestId('roll-result').locator('output')).toHaveText(String(roll.result))
  await expect(dialog.getByRole('button', { name: 'Relancer' })).toBeVisible()

  // The keeper's game screen shows it: a toast at the top, over the game (not hidden behind it, not
  // still fading in), and a line in the Journal that stays.
  const toast = keeper.locator('[data-sonner-toast]').filter({ hasText: `Alpha · Bibliothèque (${roll.target})` })
  await expect(toast).toBeVisible(LIVE)
  await expect(toast.locator('output')).toHaveText(String(roll.result))
  await expect(toast).toContainText('1 dé bonus')
  await expect(toast).toHaveAttribute('data-y-position', 'top')
  await expect.poll(() => toast.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
    return Number(getComputedStyle(el).opacity) === 1 && r.top >= 0 && !!top && el.contains(top)
  })).toBe(true)
  const journal = engine(keeper).locator('#jList li')
  await expect(journal.filter({ hasText: `Alpha · Bibliothèque (${roll.target}) : ${roll.result} — ` })).toContainText('1 dé bonus')
  await engine(keeper).locator('#jFilters [data-jf="test"]').click()
  await expect(journal.filter({ hasText: `Alpha · Bibliothèque (${roll.target})` })).toBeVisible()
  await engine(keeper).locator('#jFilters [data-jf=""]').click()
  await toast.getByRole('button', { name: 'Fermer' }).click()
  await expect(toast).toBeHidden()
  await phone.keyboard.press('Escape')

  // Free dice from the Dés tab.
  await phone.getByRole('navigation', { name: 'Fiche' }).getByRole('link', { name: 'Dés' }).click()
  await phone.getByRole('radio', { name: 'D8' }).click()
  await phone.getByRole('button', { name: 'Plus : Nombre de dés' }).click()
  const thrown = phone.waitForResponse((r) => r.url().includes('/rest/v1/rpc/companion_roll_dice') && r.ok())
  await phone.getByRole('button', { name: 'Lancer 2D8' }).click()
  const dice = (await (await thrown).json()) as { result: number }
  await expect(phone.getByTestId('dice-tray').locator(':scope > div')).toHaveCount(2)
  await expect(phone.getByTestId('roll-result').locator('output')).toHaveText(String(dice.result))
  await expect(keeper.locator('[data-sonner-toast]').filter({ hasText: 'Alpha lance 2D8' }).locator('output')).toHaveText(String(dice.result), LIVE)
  await expect(engine(keeper).locator('#jList li').filter({ hasText: `Alpha lance 2D8 : ${dice.result} (` })).toBeVisible()
  // The phone keeps its own rolls.
  await expect(phone.getByRole('heading', { name: 'Derniers jets' })).toBeVisible()
  await expect(phone.getByText(/^Bibliothèque \(\d+\)$/)).toBeVisible()
})

test('the keeper gives item cards from the game screen; the phone fires and reloads; both see it live, and the cards stay on the investigator', async ({ browser, baseURL }) => {
  const { keeper, game, tableUrl, phone } = await setUpTable(browser, baseURL)
  await unfold(game, 'Alpha')
  await expect(card(game, 'Alpha').locator('.itm-n')).toHaveText('0')

  // The items button on the investigator's card opens their cards above the game.
  await card(game, 'Alpha').locator('.itm-n').click()
  const items = keeper.getByRole('dialog', { name: 'Alpha' })
  await items.getByRole('button', { name: 'Donner un objet' }).click()
  const give = keeper.getByRole('dialog', { name: 'Donner un objet à Alpha' })
  for (const name of ['Revolver .38', 'Boîte de balles .38']) {
    await give.getByRole('button', { name, exact: true }).click()
    await give.getByRole('button', { name: `Donner « ${name} »` }).click()
    await expect(keeper.getByText(`Alpha reçoit « ${name} ».`)).toBeVisible()
  }
  await keeper.keyboard.press('Escape') // the toasts sit over the dialog's footer
  await expect(give).toBeHidden()
  await expect(items.getByRole('article')).toHaveCount(2)
  await items.getByRole('button', { name: 'Fermer' }).click()
  await expect(card(game, 'Alpha').locator('.itm-n')).toHaveText('2', LIVE)
  const chip = (name: string) => card(game, 'Alpha').locator('.itm-row .itc', { hasText: name })
  await expect(chip('Revolver .38')).toContainText('6/6')

  // The phone sees the cards, fires once and reloads from the box.
  await pick(phone, tableUrl, 'Alpha')
  await phone.getByRole('link', { name: 'Objets' }).click()
  await expect(phone.getByRole('article')).toHaveCount(2)
  await phone.getByRole('button', { name: 'Revolver .38', exact: true }).click()
  const used = phone.waitForResponse((r) => r.url().includes('/rest/v1/rpc/companion_use_item') && r.ok())
  await phone.getByRole('button', { name: 'Utiliser : Revolver .38' }).click()
  await used
  await expect(phone.getByRole('dialog').locator('.icard-uses-n')).toHaveText('5/6')
  await expect(chip('Revolver .38')).toContainText('5/6', LIVE)
  await phone.getByRole('button', { name: 'Recharger' }).click()
  await expect(phone.getByText('1 munition rechargée.')).toBeVisible()
  await expect(chip('Revolver .38')).toContainText('6/6', LIVE)
  await expect(chip('Boîte de balles .38')).toContainText('19/20', LIVE)

  // The cards belong to the investigator: they are on their sheet, outside any game.
  await keeper.goto('/characters/mine')
  await keeper.getByRole('link', { name: /Alpha/ }).first().click()
  await expect(keeper.getByRole('heading', { name: 'Objets (2)' })).toBeVisible()
  await expect(keeper.getByRole('article', { name: 'Revolver .38' })).toBeVisible()
})
