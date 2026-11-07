import { Camera } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { KeeperAvatar } from '@/auth/KeeperAvatar'
import { useKeeperAvatar, useSetKeeperPhoto } from '@/auth/keeper'
import { Button } from '@/components/ui/button'
import { PhotoDialog } from '@/characters/PhotoDialog'
import { useT } from '@/i18n/t'

/** Réglages → Profil: the keeper's round head (own photo, else Gravatar, else initials). */
export function KeeperProfile() {
  const t = useT()
  const { name, email, photo, url } = useKeeperAvatar()
  const setPhoto = useSetKeeperPhoto()
  const [open, setOpen] = useState(false)

  const save = async (value: string | null) => {
    try {
      await setPhoto.mutateAsync(value)
    } catch (e) {
      toast.error(t("Impossible d'enregistrer la photo : {error}", { error: (e as Error).message }))
      throw e
    }
  }

  return (
    <section className="flex flex-col gap-5" aria-labelledby="keeper-profile">
      <header className="flex flex-col gap-1">
        <h2 id="keeper-profile" className="font-heading text-2xl">{t('Profil')}</h2>
        <p className="text-muted-foreground">
          {t('Sans photo choisie, Grimoire affiche ton Gravatar s’il existe, sinon tes initiales.')}
        </p>
      </header>
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="rounded-full focus-visible:ring-2 focus-visible:ring-gold focus-visible:outline-none"
          aria-label={t('Changer la photo')}
          onClick={() => setOpen(true)}
          data-testid="keeper-avatar"
        >
          <KeeperAvatar className="size-20 text-2xl" />
        </button>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate font-heading text-xl">{name}</span>
          {email && email !== name && <span className="truncate text-sm text-muted-foreground">{email}</span>}
          <Button variant="link" className="h-auto justify-start p-0 text-gold" onClick={() => setOpen(true)}>
            <Camera data-icon="inline-start" />
            {photo ? t('Changer la photo') : t('Choisir une photo')}
          </Button>
        </div>
      </div>
      <PhotoDialog
        name={name}
        photo={photo}
        url={url}
        description={t('Elle remplace ton Gravatar ou tes initiales dans le menu du compte.')}
        open={open}
        onOpenChange={setOpen}
        onSave={save}
      />
    </section>
  )
}
