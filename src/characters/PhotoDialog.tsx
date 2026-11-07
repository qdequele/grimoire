import { Camera, Trash2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useT } from '@/i18n/t'
import { Avatar } from './Avatar'
import { PhotoError, photoFromFile } from './photo'

/**
 * Choose, change or remove an investigator's photo. A picked picture is cropped to a square and
 * shrunk in the browser, shown, then saved with "Enregistrer". `onSave(null)` removes the photo;
 * it rejects when the save failed (the caller says why), and the dialog stays open.
 */
export function PhotoDialog({ name, photo, open, onOpenChange, onSave }: {
  name: string
  photo: string | null | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (photo: string | null) => Promise<void>
}) {
  const t = useT()
  const input = useRef<HTMLInputElement>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Closing forgets a picked, unsaved picture.
  const setOpen = (next: boolean) => {
    if (!next) {
      setPicked(null)
      setError('')
    }
    onOpenChange(next)
  }

  const pick = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setBusy(true)
    try {
      setPicked(await photoFromFile(file))
    } catch (e) {
      setError(e instanceof PhotoError && e.code === 'too_big' ? t('Cette image est trop lourde.') : t("Cette image n'a pas pu être lue."))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  const save = async (value: string | null) => {
    setBusy(true)
    try {
      await onSave(value)
      setOpen(false)
    } catch {
      /* the caller shows the error */
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100svh-2rem)] gap-5 overflow-y-auto border border-gold/50 bg-card p-6 font-serif ring-0 sm:max-w-sm"
      >
        <header className="flex flex-col gap-2">
          <span className="eyebrow">{t('Photo')}</span>
          <DialogTitle className="font-heading text-2xl font-normal">{name}</DialogTitle>
          <span className="double-rule" />
          <DialogDescription className="font-serif text-base text-muted-foreground">
            {t('Elle remplace les initiales dans le rond qui représente l’investigateur, chez le gardien et sur les téléphones.')}
          </DialogDescription>
          <DialogClose render={<Button variant="ghost" size="icon-sm" className="absolute top-3 right-3" aria-label={t('Fermer')} />}>
            <X />
          </DialogClose>
        </header>

        <Avatar name={name} photo={picked ?? photo} className="mx-auto size-40 text-4xl" />
        {error && <p role="alert" className="text-center text-sm text-destructive">{error}</p>}

        <input
          ref={input}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-label={t('Choisir une photo')}
          onChange={(e) => void pick(e.target.files?.[0])}
        />
        {picked ? (
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => setPicked(null)}>{t('Annuler')}</Button>
            <Button disabled={busy} onClick={() => void save(picked)}>{t('Enregistrer')}</Button>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" className="border-gold text-gold hover:text-gold" disabled={busy} onClick={() => input.current?.click()}>
              <Camera data-icon="inline-start" />
              {photo ? t('Changer la photo') : t('Choisir une photo')}
            </Button>
            {photo && (
              <Button variant="ghost" disabled={busy} onClick={() => void save(null)}>
                <Trash2 data-icon="inline-start" />
                {t('Retirer la photo')}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
