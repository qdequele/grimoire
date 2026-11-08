import { createContext, useContext, type ReactNode } from 'react'
import type { PublicStory } from './stories'

// A story's rich text (spec §4.4) as page elements: **bold**, *italic*, [[scene-id|label]] and
// {{npc:id}} / {{handout:id}} as links to their place on the page, \n as line breaks. Never HTML.

interface Names {
  scene: Map<string, string>
  npc: Map<string, string>
  handout: Map<string, string>
}

const NamesContext = createContext<Names>({ scene: new Map(), npc: new Map(), handout: new Map() })

export function namesOf(story: PublicStory): Names {
  return {
    scene: new Map(story.acts.flatMap((a) => a.scenes.map((s) => [s.id, s.title] as const))),
    npc: new Map((story.npcs ?? []).map((n) => [n.id, n.name] as const)),
    handout: new Map((story.handouts ?? []).map((h) => [h.id, h.title] as const)),
  }
}

export const StoryNames = NamesContext.Provider

/** Anchor ids on the page: `scene-…`, `npc-…`, `handout-…`. */
export const anchor = (kind: 'scene' | 'npc' | 'handout', id: string) => `${kind}-${id}`

const TOKEN = /(\*\*.+?\*\*|\*[^*\s][^*]*?\*|\[\[[\w-]+(?:\|[^\]]+)?\]\]|\{\{(?:npc|handout):[\w-]+\}\}|\n)/g

function Ref({ kind, id, label }: { kind: 'scene' | 'npc' | 'handout'; id: string; label?: string }) {
  const names = useContext(NamesContext)
  const name = label ?? names[kind].get(id) ?? id
  if (!names[kind].has(id)) return <>{name}</>
  return <a href={`#${anchor(kind, id)}`} className="text-gold underline decoration-gold/40 underline-offset-2 hover:decoration-gold">{name}</a>
}

export function StoryText({ text }: { text: string }) {
  return (
    <>
      {text.split(TOKEN).map((part, i): ReactNode => {
        if (i % 2 === 0) return part
        if (part === '\n') return <br key={i} />
        if (part.startsWith('**')) return <b key={i} className="text-foreground">{part.slice(2, -2)}</b>
        if (part.startsWith('[[')) {
          const [id, label] = part.slice(2, -2).split('|')
          return <Ref key={i} kind="scene" id={id} label={label} />
        }
        if (part.startsWith('{{')) {
          const [kind, id] = part.slice(2, -2).split(':') as ['npc' | 'handout', string]
          return <Ref key={i} kind={kind} id={id} />
        }
        return <i key={i}>{part.slice(1, -1)}</i>
      })}
    </>
  )
}
