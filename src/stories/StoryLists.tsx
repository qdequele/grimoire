import { BookOpen, Languages, Store } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { useMarketplaceStories, useMyStories, type StoryRow } from './api'
import { StoryCard } from './StoryCard'
import { ALL_LANGS, filterByLanguage, languageName, pickLanguage, storyLanguages } from './languages'
import { useT } from '@/i18n/t'

function StoryGrid({ stories, isPending, error, empty }: {
  stories: StoryRow[] | undefined
  isPending: boolean
  error: Error | null
  empty: ReactNode
}) {
  const t = useT()
  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t('Impossible de charger les histoires : {error}', { error: error.message })}</AlertDescription>
      </Alert>
    )
  }
  if (isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)}
      </div>
    )
  }
  if (!stories?.length) return empty
  return <FilteredGrid stories={stories} />
}

/** The stories in the chosen language (`?lang=`, else the app's language), with the dropdown. */
function FilteredGrid({ stories }: { stories: StoryRow[] }) {
  const t = useT()
  const id = useId()
  const [params, setParams] = useSearchParams()
  const langs = storyLanguages(stories, t.lang)
  const chosen = params.get('lang')
  const lang = pickLanguage(chosen, langs, t.lang)
  const shown = filterByLanguage(stories, lang)
  const options = lang === ALL_LANGS || langs.includes(lang) ? langs : [...langs, lang]
  const choose = (v: string) => setParams((p) => {
    const next = new URLSearchParams(p)
    next.set('lang', v)
    return next
  }, { replace: true })

  return (
    <div className="flex flex-col gap-4">
      {(langs.length > 1 || chosen) && (
        <div className="flex justify-end">
          <Label htmlFor={id} className="font-normal text-muted-foreground">
            <Languages aria-hidden="true" className="size-4" />
            {t("Langue de l'histoire")}
          </Label>
          <NativeSelect id={id} size="sm" className="ml-2" value={lang} onChange={(e) => choose(e.target.value)}>
            <NativeSelectOption value={ALL_LANGS}>{t('Toutes les langues')}</NativeSelectOption>
            {options.map((code) => (
              <NativeSelectOption key={code} value={code}>{languageName(code, t.lang)}</NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      )}
      {shown.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((s) => <StoryCard key={s.id} story={s} />)}
        </div>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Languages /></EmptyMedia>
            <EmptyTitle>{t('Aucune histoire dans cette langue')}</EmptyTitle>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => choose(ALL_LANGS)}>{t('Voir toutes les langues')}</Button>
          </EmptyContent>
        </Empty>
      )}
    </div>
  )
}

export function MarketplacePage() {
  const t = useT()
  const { data, isPending, error } = useMarketplaceStories()
  return (
    <section className="flex flex-col gap-6">
      <p className="text-muted-foreground">{t("Des histoires prêtes à jouer, choisies par l'équipe Grimoire. Choisis-en une pour lancer une partie.")}</p>
      <StoryGrid
        stories={data}
        isPending={isPending}
        error={error}
        empty={
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Store /></EmptyMedia>
              <EmptyTitle>{t("La bibliothèque est vide pour l'instant")}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        }
      />
    </section>
  )
}

export function MyStoriesPage() {
  const t = useT()
  const { data, isPending, error } = useMyStories()
  return (
    <section className="flex flex-col gap-6">
      <StoryGrid
        stories={data}
        isPending={isPending}
        error={error}
        empty={
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><BookOpen /></EmptyMedia>
              <EmptyTitle>{t('Aucune histoire personnelle')}</EmptyTitle>
              <EmptyDescription>
                {t("Crée une histoire originale avec l'aide de l'IA, importe les pages d'un scénario que tu possèdes, ou copie une histoire de la bibliothèque pour l'adapter.")}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-row flex-wrap justify-center">
              <Button render={<Link to="/stories/create" />} nativeButton={false}>{t('Créer une histoire')}</Button>
              <Button variant="outline" render={<Link to="/stories/import" />} nativeButton={false}>{t('Importer une histoire')}</Button>
            </EmptyContent>
          </Empty>
        }
      />
    </section>
  )
}
