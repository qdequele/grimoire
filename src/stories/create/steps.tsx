import { RefreshCw, Sparkles } from 'lucide-react'
import { Controller, type UseFormReturn } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Tuto } from '@/characters/wizard/parts'
import { useT } from '@/i18n/t'
import { cn } from '@/lib/utils'
import { ERA_CHOICES, LENGTHS, PLACE_CHOICES, THREATS, TONES, type Brief, type IdeaField } from './brief'

export interface QuestionProps {
  form: UseFormReturn<Brief>
  /** "Inspire me": fill the empty fields, or one field. null while nothing is running. */
  inspire: (field?: IdeaField) => void
  inspiring: 'all' | IdeaField | null
}

/** The legacy diamond-bullet menu as a radio group: one choice, or "let the AI decide" (''). */
function Choices<V extends string>({
  name, legend, options, value, onChange, none = true,
}: {
  name: string
  legend: string
  options: ReadonlyArray<{ id: V; label: string; hint: string }>
  value: V | ''
  onChange: (v: V | '') => void
  /** Offer "let the AI decide". */
  none?: boolean
}) {
  const t = useT()
  const all: Array<{ id: V | ''; label: string; hint: string }> = [
    ...options,
    ...(none ? [{ id: '' as const, label: 'Au choix de l’IA', hint: 'surprends-moi' }] : []),
  ]
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="eyebrow mb-3">{t(legend)}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {all.map((o) => {
          const checked = value === o.id
          return (
            <label
              key={o.id || 'none'}
              className={cn(
                'group flex cursor-pointer items-baseline gap-3 border bg-card px-4 py-3 hover:border-gold/60 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                checked && 'border-gold',
              )}
            >
              <input type="radio" className="sr-only" name={name} checked={checked} onChange={() => onChange(o.id)} />
              <span aria-hidden="true" className={cn('size-2.5 shrink-0 rotate-45 border border-gold/50', checked && 'bg-gold')} />
              <span className="flex flex-col gap-0.5">
                <span className={cn('font-heading text-lg leading-tight', checked && 'text-gold')}>{t(o.label)}</span>
                <span className="text-sm text-muted-foreground">{t(o.hint)}</span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/** Suggestions under a text field: one click writes it in. */
function Suggestions({ items, onPick }: { items: readonly string[]; onPick: (v: string) => void }) {
  const t = useT()
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((s) => (
        <Button key={s} type="button" size="xs" variant="outline" onClick={() => onPick(t(s))}>{t(s)}</Button>
      ))}
    </div>
  )
}

function InspireButton({ inspire, inspiring, fields, form }: QuestionProps & { fields: IdeaField[] }) {
  const t = useT()
  const empty = fields.filter((f) => !form.watch(f)?.trim()).length
  return (
    <div>
      <Button type="button" variant="outline" onClick={() => inspire()} disabled={inspiring !== null}>
        {inspiring === 'all' ? <Spinner data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
        {empty ? t('Inspire-moi') : t('Inspire-moi (tout est déjà rempli)')}
      </Button>
    </div>
  )
}

/** A text field's label with the ↻ "another idea" button. */
function IdeaLabel({ field, label, inspire, inspiring }: Pick<QuestionProps, 'inspire' | 'inspiring'> & { field: IdeaField; label: string }) {
  const t = useT()
  return (
    <div className="flex items-center justify-between gap-2">
      <FieldLabel htmlFor={`brief-${field}`}>{t(label)}</FieldLabel>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={t('Autre idée pour {field}', { field: t(label) })}
        title={t('Autre idée')}
        disabled={inspiring !== null}
        onClick={() => inspire(field)}
      >
        {inspiring === field ? <Spinner /> : <RefreshCw />}
      </Button>
    </div>
  )
}

export function SettingStep(p: QuestionProps) {
  const t = useT()
  const { form } = p
  const pick = (f: 'era' | 'place') => (v: string) => form.setValue(f, v, { shouldDirty: true })
  return (
    <>
      <Tuto>
        <p>{t('Quelques questions, puis l’IA écrit le plan de ton histoire. Tu le relis et le corriges avant qu’elle n’écrive les scènes. Laisse vide ce que tu veux lui confier.')}</p>
        <p>{t('L’histoire est originale et privée : elle n’apparaît que dans tes histoires.')}</p>
      </Tuto>
      <FieldGroup>
        <Field>
          <FieldLabel>{t("Langue de l'histoire")}</FieldLabel>
          <Controller
            control={form.control}
            name="lang"
            render={({ field }) => (
              <Tabs value={field.value} onValueChange={(v) => field.onChange(v)}>
                <TabsList>
                  <TabsTrigger value="fr">Français</TabsTrigger>
                  <TabsTrigger value="en">English</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          />
        </Field>
        <Field>
          <IdeaLabel field="era" label="Époque" {...p} />
          <Input id="brief-era" placeholder={t('Années 1920, prohibition')} {...form.register('era')} />
          <Suggestions items={ERA_CHOICES} onPick={pick('era')} />
        </Field>
        <Field>
          <IdeaLabel field="place" label="Lieu" {...p} />
          <Input id="brief-place" placeholder={t('Un port de pêche dans la brume')} {...form.register('place')} />
          <Suggestions items={PLACE_CHOICES} onPick={pick('place')} />
        </Field>
      </FieldGroup>
      <InspireButton {...p} fields={['era', 'place', 'hook', 'ideas']} />
    </>
  )
}

export function MoodStep({ form }: QuestionProps) {
  return (
    <>
      <Controller
        control={form.control}
        name="tone"
        render={({ field }) => <Choices name="tone" legend="Ton" options={TONES} value={field.value} onChange={field.onChange} />}
      />
      <Controller
        control={form.control}
        name="threat"
        render={({ field }) => <Choices name="threat" legend="Menace" options={THREATS} value={field.value} onChange={field.onChange} />}
      />
    </>
  )
}

export function MysteryStep(p: QuestionProps) {
  const t = useT()
  const { form } = p
  return (
    <>
      <FieldGroup>
        <Field>
          <IdeaLabel field="hook" label="Le mystère" {...p} />
          <Textarea
            id="brief-hook"
            rows={3}
            placeholder={t('Ce qu’on demande aux investigateurs d’élucider. Ex. : le phare s’est éteint et son gardien a disparu.')}
            {...form.register('hook')}
          />
        </Field>
        <Field>
          <IdeaLabel field="ideas" label="Idées et incontournables" {...p} />
          <Textarea
            id="brief-ideas"
            rows={4}
            placeholder={t('Des images, une scène, un PNJ, un objet que tu veux voir dans l’histoire.')}
            {...form.register('ideas')}
          />
        </Field>
      </FieldGroup>
      <InspireButton {...p} fields={['hook', 'ideas']} />
    </>
  )
}

export function TableStep({ form }: QuestionProps) {
  const t = useT()
  return (
    <>
      <FieldGroup>
        <Field className="max-w-xs">
          <FieldLabel htmlFor="brief-investigators">{t('Nombre d’investigateurs')}</FieldLabel>
          <NativeSelect id="brief-investigators" {...form.register('investigators', { valueAsNumber: true })}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <NativeSelectOption key={n} value={n}>{n}</NativeSelectOption>)}
          </NativeSelect>
        </Field>
      </FieldGroup>
      <Controller
        control={form.control}
        name="length"
        render={({ field }) => (
          <Choices
            name="length"
            legend="Durée"
            options={LENGTHS}
            none={false}
            value={field.value}
            onChange={(v) => field.onChange(v || 'oneshot')}
          />
        )}
      />
      <Field>
        <FieldLabel htmlFor="brief-avoid">{t('À éviter')}</FieldLabel>
        <Textarea id="brief-avoid" rows={3} placeholder={t('Ex. : pas de violence envers les enfants, pas d’araignées.')} {...form.register('avoid')} />
        <FieldDescription>{t('Les limites de ta table : ces thèmes n’apparaîtront pas, même suggérés.')}</FieldDescription>
      </Field>
    </>
  )
}
