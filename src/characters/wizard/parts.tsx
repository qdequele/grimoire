import type { ReactNode } from 'react'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'

/** The legacy "tuto" box: explanation of the step, gold rule on the left, serif text. */
export function Tuto({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-l-2 border-gold bg-card px-4 py-3 font-serif text-base leading-relaxed">
      {children}
    </div>
  )
}

/** The legacy "pool" bar: what's left to place, in big monospace numbers. */
export function Pool({ label, values, done, extra }: { label: string; values: number[]; done: string; extra?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border bg-secondary px-4 py-3" aria-live="polite">
      <span className="text-sm font-semibold">{label}</span>
      <span className="font-mono text-xl tracking-wide">{values.length ? values.join(' · ') : done}</span>
      {extra && <span className="text-sm text-muted-foreground">{extra}</span>}
    </div>
  )
}

/**
 * Pick a value from a fixed pool. Values already placed elsewhere are disabled, the current one
 * stays selectable. Mirrors the legacy valSelect().
 */
export function ValueSelect({
  id, label, value, pool, left, onChange, className,
}: {
  id: string
  label: string
  value: number | undefined
  pool: number[]
  left: number[]
  onChange: (v: number | undefined) => void
  className?: string
}) {
  const options = [...new Set(pool)].sort((a, b) => b - a)
  return (
    <NativeSelect
      id={id}
      aria-label={label}
      value={value ?? ''}
      className={cn('font-mono', className)}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
    >
      <NativeSelectOption value="">—</NativeSelectOption>
      {options.map((v) => (
        <NativeSelectOption key={v} value={v} disabled={v !== value && !left.includes(v)}>
          {v}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}

/** A labelled stat tile (derived values, summary). */
export function Stat({ label, value, how }: { label: string; value: ReactNode; how?: string }) {
  return (
    <div className="flex flex-col gap-1 border bg-card p-3">
      <span className="text-xs tracking-[0.12em] text-muted-foreground uppercase">{label}</span>
      <span className="font-mono text-2xl">{value}</span>
      {how && <span className="text-xs text-muted-foreground">{how}</span>}
    </div>
  )
}
