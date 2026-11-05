import { RotateCw } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Outlet, useLocation, useOutletContext, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useT } from '@/i18n/t'
import { Masthead, SkinToggle } from '@/theme/Masthead'
import { forgetCharacter, useCompanion, useCompanionLive, type CompanionView } from './api'

export interface CompanionContext {
  token: string
  view: CompanionView
  /** Subscribed to the game's live channel. */
  live: boolean
}

/** What the companion pages get from the layout. */
export const useCompanionContext = () => useOutletContext<CompanionContext>()

/**
 * Installable to the home screen: a manifest whose start_url is the page the player is on, so the
 * icon reopens their sheet. Data URL, so icon URLs are absolute.
 */
function useManifest() {
  const { pathname } = useLocation()
  useEffect(() => {
    const manifest = {
      name: 'Grimoire',
      short_name: 'Grimoire',
      start_url: `${location.origin}${pathname}`,
      scope: `${location.origin}/t/`,
      display: 'standalone',
      background_color: '#0a0907',
      theme_color: '#0a0907',
      icons: [
        { src: `${location.origin}/apple-touch-icon.png`, sizes: '180x180', type: 'image/png' },
        { src: `${location.origin}/favicon.svg`, sizes: 'any', type: 'image/svg+xml' },
      ],
    }
    const link = document.createElement('link')
    link.rel = 'manifest'
    link.href = `data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifest))}`
    document.head.appendChild(link)
    return () => link.remove()
  }, [pathname])
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-lg flex-col px-4 pt-6 pb-24 sm:pt-10">
      <main className="flex flex-1 flex-col gap-6">{children}</main>
    </div>
  )
}

function Message({ text, children }: { text: string; children?: ReactNode }) {
  const t = useT()
  return (
    <Shell>
      <Masthead compact eyebrow={t('À la table')} title="Grimoire" />
      <span className="double-rule" />
      <p role="alert" className="text-center font-serif text-xl text-balance">{text}</p>
      {children}
    </Shell>
  )
}

/** Public pages opened from a table link (`/t/:token/…`): no account, no app chrome. */
export function CompanionLayout() {
  const t = useT()
  const { token = '' } = useParams()
  const q = useCompanion(token)
  const live = useCompanionLive(token, q.data?.game.channel || undefined)
  useManifest()

  const invalid = q.error?.code === 'link_invalid'
  useEffect(() => {
    if (invalid) forgetCharacter(token)
  }, [invalid, token])

  if (invalid) return <Message text={t("Ce lien n'est plus valide. Demande un nouveau code au gardien.")} />
  if (q.isPending) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (!q.data) {
    return (
      <Message text={t('Impossible de joindre le serveur.')}>
        <Button variant="outline" className="mx-auto" onClick={() => void q.refetch()} disabled={q.isFetching}>
          <RotateCw data-icon="inline-start" />
          {t('Réessayer')}
        </Button>
      </Message>
    )
  }

  return (
    <Shell>
      <Outlet context={{ token, view: q.data, live } satisfies CompanionContext} />
      <footer className="mt-auto flex justify-center pt-6">
        <SkinToggle />
      </footer>
    </Shell>
  )
}
