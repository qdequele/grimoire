import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Eraser, ExternalLink, FileText, ImagePlus, Monitor, Plus, RefreshCw, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useRef, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/auth/auth'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { useT } from '@/i18n/t'
import { cn } from '@/lib/utils'
import { findScene, isPreset, PRESET_LABEL, PRESETS } from '@/screen/ambiance'
import type { ImageRef, ScreenHandout } from '@/screen/state'
import {
  handoutImagePath, listUploads, screenUrl, uploadPicture, useCreateScreenLink, useReplaceScreenLink, useScreenLink,
  type ScreenControl, type ScreenStory,
} from './screen'

/** Something the keeper can push to the screen. */
interface Item { handout: ScreenHandout; label: string }

const uploadsKey = (gameId: string) => ['screen-uploads', gameId] as const

/** The story's handouts and pictures, this scene's first. Pictures the pack doesn't have are left out. */
function storyItems(story: ScreenStory, sceneId: string | undefined): { scene: Item[]; other: Item[] } {
  const files = new Set(story.files)
  const ref = (p: string | undefined): ImageRef | null => (p && files.has(p) ? { bucket: 'story-packs', path: `${story.folder}/${p}` } : null)
  const scene = findScene(story.content, sceneId)
  const inScene = new Set(scene?.handouts ?? [])
  const out = { scene: [] as Item[], other: [] as Item[] }
  for (const h of story.content.handouts ?? []) {
    const image = ref(handoutImagePath(h.image))
    if (!image && !h.text) continue
    const item = { label: h.title, handout: { key: `handout:${h.id}`, title: h.title, ...(h.text ? { text: h.text } : {}), image } }
    ;(inScene.has(h.id) || (sceneId && h.scene === sceneId) ? out.scene : out.other).push(item)
  }
  for (const s of story.content.acts.flatMap((a) => a.scenes)) {
    for (const img of s.images ?? []) {
      const image = ref(img.src)
      if (!image) continue
      const title = img.caption ?? ''
      ;(s.id === sceneId ? out.scene : out.other).push({ label: title || img.src.replace(/^images\//, ''), handout: { key: `image:${img.src}`, title, image } })
    }
  }
  return out
}

function Thumb({ control, image }: { control: ScreenControl; image: ImageRef | null }) {
  const url = useQuery({
    queryKey: ['screen-thumb', image?.bucket, image?.path],
    enabled: !!image,
    staleTime: 3600_000,
    queryFn: async () => (await control.sign(image!)) ?? null,
  })
  return (
    <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden border border-gold/40 bg-black/40">
      {image ? (url.data ? <img src={url.data} alt="" className="size-full object-cover" /> : <Skeleton className="size-full" />) : <FileText className="size-5 text-muted-foreground" />}
    </span>
  )
}

function ItemRow({ control, item, shown }: { control: ScreenControl; item: Item; shown: boolean }) {
  const t = useT()
  return (
    <li className="flex items-center gap-3 border-t border-border py-2 first:border-t-0">
      <Thumb control={control} image={item.handout.image} />
      <span className={cn('min-w-0 flex-1 truncate', shown && 'text-gold')}>{item.label || t('Image')}</span>
      {shown ? (
        <Button size="sm" variant="ghost" onClick={() => control.dispatch({ type: 'clear' })} aria-label={t('Retirer de l’écran : {name}', { name: item.label })}>
          <Eraser /> {t('Retirer')}
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => control.dispatch({ type: 'show', handout: item.handout })}
          aria-label={t('Montrer à l’écran : {name}', { name: item.label })}>
          <Monitor /> {t('Montrer')}
        </Button>
      )}
    </li>
  )
}

function ItemList({ title, items, control, shownKey }: { title: string; items: Item[]; control: ScreenControl; shownKey: string | undefined }) {
  if (!items.length) return null
  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-sm text-muted-foreground">{title}</h4>
      <ul className="flex flex-col">
        {items.map((i) => <ItemRow key={i.handout.key} control={control} item={i} shown={i.handout.key === shownKey} />)}
      </ul>
    </div>
  )
}

function LinkSection({ gameId }: { gameId: string }) {
  const t = useT()
  const link = useScreenLink(gameId)
  const create = useCreateScreenLink()
  const replace = useReplaceScreenLink()
  const busy = create.isPending || replace.isPending
  const fail = (e: unknown) => toast.error(t((e as Error).message))
  const url = link.data ? screenUrl(link.data.token) : null

  if (link.isPending) return <Skeleton className="mx-auto size-52" />
  if (!url || !link.data) {
    return (
      <Button className="self-center" disabled={busy} onClick={() => create.mutateAsync({ gameId }).catch(fail)}>
        <Plus /> {t("Créer le lien de l'écran")}
      </Button>
    )
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t('Lien copié.'))
    } catch {
      toast.error(t('Impossible de copier le lien.'))
    }
  }
  return (
    <>
      <div className="flex flex-col items-center gap-2">
        <div className="border border-gold/60 bg-[#efe6cf] p-3">
          <QRCodeSVG value={url} size={176} bgColor="#efe6cf" fgColor="#0a0907" marginSize={0} />
        </div>
        <code className="max-w-full font-mono text-[0.7rem] break-all text-muted-foreground" data-testid="screen-url">{url}</code>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" onClick={copy}><Copy /> {t('Copier')}</Button>
        <Button variant="outline" render={<a href={url} target="_blank" rel="noreferrer" />} nativeButton={false}><ExternalLink /> {t('Ouvrir')}</Button>
        <Button variant="ghost" disabled={busy} onClick={() => replace.mutateAsync({ linkId: link.data!.id, gameId }).catch(fail)}>
          <RefreshCw /> {t('Révoquer et remplacer')}
        </Button>
      </div>
    </>
  )
}

/**
 * The ambiance screen, from the game screen's toolbar: its link (QR code for the TV), what it shows
 * (follow the scene or stay pinned, preset, sound) and the documents to push to it.
 */
export function ScreenDialog({ gameId, control, story, open, onOpenChange }: {
  gameId: string
  control: ScreenControl
  story: ScreenStory
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const qc = useQueryClient()
  const { session } = useAuth()
  const ownerId = session?.user.id
  const state = useSyncExternalStore(control.subscribe, control.get)
  const file = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const items = storyItems(story, open ? control.currentScene : undefined)
  const uploads = useQuery({
    queryKey: uploadsKey(gameId),
    enabled: open && !!ownerId,
    queryFn: () => listUploads(ownerId!, gameId),
  })
  const uploadItems: Item[] = (uploads.data ?? []).map((image) => ({ label: '', handout: { key: `upload:${image.path}`, title: '', image } }))

  const onFile = async (f: File | undefined) => {
    if (!f || !ownerId) return
    setUploading(true)
    try {
      const image = await uploadPicture(ownerId, gameId, f)
      control.dispatch({ type: 'show', handout: { key: `upload:${image.path}`, title: '', image } })
      await qc.invalidateQueries({ queryKey: uploadsKey(gameId) })
    } catch (e) {
      toast.error(t("Impossible d'envoyer cette image."))
      console.error('Screen upload failed', e)
    } finally {
      setUploading(false)
      if (file.current) file.current.value = ''
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100svh-2rem)] gap-5 overflow-y-auto border border-gold/50 bg-card p-6 font-serif ring-0 sm:max-w-md"
      >
        <header className="flex flex-col gap-2">
          <span className="eyebrow">{t("Écran d'ambiance")}</span>
          <DialogTitle className="font-heading text-2xl font-normal">{t("L'écran de la table")}</DialogTitle>
          <span className="deco-rule" />
          <DialogDescription className="font-serif text-base text-muted-foreground">
            {t("Ouvre ce lien sur une télévision ou une tablette au milieu de la table : l'ambiance de la scène, et les documents que tu y envoies.")}
          </DialogDescription>
          <DialogClose render={<Button variant="ghost" size="icon-sm" className="absolute top-3 right-3" aria-label={t('Fermer')} />}>
            <X />
          </DialogClose>
        </header>

        <section className="flex flex-col gap-3">
          <LinkSection gameId={gameId} />
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="eyebrow">{t("À l'écran")}</h3>
          <div className="flex items-center gap-2">
            <Checkbox id="scr-follow" checked={state.follow} onCheckedChange={(c) => control.dispatch({ type: 'follow', on: c === true })} />
            <label htmlFor="scr-follow">{t('Suivre la scène')}</label>
          </div>
          {!state.follow && <p className="text-sm text-muted-foreground">{t("Épinglé : l'écran garde cette ambiance quand tu changes de scène.")}</p>}
          <div className="flex items-center gap-2">
            <label htmlFor="scr-preset">{t('Ambiance')}</label>
            <NativeSelect id="scr-preset" value={state.override ?? ''}
              onChange={(e) => control.dispatch({ type: 'preset', preset: isPreset(e.target.value) ? e.target.value : null })}>
              <NativeSelectOption value="">
                {t('Selon la scène ({preset})', { preset: t(PRESET_LABEL[state.scene?.preset ?? 'fog']) })}
              </NativeSelectOption>
              {PRESETS.map((p) => <NativeSelectOption key={p} value={p}>{t(PRESET_LABEL[p])}</NativeSelectOption>)}
            </NativeSelect>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="scr-sound" checked={state.sound} onCheckedChange={(c) => control.dispatch({ type: 'sound', on: c === true })} />
            <label htmlFor="scr-sound">{t("Jouer les sons d'ambiance sur l'écran")}</label>
          </div>
          {state.handout && (
            <div className="flex items-center gap-2 border border-gold/40 p-2">
              <span className="min-w-0 flex-1 truncate text-sm">
                {t('Affiché : {name}', { name: state.handout.title || t('Image') })}
              </span>
              <Button size="sm" onClick={() => control.dispatch({ type: 'clear' })}><Eraser /> {t("Effacer l'écran")}</Button>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="eyebrow">{t('Documents')}</h3>
          <ItemList title={t('Cette scène')} items={items.scene} control={control} shownKey={state.handout?.key} />
          <ItemList title={t('Toute l’histoire')} items={items.other} control={control} shownKey={state.handout?.key} />
          <ItemList title={t('Images envoyées')} items={uploadItems} control={control} shownKey={state.handout?.key} />
          {!items.scene.length && !items.other.length && !uploadItems.length && (
            <p className="text-sm italic text-muted-foreground">{t('Aucun document dans cette histoire pour l’instant.')}</p>
          )}
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" className="hidden"
            aria-label={t('Image à montrer')} onChange={(e) => void onFile(e.target.files?.[0])} />
          <Button variant="outline" className="self-start" disabled={uploading || !ownerId} onClick={() => file.current?.click()}>
            <ImagePlus /> {uploading ? t('Envoi…') : t('Envoyer une image…')}
          </Button>
        </section>
      </DialogContent>
    </Dialog>
  )
}
