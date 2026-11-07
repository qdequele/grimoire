import { describe, expect, it } from 'vitest'
import { branchOf, storyToEngine, toHtml, type StoryForEngine } from './adapter'

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
