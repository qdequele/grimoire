// Every French text the screens can show, for the completeness test (en.test.ts). Node only.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ERA_CHOICES, LENGTHS, PLACE_CHOICES, THREATS, TONES } from '@/stories/create/brief'
import {
  CHARACTERISTIC_INFO, CREDIT_TIERS, NAME_ORIGINS, OCCUPATIONS, PROFILE_FIELDS, SKILLS,
} from '@/rules/d100'
import { PLACE_LABEL, PRESET_LABEL, TIME_LABEL } from '@/screen/ambiance'
import { LEVEL_LABEL } from '@/companion/rolls'
import { KIND_LABEL, KIND_PLACEHOLDER, STATUS_LABEL } from '@/feedback/kinds'
import { BRUSHES, MAP_KIND_LABEL } from '@/maps/editor/labels'

/** Texts that reach t() from data rather than from a t('…') literal in the code. */
export function dataKeys(): string[] {
  return [
    ...SKILLS.flatMap((s) => [`compétence:${s.label}`, s.what]),
    'compétence:Sciences', // "Sciences (autre)" with a specialty
    ...OCCUPATIONS.flatMap((o) => [o.label, o.hint ?? '', ...Object.values(o.specialties ?? {})]),
    ...Object.values(CHARACTERISTIC_INFO).flatMap((c) => [c.short, c.name, c.what]),
    ...PROFILE_FIELDS.flatMap((f) => [f.label, f.placeholder]),
    ...CREDIT_TIERS.map(([, label]) => label),
    ...Object.values(NAME_ORIGINS).map((o) => o.label),
    // Story creator: choices, suggestions, step titles and labels passed as props
    ...[...TONES, ...THREATS, ...LENGTHS].flatMap((x) => [x.label, x.hint]),
    ...ERA_CHOICES, ...PLACE_CHOICES,
    'Créer', 'Cadre', 'Ambiance', 'Intrigue', 'Table', 'Plan', 'Écriture',
    'Ton', 'Menace', 'Durée', 'Époque', 'Lieu', 'Le mystère', 'Idées et incontournables', 'Au choix de l’IA', 'surprends-moi',
    // create-story function messages
    'Cette histoire ne peut pas être écrite. Change quelques réponses et réessaie.', 'Réponse trop longue. Réessaie.',
    'Création introuvable.', 'Les scènes sont déjà en cours d’écriture.', 'Le plan reçu est incomplet. Réessaie.',
    'Écris d’abord le plan de l’histoire.', 'Les scènes demandées manquent dans la réponse de l’IA. Réessaie.', 'Création impossible.',
    'L’IA a mis trop de temps à répondre. Réessaie.', 'Plan incomplet. Réessaie avec « Compléter le plan ».',
    'Décris le lieu en une phrase au moins.', 'Description trop longue (1500 caractères au plus).', 'Plan impossible. Réessaie.', // map action
    'Art déco', 'Classique', // SKIN_LABEL (theme/skin.ts touches the DOM on import)
    // Labels passed as props, then translated by the component (Section, NameForm, Stat, nav).
    'Histoires', 'Bibliothèque', 'Mes histoires', 'Importer', 'Investigateurs', 'Joueurs', 'Réglages',
    'Renommer', 'Ajouter un joueur', 'PV', 'Chance', 'PM', '{label} : {detail}',
    'SAN', 'Fiche', 'Dés', 'Carnet', // companion stat tiles and sheet tabs
    ...Object.values(LEVEL_LABEL), 'Réussite', 'Majeure', 'Extrême', // companion rolls
    'Concept', 'Caractéristiques', 'Valeurs dérivées', "Compétences d'occupation", 'Intérêts personnels', 'Profil', 'Récapitulatif',
    // Messages built outside components, shown through t() / tMsg().
    'Tu as déjà un joueur avec ce prénom.',
    'Cette histoire n’a encore aucune scène.',
    'Aucun fichier story.json dans ce pack.',
    'Ce pack contient plusieurs histoires : importe-les une par une.',
    'story.json n’est pas un JSON valide.',
    'format doit valoir "grimoire-story/1".',
    'meta.id manquant.', 'meta.title manquant.', 'meta.lang manquant.', 'Aucune scène.',
    'Ignoré (hors du dossier de l’histoire)',
    'Archive .zip illisible.',
    'Import impossible.', 'Suggestion impossible.',
    // suggest-profile function messages
    "L'aide IA n'est pas configurée sur ce serveur.", "Le service d'IA est occupé. Réessaie dans une minute.",
    'Connecte-toi pour utiliser l’aide IA.', 'Pas de suggestion possible pour ce profil.', 'Réponse de l’IA illisible. Réessaie.',
    "Ce lien n'est plus valide.",
    ...Object.values(PRESET_LABEL), // ambiance screen presets
    ...Object.values(PLACE_LABEL), // ambiance screen drawn décors
    ...Object.values(TIME_LABEL), // ambiance screen time of day
    ...Object.values(KIND_LABEL), ...Object.values(KIND_PLACEHOLDER), ...Object.values(STATUS_LABEL), // feedback dialog and inbox
    'Confidentialité', 'Conditions', 'Aide', // LegalLinks (legal/LegalPage.tsx)
    // Free tools (src/tools/): nav labels, blank sheet's statuses, derived values and weapon columns.
    'Lanceur de dés', 'Créer un investigateur', 'Fiche vierge', 'Plans', 'Scénarios',
    ...Object.values(MAP_KIND_LABEL), ...BRUSHES.map((b) => b.label), // map maker (src/maps/editor/labels.ts)
    'Blessure grave', 'Inconscient', 'Mourant', 'Folie passagère', 'Folie durable',
    'Mouvement', 'Impact', 'Carrure', 'Arme', 'Valeur', 'Dégâts', 'Portée', 'Attaques', 'Munitions',
  ].filter(Boolean)
}

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? (f === 'i18n' ? [] : files(p)) : /\.tsx?$/.test(f) && !/\.test\./.test(f) ? [p] : []
  })

/** The French texts passed literally to t('…') / t.n(n, '…', '…') in the app's code. */
export function literalKeys(): string[] {
  const str = String.raw`(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")`
  const call = new RegExp(String.raw`\bt\(\s*${str}`, 'g')
  const plural = new RegExp(String.raw`\bt\.n\([^,]+,\s*${str},\s*${str}`, 'g')
  const keys = new Set<string>()
  for (const f of files('src')) {
    const code = readFileSync(f, 'utf8')
    for (const m of code.matchAll(call)) keys.add(m[1] ?? m[2])
    for (const m of code.matchAll(plural)) { keys.add(m[1] ?? m[2]); keys.add(m[3] ?? m[4]) }
  }
  return [...keys].map((k) => k.replace(/\\(.)/g, '$1'))
}

