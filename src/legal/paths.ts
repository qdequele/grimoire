import type { Lang } from '@/settings/lang'

export type LegalKind = 'privacy' | 'terms' | 'help'

/**
 * Public addresses, one per language: the page's language comes from its address (what the ChatGPT
 * and Claude directories link to), not from the visitor's setting, and the switch goes to the other one.
 */
export const LEGAL_PATHS: Record<LegalKind, Record<Lang, string>> = {
  privacy: { fr: '/confidentialite', en: '/privacy' },
  terms: { fr: '/conditions', en: '/terms' },
  help: { fr: '/aide', en: '/help' },
}
