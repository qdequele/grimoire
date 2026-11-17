import { expect, it } from 'vitest'
import { isAppPage } from './pageLink'

it('links a feedback page only when it is a path on this site', () => {
  for (const page of ['/', '/stories', '/stories/mine?lang=en', '/games/1b2c#x', '/admin/feedback?statut=tous&type=bug'])
    expect(isAppPage(page), page).toBe(true)
})

it('never links the sender’s text to another site', () => {
  for (const page of [
    'https://grimoire.example/login', '//evil.example/x', '/\\evil.example', '/a\\b', '\\\\evil.example',
    'javascript:alert(1)', 'stories', '', ' /stories', '/\t/evil.example', '/\n/evil.example', '/stories x',
  ])
    expect(isAppPage(page), JSON.stringify(page)).toBe(false)
})
