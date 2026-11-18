// The player's table on a computer (a group playing online, the voice chat in another window):
// the scene's living décor fills the window with the place's name on top; the investigator and
// their points stay on the left, the documents the keeper showed and everyone's rolls on the right,
// and the sheet's pages (Fiche, Dés, Objets, Documents, Carnet, Profil) open over the décor from
// the bar at the bottom. Phones keep the tabbed sheet (SheetPage).
import { Camera, FileText, Settings, Volume2, VolumeX, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, Outlet, useMatch, useSearchParams } from 'react-router'
import { Avatar } from '@/characters/Avatar'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useT } from '@/i18n/t'
import { cn } from '@/lib/utils'
import { PLACE_LABEL, soundUrls } from '@/screen/ambiance'
import { Stage } from '@/screen/Stage'
import { shownScene, type ScreenScene } from '@/screen/state'
import { useAmbience } from '@/screen/useAmbience'
import { SkinToggle } from '@/theme/Masthead'
import { StoryText } from '@/tools/scenarios/StoryText'
import '@/items/items.css'
import { RollDialog, type RollTarget } from './Dice'
import { rollMessage, type TableRoll } from './rolls'
import { ChangeLink, StatTiles, type SheetContext } from './SheetPage'
import { useTable, useTableSound, type TableDocument, type TableView as Table } from './table'

/** What the décor shows before the keeper's game has set a scene. */
const IDLE_SCENE: ScreenScene = { preset: 'fog', image: null, sounds: [] }
/** Rolls listed beside the décor. */
const ROLLS_SHOWN = 8

type PanelId = 'fiche' | 'des' | 'objets' | 'documents' | 'carnet' | 'profil'
/** The bar's entries: a sheet page (its route, as on phones) or a panel of the table itself (`?panneau=`). */
const PANELS: Array<{ id: PanelId; label: string; route?: string }> = [
  { id: 'fiche', label: 'Fiche' },
  { id: 'des', label: 'Dés', route: 'des' },
  { id: 'objets', label: 'Objets', route: 'objets' },
  { id: 'documents', label: 'Documents' },
  { id: 'carnet', label: 'Carnet', route: 'carnet' },
  { id: 'profil', label: 'Profil', route: 'profil' },
]

/** A translucent box over the décor. */
function Box({ className, children, ...rest }: { className?: string; children: ReactNode } & React.ComponentProps<'section'>) {
  return (
    <section className={cn('border border-gold/35 bg-background/85 backdrop-blur-sm', className)} {...rest}>
      {children}
    </section>
  )
}

/** A document on paper: its picture, its text. */
function DocumentDialog({ doc, onClose }: { doc: TableDocument | null; onClose: () => void }) {
  const t = useT()
  // Keep showing the document while the dialog closes.
  const [shown, setShown] = useState(doc)
  if (doc && doc !== shown) setShown(doc)
  return (
    <Dialog open={!!doc} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="max-h-[calc(100svh-2rem)] gap-4 overflow-y-auto border-0 bg-transparent p-0 ring-0 shadow-none sm:max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">{t('Document')}</p>
          <div className="flex gap-2">
            {shown?.image && (
              <a href={shown.image} target="_blank" rel="noreferrer" className={buttonVariants({ size: 'sm', variant: 'outline', className: 'bg-background' })}>
                {t('Ouvrir en grand')}
              </a>
            )}
            <DialogClose render={<Button size="sm" variant="outline" className="bg-background" />}>{t('Fermer')}</DialogClose>
          </div>
        </div>
        <article className="idoc-paper" data-document={shown?.key}>
          <DialogTitle className="idoc-title">{shown?.title || t('Document')}</DialogTitle>
          {shown?.image && <img src={shown.image} alt={shown.title} className="mb-4 max-h-[70svh] w-full object-contain" />}
          <DialogDescription render={<div className="idoc-text" />}>
            {shown?.text ? <StoryText text={shown.text} /> : null}
          </DialogDescription>
        </article>
      </DialogContent>
    </Dialog>
  )
}

function DocumentList({ documents, onOpen, big }: { documents: TableDocument[]; onOpen: (d: TableDocument) => void; big?: boolean }) {
  const t = useT()
  if (!documents.length) {
    return <p className="font-serif text-base text-muted-foreground italic">{t('Le gardien n’a encore rien montré à la table.')}</p>
  }
  return (
    <ul className={cn(big ? 'grid grid-cols-2 gap-3 xl:grid-cols-3' : 'flex flex-col')}>
      {documents.map((d) => (
        <li key={d.id} className={cn(!big && 'border-b border-border last:border-b-0')}>
          <button
            type="button"
            onClick={() => onOpen(d)}
            className={cn(
              'group flex w-full items-center gap-2.5 text-left hover:text-gold',
              big ? 'h-full flex-col items-stretch border border-border bg-card p-3' : 'py-2',
            )}
          >
            {big && d.image ? (
              <img src={d.image} alt="" className="h-36 w-full bg-black/40 object-contain" />
            ) : (
              <FileText aria-hidden="true" className={cn('shrink-0 text-gold', big ? 'mx-auto my-6 size-10' : 'size-4')} />
            )}
            <span className="min-w-0 truncate font-serif text-lg">{d.title || t('Document')}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Everyone's last rolls, the keeper's for an investigator included. */
function RollList({ rolls, names }: { rolls: TableRoll[]; names: Map<string, string> }) {
  const t = useT()
  const shown = rolls.filter((r) => names.has(r.characterId)).slice(0, ROLLS_SHOWN)
  if (!shown.length) return <p className="font-serif text-base text-muted-foreground italic">{t('Aucun jet pour l’instant.')}</p>
  return (
    <ul aria-live="polite">
      {shown.map((r) => {
        const { title, text } = rollMessage(t, r, names.get(r.characterId) ?? '')
        const failed = r.kind === 'check' && r.level === 'failure'
        return (
          <li key={r.id} data-roll={r.kind} className="border-b border-border py-1.5 last:border-b-0">
            <p className="text-[0.6875rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              {title}
              {r.source === 'keeper' && <span className="ml-1.5 text-gold/80 normal-case">· {t('lancé par le gardien')}</span>}
            </p>
            <p className={cn('font-mono text-sm', failed || r.kind === 'damage' ? 'text-destructive' : 'text-foreground')}>{text}</p>
          </li>
        )
      })}
    </ul>
  )
}

/** The place's name: the keeper's or the story's, else the kind of décor, else nothing. */
function placeName(t: ReturnType<typeof useT>, scene: ScreenScene | null): string {
  if (scene?.name) return scene.name
  return scene?.place ? t(PLACE_LABEL[scene.place]) : ''
}

/** The document the keeper is showing now, as a document: its kept copy, else what the screen carries. */
function shownDocument(table: Table | undefined): TableDocument | null {
  const h = table?.screen.handout
  if (!h) return null
  const kept = table.documents.find((d) => d.key === h.key)
  if (kept) return kept
  const image = h.image?.url
  if (!h.text && !image) return null
  return { id: `screen:${h.key}`, key: h.key, title: h.title, ...(h.text ? { text: h.text } : {}), ...(image ? { image } : {}), createdAt: '' }
}

export function TableView({ ctx, onPhoto }: { ctx: SheetContext; onPhoto: () => void }) {
  const t = useT()
  const { token, view, live, member } = ctx
  const table = useTable(token, true).data
  const [params] = useSearchParams()
  const route = useMatch('/t/:token/c/:characterId/:tab')?.params.tab
  const [rolling, setRolling] = useState<RollTarget | null>(null)
  const [reading, setReading] = useState<TableDocument | null>(null)
  const [sound, setSound] = useTableSound()
  // Browsers only start sound after a click on the page.
  const [touched, setTouched] = useState(false)
  useEffect(() => {
    const on = () => setTouched(true)
    addEventListener('pointerdown', on, { once: true })
    return () => removeEventListener('pointerdown', on)
  }, [])

  // Escape opens the settings, unless it is closing a dialog (seen before the dialog handles the key).
  // Opened once the key press is over: a dialog mounted during it would get the same Escape and close.
  const [settings, setSettings] = useState(false)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const on = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.repeat || document.querySelector('[role="dialog"]')) return
      timer = setTimeout(() => setSettings(true))
    }
    addEventListener('keydown', on, true)
    return () => {
      clearTimeout(timer)
      removeEventListener('keydown', on, true)
    }
  }, [])

  const scene = table ? shownScene(table.screen) : null
  useAmbience(soundUrls(scene?.sounds ?? []), sound && touched)

  // A document the keeper shows opens by itself, once: the player closes it and finds it in the list.
  const pushed = shownDocument(table)
  const [opened, setOpened] = useState<string | null>(null)
  if (pushed && pushed.key !== opened) {
    setOpened(pushed.key)
    setReading(pushed)
  }
  if (!pushed && opened !== null) setOpened(null)

  const base = `/t/${token}/c/${member.id}`
  const routed = PANELS.find((p) => p.route && p.route === route)
  const asked = params.get('panneau')
  const open: PanelId | null = routed ? routed.id : !route && (asked === 'fiche' || asked === 'documents') ? asked : null
  const href = (p: (typeof PANELS)[number]) => (p.id === open ? base : p.route ? `${base}/${p.route}` : `${base}?panneau=${p.id}`)

  const d = member.data
  const subtitle = [d.occupation, d.age ? t('{n} ans', { n: d.age }) : ''].filter(Boolean).join(' · ')
  const names = new Map(view.party.map((m) => [m.id, m.data.name]))
  const documents = table?.documents ?? []
  const items = view.items.filter((i) => i.characterId === member.id).length
  const place = placeName(t, scene)
  const count = (id: PanelId) => (id === 'documents' ? documents.length : id === 'objets' ? items : 0)

  return (
    <div data-testid="table" className="fixed inset-0 z-0">
      <div className="scr-root" aria-hidden="true">
        <Stage scene={scene ?? IDLE_SCENE} handout={null} />
      </div>

      <header className="pointer-events-none absolute inset-x-80 top-0 flex flex-col items-center gap-1 pt-5 text-center">
        <span className="eyebrow [text-shadow:0_1px_6px_#000]">{view.game.title || t('À la table')}</span>
        {place && (
          <h1 data-testid="table-place" className="font-heading text-4xl leading-tight text-balance text-[#efe6cf] [text-shadow:0_2px_14px_#000,0_0_3px_#000]">
            {place}
          </h1>
        )}
      </header>

      {/* The investigator: always there, points live with the keeper. */}
      <aside className="absolute top-4 bottom-20 left-4 flex w-72 flex-col gap-3 overflow-y-auto">
        <Box className="flex flex-col items-center gap-3 p-4" aria-label={d.name}>
          <button
            type="button"
            className="group relative rounded-full focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
            aria-label={member.photo ? t('Changer la photo de {name}', { name: d.name }) : t('Ajouter une photo de {name}', { name: d.name })}
            onClick={onPhoto}
          >
            <Avatar name={d.name} photo={member.photo} className="size-20 text-2xl group-hover:border-foreground" />
            <span aria-hidden="true" className="absolute -right-1 -bottom-1 grid size-7 place-items-center rounded-full border border-gold bg-background text-gold">
              <Camera className="size-3.5" />
            </span>
          </button>
          <div className="text-center">
            <h2 className="font-heading text-2xl leading-tight">{d.name}</h2>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <p
            className={cn(
              'flex h-4 items-center gap-1.5 text-[0.625rem] font-semibold tracking-[0.14em] text-emerald-400 uppercase transition-opacity',
              !live && 'opacity-0',
            )}
            aria-hidden={!live}
          >
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
            {t('En direct avec le gardien')}
          </p>
          <div className="w-full">
            <StatTiles token={token} view={view} member={member} onRoll={setRolling} compact />
          </div>
        </Box>
      </aside>

      {/* What the table shares: the keeper's documents, everyone's rolls. */}
      <aside className="absolute top-4 right-4 bottom-20 flex w-80 flex-col gap-3 overflow-y-auto">
        <Box className="flex flex-col gap-1 p-4" aria-label={t('Documents')}>
          <h2 className="eyebrow">{t('Documents')}</h2>
          <DocumentList documents={documents.slice(0, 6)} onOpen={setReading} />
          {documents.length > 6 && (
            <Link to={`${base}?panneau=documents`} className="pt-1 text-xs tracking-[0.14em] text-muted-foreground uppercase underline underline-offset-4 hover:text-gold">
              {t('Tous les documents ({n})', { n: documents.length })}
            </Link>
          )}
        </Box>
        <Box className="flex flex-col gap-1 p-4" aria-label={t('Jets de la table')}>
          <h2 className="eyebrow">{t('Jets de la table')}</h2>
          <RollList rolls={table?.rolls ?? []} names={names} />
        </Box>
      </aside>

      {open && (
        <Box
          className="absolute top-24 right-4 bottom-20 left-80 z-10 flex flex-col 2xl:right-[21.5rem]"
          aria-label={t(PANELS.find((p) => p.id === open)?.label ?? '')}
          data-panel={open}
        >
          <div className="flex items-center justify-between gap-3 border-b border-gold/25 px-5 py-2.5">
            <h2 className="font-heading text-2xl">{t(PANELS.find((p) => p.id === open)?.label ?? '')}</h2>
            <Link to={base} aria-label={t('Fermer')} className={buttonVariants({ variant: 'ghost', size: 'icon' })}>
              <X />
            </Link>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {open === 'documents' ? <DocumentList documents={documents} onOpen={setReading} big /> : <Outlet context={{ ...ctx, table: true } satisfies SheetContext} />}
          </div>
        </Box>
      )}

      <Button
        variant="outline"
        size="icon"
        className="absolute bottom-4 left-4 bg-background/85"
        aria-label={t('Réglages')}
        title={t('Réglages (Échap)')}
        onClick={() => setSettings(true)}
      >
        <Settings />
      </Button>

      <nav aria-label={t('Fiche')} className="absolute inset-x-0 bottom-4 flex justify-center">
        <ul className="flex border border-gold/35 bg-background/90 backdrop-blur-sm">
          {PANELS.map((p) => (
            <li key={p.id}>
              <Link
                to={href(p)}
                aria-current={p.id === open ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-1.5 px-5 py-3 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase hover:text-gold',
                  p.id === open && 'bg-gold text-background hover:text-background',
                )}
              >
                {t(p.label)}
                {count(p.id) > 0 && <span className="font-mono text-[0.6875rem] tracking-normal opacity-80">{count(p.id)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* The table's settings, as in a game: Escape opens them. */}
      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent className="gap-5 rounded-none border border-gold/40 bg-background sm:max-w-sm">
          <DialogTitle className="font-heading text-2xl">{t('Réglages')}</DialogTitle>
          <DialogDescription className="sr-only">{t('Réglages')}</DialogDescription>
          <div className="flex flex-col items-center gap-4">
            <Button variant="outline" aria-pressed={sound} onClick={() => setSound(!sound)}>
              {sound ? <Volume2 data-icon="inline-start" /> : <VolumeX data-icon="inline-start" />}
              {sound ? t('Ambiance sonore : oui') : t('Ambiance sonore : non')}
            </Button>
            <SkinToggle />
            {!view.focus && <ChangeLink token={token} />}
          </div>
        </DialogContent>
      </Dialog>
      <RollDialog target={rolling} onClose={() => setRolling(null)} ctx={ctx} />
      <DocumentDialog doc={reading} onClose={() => setReading(null)} />
    </div>
  )
}
