import { describe, expect, it } from 'vitest'
import { branchOf, storyToEngine, toHtml, type StoryForEngine } from './adapter'
import { hostileStory } from './hostileStory'

// Structure only: no story text (see CLAUDE.md, copyright).
const story: StoryForEngine = {
  meta: { id: 's', title: 'S', lang: 'fr' },
  acts: [{
    id: 'a', title: 'A',
    scenes: [
      {
        id: 'one', title: 'One', handouts: ['h1'],
        flow: [
          { title: 'Setup', text: 'Read {{handout:h1}} and {{handout:nope}}.' },
          { title: 'Give', branch: 'Si X' },
          { title: 'Si Y' },
          { title: 'After' },
        ],
      },
      { id: 'two', title: 'Two' },
    ],
  }],
  handouts: [
    { id: 'h1', title: 'Letter <1>', text: '**Signed**' },
    { id: 'h2', title: 'Map', image: 'images/map.svg', scene: 'one' },
    { id: 'h3', title: 'Elsewhere', text: 'x', scene: 'two' },
  ],
}

describe('story → engine: choices and documents', () => {
  it('reads a step choice from branch, else from a title starting with Si / If', () => {
    expect(branchOf({ title: 'Go', branch: ' Si X ' })).toBe('Si X')
    expect(branchOf({ title: 'Si elle part' })).toBe('Si elle part')
    expect(branchOf({ title: 'If she leaves' })).toBe('If she leaves')
    expect(branchOf({ title: 'Silence' })).toBeUndefined()
    expect(branchOf({ title: 'Go', branch: '' })).toBeUndefined()
  })

  it('marks choice steps for the engine', () => {
    const e = storyToEngine(story, (id) => id)
    const flow = e.SCENARIO.acts![0].scenes[0].flow!
    expect(flow.map((s) => s.br)).toEqual([undefined, 'Si X', 'Si Y', undefined])
  })

  it('links documents in the text, lists them by scene, and gives their titles, text and picture', () => {
    const e = storyToEngine(story, (id) => id)
    const [one, two] = e.SCENARIO.acts![0].scenes
    expect(one.flow![0].txt).toBe('Read <a class="golink hdlink" data-hd="h1">Letter &lt;1&gt;</a> and <b>nope</b>.')
    expect(one.hd).toEqual(['h1', 'h2'])
    expect(two.hd).toEqual(['h3'])
    expect(e.HANDOUTS).toEqual({
      h1: { t: 'Letter <1>', txt: '<b>Signed</b>' },
      h2: { t: 'Map', img: true },
      h3: { t: 'Elsewhere', txt: 'x' },
    })
  })

  it('keeps a document id as before when the story has no such document', () => {
    expect(toHtml('{{handout:x}}')).toBe('<b>x</b>')
  })
})

describe('story → engine: the tracker panel', () => {
  const t = (id: string) => ({ id, label: id.toUpperCase(), max: 6 })

  it('shows the "ritual" tracker, else the story\'s first one', () => {
    const legacy = storyToEngine({ ...story, trackers: [t('other'), t('ritual')] }, (id) => id)
    expect(legacy.SCENARIO.ritual).toBe(true)
    expect(legacy.RITUAL?.title).toBe('RITUAL')
    const first = storyToEngine({ ...story, trackers: [t('days'), t('steps')] }, (id) => id)
    expect(first.SCENARIO.ritual).toBe(true)
    expect(first.RITUAL?.title).toBe('DAYS')
  })

  it('has no panel without trackers', () => {
    const e = storyToEngine(story, (id) => id)
    expect(e.SCENARIO.ritual).toBe(false)
    expect(e.RITUAL).toBeNull()
  })
})

// ------------------------------------------------------------------ untrusted story text

/** Every string of a value, with where it sits (array indexes as *). */
function strings(v: unknown, path = ''): Array<[string, string]> {
  if (typeof v === 'string') return [[path, v]]
  if (Array.isArray(v)) return v.flatMap((x) => strings(x, `${path}.*`))
  if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => strings(x, path ? `${path}.${k}` : k))
  return []
}

describe('story → engine: story text is never markup', () => {
  const IMG = '<img src=x onerror="alert(1)">'

  it('escapes the text before adding its own tags', () => {
    expect(toHtml(`a ${IMG} **b**`)).toBe('a &lt;img src=x onerror="alert(1)"> <b>b</b>')
    expect(toHtml('Tom & Jerry <3')).toBe('Tom &amp; Jerry &lt;3')
  })

  it('escapes a link label, and the scene titles and names it looks up', () => {
    expect(toHtml(`[[two|${IMG}]]`)).toBe('<a class="golink" data-go="two">&lt;img src=x onerror="alert(1)"></a>')
    expect(toHtml('[[two]] {{npc:n}}', { two: `T ${IMG}` }, { n: `N ${IMG}` })).toBe(
      '<a class="golink" data-go="two">T &lt;img src=x onerror="alert(1)"></a> <b>N &lt;img src=x onerror="alert(1)"></b>',
    )
  })

  it('escapes a document title once', () => {
    expect(toHtml('{{handout:h}}', {}, {}, { h: 'A & <B>' })).toBe('<a class="golink hdlink" data-hd="h">A &amp; &lt;B&gt;</a>')
  })

  it('leaves ordinary punctuation as it is', () => {
    expect(toHtml('She said "no" > maybe; it\'s 5 o\'clock')).toBe('She said "no" > maybe; it\'s 5 o\'clock')
  })

  it('keeps character references and the few plain tags of stories converted from the legacy app', () => {
    expect(toHtml('a&nbsp;: b &#233; &amp; c<br>d <em>e</em> <u>f</u> <strong>g</strong> <B>h</B> <i>i</i><br />')).toBe(
      'a&nbsp;: b &#233; &amp; c<br>d <em>e</em> <u>f</u> <strong>g</strong> <B>h</B> <i>i</i><br />',
    )
    // A tag with anything more than its name is text.
    expect(toHtml('<b onclick="x()">x</b> <br onload=x> <bx>')).toBe('&lt;b onclick="x()">x</b> &lt;br onload=x> &lt;bx>')
    // A reference needs its semicolon.
    expect(toHtml('&lt &copy')).toBe('&amp;lt &amp;copy')
  })

  it('hands no markup to the engine, except in the plain fields the engine escapes itself', () => {
    const { story } = hostileStory()
    const e = storyToEngine(story, (id) => id)
    const raw = [...new Set(strings(e).filter(([, s]) => s.includes('<img')).map(([path]) => path))].sort()
    // Plain text, never HTML: titles, names, labels. The engine escapes them where it writes them
    // (engine-markup.test.ts runs it), and reads them as text elsewhere (Journal, narrator, toasts).
    expect(raw).toEqual([
      'BEASTS.*.atk.*.*', // an attack's name and damage (its skill value is a number)
      'BEASTS.*.n',
      'HANDOUTS.h1.t',
      'INV0.*.job',
      'INV0.*.n',
      'INV0.*.sk',
      'ITEMS.i1.k',
      'ITEMS.i1.t',
      'NPC_X.talker.n',
      'RITUAL.add',
      'RITUAL.full',
      'RITUAL.running',
      'RITUAL.start',
      'RITUAL.sub',
      'RITUAL.title',
      'SCENARIO.acts.*.scenes.*.after.*.h',
      'SCENARIO.acts.*.scenes.*.chips.*.*', // a roll's label and value
      'SCENARIO.acts.*.scenes.*.flow.*.h',
      'SCENARIO.acts.*.scenes.*.flow.*.test',
      'SCENARIO.acts.*.scenes.*.p',
      'SCENARIO.acts.*.scenes.*.secs.*.h',
      'SCENARIO.acts.*.scenes.*.t',
      'SCENARIO.t',
      'WEAPONS.p1.atk.*.*',
    ])
  })

  it('gives the engine numbers where it writes numbers', () => {
    const { story } = hostileStory()
    const e = storyToEngine(story, (id) => id)
    const [beast] = e.BEASTS
    const [pregen] = e.INV0
    const numbers = [
      beast.pv, beast.dex, beast.arm, beast.esq, beast.atk[0][1],
      pregen.pv, pregen.san, pregen.chance, pregen.pm, pregen.dex,
      e.WEAPONS.p1.esq, e.WEAPONS.p1.atk[0][1], e.RITUAL!.max, e.RITUAL!.step,
    ]
    expect(numbers.map((x) => typeof x)).toEqual(numbers.map(() => 'number'))
    expect(numbers.every((x) => Number.isFinite(x))).toBe(true)
  })

  it('keeps the numbers of an ordinary story', () => {
    const e = storyToEngine({
      ...story,
      npcs: [{ id: 'n', name: 'N', hp: 12, characteristics: { DEX: 60 }, armor: 2, attacks: [{ name: 'A', skill: 45, damage: '1D6' }] }],
      pregens: [{ id: 'p', name: 'P', hp: 11, mp: 9, san: 45, luck: 55, characteristics: { DEX: 70 }, dodge: 35, attacks: [{ name: 'B', skill: 30, damage: '1D3' }] }],
      trackers: [{ id: 'ritual', label: 'R', max: 8, step: 2 }],
    }, (id) => id)
    expect(e.BEASTS[0]).toMatchObject({ pv: 12, dex: 60, arm: 2, esq: 30, atk: [['A', 45, '1D6']] })
    expect(e.INV0[0]).toMatchObject({ pv: 11, pm: 9, san: 45, chance: 55, dex: 70 })
    expect(e.WEAPONS.p).toEqual({ esq: 35, atk: [['B', 30, '1D3']] })
    expect(e.RITUAL).toMatchObject({ max: 8, step: 2 })
  })

  it('makes ids that could close an attribute harmless, the same way everywhere', () => {
    const id = 'x"><img src=x onerror=alert(1)>'
    const e = storyToEngine({
      meta: { id, title: 'S', lang: 'fr' },
      acts: [{ id: 'a', title: 'A', scenes: [{ id, title: 'One', npcs: [id], handouts: [id], items: [id], ambience: ['rain'] }] }],
      npcs: [{ id, name: 'N' }, { id: `${id}2`, name: 'M', hp: 5, attacks: [{ name: 'A', skill: 40, damage: '1D4' }] }],
      handouts: [{ id, title: 'H' }],
      items: [{ id, name: 'I', kind: 'gear' }],
      pregens: [{ id, name: 'P', attacks: [{ name: 'B', skill: 30, damage: '1D3' }] }],
      defaultParty: [id],
    }, (x) => x)
    const scene = e.SCENARIO.acts![0].scenes[0]
    const safe = scene.id
    expect(safe).not.toMatch(/[&<>"'`]/)
    expect([e.SCENARIO.id, scene.hd, scene.it, e.SCENARIO.party, e.SCENE_NPC[safe], e.INV0[0].id]).toEqual([safe, [safe], [safe], [safe], [safe], safe])
    expect([Object.keys(e.HANDOUTS), Object.keys(e.ITEMS), Object.keys(e.NPC_X), Object.keys(e.WEAPONS), Object.keys(e.AMB_FOR)]).toEqual([[safe], [safe], [safe], [safe], [safe]])
    expect(e.BEASTS[0].id).toBe(`${safe}2`)
    // Ids as the format wants them are untouched.
    expect(storyToEngine(story, (x) => x).SCENARIO.acts![0].scenes.map((s) => s.id)).toEqual(['one', 'two'])
  })
})
