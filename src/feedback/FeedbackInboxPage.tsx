import { Inbox, Mail } from 'lucide-react'
import { useId } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { useProfile } from '@/auth/auth'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { useT } from '@/i18n/t'
import { cn } from '@/lib/utils'
import {
  FEEDBACK_STATUSES, replyLink, useFeedbackCounts, useFeedbackInbox, useSetFeedbackStatus,
  type FeedbackStatus, type InboxRow,
} from './api'
import { FEEDBACK_KINDS, KIND_LABEL, STATUS_LABEL, type FeedbackKind } from './kinds'

const ALL = 'tous'

const isStatus = (v: string | null): v is FeedbackStatus => FEEDBACK_STATUSES.includes(v as FeedbackStatus)
const isKind = (v: string | null): v is FeedbackKind => FEEDBACK_KINDS.includes(v as FeedbackKind)

/** One message: what it's about, who sent it, from where, and the triage buttons. */
function FeedbackItem({ row }: { row: InboxRow }) {
  const t = useT()
  const setStatus = useSetFeedbackStatus()
  const reply = replyLink(row, t('Ton avis sur Grimoire'))
  const move = async (status: FeedbackStatus) => {
    try {
      await setStatus.mutateAsync({ id: row.id, status })
    } catch (e) {
      toast.error(t('Impossible de changer le statut : {error}', { error: (e as Error).message }))
    }
  }
  const name = row.display_name || row.email || t('Compte supprimé')

  return (
    <article aria-label={name} className={cn('flex flex-col gap-3 border border-border bg-card p-4', row.status === 'new' && 'border-l-2 border-l-gold')}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Badge variant={row.kind === 'bug' ? 'destructive' : 'outline'}>{t(KIND_LABEL[row.kind as FeedbackKind] ?? row.kind)}</Badge>
        <span className="font-heading text-lg">{name}</span>
        {row.email && row.display_name && <span className="text-sm text-muted-foreground">{row.email}</span>}
        <time dateTime={row.created_at} className="ml-auto text-[0.625rem] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          {t.date(row.created_at, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </time>
      </header>

      <p className="font-serif text-base whitespace-pre-wrap">{row.message}</p>

      <dl className="grid gap-x-3 gap-y-1 text-xs text-muted-foreground sm:grid-cols-[6rem_1fr]">
        {row.page && (
          <>
            <dt className="eyebrow text-[0.625rem]">{t('Page')}</dt>
            <dd className="font-mono break-all"><Link to={row.page} className="hover:text-gold">{row.page}</Link></dd>
          </>
        )}
        {row.lang && (
          <>
            <dt className="eyebrow text-[0.625rem]">{t('Langue')}</dt>
            <dd>{row.lang.toUpperCase()}</dd>
          </>
        )}
        {row.user_agent && (
          <>
            <dt className="eyebrow text-[0.625rem]">{t('Navigateur')}</dt>
            <dd className="font-mono break-all">{row.user_agent}</dd>
          </>
        )}
      </dl>

      <footer className="flex flex-wrap items-center gap-2">
        {reply ? (
          <Button variant="outline" size="sm" nativeButton={false} render={<a href={reply} />}>
            <Mail />
            {t('Répondre')}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">{t('Ne souhaite pas de réponse.')}</span>
        )}
        <span className="ml-auto flex flex-wrap gap-2">
          {row.status === 'new' && (
            <Button size="sm" variant="ghost" disabled={setStatus.isPending} onClick={() => void move('read')}>{t('Marquer comme lu')}</Button>
          )}
          {row.status !== 'done' && (
            <Button size="sm" disabled={setStatus.isPending} onClick={() => void move('done')}>{t('Marquer comme traité')}</Button>
          )}
          {row.status !== 'new' && (
            <Button size="sm" variant="ghost" disabled={setStatus.isPending} onClick={() => void move('new')}>{t('Rouvrir')}</Button>
          )}
        </span>
      </footer>
    </article>
  )
}

/** Admins' inbox for the feedback keepers send from the account menu (`/admin/feedback`). */
export function FeedbackInboxPage() {
  const t = useT()
  const profile = useProfile()
  const kindId = useId()
  const [params, setParams] = useSearchParams()
  const statusParam = params.get('statut')
  const status: FeedbackStatus | null = statusParam === ALL ? null : isStatus(statusParam) ? statusParam : 'new'
  const kindParam = params.get('type')
  const kind = isKind(kindParam) ? kindParam : null
  const isAdmin = profile.data?.is_admin === true
  const inbox = useFeedbackInbox(status, kind, isAdmin)
  const counts = useFeedbackCounts(isAdmin)

  const set = (key: string, value: string) => setParams((p) => {
    const next = new URLSearchParams(p)
    next.set(key, value)
    return next
  }, { replace: true })

  if (profile.isPending) return <Skeleton className="h-40" />
  if (!isAdmin) {
    return <p role="alert" className="text-muted-foreground">{t('Cette page est réservée aux administrateurs.')}</p>
  }

  const tabs: { value: string; label: string; count?: number }[] = [
    ...FEEDBACK_STATUSES.map((s) => ({ value: s, label: t(STATUS_LABEL[s]), count: counts.data?.[s] })),
    { value: ALL, label: t('Tous') },
  ]
  const current = status ?? ALL

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <span className="eyebrow">{t('Administration')}</span>
        <h1 className="font-heading text-4xl">{t('Avis reçus')}</h1>
        <div className="flex flex-wrap items-end gap-3 border-b border-border">
          <nav aria-label={t('Statut')} className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                aria-pressed={current === tab.value}
                onClick={() => set('statut', tab.value)}
                className={cn(
                  '-mb-px border-b-2 border-transparent px-3 py-2 text-xs font-semibold tracking-[0.14em] whitespace-nowrap text-muted-foreground uppercase hover:text-gold',
                  current === tab.value && 'border-gold text-gold',
                )}
              >
                {tab.label}
                {tab.count !== undefined && <span className="ml-1.5 font-mono">{tab.count}</span>}
              </button>
            ))}
          </nav>
          <div className="mb-1.5 ml-auto flex items-center">
            <Label htmlFor={kindId} className="font-normal text-muted-foreground">{t('Type')}</Label>
            <NativeSelect id={kindId} size="sm" className="ml-2" value={kind ?? ALL} onChange={(e) => set('type', e.target.value)}>
              <NativeSelectOption value={ALL}>{t('Tous les types')}</NativeSelectOption>
              {FEEDBACK_KINDS.map((k) => <NativeSelectOption key={k} value={k}>{t(KIND_LABEL[k])}</NativeSelectOption>)}
            </NativeSelect>
          </div>
        </div>
      </header>

      {inbox.error && (
        <p role="alert" className="text-sm text-destructive">{t('Impossible de charger les avis : {error}', { error: inbox.error.message })}</p>
      )}
      {inbox.isPending && <Skeleton className="h-40" />}
      {inbox.data && (inbox.data.length ? (
        <div className="flex flex-col gap-4">
          {inbox.data.map((row) => <FeedbackItem key={row.id} row={row} />)}
        </div>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Inbox /></EmptyMedia>
            <EmptyTitle>{t('Aucun avis ici.')}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ))}
    </section>
  )
}
