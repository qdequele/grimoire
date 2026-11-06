// Fake Claude answers for the story creator (create-story function), shared by the function test
// and the e2e test. Picks the answer from the structured-output schema the function sends, and
// writes exactly the scenes the prompt asks for. No scenario text: placeholder words only.

export const FAKE_OUTLINE = {
  title: 'The Quiet Mill',
  summary: 'Something is wrong at the mill.',
  era: '1920s',
  setting: 'A mill town',
  contentWarnings: ['missing people'],
  overview: { secret: 'The miller hides something.', steps: ['[[arrival]]', '[[mill]]', '[[cellar]]'], mustNotMiss: [], branches: [], ifStuck: [], keeperTips: [] },
  acts: [
    {
      id: 'act-1',
      title: 'Arrival',
      scenes: [
        { id: 'arrival', title: 'Arrival', summary: 'The investigators arrive.', clues: ['A ribbon'], npcs: ['miller'], next: ['mill'] },
        { id: 'mill', title: 'The mill', summary: 'They visit the mill.', clues: [], npcs: ['miller'], next: ['cellar'] },
      ],
    },
    { id: 'act-2', title: 'Below', scenes: [{ id: 'cellar', title: 'The cellar', summary: 'The truth.', clues: [], npcs: [], next: [] }] },
  ],
  npcs: [{ id: 'miller', name: 'Abel Roe', kind: 'person', role: 'Miller', description: 'Floury hands.' }],
}

export const FAKE_IDEAS = { era: '1890s', place: 'A river port', hook: 'A bell rings at night.', ideas: 'A drowned choir.' }

/** A full draft scene with placeholder words (also used by the MCP connector test). */
export const fakeScene = (id: string) => ({
  id, title: id, ref: '', lead: 'Lead.', readAloud: ['You see it.'],
  flow: [{
    title: 'Look around', text: '', success: 'Found.', failure: 'Nothing.', pushed: '', extra: '', goto: [],
    roll: [{ type: 'skill', options: ['spot-hidden'], difficulty: 'regular', bonus: 0, san: '', dice: '', label: '', againstNpc: '', againstSkill: '' }],
  }],
  notes: [], npcs: [], handouts: [], rolls: [], ambience: [], sfx: [], next: [],
})

/** The scenes a "write" prompt asks for: '"id" (act "act-id")'. */
export function requestedScenes(prompt: string): Array<{ id: string; act: string }> {
  const line = prompt.split('\n').find((l) => l.startsWith('Now write these scenes')) ?? ''
  return [...line.matchAll(/"([\w-]+)" \(act "([\w-]+)"\)/g)].map((m) => ({ id: m[1], act: m[2] }))
}

/** The JSON text Claude would answer for this Messages API request body. */
export function fakeAnswer(body: { output_config?: { format?: { schema?: { properties?: Record<string, unknown> } } }; messages?: Array<{ content: unknown }> }): string | null {
  const props = body.output_config?.format?.schema?.properties ?? {}
  if ('contentWarnings' in props) return JSON.stringify(FAKE_OUTLINE)
  if ('hook' in props) return JSON.stringify(FAKE_IDEAS)
  const content = body.messages?.[0]?.content
  const wanted = requestedScenes(typeof content === 'string' ? content : '')
  if (!wanted.length) return null
  const acts = [...new Set(wanted.map((w) => w.act))].map((act) => ({
    id: act, title: '', scenes: wanted.filter((w) => w.act === act).map((w) => fakeScene(w.id)),
  }))
  return JSON.stringify({
    title: '', summary: '', era: '', setting: '', duration: '',
    overview: { secret: '', steps: [], mustNotMiss: [], branches: [], ifStuck: [], keeperTips: [] },
    acts,
    npcs: [{
      id: 'miller', name: 'Abel Roe', kind: 'person', role: 'Miller', description: 'Floury hands.', personality: 'Gruff.',
      knows: ['The cellar key'], stats: [{ key: 'STR', value: 60 }, { key: 'hp', value: 11 }], damageBonus: '', attacks: [],
      skills: [], sanLoss: '', special: [],
    }],
    handouts: [],
  })
}
