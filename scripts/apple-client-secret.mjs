// Sign in with Apple: makes the "Secret Key (for OAuth)" Supabase asks for, a JWT signed with your
// Sign in with Apple key (.p8). Apple caps its life at 6 months: run this again and paste the new
// value before it expires (the date is printed), or Apple sign-in stops working.
//
//   pnpm auth:apple-secret -- --team <Team ID> --key <Key ID> --client <Services ID> --p8 <path to AuthKey_XXXX.p8>
//
// Everything stays on this machine: nothing is sent anywhere, the secret is printed.
import { createPrivateKey, sign } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: { team: { type: 'string' }, key: { type: 'string' }, client: { type: 'string' }, p8: { type: 'string' }, days: { type: 'string', default: '180' } },
})
const missing = ['team', 'key', 'client', 'p8'].filter((k) => !values[k])
if (missing.length) {
  console.error(`Missing: ${missing.map((k) => `--${k}`).join(' ')}`)
  console.error('Usage: pnpm auth:apple-secret -- --team <Team ID> --key <Key ID> --client <Services ID> --p8 <AuthKey_XXXX.p8>')
  process.exit(1)
}
const days = Math.min(Number(values.days), 180) // Apple refuses more than 15777000 s (~182.6 days)

const b64url = (data) => Buffer.from(data).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const exp = now + days * 86400
const header = { alg: 'ES256', kid: values.key, typ: 'JWT' }
const payload = { iss: values.team, iat: now, exp, aud: 'https://appleid.apple.com', sub: values.client }
const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
const key = createPrivateKey(readFileSync(values.p8, 'utf8'))
const signature = sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' })

console.log(`${input}.${b64url(signature)}`)
console.error(`\nExpires ${new Date(exp * 1000).toISOString().slice(0, 10)}: make a new one before then.`)
