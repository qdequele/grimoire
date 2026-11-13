import { Copy, Link2Off, Plus, QrCode, RefreshCw, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Avatar } from '@/characters/Avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useT } from '@/i18n/t'
import { linkUrl, useCreateLink, useGameLinks, useRevokeLink, type TableLink } from './links'

export interface TableMember { id: string; name: string; player?: string; photo?: string | null }

/** QR code on a light ground (phones read dark-on-light best), with the link under it. */
function LinkQr({ link }: { link: TableLink }) {
  const url = linkUrl(link.token)
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="border border-gold/60 bg-[#efe6cf] p-3">
        <QRCodeSVG value={url} size={176} bgColor="#efe6cf" fgColor="#0a0907" marginSize={0} />
      </div>
      <code className="max-w-full font-mono text-[0.7rem] break-all text-muted-foreground">{url}</code>
    </div>
  )
}

function useLinkActions(gameId: string) {
  const t = useT()
  const create = useCreateLink()
  const revoke = useRevokeLink()
  const fail = (e: unknown) => toast.error(t((e as Error).message))
  return {
    busy: create.isPending || revoke.isPending,
    create: (characterId?: string) => create.mutateAsync({ gameId, characterId }).catch(fail),
    revoke: (link: TableLink) => revoke.mutateAsync({ linkId: link.id, gameId }).catch(fail),
    replace: async (link: TableLink) => {
      try {
        await revoke.mutateAsync({ linkId: link.id, gameId })
        await create.mutateAsync({ gameId })
      } catch (e) {
        fail(e)
      }
    },
    copy: async (link: TableLink) => {
      try {
        await navigator.clipboard.writeText(linkUrl(link.token))
        toast.success(t('Lien copié.'))
      } catch {
        toast.error(t('Impossible de copier le lien.'))
      }
    },
  }
}

/** One investigator: their personal link (only their sheet), created on demand. */
function MemberRow({ gameId, member, link }: { gameId: string; member: TableMember; link: TableLink | undefined }) {
  const t = useT()
  const a = useLinkActions(gameId)
  const [shown, setShown] = useState(false)
  return (
    <li className="flex flex-col gap-3 border-t border-border py-2.5 first:border-t-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Avatar name={member.name} photo={member.photo} className="size-7 text-[0.625rem]" />
        <span className="font-heading text-base">{member.name}</span>
        {member.player && <span className="text-sm text-muted-foreground">{member.player}</span>}
        <span className="ml-auto flex gap-1">
          {link ? (
            <>
              <Button size="icon-sm" variant="ghost" aria-pressed={shown} aria-label={t('QR code de {name}', { name: member.name })}
                title={t('QR code')} onClick={() => setShown((v) => !v)}>
                <QrCode />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label={t('Copier le lien de {name}', { name: member.name })}
                title={t('Copier')} onClick={() => a.copy(link)}>
                <Copy />
              </Button>
              <Button size="icon-sm" variant="ghost" disabled={a.busy} aria-label={t('Révoquer le lien de {name}', { name: member.name })}
                title={t('Révoquer')} onClick={() => a.revoke(link).then(() => setShown(false))}>
                <Link2Off />
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" disabled={a.busy} aria-label={t('Créer le lien de {name}', { name: member.name })}
              onClick={() => a.create(member.id).then(() => setShown(true))}>
              <Plus /> {t('Créer')}
            </Button>
          )}
        </span>
      </div>
      {link && shown && <LinkQr link={link} />}
    </li>
  )
}

/**
 * "Players at the table": the table link (anyone can join and create an investigator) and one
 * personal link per investigator. Opened from the game screen's toolbar, above the engine iframe.
 */
export function TableLinksDialog({ gameId, party, open, onOpenChange }: {
  gameId: string
  party: TableMember[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const links = useGameLinks(gameId)
  const a = useLinkActions(gameId)
  const tableLink = links.data?.find((l) => l.character_id === null)
  const personal = (id: string) => links.data?.find((l) => l.character_id === id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100svh-2rem)] gap-5 overflow-y-auto border border-gold/50 bg-card p-6 font-serif ring-0 sm:max-w-md"
      >
        <header className="flex flex-col gap-2">
          <span className="eyebrow">{t('Joueurs à la table')}</span>
          <DialogTitle className="font-heading text-2xl font-normal">{t('Liens des joueurs')}</DialogTitle>
          <span className="deco-rule" />
          <DialogDescription className="font-serif text-base text-muted-foreground">
            {t('Les joueurs ouvrent un lien sur leur téléphone ou leur ordinateur pour suivre leur investigateur. En ligne, copie-le dans votre salon (Discord…).')}
          </DialogDescription>
          <DialogClose render={<Button variant="ghost" size="icon-sm" className="absolute top-3 right-3" aria-label={t('Fermer')} />}>
            <X />
          </DialogClose>
        </header>

        <section className="flex flex-col gap-3">
          <h3 className="eyebrow">{t('Lien de la table')}</h3>
          <p className="text-sm text-muted-foreground">{t('Pour toute la table : chacun choisit ou crée son investigateur.')}</p>
          {links.isPending ? (
            <Skeleton className="mx-auto size-52" />
          ) : tableLink ? (
            <>
              <LinkQr link={tableLink} />
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" onClick={() => a.copy(tableLink)}><Copy /> {t('Copier')}</Button>
                <Button variant="ghost" disabled={a.busy} onClick={() => a.replace(tableLink)}>
                  <RefreshCw /> {t('Révoquer et remplacer')}
                </Button>
              </div>
            </>
          ) : (
            <Button className="self-center" disabled={a.busy} onClick={() => a.create()}>
              <Plus /> {t('Créer le lien de la table')}
            </Button>
          )}
        </section>

        <section className="flex flex-col gap-1">
          <h3 className="eyebrow">{t('Liens personnels')}</h3>
          <p className="text-sm text-muted-foreground">{t('Un lien par investigateur : il ne montre que sa fiche.')}</p>
          {party.length ? (
            <ul className="mt-1 flex flex-col">
              {party.map((m) => <MemberRow key={m.id} gameId={gameId} member={m} link={personal(m.id)} />)}
            </ul>
          ) : (
            <p className="text-sm italic text-muted-foreground">{t('Aucun investigateur de ton compte dans cette partie.')}</p>
          )}
        </section>
      </DialogContent>
    </Dialog>
  )
}
