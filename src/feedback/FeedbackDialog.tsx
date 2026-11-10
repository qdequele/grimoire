import { X } from 'lucide-react'
import { useState } from 'react'
import { useLocation } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useT } from '@/i18n/t'
import { cn } from '@/lib/utils'
import { useLang } from '@/settings/lang'
import { isFeedbackLimit, MAX_FEEDBACK, useSendFeedback } from './api'
import { FEEDBACK_KINDS, KIND_LABEL, KIND_PLACEHOLDER, type FeedbackKind } from './kinds'

/** The keeper tells us what's broken, what they'd like, or what they love. Stored in `feedback`. */
export function FeedbackDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT()
  const lang = useLang((s) => s.lang)
  const { pathname, search } = useLocation()
  const send = useSendFeedback()
  const [kind, setKind] = useState<FeedbackKind>('idea')
  const [message, setMessage] = useState('')
  const [contactOk, setContactOk] = useState(true)
  const length = message.trim().length
  const valid = length >= 1 && length <= MAX_FEEDBACK

  const submit = async () => {
    if (!valid) return
    try {
      await send.mutateAsync({ kind, message, contactOk, page: pathname + search, lang })
      toast.success(t('Merci ! Ton avis est bien arrivé.'))
      setMessage('')
      setKind('idea')
      onOpenChange(false)
    } catch (e) {
      toast.error(
        isFeedbackLimit(e)
          ? t('Tu as envoyé beaucoup de messages aujourd’hui : réessaie demain.')
          : t('Impossible d’envoyer ton avis : {error}', { error: (e as Error).message }),
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100svh-2rem)] gap-5 overflow-y-auto border border-gold/50 bg-card p-6 font-serif ring-0 sm:max-w-lg"
      >
        <header className="flex flex-col gap-2">
          <span className="eyebrow">Grimoire</span>
          <DialogTitle className="font-heading text-2xl font-normal">{t('Donner mon avis')}</DialogTitle>
          <span className="double-rule" />
          <DialogDescription className="font-serif text-base text-muted-foreground">
            {t('Un problème, une idée, un mot gentil : chaque message est lu.')}
          </DialogDescription>
          <DialogClose render={<Button variant="ghost" size="icon-sm" className="absolute top-3 right-3" aria-label={t('Fermer')} />}>
            <X />
          </DialogClose>
        </header>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="eyebrow mb-2">{t('C’est à propos de…')}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FEEDBACK_KINDS.map((k) => (
                <label
                  key={k}
                  className={cn(
                    'cursor-pointer border border-border px-2 py-2 text-center font-sans text-xs font-semibold tracking-[0.08em] uppercase transition-colors hover:border-gold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50',
                    kind === k && 'border-gold text-gold',
                  )}
                >
                  <input type="radio" name="feedback-kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
                  {t(KIND_LABEL[k])}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1">
            <Textarea
              value={message}
              autoFocus
              aria-label={t('Ton message')}
              placeholder={t(KIND_PLACEHOLDER[kind])}
              maxLength={MAX_FEEDBACK + 200}
              className="min-h-32 font-serif text-base"
              onChange={(e) => setMessage(e.target.value)}
            />
            {length > MAX_FEEDBACK && (
              <span className="text-xs text-destructive">{`${length} / ${MAX_FEEDBACK}`}</span>
            )}
          </div>

          <label className="flex items-start gap-2 font-sans text-sm">
            <Checkbox checked={contactOk} onCheckedChange={(c) => setContactOk(c === true)} className="mt-0.5" />
            <span>{t('Vous pouvez me répondre à l’adresse e-mail de mon compte.')}</span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" className="ml-auto" onClick={() => onOpenChange(false)}>{t('Annuler')}</Button>
            <Button type="submit" disabled={!valid || send.isPending}>{t('Envoyer')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
