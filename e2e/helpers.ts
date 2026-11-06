import { expect, type Page } from '@playwright/test'

// Flows shared by the app and companion specs.

export async function signUp(page: Page, name = 'Keeper') {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await page.getByRole('tab', { name: 'Créer un compte' }).click()
  await page.getByLabel('Nom affiché').fill(name)
  await page.getByLabel('E-mail').fill(`e2e-${crypto.randomUUID()}@example.com`)
  await page.getByLabel('Mot de passe').fill('correct-horse-battery')
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
  await expect(page.getByText(`Bonsoir, ${name}`)).toBeVisible()
}

/** Picks the investigator's player in the wizard, creating the player if needed. */
export async function choosePlayer(page: Page, player: string) {
  const select = page.getByRole('combobox', { name: 'Joueur' })
  if (await select.locator('option', { hasText: player }).count()) return select.selectOption({ label: player })
  await select.selectOption({ label: '+ Nouveau joueur…' })
  await page.getByPlaceholder('Prénom').fill(player)
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Joueur' }).locator('option:checked')).toHaveText(player)
}

export interface WizardOptions {
  /** Fills the player field of step 1 (default: the keeper's player select). */
  fillPlayer?: (page: Page) => Promise<unknown>
  /** Where the wizard goes once saved (default: the keeper's investigator list). */
  savedUrl?: RegExp
}

/**
 * Walks the 7-step creation wizard (the legacy app's rules) for a journalist. player null: keep the one
 * already chosen. HP 13, SAN 60, MP 12.
 */
export async function createJournalist(page: Page, name: string, player: string | null = 'Camille', options: WizardOptions = {}) {
  const next = (label: string) => page.getByRole('button', { name: new RegExp(label, 'i') }).last().click()

  // 1. Concept (Journaliste is the default occupation)
  await expect(page.getByRole('heading', { name: 'Créer un investigateur' })).toBeVisible()
  await page.getByLabel('Nom', { exact: true }).fill(name)
  if (options.fillPlayer) await options.fillPlayer(page)
  else if (player) await choosePlayer(page, player)
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
  // Saved: the wizard leaves. Navigating away earlier would cancel the save.
  await expect(page).toHaveURL(options.savedUrl ?? /\/characters(\/joueurs)?$/)
  if (!options.savedUrl) await expect(page.getByText(name, { exact: true }).first()).toBeVisible()
}
