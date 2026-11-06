import { describe, expect, it } from 'vitest'
import { claudeAddLink } from './connectorUrl'

describe('claudeAddLink', () => {
  it('opens claude.ai’s add-connector dialog with the name and the percent-encoded address', () => {
    expect(claudeAddLink('https://www.legrimoire.quest/mcp')).toBe(
      'https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=Grimoire&connectorUrl=https%3A%2F%2Fwww.legrimoire.quest%2Fmcp',
    )
  })
})
