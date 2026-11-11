// A held card with what can be done with it: spend or regain a use, reload a weapon from matching
// ammunition, take it back (keeper). Shared by the keeper's screens and the players' phones.
import { Minus, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { useT } from '@/i18n/t'
import { cn } from '@/lib/utils'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { ammoFor, CONDITION_LABEL, CONDITIONS, reloadable, reloadPlan, type Condition, type HeldItem } from './item'
import { ItemCard } from './ItemCard'
import { localCard, usesText } from './text'

export interface ItemActions {
  onUse?: (item: HeldItem, delta: number) => void
  /** The keeper sets a weapon's condition (phones only see it). */
  onCondition?: (item: HeldItem, condition: Condition) => void
  onReload?: (item: HeldItem) => void
  onRemove?: (item: HeldItem) => Promise<unknown> | void
}

export function ItemTile({ item, held, actions, className, extra }: { item: HeldItem; held: HeldItem[]; actions: ItemActions; className?: string; extra?: ReactNode }) {
  const t = useT()
  const [confirming, setConfirming] = useState(false)
  const name = localCard(t, item.card, item.source).name
  const max = item.card.uses
  const left = item.uses ?? 0
  const plan = actions.onReload ? reloadPlan(item, held) : null

  return (
    <li className={cn('flex flex-col gap-2', className)}>
      <ItemCard card={item.card} uses={item.uses} source={item.source} condition={item.condition} />
      {actions.onCondition && item.card.kind === 'weapon' && (
        <NativeSelect
          size="sm"
          className="w-full"
          value={item.condition}
          aria-label={t('État de « {name} »', { name })}
          onChange={(e) => actions.onCondition!(item, e.target.value as Condition)}
        >
          {CONDITIONS.map((c) => <NativeSelectOption key={c} value={c}>{t('État : {condition}', { condition: t(CONDITION_LABEL[c]) })}</NativeSelectOption>)}
        </NativeSelect>
      )}
      <div className="flex min-h-9 flex-wrap items-center justify-center gap-1">
        {max !== undefined && actions.onUse && (
          <>
            <Button size="icon-sm" variant="outline" disabled={left <= 0} onClick={() => actions.onUse!(item, -1)}
              aria-label={t('Utiliser : {name}', { name })} title={t('Utiliser')}>
              <Minus />
            </Button>
            <span className="min-w-12 text-center font-mono text-xs" aria-live="polite">{usesText(t, item.card, left)}</span>
            <Button size="icon-sm" variant="outline" disabled={left >= max} onClick={() => actions.onUse!(item, 1)}
              aria-label={t('Ajouter : {name}', { name })} title={t('Ajouter')}>
              <Plus />
            </Button>
          </>
        )}
        {/* Always there for a weapon that takes ammunition, so the buttons don't move under the finger. */}
        {actions.onReload && reloadable(item.card) && (
          <Button
            size="sm"
            variant="outline"
            disabled={!plan}
            onClick={() => actions.onReload!(item)}
            title={
              plan ? t('Prend {n} dans « {ammo} »', { n: plan.moved, ammo: localCard(t, plan.ammo.card, plan.ammo.source).name })
                : left >= (max ?? 0) ? t('Chargée')
                  : ammoFor(item, held) ? t('Rien à recharger.') : t('Pas de munitions {ammo}', { ammo: item.card.ammo ?? '' })
            }
          >
            <RotateCcw data-icon="inline-start" />
            {t('Recharger')}
          </Button>
        )}
        {actions.onRemove && !confirming && (
          <Button size="icon-sm" variant="ghost" onClick={() => setConfirming(true)} aria-label={t('Retirer : {name}', { name })} title={t('Retirer')}>
            <Trash2 />
          </Button>
        )}
        {actions.onRemove && confirming && (
          <span className="flex items-center gap-1">
            <Button size="sm" variant="destructive" onClick={async () => { await actions.onRemove!(item); setConfirming(false) }}>{t('Retirer')}</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>{t('Garder')}</Button>
          </span>
        )}
        {extra}
      </div>
    </li>
  )
}
