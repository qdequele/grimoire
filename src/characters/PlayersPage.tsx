import { ChevronRight, UserPlus, Users } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useAddPlayer,
  useAssignPlayer,
  useCharacters,
  useDeletePlayer,
  usePlayers,
  useRenamePlayer,
  type CharacterRow,
  type PlayerRow,
} from './api'
import { progressSummary } from './character'
import { skillText, useT } from '@/i18n/t'


/** A one-field inline form (add / rename a player), like the legacy "promptInline". */
function NameForm({ label, initial = '', onSubmit, onCancel }: {
  label: string
  initial?: string
  onSubmit: (name: string) => Promise<unknown>
  onCancel?: () => void
}) {
  const t = useT()
  const [name, setName] = useState(initial)
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        setBusy(true)
        try {
          await onSubmit(name)
          setName('')
        } catch (err) {
          toast.error(t((err as Error).message))
        } finally {
          setBusy(false)
        }
      }}
    >
      <Input
        aria-label={t('Prénom')} placeholder={t('Prénom')} value={name} autoFocus={!!onCancel} className="w-48"
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onCancel?.()}
      />
      <Button type="submit" disabled={!name.trim() || busy}>{t(label)}</Button>
      {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>{t('Annuler')}</Button>}
    </form>
  )
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  const t = useT()
  return (
    <div className="flex flex-col items-center border border-border px-2 py-1">
      <span className="eyebrow text-[0.65rem]">{t(label)}</span>
      <span className="font-heading text-lg">{value}</span>
    </div>
  )
}

/** One investigator: summary line, then their progression from play (legacy "charCard"). */
function CharacterCard({ c, players }: { c: CharacterRow; players: PlayerRow[] }) {
  const t = useT()
  const assign = useAssignPlayer()
  const p = progressSummary(c.data)
  const san = p.san ?? c.data.san
  return (
    <Collapsible className="border border-border bg-background/40">
      <CollapsibleTrigger className="group flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-left hover:text-gold">
        <ChevronRight className="size-3.5 self-center transition-transform group-data-[panel-open]:rotate-90" />
        <span className="font-heading text-lg">{c.data.name}</span>
        <span className="text-sm text-muted-foreground">{c.data.occupation && t(c.data.occupation)}</span>
        <span className="ml-auto text-xs tracking-wide text-muted-foreground uppercase">
          SAN {san ?? '—'}{p.gamesPlayed > 0 && ` · ${t.n(p.gamesPlayed, '{n} partie', '{n} parties')}`}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4 border-t border-border px-3 py-3">
        <div className="flex flex-wrap gap-2">
          <Stat label="PV" value={c.data.hp ?? '—'} />
          <Stat label="SAN" value={san ?? '—'} />
          <Stat label="Chance" value={c.data.luck ?? '—'} />
          <Stat label="PM" value={c.data.mp ?? '—'} />
          {p.san !== undefined && p.san !== c.data.san && (
            <span className="self-end text-xs text-muted-foreground">{t('SAN de départ {n}', { n: c.data.san ?? '—' })}</span>
          )}
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-[12rem_1fr]">
          <dt className="eyebrow">{t('Progrès')}</dt>
          <dd>
            {p.improved.length
              ? p.improved.map(([k, v]) => `${skillText(t, k)} ${v}`).join(' · ')
              : <span className="text-muted-foreground">{t('Pas encore de compétence améliorée.')}</span>}
          </dd>
          <dt className="eyebrow">{t('À améliorer')}</dt>
          <dd>
            {p.checks.length
              ? p.checks.map((k) => skillText(t, k)).join(', ')
              : <span className="text-muted-foreground">{t('Aucune compétence cochée.')}</span>}
          </dd>
          <dt className="eyebrow">{t('Historique')}</dt>
          <dd>
            {p.history.length ? (
              <ul className="flex flex-col gap-1">
                {p.history.slice(0, 8).map((h, i) => (
                  <li key={i}><span className="text-muted-foreground">{t.date(h.at, { day: 'numeric', month: 'short', year: 'numeric' })} · </span>{h.text}</li>
                ))}
              </ul>
            ) : (
              <span className="text-muted-foreground">{t('Pas encore joué.')}</span>
            )}
          </dd>
        </dl>

        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            size="sm" aria-label={t('Joueur de {name}', { name: c.data.name })} value={c.player_id ?? ''} disabled={assign.isPending}
            onChange={(e) => assign.mutate({ characterId: c.id, playerId: e.target.value || null })}
          >
            <NativeSelectOption value="">{t('Sans joueur')}</NativeSelectOption>
            {players.map((pl) => <NativeSelectOption key={pl.id} value={pl.id}>{pl.name}</NativeSelectOption>)}
          </NativeSelect>
          <Button size="sm" variant="outline" render={<Link to={`/characters/${c.id}`} />} nativeButton={false}>
            {t('Ouvrir la fiche')}
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function PlayerCard({ player, characters, unowned, players }: {
  player: PlayerRow
  characters: CharacterRow[]
  unowned: CharacterRow[]
  players: PlayerRow[]
}) {
  const t = useT()
  const rename = useRenamePlayer()
  const remove = useDeletePlayer()
  const assign = useAssignPlayer()
  const [mode, setMode] = useState<'idle' | 'rename' | 'delete'>('idle')

  return (
    <article className="flex flex-col gap-3 border border-border bg-card p-4" aria-label={player.name}>
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
        {mode === 'rename' ? (
          <NameForm
            label="Renommer" initial={player.name} onCancel={() => setMode('idle')}
            onSubmit={async (name) => { await rename.mutateAsync({ id: player.id, name }); setMode('idle') }}
          />
        ) : (
          <>
            <h2 className="font-heading text-2xl text-gold">{player.name}</h2>
            <span className="text-sm text-muted-foreground">{t.n(characters.length, '{n} personnage', '{n} personnages')}</span>
            <span className="ml-auto flex flex-wrap items-center gap-2 text-sm">
              {mode === 'delete' ? (
                <>
                  <span>{t('Retirer ce joueur ? Ses personnages passent « sans joueur ».')}</span>
                  <Button size="sm" variant="destructive" onClick={() => remove.mutate(player.id)}>{t('Oui')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setMode('idle')}>{t('Non')}</Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="link" onClick={() => setMode('rename')}>{t('Renommer')}</Button>
                  <Button size="sm" variant="link" onClick={() => setMode('delete')}>{t('Retirer')}</Button>
                </>
              )}
            </span>
          </>
        )}
      </header>

      <div className="flex flex-col gap-2">
        {characters.length
          ? characters.map((c) => <CharacterCard key={c.id} c={c} players={players} />)
          : <p className="text-sm text-muted-foreground">{t("Aucun personnage pour l'instant.")}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" render={<Link to={`/characters/new?joueur=${player.id}`} />} nativeButton={false}>
          <UserPlus data-icon="inline-start" />
          {t('Créer un personnage')}
        </Button>
        {unowned.length > 0 && (
          <NativeSelect
            size="sm" value="" aria-label={t('Donner un personnage à {name}', { name: player.name })}
            onChange={(e) => e.target.value && assign.mutate({ characterId: e.target.value, playerId: player.id })}
          >
            <NativeSelectOption value="">{t('Lui donner un personnage existant…')}</NativeSelectOption>
            {unowned.map((c) => <NativeSelectOption key={c.id} value={c.id}>{c.data.name}</NativeSelectOption>)}
          </NativeSelect>
        )}
      </div>
    </article>
  )
}

/** The people the keeper plays with, their investigators, and those investigators' progression. */
export function PlayersPage() {
  const t = useT()
  const players = usePlayers()
  const characters = useCharacters()
  const add = useAddPlayer()
  const error = players.error ?? characters.error

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t('Impossible de charger les joueurs : {error}', { error: error.message })}</AlertDescription>
      </Alert>
    )
  }
  if (!players.data || !characters.data) return <Skeleton className="h-48" />

  const all = characters.data
  const unowned = all.filter((c) => !c.player_id)

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <p className="text-muted-foreground">
          {t("Les personnes avec qui tu joues, juste un prénom. Chacune garde ses personnages d'une partie à l'autre, avec leur Santé mentale, leurs progrès et leur historique.")}
        </p>
        <NameForm label="Ajouter un joueur" onSubmit={(name) => add.mutateAsync(name)} />
      </header>

      {players.data.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Users /></EmptyMedia>
            <EmptyTitle>{t('Aucun joueur')}</EmptyTitle>
            <EmptyDescription>{t('Ajoute les personnes avec qui tu joues, puis donne-leur un investigateur.')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {players.data.map((p) => (
        <PlayerCard
          key={p.id} player={p} players={players.data}
          characters={all.filter((c) => c.player_id === p.id)} unowned={unowned}
        />
      ))}

      {unowned.length > 0 && (
        <Collapsible className="border border-border p-4">
          <CollapsibleTrigger className="group flex w-full flex-wrap items-baseline gap-3 text-left">
            <ChevronRight className="size-3.5 self-center transition-transform group-data-[panel-open]:rotate-90" />
            <h2 className="font-heading text-2xl">{t('Sans joueur')}</h2>
            <Badge variant="outline">{t.n(unowned.length, '{n} personnage', '{n} personnages')}</Badge>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 flex flex-col gap-2">
            {unowned.map((c) => <CharacterCard key={c.id} c={c} players={players.data} />)}
          </CollapsibleContent>
        </Collapsible>
      )}
    </section>
  )
}
