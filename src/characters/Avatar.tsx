import { cn } from '@/lib/utils'
import { initials, photoOr } from './photo'

/**
 * The small round head that stands for an investigator (as on the game screen): their photo when
 * there is one, else their initials. Decorative: the name is always written next to it.
 */
export function Avatar({ name, photo, className }: { name: string; photo?: string | null; className?: string }) {
  const src = photoOr(photo)
  return (
    <span
      aria-hidden="true"
      data-photo={src ? '' : undefined}
      className={cn(
        'inline-grid size-8 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-gold bg-background text-xs font-semibold text-foreground select-none',
        className,
      )}
    >
      {src ? <img src={src} alt="" className="size-full object-cover" draggable={false} /> : initials(name)}
    </span>
  )
}
