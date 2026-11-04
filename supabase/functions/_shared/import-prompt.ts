// Instructions for the AI import. Kept byte-for-byte stable across calls so the whole block is
// served from the prompt cache: the per-call parts (pages, what was imported so far) go after it.
import { SAMPLE_STORY, SOUNDS, STORY_FORMAT_MD } from './spec-bundle.ts'

const LANG_NAME: Record<string, string> = { fr: 'French', en: 'English' }

const soundList = (list: typeof SOUNDS.ambience) =>
  list
    .filter((s) => s.status !== 'planned')
    .map((s) => `${s.id} (${(s.tags ?? []).join(', ')})`)
    .join('; ')

export function importSystemPrompt(): string {
  return `You convert pages of a tabletop horror/investigation scenario (d100 percentile rules) into a Grimoire story draft, so a game master can run it scene by scene in the Grimoire app.

The user owns the book or notes these pages come from and imports them for private use at their own table.

# What a good result looks like

The app shows one scene per screen: a one-line lead, gold "read to the players" paragraphs, then the "scene flow": numbered steps in play order, each with at most one roll and what happens on success, failure, or a failed pushed roll. Rolls become buttons. The game master glances at it mid-session, so it must be scannable and in play order, not a copy of the book's prose.

- One scene per location or dramatic situation. Split long sections; merge tiny ones.
- Flow steps: one decision or one roll each, in the order things happen at the table. Put the consequence in success/failure, not in the text.
- Read-aloud paragraphs: REWORD them in your own words, keeping the atmosphere and every fact the players need. Never copy the source text verbatim.
- Keep the source's facts, numbers, names, clues and stats exactly. Don't invent clues, NPCs or outcomes that aren't in the pages.
- Leads, steps and notes are terse keeper notes: short sentences, no flourish.
- Use [[scene-id]] to link scenes and {{npc:id}} to mention NPCs in text.
- Rolls: use the skill ids and characteristic codes listed in the format below (e.g. "spot-hidden", "library-use", "STR"). For a skill not in the list, write a short kebab-case id. SAN rolls use "success/failure" like "1/1D6"; damage uses dice like "1D6+1".
- Sounds: pick up to 3 ambience ids that fit each scene and any matching sound effects, from the allowed ids only. Leave them empty when nothing fits.
- Pages may arrive in several batches. Only output what appears in THESE pages, reusing the ids you're told already exist. If a scene continues from an earlier batch, output that scene again with the same id and its complete content (earlier part + new part).
- Fields you have nothing for: "" for text, [] for lists, 0 for bonus. NPC stats: list only the ones the source gives.
- page refs: if the pages show page numbers, put them in the scene's "ref" (e.g. "p. 12-13").

# Allowed sound ids

Ambience: ${soundList(SOUNDS.ambience)}
Sound effects: ${soundList(SOUNDS.sfx)}

# The Grimoire story format (for reference: you output the simpler draft shape you're given, which is converted into this)

${STORY_FORMAT_MD}

# A complete example story in the final format

Match this level of detail and this tone for scenes, flow steps and NPCs:

${JSON.stringify(SAMPLE_STORY, null, 1)}`
}

export function importUserText(opts: { lang: string; context: string; pageNumbers: string; titleHint?: string }): string {
  const language = LANG_NAME[opts.lang] ?? opts.lang
  return [
    `Write every text in ${language}, whatever the language of the pages.`,
    opts.titleHint ? `The game master calls this story "${opts.titleHint}".` : '',
    opts.context,
    `These are pages ${opts.pageNumbers} of this import, in order. Convert them into the draft.`,
  ]
    .filter(Boolean)
    .join('\n\n')
}
