import { Plus } from 'lucide-react'
import { Link, Navigate, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { useT } from '@/i18n/t'
import { Masthead } from '@/theme/Masthead'
import { forgetCharacter, rememberCharacter, rememberedCharacter } from './api'
import { useCompanionContext } from './CompanionLayout'

/** Navigation state that shows the list even when this device remembers an investigator. */
export interface PickState { pick: true }

/** `/t/:token`: "who are you?" from a table link. A personal link goes straight to its sheet. */
export function PickPage() {
  const t = useT()
  const { token, view } = useCompanionContext()
  const wantsList = (useLocation().state as PickState | null)?.pick === true

  if (view.focus) return <Navigate to={`c/${view.focus}`} replace />
  const remembered = rememberedCharacter(token)
  if (remembered && !wantsList) {
    if (view.party.some((m) => m.id === remembered)) return <Navigate to={`c/${remembered}`} replace />
    forgetCharacter(token)
  }

  return (
    <>
      <Masthead compact eyebrow={t('À la table')} title="Grimoire" subtitle={view.game.title || undefined} />
      <span className="double-rule" />
      <section className="flex flex-col gap-2">
        <h2 className="eyebrow">{t('Qui êtes-vous ?')}</h2>
        {view.party.length ? (
          <ul className="flex flex-col">
            {view.party.map((m) => (
              <li key={m.id}>
                <Link
                  to={`c/${m.id}`}
                  onClick={() => rememberCharacter(token, m.id)}
                  className="group flex items-baseline gap-3 border-b border-border py-3"
                >
                  <span aria-hidden="true" className="diamond group-hover:bg-gold" />
                  <span className="flex-1 font-serif text-xl group-hover:text-gold">{m.data.name}</span>
                  <span className="text-sm text-muted-foreground">{m.player || '—'}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-serif text-lg text-muted-foreground italic">{t("Aucun investigateur dans cette partie pour l'instant.")}</p>
        )}
      </section>
      {view.canCreate && (
        <Button
          variant="outline"
          size="lg"
          className="border-gold text-gold hover:text-gold"
          render={<Link to={`/t/${token}/nouveau`} />}
          nativeButton={false}
        >
          <Plus data-icon="inline-start" />
          {t('Créer mon investigateur')}
        </Button>
      )}
    </>
  )
}
