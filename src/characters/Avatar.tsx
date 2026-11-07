import { useState } from 'react'
import { cn } from '@/lib/utils'
import { initials, photoOr } from './photo'

/**
 * The small round head that stands for an investigator (as on the game screen), or the keeper:
 * their photo when there is one, else the picture at `url` (the keeper's Gravatar) if it loads,
 * else their initials. Decorative: the name is always written next to it.
 */
export function Avatar({ name, photo, url, className }: {
  name: string
  photo?: string | null
  /** Shown when there's no photo; an address that fails to load (Gravatar's 404) falls back to the initials. */
  url?: string | null
  className?: string
}) {
  const [broken, setBroken] = useState<string | null>(null)
  const src = photoOr(photo) ?? (url && url !== broken ? url : null)
  return (
    <span
      aria-hidden="true"
      data-photo={src ? '' : undefined}
      className={cn(
        'inline-grid size-8 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-gold bg-background text-xs font-semibold text-foreground select-none',
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt=""
          className="size-full object-cover"
          draggable={false}
          referrerPolicy="no-referrer"
          onError={() => src === url && setBroken(url)}
        />
      ) : <span className="avatar-initials">{initials(name)}</span>}
    </span>
  )
}
