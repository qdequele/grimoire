// Investigator creation data for the d100 rules (simplified creation, as in the legacy app).
// Skill ids follow spec/STORY_FORMAT.md §4.3, so story rolls can find an investigator's skills.
// Labels are French for now (the app's language); English comes with the i18n work.

export const CHARACTERISTICS = ['STR', 'CON', 'SIZ', 'DEX', 'APP', 'INT', 'POW', 'EDU'] as const
export type Characteristic = (typeof CHARACTERISTICS)[number]

export const CHARACTERISTIC_INFO: Record<Characteristic, { short: string; name: string; what: string; dice: '3D6' | '2D6+6' }> = {
  STR: { short: 'FOR', name: 'Force', what: 'Puissance physique.', dice: '3D6' },
  CON: { short: 'CON', name: 'Constitution', what: 'Santé et vigueur.', dice: '3D6' },
  SIZ: { short: 'TAI', name: 'Taille', what: 'Taille et poids.', dice: '2D6+6' },
  DEX: { short: 'DEX', name: 'Dextérité', what: 'Agilité, vitesse, ordre en combat.', dice: '3D6' },
  APP: { short: 'APP', name: 'Apparence', what: 'Séduction.', dice: '3D6' },
  INT: { short: 'INT', name: 'Intelligence', what: 'Logique et intuition.', dice: '2D6+6' },
  POW: { short: 'POU', name: 'Pouvoir', what: 'Volonté. Donne la SAN et les PM.', dice: '3D6' },
  EDU: { short: 'ÉDU', name: 'Éducation', what: 'Savoir accumulé.', dice: '2D6+6' },
}

/** Values to spread over the eight characteristics. */
export const CHARACTERISTIC_ARRAY = [40, 50, 50, 50, 60, 60, 70, 80]
/** Values to spread over the eight occupation skills plus Credit Rating. */
export const OCCUPATION_ARRAY = [70, 60, 60, 50, 50, 50, 40, 40, 40]
export const OCCUPATION_SKILL_COUNT = 8
export const PERSONAL_INTEREST_COUNT = 4
export const PERSONAL_INTEREST_BONUS = 20

/** Base value: a number, half DEX, or EDU. */
export type SkillBase = number | 'DEX/2' | 'EDU'

export interface SkillDef {
  id: string
  label: string
  base: SkillBase
  /** Needs a specialty, e.g. Arts et métiers (Photographie). */
  specialty?: boolean
  /** Not available at creation. */
  noCreation?: boolean
}

export const SKILLS: SkillDef[] = [
  { id: 'anthropology', label: 'Anthropologie', base: 1 },
  { id: 'archaeology', label: 'Archéologie', base: 1 },
  { id: 'art-craft', label: 'Arts et métiers', base: 5, specialty: true },
  { id: 'fast-talk', label: 'Baratin', base: 5 },
  { id: 'library-use', label: 'Bibliothèque', base: 20 },
  { id: 'charm', label: 'Charme', base: 15 },
  { id: 'firearms-handgun', label: 'Armes de poing', base: 20 },
  { id: 'firearms-rifle', label: 'Fusils', base: 25 },
  { id: 'fighting-brawl', label: 'Corps à corps', base: 25 },
  { id: 'accounting', label: 'Comptabilité', base: 5 },
  { id: 'drive-auto', label: 'Conduite', base: 20 },
  { id: 'operate-heavy-machinery', label: "Conduite d'engin lourd", base: 1 },
  { id: 'credit-rating', label: 'Crédit', base: 0, noCreation: true },
  { id: 'locksmith', label: 'Crochetage', base: 1 },
  { id: 'stealth', label: 'Discrétion', base: 20 },
  { id: 'law', label: 'Droit', base: 5 },
  { id: 'listen', label: 'Écouter', base: 20 },
  { id: 'electrical-repair', label: 'Électricité', base: 10 },
  { id: 'ride', label: 'Équitation', base: 5 },
  { id: 'dodge', label: 'Esquive', base: 'DEX/2' },
  { id: 'appraise', label: 'Estimation', base: 5 },
  { id: 'climb', label: 'Grimper', base: 20 },
  { id: 'history', label: 'Histoire', base: 5 },
  { id: 'disguise', label: 'Imposture', base: 5 },
  { id: 'intimidate', label: 'Intimidation', base: 15 },
  { id: 'throw', label: 'Lancer', base: 20 },
  { id: 'language-own', label: 'Langue maternelle', base: 'EDU' },
  { id: 'language-other', label: 'Langues', base: 1, specialty: true },
  { id: 'mechanical-repair', label: 'Mécanique', base: 10 },
  { id: 'medicine', label: 'Médecine', base: 1 },
  { id: 'cthulhu-mythos', label: 'Mythe de Cthulhu', base: 0, noCreation: true },
  { id: 'swim', label: 'Nager', base: 20 },
  { id: 'natural-world', label: 'Naturalisme', base: 10 },
  { id: 'occult', label: 'Occultisme', base: 5 },
  { id: 'navigate', label: 'Orientation', base: 10 },
  { id: 'persuade', label: 'Persuasion', base: 10 },
  { id: 'sleight-of-hand', label: 'Pickpocket', base: 10 },
  { id: 'pilot', label: 'Pilotage', base: 1, specialty: true },
  { id: 'track', label: 'Pister', base: 10 },
  { id: 'first-aid', label: 'Premiers soins', base: 30 },
  { id: 'psychoanalysis', label: 'Psychanalyse', base: 1 },
  { id: 'psychology', label: 'Psychologie', base: 10 },
  { id: 'jump', label: 'Sauter', base: 20 },
  { id: 'science', label: 'Sciences', base: 1, specialty: true },
  { id: 'science-2', label: 'Sciences (autre)', base: 1, specialty: true },
  { id: 'survival', label: 'Survie', base: 10, specialty: true },
  { id: 'spot-hidden', label: 'Trouver Objet Caché', base: 25 },
]

export const SKILL_BY_ID = new Map(SKILLS.map((s) => [s.id, s]))
export const SOCIAL_SKILLS = ['fast-talk', 'charm', 'intimidate', 'persuade']

export interface Occupation {
  id: string
  label: string
  /** Skills that come with the occupation. */
  skills: string[]
  /** Must also take one social skill. */
  social: boolean
  /** Default specialties, by skill id. */
  specialties?: Record<string, string>
  hint?: string
}

export const OCCUPATIONS: Occupation[] = [
  { id: 'antiquarian', label: 'Antiquaire', skills: ['art-craft', 'library-use', 'appraise', 'history', 'language-other', 'spot-hidden'], social: true },
  {
    id: 'private-eye', label: 'Détective privé',
    skills: ['art-craft', 'library-use', 'law', 'disguise', 'psychology', 'spot-hidden'], social: true,
    specialties: { 'art-craft': 'Photographie' },
  },
  {
    id: 'dilettante', label: 'Dilettante', skills: ['art-craft', 'firearms-rifle', 'ride', 'language-other'], social: true,
    hint: 'Combat à distance : Fusils par défaut ; prends Armes de poing dans les choix si tu préfères.',
  },
  {
    id: 'author', label: 'Écrivain', skills: ['art-craft', 'library-use', 'history', 'language-own', 'language-other', 'psychology'], social: false,
    specialties: { 'art-craft': 'Littérature' },
    hint: 'Parmi les compétences au choix : Naturalisme ou Occultisme, plus une compétence libre.',
  },
  {
    id: 'police-detective', label: 'Inspecteur', skills: ['disguise', 'firearms-handgun', 'law', 'listen', 'psychology', 'spot-hidden'], social: true,
    hint: 'Imposture peut être remplacée par Arts et métiers (Comédie).',
  },
  {
    id: 'journalist', label: 'Journaliste', skills: ['art-craft', 'library-use', 'history', 'language-own', 'psychology'], social: true,
    specialties: { 'art-craft': 'Photographie' },
  },
  {
    id: 'doctor', label: 'Médecin', skills: ['language-other', 'medicine', 'first-aid', 'psychology', 'science', 'science-2'], social: false,
    specialties: { 'language-other': 'Latin', science: 'Biologie', 'science-2': 'Pharmacologie' },
    hint: 'Les compétences au choix sont académiques ou personnelles (un psychiatre prendrait Psychanalyse).',
  },
  {
    id: 'professor', label: 'Professeur', skills: ['library-use', 'language-own', 'language-other', 'psychology'], social: false,
    hint: 'Les compétences au choix sont académiques ou personnelles.',
  },
  {
    id: 'custom', label: 'Autre (à inventer)', skills: [], social: false,
    hint: 'Choisis 8 compétences qui correspondent au métier inventé, avec l’accord du gardien.',
  },
]

export const OCCUPATION_BY_ID = new Map(OCCUPATIONS.map((o) => [o.id, o]))

export const PROFILE_FIELDS = [
  { id: 'description', label: 'Description', placeholder: 'Grand, mal rasé, toujours un carnet' },
  { id: 'ideology', label: 'Idéologie', placeholder: 'La science a réponse à tout' },
  { id: 'significantPeople', label: 'Personne importante', placeholder: 'Sa sœur, Mary' },
  { id: 'meaningfulLocations', label: 'Lieu significatif', placeholder: 'Née et élevée à New York' },
  { id: 'treasuredPossessions', label: 'Bien précieux', placeholder: 'Jamais sans son pistolet' },
  { id: 'traits', label: 'Trait', placeholder: 'Curieux, têtu' },
] as const
export type ProfileField = (typeof PROFILE_FIELDS)[number]['id']

export const CREDIT_TIERS: Array<[max: number, label: string]> = [
  [0, 'sans le sou'],
  [9, 'pauvre'],
  [49, 'classe moyenne'],
  [89, 'aisé'],
  [98, 'riche'],
  [Infinity, 'immensément riche'],
]

export const creditTier = (v: number) => CREDIT_TIERS.find(([max]) => v <= max)![1]

export function skillLabel(id: string, specialty?: string): string {
  const label = SKILL_BY_ID.get(id)?.label ?? id
  return specialty ? `${label.replace(' (autre)', '')} (${specialty})` : label
}

/** Name ideas by origin, for the name generator. 1920s New England and its immigrant communities. */
export const NAME_ORIGINS: Record<string, { label: string; f: string[]; m: string[]; surnames: string[] }> = {
  ne: {
    label: 'Nouvelle-Angleterre',
    f: ['Abigail', 'Alice', 'Beatrice', 'Clara', 'Dorothy', 'Edith', 'Eleanor', 'Esther', 'Florence', 'Grace', 'Harriet', 'Helen', 'Irene', 'Lillian', 'Mabel', 'Margaret', 'Martha', 'Mildred', 'Ruth', 'Sarah', 'Vivian', 'Winifred'],
    m: ['Albert', 'Ambrose', 'Arthur', 'Calvin', 'Charles', 'Edgar', 'Edmund', 'Elias', 'Ezra', 'Frederick', 'Harold', 'Henry', 'Horace', 'Josiah', 'Lester', 'Nathaniel', 'Oliver', 'Silas', 'Theodore', 'Walter', 'Warren', 'Wilbur'],
    surnames: ['Ashby', 'Bishop', 'Bradford', 'Chandler', 'Coffin', 'Crane', 'Dexter', 'Eaton', 'Fairbanks', 'Gardner', 'Hale', 'Hawthorne', 'Lathrop', 'Marsh', 'Peabody', 'Prescott', 'Sawyer', 'Thayer', 'Wainwright', 'Whipple', 'Winslow'],
  },
  irl: {
    label: 'Irlandaise',
    f: ['Bridget', 'Catherine', 'Delia', 'Eileen', 'Honora', 'Kathleen', 'Maeve', 'Mary', 'Nora', 'Rose', 'Sheila'],
    m: ['Brendan', 'Cornelius', 'Daniel', 'Dennis', 'Francis', 'James', 'Michael', 'Patrick', 'Seamus', 'Terence', 'Thomas'],
    surnames: ['Brennan', 'Callahan', 'Doyle', 'Fitzgerald', 'Flanagan', 'Kelleher', 'McCarthy', 'Moriarty', "O'Brien", "O'Connell", 'Quinn', 'Sullivan'],
  },
  ita: {
    label: 'Italienne',
    f: ['Angela', 'Carmela', 'Concetta', 'Giulia', 'Lucia', 'Maria', 'Rosa', 'Teresa'],
    m: ['Antonio', 'Carmine', 'Enzo', 'Giovanni', 'Giuseppe', 'Luigi', 'Salvatore', 'Vincenzo'],
    surnames: ['Bellini', 'Caruso', 'Esposito', 'Ferraro', 'Lombardi', 'Moretti', 'Romano', 'Russo', 'Santoro'],
  },
  fra: {
    label: 'Franco-canadienne',
    f: ['Amélie', 'Blanche', 'Céline', 'Germaine', 'Jeanne', 'Lucienne', 'Marguerite', 'Yvonne'],
    m: ['Alphonse', 'Armand', 'Gaston', 'Henri', 'Jules', 'Lucien', 'Marcel', 'René'],
    surnames: ['Beaulieu', 'Bouchard', 'Dubois', 'Gagnon', 'Lavoie', 'Leblanc', 'Pelletier', 'Thibodeau'],
  },
  jew: {
    label: "Juive d'Europe de l'Est",
    f: ['Esther', 'Golda', 'Hannah', 'Miriam', 'Rebecca', 'Rose', 'Sadie', 'Sophie'],
    m: ['Abraham', 'Benjamin', 'Isaac', 'Jacob', 'Morris', 'Nathan', 'Samuel', 'Solomon'],
    surnames: ['Abramowitz', 'Bernstein', 'Cohen', 'Feldman', 'Goldberg', 'Kaplan', 'Levine', 'Rosen', 'Weiss'],
  },
  ger: {
    label: 'Allemande',
    f: ['Elsa', 'Frieda', 'Greta', 'Hilda', 'Ilse', 'Lotte', 'Margarete'],
    m: ['Ernst', 'Friedrich', 'Heinrich', 'Karl', 'Ludwig', 'Otto', 'Wilhelm'],
    surnames: ['Bauer', 'Fischer', 'Hartmann', 'Klein', 'Krüger', 'Schmidt', 'Vogel', 'Wagner'],
  },
}
