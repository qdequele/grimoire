// The MCP connector's sign-in, as ChatGPT or Claude do it: dynamic client registration with
// Supabase Auth's OAuth server, the authorize URL in the keeper's browser, login, our consent page,
// the code exchanged (PKCE) for a token, then a tool call with that token. Also: deny, the
// connected apps list in Réglages, and the consent page in English.
// Needs the local stack with `supabase functions serve --env-file supabase/tests/functions.env`.
import { createHash, randomBytes } from 'node:crypto'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { expect, test, type Page } from '@playwright/test'

const SUPABASE = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const AUTH = `${SUPABASE}/auth/v1`
const MCP = `${SUPABASE}/functions/v1/mcp`
// Never served: the browser's trip back to the client is intercepted.
const CALLBACK = 'http://127.0.0.1:5999/callback'

const b64url = (b: Buffer) => b.toString('base64url')

async function registerClient(name: string) {
  const res = await fetch(`${AUTH}/oauth/clients/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: name,
      redirect_uris: [CALLBACK],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    }),
  })
  expect(res.status, await res.clone().text()).toBeLessThan(300)
  return (await res.json()).client_id as string
}

/** Opens the authorize URL like an MCP client would; returns the PKCE verifier and the state. */
async function authorize(page: Page, clientId: string) {
  const verifier = b64url(randomBytes(32))
  const state = b64url(randomBytes(12))
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: CALLBACK,
    code_challenge: b64url(createHash('sha256').update(verifier).digest()),
    code_challenge_method: 'S256',
    state,
    resource: MCP,
  })
  await page.route(`${CALLBACK}**`, (route) => route.fulfill({ status: 200, contentType: 'text/plain', body: 'back to the client' }))
  // Local Auth sends the keeper to its site_url (127.0.0.1:5173) but the dev server answers on
  // localhost: rewrite that redirect (Playwright doesn't intercept redirect hops themselves).
  await page.route(`${AUTH}/oauth/authorize?**`, async (route) => {
    const res = await route.fetch({ maxRedirects: 0 })
    const location = (res.headers()['location'] ?? '').replace('//127.0.0.1:5173/', '//localhost:5173/')
    await route.fulfill({ status: res.status(), headers: { location } })
  })
  await page.goto(`${AUTH}/oauth/authorize?${params}`)
  return { verifier, state }
}

async function signUpHere(page: Page) {
  await page.getByRole('tab', { name: 'Créer un compte' }).click()
  await page.getByLabel('Nom affiché').fill('Keeper')
  await page.getByLabel('E-mail').fill(`e2e-mcp-${crypto.randomUUID()}@example.com`)
  await page.getByLabel('Mot de passe').fill('correct-horse-battery')
  await page.getByRole('button', { name: 'Créer mon compte' }).click()
}

test('a chat app signs the keeper in and calls the tools with its token', async ({ page }) => {
  const clientId = await registerClient('Test chat app')
  const { verifier, state } = await authorize(page, clientId)

  // Not signed in yet: login first, then back to the consent page.
  await expect(page).toHaveURL(/\/login\?next=%2Foauth%2Fconsent/)
  await signUpHere(page)
  await expect(page).toHaveURL(/\/oauth\/consent\?authorization_id=/)
  const consent = page.getByTestId('oauth-consent')
  await expect(consent.getByRole('heading', { name: 'Test chat app veut accéder à ton Grimoire.' })).toBeVisible()
  await expect(consent.getByText('127.0.0.1:5999')).toBeVisible()

  const back = page.waitForURL(`${CALLBACK}**`)
  await consent.getByRole('button', { name: 'Autoriser' }).click()
  await back
  const returned = new URL(page.url())
  expect(returned.searchParams.get('state')).toBe(state)
  const code = returned.searchParams.get('code')
  expect(code).toBeTruthy()

  const tokenRes = await fetch(`${AUTH}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: code!, redirect_uri: CALLBACK, client_id: clientId, code_verifier: verifier }),
  })
  expect(tokenRes.status, await tokenRes.clone().text()).toBe(200)
  const { access_token: token } = await tokenRes.json()

  const mcp = new Client({ name: 'e2e', version: '1.0.0' })
  await mcp.connect(new StreamableHTTPClientTransport(new URL(MCP), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }))
  const res = await mcp.callTool({ name: 'list_my_stories', arguments: {} })
  expect(res.isError).toBeFalsy()
  expect(JSON.parse((res.content as Array<{ text: string }>)[0].text)).toMatchObject({ stories: [], unfinishedCreations: [] })
  await mcp.close()

  // Réglages lists the app; disconnecting it revokes the grant.
  await page.goto('/settings')
  const grants = page.getByTestId('oauth-grants')
  await expect(grants.getByText('Test chat app')).toBeVisible()
  await grants.getByRole('button', { name: 'Déconnecter' }).click()
  await expect(page.getByText('Aucune application connectée.')).toBeVisible()
})

test('the keeper can refuse, and the consent page speaks English', async ({ page }) => {
  await page.goto('/login')
  await page.evaluate(() => localStorage.setItem('gardien-lang', 'en'))
  await page.reload()
  const clientId = await registerClient('Another app')
  await authorize(page, clientId)
  await page.getByRole('tab', { name: 'Create an account' }).click()
  await page.getByLabel('Display name').fill('Keeper')
  await page.getByLabel('Email').fill(`e2e-mcp-${crypto.randomUUID()}@example.com`)
  await page.getByLabel('Password').fill('correct-horse-battery')
  await page.getByRole('button', { name: 'Create my account' }).click()

  const consent = page.getByTestId('oauth-consent')
  await expect(consent.getByRole('heading', { name: 'Another app wants to access your Grimoire.' })).toBeVisible()
  const back = page.waitForURL(`${CALLBACK}**`)
  await consent.getByRole('button', { name: 'Deny' }).click()
  await back
  const returned = new URL(page.url())
  expect(returned.searchParams.get('error')).toBe('access_denied')
  expect(returned.searchParams.get('code')).toBeNull()
})

test('an incomplete consent link says so', async ({ page }) => {
  await page.goto('/login?next=%2Foauth%2Fconsent')
  await signUpHere(page)
  await expect(page.getByTestId('oauth-consent').getByText('Ce lien d’autorisation est incomplet.')).toBeVisible()
})
