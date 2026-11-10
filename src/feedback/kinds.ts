// What a feedback message is about. Same ids as the database (`feedback.kind`); French labels, translated where shown.
export const FEEDBACK_KINDS = ['bug', 'idea', 'praise', 'other'] as const
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]

export const KIND_LABEL: Record<FeedbackKind, string> = {
  bug: 'Un problème',
  idea: 'Une idée',
  praise: 'Ce que j’aime',
  other: 'Autre chose',
}

export const KIND_PLACEHOLDER: Record<FeedbackKind, string> = {
  bug: 'Ce qui s’est passé, ce que tu attendais, et où (écran, histoire, téléphone…).',
  idea: 'Ce qui te manque à la table, ou ce qui pourrait être plus simple.',
  praise: 'Ce qui marche bien pour ta table.',
  other: 'Ton message.',
}

/** Admins' triage of a message (`feedback.status`), as the inbox's tabs name it. */
export const STATUS_LABEL = { new: 'Nouveaux', read: 'Lus', done: 'Traités' } as const
