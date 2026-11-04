import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useParams } from 'react-router'
import { useCharacters } from '@/characters/api'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useGame, useUpdateGameState } from './api'

// Minimal game screen: party, scene list and current scene, saved to the account.
// The full play screen (flow, rolls, combat, sounds) is being ported from the legacy app.
export function GamePage() {
  const { id } = useParams()
  const { data: game, isPending, error } = useGame(id)
  const characters = useCharacters()
  const update = useUpdateGameState()

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Partie introuvable.</AlertDescription>
      </Alert>
    )
  }
  if (isPending || !game) return <Skeleton className="h-64" />
  if (!game.story) {
    return (
      <Alert variant="destructive">
        <AlertDescription>L'histoire de cette partie n'est plus disponible.</AlertDescription>
      </Alert>
    )
  }

  const scenes = game.story.content.acts.flatMap((a) => a.scenes.map((s) => ({ ...s, act: a.title })))
  const index = Math.max(0, scenes.findIndex((s) => s.id === game.state.scene))
  const scene = scenes[index]
  const party = game.state.party.map((p) => characters.data?.find((c) => c.id === p.characterId)).filter(Boolean)

  const goTo = (sceneId: string) =>
    update.mutate({
      id: game.id,
      state: { ...game.state, scene: sceneId, done: [...new Set([...game.state.done, game.state.scene])] },
    })

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <nav aria-label="Scènes" className="flex flex-col gap-1">
        {scenes.map((s, i) => (
          <Button
            key={s.id}
            variant={i === index ? 'secondary' : 'ghost'}
            className={cn('justify-start', game.state.done.includes(s.id) && i !== index && 'text-muted-foreground')}
            onClick={() => goTo(s.id)}
          >
            {s.title}
          </Button>
        ))}
      </nav>

      <section className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{game.story.content.meta.title} · {scene.act}</p>
          <h1 className="font-heading text-3xl">{scene.title}</h1>
          {scene.lead && <p className="text-lg text-muted-foreground">{scene.lead}</p>}
          <div className="flex flex-wrap gap-2">
            {party.map((c) => <Badge key={c!.id} variant="outline">{c!.data.name}</Badge>)}
          </div>
        </header>

        <Alert>
          <AlertTitle>Écran de jeu en cours de portage</AlertTitle>
          <AlertDescription>
            Le fil de la scène, les jets, le combat et les sons arrivent depuis l'ancienne application. La partie et la
            scène en cours sont déjà sauvegardées sur ton compte.
          </AlertDescription>
        </Alert>

        <div className="flex justify-between gap-2">
          <Button variant="outline" disabled={index === 0} onClick={() => goTo(scenes[index - 1].id)}>
            <ChevronLeft data-icon="inline-start" />
            Scène précédente
          </Button>
          <Button disabled={index === scenes.length - 1} onClick={() => goTo(scenes[index + 1].id)}>
            Scène suivante
            <ChevronRight data-icon="inline-end" />
          </Button>
        </div>
      </section>
    </div>
  )
}
