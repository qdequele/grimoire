// AI help for the investigator profile (wizard step 6). Pure TypeScript: used by the
// suggest-profile Edge Function and unit-tested with Vitest.

/** Same ids and labels as PROFILE_FIELDS in src/rules/d100.ts (a unit test keeps them in sync). */
export const PROFILE_FIELDS = [
  { id: 'description', label: 'Description', hint: 'apparence, allure, un détail visible' },
  { id: 'ideology', label: 'Idéologie', hint: 'une conviction, une croyance' },
  { id: 'significantPeople', label: 'Personne importante', hint: 'un proche nommé, et pourquoi il compte' },
  { id: 'meaningfulLocations', label: 'Lieu significatif', hint: 'un lieu précis qui le relie à son passé' },
  { id: 'treasuredPossessions', label: 'Bien précieux', hint: 'un objet concret dont il ne se sépare pas' },
  { id: 'traits', label: 'Trait', hint: 'deux ou trois adjectifs ou une manie' },
] as const

export type ProfileKey = (typeof PROFILE_FIELDS)[number]['id']
export type Profile = Record<ProfileKey, string>

export const PROFILE_KEYS = PROFILE_FIELDS.map((f) => f.id) as ProfileKey[]

/** What the wizard knows about the investigator so far. All free text, so it's capped. */
export interface ProfileRequest {
  name: string
  occupation: string
  age: number
  link: string
  /** e.g. { STR: 50, APP: 80 } */
  characteristics: Record<string, number>
  /** Best skills, already labelled, e.g. ["Bibliothèque 70", "Psychologie 60"]. */
  skills: string[]
  /** Fields already written by the keeper: kept as is and used for consistency. */
  profile: Partial<Profile>
  /** Only regenerate this field (the ↻ button). Otherwise fill every empty field. */
  field?: ProfileKey
  /** Language to write in (the keeper's app language). */
  lang: 'fr' | 'en'
}

const clip = (s: unknown, n: number) => (typeof s === 'string' ? s.trim().slice(0, n) : '')

/** Validate and cap untrusted input from the browser. Returns an error message or the clean request. */
export function parseProfileRequest(body: unknown): ProfileRequest | string {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object.'
  const b = body as Record<string, unknown>
  const field = b.field === undefined ? undefined : (b.field as ProfileKey)
  if (field !== undefined && !PROFILE_KEYS.includes(field)) return `field must be one of ${PROFILE_KEYS.join(', ')}.`
  const chars: Record<string, number> = {}
  if (b.characteristics && typeof b.characteristics === 'object') {
    for (const [k, v] of Object.entries(b.characteristics as Record<string, unknown>)) {
      if (/^[A-Z]{2,4}$/.test(k) && typeof v === 'number' && v >= 0 && v <= 200) chars[k] = Math.round(v)
    }
  }
  const profile: Partial<Profile> = {}
  if (b.profile && typeof b.profile === 'object') {
    for (const k of PROFILE_KEYS) {
      const v = clip((b.profile as Record<string, unknown>)[k], 300)
      if (v) profile[k] = v
    }
  }
  return {
    name: clip(b.name, 80),
    occupation: clip(b.occupation, 80),
    age: typeof b.age === 'number' && b.age > 0 && b.age < 150 ? Math.round(b.age) : 0,
    link: clip(b.link, 400),
    characteristics: chars,
    skills: Array.isArray(b.skills) ? b.skills.slice(0, 12).map((s) => clip(s, 60)).filter(Boolean) : [],
    profile,
    field,
    lang: b.lang === 'en' ? 'en' : 'fr',
  }
}

/** Structured output: the six fields, all required (structured outputs limits, see import-draft.ts). */
export function profileSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: Object.fromEntries(PROFILE_FIELDS.map((f) => [f.id, { type: 'string', description: f.hint }])),
    required: [...PROFILE_KEYS],
    additionalProperties: false,
  }
}

export const PROFILE_SYSTEM_PROMPT = `Tu aides un gardien (meneur de jeu) à créer un investigateur pour un jeu d'enquête et d'horreur des années 1920 en Nouvelle-Angleterre.

Tu écris le profil de l'investigateur : six affirmations courtes que le gardien utilisera en partie (une folie passagère peut faire voir la personne importante dans un inconnu, le bien précieux peut être perdu, l'idéologie mise à l'épreuve).

Règles :
- Dans la langue demandée (français sauf indication contraire), une seule phrase courte par champ, souvent sans verbe. Le ton des exemples : « Sa sœur, Mary », « Jamais sans son pistolet », « La science a réponse à tout ».
- Concret et précis : des noms propres, des lieux réels de l'époque, des objets qu'on peut perdre. Pas de généralités.
- Cohérent avec ce qu'on sait : occupation, âge, caractéristiques marquantes (une APP très haute ou un POU faible se voient), meilleures compétences, lien avec l'histoire.
- Les champs déjà écrits par le gardien sont la vérité : garde-les mot pour mot et accorde le reste avec eux.
- Rien de surnaturel : l'investigateur ignore tout du Mythe. Pas de clichés (pas d'« âme tourmentée », pas de « regard perçant »).`

function describe(r: ProfileRequest): string {
  const facts = [
    `Nom : ${r.name || 'pas encore choisi'}`,
    `Occupation : ${r.occupation || 'inconnue'}`,
    r.age ? `Âge : ${r.age} ans` : '',
    Object.keys(r.characteristics).length
      ? `Caractéristiques (sur 100, 50 = moyenne) : ${Object.entries(r.characteristics).map(([k, v]) => `${k} ${v}`).join(', ')}`
      : '',
    r.skills.length ? `Meilleures compétences : ${r.skills.join(', ')}` : '',
    r.link ? `Lien avec l'histoire : ${r.link}` : '',
  ]
  return facts.filter(Boolean).join('\n')
}

export function profileUserPrompt(r: ProfileRequest): string {
  const written = PROFILE_FIELDS.filter((f) => r.profile[f.id])
    .map((f) => `- ${f.label} : ${r.profile[f.id]}`)
    .join('\n')
  const task = r.field
    ? `Propose une nouvelle idée pour le champ « ${PROFILE_FIELDS.find((f) => f.id === r.field)!.label} »${
        r.profile[r.field] ? `, différente de « ${r.profile[r.field]} »` : ''
      }. Recopie les autres champs tels quels (ou laisse-les vides s'ils le sont).`
    : 'Remplis les champs vides. Recopie mot pour mot ceux qui sont déjà écrits.'
  return [
    "L'investigateur :",
    describe(r),
    written ? `Déjà écrit par le gardien :\n${written}` : 'Aucun champ du profil n’est encore écrit.',
    task,
    r.lang === 'en' ? 'Écris les champs en anglais (English), dans le même ton (« His sister, Mary », « Never without his pistol »).' : '',
  ].filter(Boolean).join('\n\n')
}

/**
 * Keep only what was asked for: a single field when regenerating one, otherwise the fields that
 * were empty. The keeper's own text is never overwritten, whatever the model returns.
 */
export function pickSuggestions(r: ProfileRequest, output: Partial<Profile>): Partial<Profile> {
  const wanted = r.field ? [r.field] : PROFILE_KEYS.filter((k) => !r.profile[k])
  const out: Partial<Profile> = {}
  for (const k of wanted) {
    const v = clip(output[k], 300)
    if (v) out[k] = v
  }
  return out
}
