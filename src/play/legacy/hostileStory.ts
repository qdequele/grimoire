// Test helper: a story whose every text carries markup, to check that none of it reaches the game
// screen as HTML (adapter.test.ts: what the adapter hands over; engine-markup.test.ts: what the
// generated engine then writes in a real page). Structure only: no story text.
import type { StoryForEngine } from './adapter.ts'

export interface HostileStory {
  story: StoryForEngine
  /** Marker (F1, F2…) → the story field that carries it. */
  fields: Record<string, string>
}

/** What a marker's element does when it runs: it reports its marker in `window.__ran`. */
export const RAN = '__ran'

/**
 * `ids`: the ids of scenes, NPCs, documents, items and pregens also carry markup (they close an
 * attribute first). `storyId`: the story's own id does. Without them the ids are ordinary, so the
 * engine can open every scene.
 */
export function hostileStory(lang = 'fr', opts: { ids?: boolean; storyId?: boolean } = {}): HostileStory {
  const fields: Record<string, string> = {}
  let n = 0
  const marker = (field: string) => {
    const k = `F${++n}`
    fields[k] = field
    return k
  }
  /** An element that reports its marker if it is ever built and run. */
  const img = (k: string) => `<img src=x onerror="(window.${RAN}=window.${RAN}||[]).push('${k}')">`
  /** A text naming its field, with an ampersand, quotes, and such an element. */
  const bad = (field: string): string => {
    const k = marker(field)
    return `${k} & "q" ${img(k)}`
  }
  const made = new Map<string, string>()
  const hostileId = (base: string) => {
    if (!made.has(base)) made.set(base, `${base}"'>${img(marker(`id (${base})`))}`)
    return made.get(base)!
  }
  const id = (base: string) => (opts.ids ? hostileId(base) : base)
  /** The same where the format wants a number: story.json is untrusted, a string can sit there. */
  const badNumber = (field: string) => bad(field) as unknown as number

  const scene = (base: string, extra: object = {}) => ({
    id: id(base),
    title: bad(`scene.title (${base})`),
    ref: bad('scene.ref'),
    lead: bad('scene.lead'),
    readAloud: [bad('scene.readAloud')],
    notes: [{ title: bad('note.title'), items: [bad('note.item')] }],
    notesAfter: [{ title: bad('notesAfter.title'), items: [bad('notesAfter.item')] }],
    flow: [
      {
        title: bad('step.title'), text: bad('step.text'), test: bad('step.test'), success: bad('step.success'),
        failure: bad('step.failure'), pushed: bad('step.pushed'), extra: bad('step.extra'),
      },
      { title: bad('step.title (of a choice)'), branch: bad('step.branch'), text: bad('step.text (of a choice)') },
      { title: `Si ${bad('step.title (read as a choice)')}`, text: 'x' },
      { title: 'damage', roll: { type: 'damage', dice: bad('roll.dice'), label: bad('roll.label (damage)') } },
      { title: 'san', roll: { type: 'san', san: bad('roll.san'), label: bad('roll.label (san)') } },
      {
        title: 'links',
        text: `[[s2|${bad('link label')}]] [[s2]] {{npc:talker}} {{npc:fighter}} {{handout:h1}} **${bad('bold')}** *${bad('italic')}*`,
      },
    ],
    callout: bad('scene.callout'),
    npcTable: true,
    npcs: [id('talker'), id('fighter')],
    rolls: [
      { type: 'skill', options: ['spot-hidden'], label: bad('scene roll.label (skill)') },
      { type: 'san', san: bad('scene roll.san'), label: bad('scene roll.label (san)') },
      { type: 'damage', dice: bad('scene roll.dice'), label: bad('scene roll.label (damage)') },
    ],
    handouts: [id('h1')],
    items: [id('i1')],
    ...extra,
  })

  const story: StoryForEngine = {
    meta: {
      id: opts.storyId ? hostileId('hostile') : 'hostile', title: bad('meta.title'), lang, summary: bad('meta.summary'),
      playersText: bad('meta.playersText'), duration: bad('meta.duration'),
    },
    acts: [
      { id: 'a1', title: bad('act.title'), scenes: [scene('s1'), scene('s2')] },
      { id: 'a2', title: bad('act.title (2)'), scenes: [scene('s3', { notesFirst: true })] },
    ],
    npcs: [
      { id: id('talker'), name: bad('npc.name (no attacks)'), description: bad('npc.description') },
      {
        id: id('fighter'), name: bad('npc.name (opponent)'), hp: badNumber('npc.hp'),
        characteristics: { DEX: badNumber('npc.characteristics.DEX') }, armor: badNumber('npc.armor'),
        dodge: badNumber('npc.dodge'), sanLoss: bad('npc.sanLoss'),
        attacks: [{ name: bad('npc.attack.name'), skill: badNumber('npc.attack.skill'), damage: bad('npc.attack.damage') }],
        special: [bad('npc.special')],
      },
    ],
    handouts: [{ id: id('h1'), title: bad('handout.title'), text: bad('handout.text'), scene: id('s1') }],
    items: [{ id: id('i1'), name: bad('item.name'), kind: bad('item.kind'), scene: id('s1') }],
    npcTable: {
      ref: bad('npcTable.ref'), note: bad('npcTable.note'),
      rows: [[0, 1, 2, 3, 4, 5].map((i) => bad(`npcTable.rows[][${i}]`))],
    },
    pregens: [{
      id: id('p1'), name: bad('pregen.name'), occupation: bad('pregen.occupation'), hp: badNumber('pregen.hp'),
      mp: badNumber('pregen.mp'), san: badNumber('pregen.san'), luck: badNumber('pregen.luck'),
      characteristics: { DEX: badNumber('pregen.characteristics.DEX') }, sheet: bad('pregen.sheet'),
      dodge: badNumber('pregen.dodge'),
      attacks: [{ name: bad('pregen.attack.name'), skill: badNumber('pregen.attack.skill'), damage: bad('pregen.attack.damage') }],
    }],
    defaultParty: [id('p1')],
    knowledge: [{ need: bad('knowledge.need'), best: bad('knowledge.best'), backup: bad('knowledge.backup') }],
    knowledgeNote: bad('knowledgeNote'),
    trackers: [{
      id: 'ritual', label: bad('tracker.label'), max: badNumber('tracker.max'), step: badNumber('tracker.step'),
      help: bad('tracker.help'), addLabel: bad('tracker.addLabel'), subLabel: bad('tracker.subLabel'),
      startLabel: bad('tracker.startLabel'), runningLabel: bad('tracker.runningLabel'), fullMessage: bad('tracker.fullMessage'),
    }],
  }
  return { story, fields }
}
