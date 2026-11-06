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
  /** What the skill is for, in a sentence (the players' phones show it when a skill is tapped). */
  what: string
}

export const SKILLS: SkillDef[] = [
  { id: 'anthropology', label: 'Anthropologie', base: 1, what: "Coutumes, croyances et modes de vie des peuples ; comprendre un groupe en l'observant." },
  { id: 'archaeology', label: 'Archéologie', base: 1, what: 'Dater et identifier des vestiges anciens, mener une fouille, repérer un faux.' },
  { id: 'art-craft', label: 'Arts et métiers', base: 5, specialty: true, what: "Pratiquer un art ou un métier précis (peinture, photographie, comédie…) et juger le travail d'autrui dans ce domaine." },
  { id: 'fast-talk', label: 'Baratin', base: 5, what: "Embobiner quelqu'un d'un flot de paroles. L'effet est rapide mais ne dure pas : la personne finit par s'en rendre compte." },
  { id: 'library-use', label: 'Bibliothèque', base: 20, what: 'Trouver un livre, un article de journal ou une archive dans une bibliothèque ou une pile de documents.' },
  { id: 'charm', label: 'Charme', base: 15, what: "Plaire, flatter ou séduire pour obtenir ce que l'on veut, sans menace ni mensonge." },
  { id: 'firearms-handgun', label: 'Armes de poing', base: 20, what: 'Tirer avec un revolver ou un pistolet.' },
  { id: 'firearms-rifle', label: 'Fusils', base: 25, what: 'Tirer avec une carabine, un fusil de chasse ou un fusil à pompe.' },
  { id: 'fighting-brawl', label: 'Corps à corps', base: 25, what: 'Se battre à mains nues ou avec une arme de fortune : coups, prises, couteau, matraque.' },
  { id: 'accounting', label: 'Comptabilité', base: 5, what: "Lire des livres de comptes, repérer une fraude, suivre l'argent d'une affaire." },
  { id: 'drive-auto', label: 'Conduite', base: 20, what: "Conduire une voiture ou un camion, et s'en sortir dans une poursuite ou sur une mauvaise route." },
  { id: 'operate-heavy-machinery', label: "Conduite d'engin lourd", base: 1, what: "Manœuvrer un tracteur, une grue, un bulldozer ou une grosse machine d'usine." },
  { id: 'credit-rating', label: 'Crédit', base: 0, noCreation: true, what: "Fortune et rang social : ce que l'investigateur peut s'offrir et les portes que son nom lui ouvre." },
  { id: 'locksmith', label: 'Crochetage', base: 1, what: 'Ouvrir une serrure sans la clé, forcer un cadenas ou un coffre simple.' },
  { id: 'stealth', label: 'Discrétion', base: 20, what: 'Se déplacer sans bruit, se cacher, passer inaperçu.' },
  { id: 'law', label: 'Droit', base: 5, what: "Lois, procédures et tribunaux : savoir ce que l'on risque et comment s'en tirer." },
  { id: 'listen', label: 'Écouter', base: 20, what: "Entendre un bruit faible, surprendre une conversation, sentir que quelqu'un approche." },
  { id: 'electrical-repair', label: 'Électricité', base: 10, what: 'Réparer ou bricoler un appareil, un circuit ou une installation électrique.' },
  { id: 'ride', label: 'Équitation', base: 5, what: 'Monter à cheval (ou un autre animal), rester en selle et le diriger.' },
  { id: 'dodge', label: 'Esquive', base: 'DEX/2', what: "Éviter un coup ou un projectile : se jeter de côté, se baisser, se mettre à l'abri." },
  { id: 'appraise', label: 'Estimation', base: 5, what: "Estimer la valeur et l'âge d'un objet, reconnaître une contrefaçon." },
  { id: 'climb', label: 'Grimper', base: 20, what: 'Escalader un mur, un arbre ou une falaise, avec ou sans corde.' },
  { id: 'history', label: 'Histoire', base: 5, what: "Le passé d'un pays, d'une ville, d'une famille ou d'un bâtiment." },
  { id: 'disguise', label: 'Imposture', base: 5, what: "Changer d'allure, de voix et de manières pour passer pour quelqu'un d'autre." },
  { id: 'intimidate', label: 'Intimidation', base: 15, what: "Faire céder quelqu'un par la peur, la menace ou la force." },
  { id: 'throw', label: 'Lancer', base: 20, what: 'Lancer un objet avec précision : pierre, couteau, corde, bouteille.' },
  { id: 'language-own', label: 'Langue maternelle', base: 'EDU', what: 'Parler, lire et écrire sa langue maternelle ; comprendre un texte ardu ou ancien.' },
  { id: 'language-other', label: 'Langues', base: 1, specialty: true, what: 'Parler, lire et écrire une langue étrangère (indiquée entre parenthèses).' },
  { id: 'mechanical-repair', label: 'Mécanique', base: 10, what: 'Réparer un moteur, une machine ou un mécanisme ; fabriquer un outil simple.' },
  { id: 'medicine', label: 'Médecine', base: 1, what: "Diagnostiquer et soigner maladies et blessures graves, opérer, établir la cause d'un décès." },
  { id: 'cthulhu-mythos', label: 'Mythe de Cthulhu', base: 0, noCreation: true, what: "Savoir interdit sur les puissances cachées de l'univers. Il ne s'apprend pas à la création : il vient en jeu, au prix de la santé mentale." },
  { id: 'swim', label: 'Nager', base: 20, what: 'Nager, plonger, rester à flot dans une eau agitée.' },
  { id: 'natural-world', label: 'Naturalisme', base: 10, what: "Plantes, animaux et temps qu'il fera ; remarquer une trace ou un comportement inhabituel." },
  { id: 'occult', label: 'Occultisme', base: 5, what: 'Sociétés secrètes, magie populaire, astrologie, vieux grimoires connus… du savoir, pas de pouvoir réel.' },
  { id: 'navigate', label: 'Orientation', base: 10, what: 'Trouver son chemin, lire une carte ou les étoiles, estimer une distance.' },
  { id: 'persuade', label: 'Persuasion', base: 10, what: "Convaincre par des arguments, en prenant le temps. L'effet dure : la personne est vraiment d'accord." },
  { id: 'sleight-of-hand', label: 'Pickpocket', base: 10, what: 'Escamoter un objet, faire les poches, glisser quelque chose sans être vu.' },
  { id: 'pilot', label: 'Pilotage', base: 1, specialty: true, what: 'Piloter un avion, un bateau ou un dirigeable (indiqué entre parenthèses).' },
  { id: 'track', label: 'Pister', base: 10, what: 'Suivre une personne ou un animal à ses traces.' },
  { id: 'first-aid', label: 'Premiers soins', base: 30, what: "Soigner une blessure sur le moment : pansement, attelle, ranimer quelqu'un d'inconscient." },
  { id: 'psychoanalysis', label: 'Psychanalyse', base: 1, what: 'Apaiser une crise de folie, aider un esprit ébranlé à retrouver un peu de santé mentale.' },
  { id: 'psychology', label: 'Psychologie', base: 10, what: 'Lire les gens : deviner une intention, repérer un mensonge, sentir un malaise.' },
  { id: 'jump', label: 'Sauter', base: 20, what: 'Sauter loin ou haut, franchir un fossé, amortir une chute.' },
  { id: 'science', label: 'Sciences', base: 1, specialty: true, what: "Connaissances et méthodes d'une science précise (chimie, biologie, astronomie…)." },
  { id: 'science-2', label: 'Sciences (autre)', base: 1, specialty: true, what: "Connaissances et méthodes d'une science précise (chimie, biologie, astronomie…)." },
  { id: 'survival', label: 'Survie', base: 10, specialty: true, what: 'Tenir dans un milieu hostile (désert, montagne, mer…) : trouver eau, abri et nourriture.' },
  { id: 'spot-hidden', label: 'Trouver Objet Caché', base: 25, what: 'Repérer un indice, une porte dérobée, un objet caché ou un détail qui cloche.' },
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
