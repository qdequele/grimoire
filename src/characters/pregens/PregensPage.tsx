// Investigateurs, first tab (/characters): twelve ready-made 1920s investigators. A keeper
// reads one's sheet and adds it to their account, where it becomes an ordinary investigator.
import { BookOpen, Check, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useT } from '@/i18n/t'
import { useLang } from '@/settings/lang'
import { useCharacters, type CharacterRow } from '../api'
import { Avatar } from '../Avatar'
import { CharacterSheet } from '../CharacterSheet'
import { useAddPregen } from './api'
import { portraitUrl } from './portrait'
import { PREGENS, pregenData, type Pregen } from './pregens'

/** The sheet as CharacterSheet wants it (a row that isn't in the database). */
const rowOf = (p: Pregen, lang: 'fr' | 'en'): CharacterRow =>
  ({ id: `pregen-${p.id}`, name: p.name, data: pregenData(p, lang), photo: null, player: null }) as unknown as CharacterRow

export function PregensPage() {
  const t = useT()
  const lang = useLang((s) => s.lang)
  const navigate = useNavigate()
  const mine = useCharacters()
  const add = useAddPregen()
  const [open, setOpen] = useState<Pregen | null>(null)

  /** The keeper's copy of a pregen (same name), if they already added it. */
  const copyOf = (p: Pregen) => mine.data?.find((c) => c.data.name === p.name)

  const addOne = (p: Pregen) =>
    add.mutate(
      { pregen: p, lang },
      {
        onSuccess: (row) => {
          toast.success(t('{name} rejoint tes personnages.', { name: p.name }), {
            action: { label: t('Voir la fiche'), onClick: () => navigate(`/characters/${row.id}`) },
          })
        },
        onError: (e) => toast.error(t("Impossible d'ajouter l'investigateur : {error}", { error: e.message })),
      },
    )

  const addButton = (p: Pregen, size: 'xs' | 'default' = 'xs') => {
    const copy = copyOf(p)
    if (copy) {
      return (
        <Button size={size} variant="ghost" className="relative z-10" render={<Link to={`/characters/${copy.id}`} />} nativeButton={false}>
          <Check data-icon="inline-start" />
          {t('Dans tes personnages')}
        </Button>
      )
    }
    return (
      <Button
        size={size}
        variant={size === 'xs' ? 'outline' : 'default'}
        className="relative z-10"
        disabled={add.isPending && add.variables?.pregen.id === p.id}
        aria-label={t('Ajouter {name} à mes personnages', { name: p.name })}
        onClick={() => addOne(p)}
      >
        <UserPlus data-icon="inline-start" />
        {t('Ajouter')}
      </Button>
    )
  }

  return (
    <section className="flex flex-col gap-6">
      <p className="max-w-3xl text-muted-foreground">
        {t('Douze investigateurs des années 1920, prêts à jouer. Ajoute ceux qui te plaisent : ils deviennent les tiens, à modifier, confier à un joueur et faire progresser.')}
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PREGENS.map((p) => {
          const d = pregenData(p, lang)
          return (
            <li key={p.id}>
              <Card size="sm" className="relative h-full">
                <CardHeader className="grid-cols-[auto_1fr] gap-x-4">
                  <Avatar name={p.name} url={portraitUrl(p.id)} className="row-span-2 size-16 self-center text-lg" />
                  <CardTitle>
                    <button type="button" className="text-left after:absolute after:inset-0 hover:text-gold" onClick={() => setOpen(p)}>
                      {p.name}
                    </button>
                  </CardTitle>
                  <CardDescription>
                    {[d.occupation && t(d.occupation), t('{n} ans', { n: p.age }), p.origin[lang]].join(' · ')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="font-serif text-base leading-snug italic">{p.text[lang].hook}</CardContent>
                <CardFooter className="mt-auto flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{t('PV')} {d.hp}</Badge>
                  <Badge variant="outline">SAN {d.san}</Badge>
                  <Badge variant="outline">{t('Chance')} {d.luck}</Badge>
                  <span className="ml-auto">{addButton(p)}</span>
                </CardFooter>
              </Card>
            </li>
          )
        })}
      </ul>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[calc(100svh-2rem)] gap-0 overflow-y-auto border border-gold/50 bg-background p-6 ring-0 sm:max-w-4xl sm:p-8"
        >
          <DialogTitle className="sr-only">{t("Fiche d'investigateur")}</DialogTitle>
          <DialogDescription className="sr-only">{open?.text[lang].hook ?? ''}</DialogDescription>
          {open && (
            <CharacterSheet
              character={rowOf(open, lang)}
              portrait={portraitUrl(open.id)}
              headingLevel={2}
              actions={
                <>
                  {addButton(open, 'default')}
                  <DialogClose render={<Button variant="outline" />}>{t('Fermer')}</DialogClose>
                </>
              }
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}

/** Link from "Mes personnages" to the ready-made investigators. */
export function PregensLink({ className }: { className?: string }) {
  const t = useT()
  return (
    <Button variant="outline" className={className} render={<Link to="/characters" />} nativeButton={false}>
      <BookOpen data-icon="inline-start" />
      {t('Investigateurs prêts à jouer')}
    </Button>
  )
}
