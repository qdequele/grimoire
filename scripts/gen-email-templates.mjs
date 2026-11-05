// Supabase Auth e-mails in the Grimoire look (Art Deco skin: ink, gold, double rules).
//
//   pnpm emails             writes supabase/templates/*.html (used by the local stack, config.toml)
//   pnpm emails --preview   also writes filled-in copies to the folder given after --preview
//
// The hosted project doesn't read these files: paste each one in the Supabase dashboard,
// Authentication → Emails → Templates (subjects are listed in SUBJECTS below and in config.toml).
//
// Language: the app stores the keeper's language in user_metadata.lang at sign-up (LoginPage), which
// templates read as .Data.lang. Without it (older accounts), French.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const C = { ink: '#0a0907', slab: '#12100c', slab2: '#19160f', line: '#3a3220', bone: '#efe6cf', mute: '#a59a7e', gold: '#e2c06e' }
const DISPLAY = "Limelight, 'IM Fell DW Pica', Georgia, 'Times New Roman', serif"
const BODY = "'Cormorant Garamond', Spectral, Georgia, 'Times New Roman', serif"
const UI = "'Josefin Sans', 'Helvetica Neue', Arial, sans-serif"

/** Each e-mail: French and English texts. `action` is the button (a link), or `code` shows a code. */
const EMAILS = {
  confirmation: {
    subject: 'Confirme ton compte Grimoire · Confirm your Grimoire account',
    fr: { eyebrow: 'Nouveau gardien', title: 'Bienvenue à la table', text: "Il ne reste qu'à confirmer ton adresse pour ouvrir ton grimoire : tes investigateurs, tes histoires et tes parties t'y attendent.", button: 'Confirmer mon adresse', ignore: "Tu n'as pas créé de compte ? Ignore ce message, rien ne sera fait." },
    en: { eyebrow: 'New keeper', title: 'Welcome to the table', text: 'Confirm your address to open your grimoire: your investigators, stories and games are waiting.', button: 'Confirm my address', ignore: "Didn't create an account? Ignore this message, nothing will happen." },
    action: '{{ .ConfirmationURL }}',
  },
  recovery: {
    subject: 'Nouveau mot de passe Grimoire · Reset your Grimoire password',
    fr: { eyebrow: 'Mot de passe', title: 'Une clé perdue', text: 'Quelqu’un a demandé un nouveau mot de passe pour ton compte. Si c’est toi, choisis-en un nouveau avec le lien ci-dessous.', button: 'Choisir un mot de passe', ignore: "Ce n'est pas toi ? Ignore ce message : ton mot de passe ne change pas." },
    en: { eyebrow: 'Password', title: 'A lost key', text: 'Someone asked for a new password for your account. If it was you, choose a new one with the link below.', button: 'Choose a password', ignore: "Wasn't you? Ignore this message: your password stays the same." },
    action: '{{ .ConfirmationURL }}',
  },
  magic_link: {
    subject: 'Ton lien de connexion Grimoire · Your Grimoire sign-in link',
    fr: { eyebrow: 'Connexion', title: 'La porte est entrouverte', text: 'Ce lien te connecte à ton grimoire, sans mot de passe. Il ne sert qu’une fois.', button: 'Me connecter', ignore: "Tu n'as rien demandé ? Ignore ce message." },
    en: { eyebrow: 'Sign in', title: 'The door is ajar', text: 'This link signs you in to your grimoire, no password needed. It works once.', button: 'Sign me in', ignore: "Didn't ask for this? Ignore this message." },
    action: '{{ .ConfirmationURL }}',
  },
  email_change: {
    subject: 'Confirme ta nouvelle adresse · Confirm your new address',
    fr: { eyebrow: 'Adresse e-mail', title: 'Une nouvelle adresse', text: 'Confirme que ton compte Grimoire doit désormais utiliser {{ .NewEmail }}.', button: 'Confirmer le changement', ignore: "Ce n'est pas toi ? Ignore ce message, ton adresse ne change pas." },
    en: { eyebrow: 'E-mail address', title: 'A new address', text: 'Confirm that your Grimoire account should now use {{ .NewEmail }}.', button: 'Confirm the change', ignore: "Wasn't you? Ignore this message, your address stays the same." },
    action: '{{ .ConfirmationURL }}',
  },
  invite: {
    subject: 'Invitation à Grimoire · You are invited to Grimoire',
    fr: { eyebrow: 'Invitation', title: 'Une place t’attend', text: 'Tu es invité à rejoindre Grimoire, le compagnon du gardien. Accepte l’invitation pour créer ton compte.', button: "Accepter l'invitation", ignore: 'Tu ne connais pas Grimoire ? Ignore ce message.' },
    en: { eyebrow: 'Invitation', title: 'A seat awaits', text: "You're invited to join Grimoire, the keeper's companion. Accept the invitation to create your account.", button: 'Accept the invitation', ignore: "Don't know Grimoire? Ignore this message." },
    action: '{{ .ConfirmationURL }}',
  },
  reauthentication: {
    subject: 'Ton code Grimoire · Your Grimoire code',
    fr: { eyebrow: 'Vérification', title: 'Le mot de passe du gardien', text: 'Saisis ce code pour confirmer que c’est bien toi.', ignore: "Tu n'as rien demandé ? Ignore ce message." },
    en: { eyebrow: 'Verification', title: "The keeper's password", text: "Enter this code to confirm it's you.", ignore: "Didn't ask for this? Ignore this message." },
    code: '{{ .Token }}',
  },
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function block(t, e) {
  const p = (style, html) => `<p style="margin:0;${style}">${html}</p>`
  const cta = e.action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:32px auto 0"><tr><td bgcolor="${C.gold}" style="background:${C.gold}">
        <a href="${e.action}" style="display:inline-block;padding:15px 30px;font-family:${UI};font-size:13px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#120f08;text-decoration:none">${esc(t.button)}</a>
      </td></tr></table>
      ${p(`margin-top:24px;font-family:${UI};font-size:12px;line-height:1.6;color:${C.mute};text-align:center`, `${t === e.fr ? 'Le bouton ne marche pas ? Copie ce lien :' : "Button not working? Copy this link:"}<br><a href="${e.action}" style="color:${C.gold};word-break:break-all">${e.action}</a>`)}`
    : `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:32px auto 0"><tr><td style="border:1px solid ${C.gold};padding:14px 28px;font-family:'IBM Plex Mono',Menlo,Consolas,monospace;font-size:30px;letter-spacing:10px;color:${C.gold}">${e.code}</td></tr></table>`
  return `
      ${p(`font-family:${UI};font-size:11px;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:${C.gold};text-align:center`, esc(t.eyebrow))}
      <h1 style="margin:14px 0 0;font-family:${DISPLAY};font-weight:400;font-size:30px;line-height:1.2;color:${C.bone};text-align:center">${esc(t.title)}</h1>
      ${p(`margin-top:20px;font-family:${BODY};font-size:19px;line-height:1.6;color:${C.bone};text-align:center`, t.text.replace(/'/g, '’'))}
      ${cta}
      ${p(`margin-top:28px;font-family:${UI};font-size:12px;line-height:1.6;color:${C.mute};text-align:center`, esc(t.ignore))}`
}

function page(name) {
  const e = EMAILS[name]
  const isEn = '{{ if and .Data.lang (eq .Data.lang "en") }}'
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>Grimoire</title>
<!-- Generated by scripts/gen-email-templates.mjs: edit the script, not this file. -->
<link href="https://fonts.googleapis.com/css2?family=Limelight&family=Josefin+Sans:wght@600;700&family=Cormorant+Garamond:wght@500&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${C.ink}" bgcolor="${C.ink}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.ink}" style="background:${C.ink}">
  <tr><td align="center" style="padding:40px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
      <tr><td align="center" style="padding-bottom:22px">
        <p style="margin:0;font-family:${UI};font-size:11px;font-weight:600;letter-spacing:5px;text-transform:uppercase;color:${C.mute}">${isEn}Keeper's screen{{ else }}Écran du gardien{{ end }}</p>
        <p style="margin:8px 0 0;font-family:${DISPLAY};font-size:44px;line-height:1;color:${C.gold}">Grimoire</p>
      </td></tr>
      <tr><td bgcolor="${C.slab}" style="background:${C.slab};border:1px solid ${C.line};border-top:4px double ${C.gold};border-bottom:4px double ${C.gold};padding:40px 36px">
        <p style="margin:0 0 26px;text-align:center;font-size:12px;line-height:1;color:${C.gold};letter-spacing:10px">◆ ◆ ◆</p>
        ${isEn}${block(e.en, e)}
        {{ else }}${block(e.fr, e)}
        {{ end }}
      </td></tr>
      <tr><td align="center" style="padding-top:22px">
        <p style="margin:0;font-family:${BODY};font-style:italic;font-size:15px;color:${C.mute}">${isEn}The keeper's companion, scene by scene.{{ else }}Le compagnon du gardien, scène par scène.{{ end }}</p>
        <p style="margin:6px 0 0;font-family:${UI};font-size:11px;letter-spacing:2px;color:${C.mute}"><a href="{{ .SiteURL }}" style="color:${C.mute}">legrimoire.quest</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>
`
}

const out = 'supabase/templates'
mkdirSync(out, { recursive: true })
for (const name of Object.keys(EMAILS)) writeFileSync(path.join(out, `${name}.html`), page(name))
console.log(`${Object.keys(EMAILS).length} templates → ${out}/`)
for (const [name, e] of Object.entries(EMAILS)) console.log(`  ${name.padEnd(17)} ${e.subject}`)

// Filled-in copies for a visual check: --preview <folder>
const at = process.argv.indexOf('--preview')
if (at > 0) {
  const dir = process.argv[at + 1]
  mkdirSync(dir, { recursive: true })
  const fill = (html, lang) =>
    html
      .replace(/\{\{ if and \.Data\.lang \(eq \.Data\.lang "en"\) \}\}([\s\S]*?)\{\{ else \}\}([\s\S]*?)\{\{ end \}\}/g, (_, en, fr) => (lang === 'en' ? en : fr))
      .replaceAll('{{ .ConfirmationURL }}', 'https://www.legrimoire.quest/auth/v1/verify?token=abc123&type=signup')
      .replaceAll('{{ .SiteURL }}', 'https://www.legrimoire.quest')
      .replaceAll('{{ .NewEmail }}', 'gardien@example.com')
      .replaceAll('{{ .Token }}', '482913')
  for (const name of Object.keys(EMAILS))
    for (const lang of ['fr', 'en']) writeFileSync(path.join(dir, `${name}.${lang}.html`), fill(page(name), lang))
  console.log(`previews → ${dir}`)
}
