// Fallback when structured outputs refuse a schema.
//
// Anthropic compiles output_config.format into a grammar and answers HTTP 400 when it can't
// ("The compiled grammar is too large…"), before writing anything. The functions then ask once more
// without output_config.format: the schema goes in the prompt (schemaInstruction) and the answer is
// read with readJsonAnswer. Nothing guarantees its shape, so callers check it afterwards
// (normalizeDraft, parseOutline…).
//
// Pure TypeScript, no Deno or browser APIs: unit-tested with Vitest.

/** Text appended to the user message when the schema can't be sent as output_config.format. */
export function schemaInstruction(schema: Record<string, unknown>): string {
  return [
    '',
    'Answer with ONE JSON object and nothing else: no text before or after it, no code fence.',
    'It must match this JSON Schema exactly (every property present, "" or [] when there is nothing):',
    JSON.stringify(schema),
  ].join('\n')
}

/** The JSON object in a free-text answer: the whole text, a fenced block, or the outermost braces. Throws SyntaxError. */
export function readJsonAnswer(text: string): unknown {
  const tries = [text.trim()]
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) tries.push(fenced[1].trim())
  const first = text.indexOf('{')
  const last = text.lastIndexOf('}')
  if (first !== -1 && last > first) tries.push(text.slice(first, last + 1))
  for (const t of tries) {
    try {
      return JSON.parse(t)
    } catch {
      // next
    }
  }
  throw new SyntaxError('No JSON object in the answer.')
}
