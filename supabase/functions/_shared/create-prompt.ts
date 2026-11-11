// Instructions for the story creator. The system prompt is the same for every call (outline,
// scenes, ideas) and byte-for-byte stable, so it is served from the prompt cache; everything that
// changes (the brief, the outline, what's written so far) goes in the user message.
import { draftAnswerFormat, draftContext, SCREEN_PLACES, SCREEN_PRESETS, SCREEN_TIMES, SOUND_IDS, type ImportDraft } from './import-draft.ts'
import { SAMPLE_STORY, SOUNDS, STORY_FORMAT_MD } from './spec-bundle.ts'
import {
  IDEA_FIELDS,
  lengthOf,
  npcDetailed,
  outlineScenes,
  THREATS,
  TONES,
  type IdeaField,
  type StoryBrief,
  type StoryOutline,
} from './story-create.ts'

const LANG_NAME: Record<string, string> = { fr: 'French', en: 'English' }

const soundList = (list: typeof SOUNDS.ambience) =>
  list
    .filter((s) => s.status !== 'planned')
    .map((s) => `${s.id} (${(s.tags ?? []).join(', ')})`)
    .join('; ')

/**
 * Names from published games and fiction that must not appear. Not exhaustive: the prompt asks for
 * invented names in general; these are the ones models reach for first.
 */
export const FORBIDDEN_NAMES = [
  'Cthulhu', 'Call of Cthulhu', 'Chaosium', 'Mythos', 'Lovecraft', 'Arkham', 'Miskatonic', 'Innsmouth', 'Dunwich',
  'Kingsport', 'Necronomicon', 'Yog-Sothoth', 'Nyarlathotep', 'Azathoth', 'Shub-Niggurath', 'Hastur', 'Dagon',
  'Deep Ones', 'Mi-Go', 'Shoggoth', 'Elder Things', 'R\'lyeh', 'Delta Green',
]

// The rules are exported section by section: the create-story function joins them into its system
// prompt, and the MCP connector (story-mcp.ts) serves the same sections to ChatGPT or Claude through
// its guide tool, so both ways of creating a story follow one set of rules.

/** Originality rules: the same for Grimoire's own Claude and for a chat app writing through MCP. */
export const ORIGINALITY_RULES = `# Originality (non-negotiable)

- Invent everything: plot, places, people, entities, tomes, cults. Never retell, adapt or closely imitate a published scenario, campaign, novel or film, even if the keeper's answers resemble one: take the idea somewhere new.
- Never use names from published games or fiction. In particular none of: ${FORBIDDEN_NAMES.join(', ')}. No entity, book or town from H. P. Lovecraft's stories or their imitators. Invent your own entities and forbidden books with fresh names. Real historical places and public events of the era are fine.
- Rules vocabulary is generic d100: skills, characteristics, SAN (sanity), luck, hit points. Don't name any commercial game line. (Skill ids from the format below, such as "cthulhu-mythos" for forbidden lore, are technical ids and may be used in rolls; never write such names in the story's text.)`

/** What a good, playable Grimoire story looks like. */
export const CRAFT_RULES = `# What makes a good Grimoire story

The app shows one scene per screen: a one-line lead, "read to the players" paragraphs, then the "scene flow": numbered steps in play order, each with at most one roll and what happens on success, failure, or a failed pushed roll. Rolls become buttons. The keeper glances at it mid-session, so it must be scannable and in play order.

- A clear secret: who did what, why, and what happens if nobody intervenes. Everything else follows from it.
- Investigation first: the truth is found through clues, interviews and places. Every clue the investigators must find is reachable in at least two ways (two scenes, or a roll and a non-roll way). Failure slows them down or costs something, it never ends the story.
- Escalation: unease → discovery → confrontation. The supernatural is shown late and sparingly. The climax gives the investigators a real choice and a way to win at a cost.
- Scenes: one per location or dramatic situation. A one-line lead says what the scene is for. Read-aloud paragraphs are short, sensory, in second person plural, and never tell the players what they feel or decide.
- Flow steps: one decision or one roll each, in the order things happen at the table. Put the consequence in success/failure (and pushed when it makes sense), not in the text. Terse keeper notes, no flourish.
- Choices: when the players can go several ways at one point (give the object back or burn it, flee or fight), write the step that sets up the choice, then one step per choice right after it with "branch" naming the choice ("If she burns the letters"). The app shows them as lettered options under that step.
- NPCs: a name that fits the place and era, a want, a secret or a fear, what they know (the "knows" list), how they react. Humans have characteristics around 40-70; creatures get hit points, attacks, armor, a SAN loss like "1/1D8" and special abilities.
- Rolls use the skill ids and characteristic codes listed in the format below (e.g. "spot-hidden", "library-use", "persuade", "STR"). SAN rolls use "success/failure" like "1/1D6"; damage uses dice like "1D6+1". Hard or extreme difficulty only when the fiction calls for it.
- Use [[scene-id]] to link scenes and {{npc:id}} to mention NPCs in text.
- Sounds: pick up to 3 ambience ids that fit each scene and any matching sound effects, from the allowed ids only. Leave them empty when nothing fits.
- Ambiance screen: give each scene the drawn décor ("place") that matches where it happens, the atmosphere ("preset": weather and mood) and the time of day ("time"), from the lists under "Ambiance screen". Use "" for a place when none fits; the strong atmospheres (abyss, ritual, nightmare, bulb, blaze) only for the scenes that call for them.
- Respect the keeper's lines and veils exactly: content they ask to avoid never appears, not even off-screen or hinted at.`

/** What each ambiance screen value looks like, for the model. A test checks every value of the format is described. */
export const PLACE_HINTS: Record<string, string> = {
  church: 'a church or chapel seen from outside, a few graves',
  graveyard: 'a graveyard behind an iron fence, a mausoleum',
  crypt: 'vaults, a crypt, catacombs, a cellar, tunnels: an underground room with candles',
  castle: 'a castle or fortress on a crag',
  manor: 'a large old house, a manor, a mansion, seen from its grounds',
  library: 'a library, archives, a study: shelves of books',
  police: 'a police station, a jail, seen from the street',
  forest: 'woods, a forest, a clearing',
  harbour: 'a harbour, docks, a pier, the sea, a lighthouse',
  street: 'a town street at night: houses, lit windows, street lamps',
  asylum: 'an asylum, a sanatorium, a hospital: a long building behind walls and gates',
  station: 'a railway station: a platform under a canopy, a waiting train, a clock',
  swamp: 'a swamp, a marsh, a bayou: dead trees in still water, a shack on stilts',
  dig: 'an archaeological dig in the desert: tents, trenches, ruined columns, dunes',
  mountain: 'mountains: snowy peaks, a pass, a refuge or a cabin among firs',
  museum: 'a museum hall: display cases, statues, a skeleton, tall windows',
  cavern: 'a natural cave: rock, stalactites, an underground lake, a torch (not a built crypt)',
  farm: 'a farm: farmhouse, barn, windmill, fields, a scarecrow',
  ship: 'on the deck of a ship at sea: masts, rigging, the rail, the waves',
  fair: 'a fairground or a circus: a big wheel, tents, strings of lights',
  mine: 'a mine: the headframe over the shaft, rails, carts, a tunnel mouth in the hill',
  moor: 'a moor: standing stones, heather, a lone tree, low hills',
}
export const TIME_HINTS: Record<string, string> = {
  day: 'daylight: a bright sky (grey under rain, storm or snow), the sun, windows unlit',
  dusk: 'dawn or dusk: violet sky, a warm glow at the horizon',
  night: 'night: dark sky, the moon, lit windows and lamps',
}
export const PRESET_HINTS: Record<string, string> = {
  fog: 'mist low over the ground',
  rain: 'rain falling',
  candle: 'warm flickering light from a candle or lamp',
  hearth: 'a live fire in a fireplace',
  night: 'deep blue night',
  storm: 'heavy rain and lightning',
  dust: 'dust motes in warm daylight',
  snow: 'snow falling in a cold night',
  abyss: 'deep water: green murk, light from the surface, bubbles',
  ritual: 'a sickly green glow breathing, spores in the air: a ritual, a presence',
  nightmare: 'dark reds, the screen throbbing like a heartbeat: dread, madness, a dream',
  bulb: 'a bare electric bulb that keeps failing: asylum, hospital, basement',
  blaze: 'a building on fire: red glow, smoke, embers',
}

/** Sound ids the library has (planned sounds left out), and the ambiance screen's values. */
export const SOUND_RULES = `# Allowed sound ids

Ambience: ${soundList(SOUNDS.ambience)}
Sound effects: ${soundList(SOUNDS.sfx)}

# Ambiance screen

The keeper can show each scene on a TV at the table: a drawn décor under a living atmosphere. A scene's "place", "preset" and "time" choose them (in story.json: "screen": { "place": …, "preset": …, "time": … }). The preset is the weather and the mood, the time the light: any preset goes with any time (rain by day, snow at night).

Places: ${SCREEN_PLACES.map((p) => `${p} (${PLACE_HINTS[p] ?? p})`).join('; ')}
Presets: ${SCREEN_PRESETS.map((p) => `${p} (${PRESET_HINTS[p] ?? p})`).join('; ')}
Times: ${SCREEN_TIMES.map((p) => `${p} (${TIME_HINTS[p] ?? p})`).join('; ')}`

export const EXAMPLE_INTRO = 'Match this level of detail and this tone for scenes, flow steps and NPCs (but not its plot: write something new):'

export function createSystemPrompt(): string {
  return `You write ORIGINAL scenarios for tabletop horror/investigation games using d100 percentile rules, as Grimoire stories that a game master (the "keeper") runs scene by scene in the Grimoire app.

${ORIGINALITY_RULES}

${CRAFT_RULES}
- Fields you have nothing for: "" for text, [] for lists, 0 for bonus.

${SOUND_RULES}

# The Grimoire story format (for reference: you output the simpler shape you're given)

${STORY_FORMAT_MD}

# A complete example story in the final format

${EXAMPLE_INTRO}

${JSON.stringify(SAMPLE_STORY, null, 1)}`
}

/** The keeper's answers, as the model reads them. Empty answers are left to the model. */
export function describeBrief(b: StoryBrief): string {
  const tone = TONES.find((x) => x.id === b.tone)
  const threat = THREATS.find((x) => x.id === b.threat)
  const length = lengthOf(b.length)
  const or = (v: string, fallback: string) => v || fallback
  return [
    `- Era: ${or(b.era, 'your choice')}`,
    `- Place: ${or(b.place, 'your choice')}`,
    `- Tone: ${tone ? tone.prompt : 'your choice'}`,
    `- Threat: ${threat ? threat.prompt : 'your choice'}`,
    `- Central mystery: ${or(b.hook, 'your choice')}`,
    `- Investigators: ${b.investigators}`,
    `- Length: ${length.prompt}, so ${length.scenes[0]} to ${length.scenes[1]} scenes in all`,
    b.ideas ? `- The keeper's ideas and must-haves:\n${b.ideas}` : '',
    b.avoid ? `- Content to avoid entirely (lines and veils):\n${b.avoid}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

const language = (b: StoryBrief) => `Write every text in ${LANG_NAME[b.lang] ?? b.lang}.`

export function outlineUserPrompt(b: StoryBrief, revise?: { previous: StoryOutline; notes: string }): string {
  const length = lengthOf(b.length)
  const parts = [
    'The keeper wants a new story. Their answers:',
    describeBrief(b),
    language(b),
  ]
  if (revise) {
    parts.push(
      'Your previous outline:',
      JSON.stringify(revise.previous),
      revise.notes
        ? `The keeper's notes on it:\n${revise.notes}\n\nRevise the outline following these notes. Keep what they don't ask to change, ids included.`
        : 'The keeper wants another take: write a clearly different outline (another secret, other places and people).',
    )
  }
  parts.push(
    `Write the FRAME of the outline: title, pitch, content warnings, the secret, ${length.scenes[0]} to ${length.scenes[1]} scenes grouped in acts (one act is fine for a short story), each with its id, title and summary, and every NPC with a short description. The clues, the links between scenes and the keeper's overview come in a second step; the full scenes are written later.`,
  )
  return parts.join('\n\n')
}

/** Second outline call: clues, NPCs present and next scenes for every scene, and the keeper's overview. */
export function outlineDetailsPrompt(b: StoryBrief, o: StoryOutline): string {
  return [
    "The keeper's answers:",
    describeBrief(b),
    language(b),
    'The outline so far (title, secret, scenes, NPCs):',
    JSON.stringify({ title: o.title, secret: o.overview.secret, acts: o.acts.map((a) => ({ id: a.id, title: a.title, scenes: a.scenes.map((s) => ({ id: s.id, title: s.title, summary: s.summary })) })), npcs: o.npcs }),
    [
      'Now complete it, using only the ids above:',
      '- For EVERY scene (same id): the clues found there, the ids of the NPCs present, the ids of the scenes it can lead to.',
      '- The keeper\'s overview: the usual path (one line per scene with [[scene-id]]), the clues the investigators must not miss and where, the main branches, how to get stuck players moving, and a few tips.',
      '- The clues must lead the investigators to the secret: each important truth reachable from at least two scenes.',
    ].join('\n'),
  ].join('\n\n')
}

/** Which scenes and NPCs exist, which are already written. Sent with every scene batch. */
export function writingContext(o: StoryOutline, d: ImportDraft): string {
  const detailed = d.npcs.filter(npcDetailed).map((n) => n.id)
  const pending = o.npcs.map((n) => n.id).filter((id) => !detailed.includes(id))
  return [
    draftContext({ ...d, npcs: d.npcs.filter(npcDetailed) }),
    `NPCs from the outline not detailed yet: ${pending.map((id) => `"${id}"`).join(', ') || 'none'}.`,
  ].join('\n')
}

export function scenesUserPrompt(b: StoryBrief, o: StoryOutline, d: ImportDraft, sceneIds: string[]): string {
  const all = outlineScenes(o)
  const wanted = sceneIds.map((id) => all.find((s) => s.id === id)!).filter(Boolean)
  const actOf = (id: string) => o.acts.find((a) => a.scenes.some((s) => s.id === id))!
  return [
    "The keeper's answers:",
    describeBrief(b),
    language(b),
    'The approved outline (follow it: same ids, same secret, same clues):',
    JSON.stringify(o),
    writingContext(o, d),
    `Now write these scenes in full, and only these: ${wanted.map((s) => `"${s.id}" (act "${actOf(s.id).id}")`).join(', ')}.`,
    [
      '- Put each scene in its act, using the act ids above. Output no other scene.',
      '- Write the full NPC entry (personality, what they know, stats, skills, attacks) for every outline NPC who appears in these scenes and is not detailed yet. Add a minor NPC only if a scene needs one.',
      '- Handouts found in these scenes, if any.',
      '- Items found or given in these scenes, if the story needs them: an object the investigators keep and use (a key, a weapon, a lamp, a talisman), each with the scene where it is found. Two or three in a whole story is plenty; ordinary gear is not an item.',
      '- Copy title, summary, era, setting and overview from the outline as they are.',
    ].join('\n'),
    draftAnswerFormat(SOUND_IDS),
  ].join('\n\n')
}

export function ideasUserPrompt(b: StoryBrief, field?: IdeaField): string {
  const filled = IDEA_FIELDS.filter((f) => b[f])
  const task = field
    ? `Suggest a new idea for "${field}"${b[field] ? `, different from what is written` : ''}. Copy the other fields as they are (or leave them empty).`
    : filled.length
      ? `Fill the empty fields so they fit with what the keeper already wrote (${filled.join(', ')}). Copy those word for word.`
      : 'Every field is empty: propose a fresh, original premise.'
  return [
    'The keeper is preparing a new story and asks for inspiration. Their answers so far:',
    describeBrief(b),
    language(b),
    task,
    'Short and concrete: precise places, a striking image, a mystery that makes players want to know more. Original, as everything you write.',
  ].join('\n\n')
}
