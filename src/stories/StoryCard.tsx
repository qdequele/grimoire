import { Link } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { sceneCount, type StoryRow } from './api'

export function StoryCard({ story }: { story: StoryRow }) {
  const { meta } = story.content
  const players = meta.players?.min ? `${meta.players.min}–${meta.players.max ?? meta.players.min} joueurs` : null
  return (
    <Card size="sm" className="relative">
      <CardHeader>
        <CardTitle>
          <Link to={`/stories/${story.id}`} className="after:absolute after:inset-0">
            {meta.title}
          </Link>
        </CardTitle>
        {meta.summary && <CardDescription className="line-clamp-3">{meta.summary}</CardDescription>}
      </CardHeader>
      <CardFooter className="flex flex-wrap gap-2">
        <Badge variant="secondary">{meta.lang.toUpperCase()}</Badge>
        <Badge variant="outline">{sceneCount(story.content)} scènes</Badge>
        {players && <Badge variant="outline">{players}</Badge>}
        {meta.duration && <Badge variant="outline">{meta.duration}</Badge>}
        {meta.license === 'private' && <Badge variant="outline">Import privé</Badge>}
      </CardFooter>
    </Card>
  )
}
