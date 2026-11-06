import { describe, expect, it } from 'vitest'
import { readJsonAnswer, schemaInstruction } from './json-answer'

describe('readJsonAnswer', () => {
  it('reads plain JSON, a fenced block, or the outermost braces', () => {
    expect(readJsonAnswer('{"a":1}')).toEqual({ a: 1 })
    expect(readJsonAnswer('Here it is:\n```json\n{"a":[1,2]}\n```\n')).toEqual({ a: [1, 2] })
    expect(readJsonAnswer('Sure. {"a":{"b":"}"}} Done.')).toEqual({ a: { b: '}' } })
  })

  it('throws when there is no JSON object', () => {
    expect(() => readJsonAnswer('Sorry, I cannot.')).toThrow(SyntaxError)
  })
})

describe('schemaInstruction', () => {
  it('carries the whole schema', () => {
    const schema = { type: 'object', properties: { a: { type: 'string' } } }
    expect(schemaInstruction(schema)).toContain(JSON.stringify(schema))
  })
})
