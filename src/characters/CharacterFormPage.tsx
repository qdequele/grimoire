import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useCharacter, useDeleteCharacter, useSaveCharacter } from './api'
import { CHARACTERISTICS, derived, formatSkills, parseSkills, type CharacterData } from './character'

// Empty inputs mean "unknown", so numbers are optional and NaN from an empty field becomes undefined.
const optionalNumber = (max: number) =>
  z.preprocess((v) => (v === '' || v === null || Number.isNaN(v) ? undefined : Number(v)), z.number().int().min(0).max(max).optional())

const schema = z.object({
  name: z.string().trim().min(1, 'Le nom est obligatoire').max(80),
  occupation: z.string().trim().max(80),
  age: optionalNumber(150),
  characteristics: z.object(Object.fromEntries(CHARACTERISTICS.map((k) => [k, optionalNumber(200)]))),
  hp: optionalNumber(99),
  mp: optionalNumber(99),
  san: optionalNumber(99),
  luck: optionalNumber(99),
  skills: z.string().max(4000),
  background: z.string().max(4000),
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

const empty: FormInput = {
  name: '', occupation: '', age: undefined,
  characteristics: {}, hp: undefined, mp: undefined, san: undefined, luck: undefined,
  skills: '', background: '',
}

function toForm(c: CharacterData): FormInput {
  return { ...empty, ...c, occupation: c.occupation ?? '', skills: formatSkills(c.skills), background: c.background ?? '' }
}

function fromForm(v: FormValues): CharacterData {
  return {
    name: v.name,
    occupation: v.occupation || undefined,
    age: v.age,
    characteristics: Object.fromEntries(
      Object.entries(v.characteristics).filter(([, n]) => n !== undefined),
    ) as CharacterData['characteristics'],
    hp: v.hp,
    mp: v.mp,
    san: v.san,
    luck: v.luck,
    skills: parseSkills(v.skills),
    background: v.background || undefined,
  }
}

export function CharacterFormPage() {
  const { id } = useParams()
  const editing = !!id && id !== 'new'
  const navigate = useNavigate()
  const existing = useCharacter(editing ? id : undefined)
  const save = useSaveCharacter()
  const remove = useDeleteCharacter()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const form = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema), defaultValues: empty })

  useEffect(() => {
    if (existing.data) form.reset(toForm(existing.data.data))
  }, [existing.data, form])

  if (editing && existing.isPending) return <Skeleton className="h-96" />

  async function onSubmit(values: FormValues) {
    try {
      await save.mutateAsync({ id: editing ? id : undefined, data: fromForm(values) })
      toast.success(editing ? 'Investigateur mis à jour.' : 'Investigateur créé.')
      navigate('/characters')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function onDelete() {
    await remove.mutateAsync(id!)
    toast.success('Investigateur supprimé.')
    navigate('/characters')
  }

  const { errors, isSubmitting } = form.formState
  // Placeholder hints for derived values; ignore the form while it's mid-edit and invalid.
  const watched = schema.safeParse({ ...form.watch(), name: '-' })
  const preview: ReturnType<typeof derived> = watched.success ? derived(fromForm(watched.data)) : {}
  const num = { type: 'number', inputMode: 'numeric' } as const

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="font-heading text-2xl">{editing ? 'Modifier l’investigateur' : 'Nouvel investigateur'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-[2fr_2fr_1fr]">
              <Field data-invalid={!!errors.name || undefined}>
                <FieldLabel htmlFor="name">Nom</FieldLabel>
                <Input id="name" aria-invalid={!!errors.name} {...form.register('name')} />
                <FieldError errors={[errors.name]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="occupation">Profession</FieldLabel>
                <Input id="occupation" {...form.register('occupation')} />
              </Field>
              <Field>
                <FieldLabel htmlFor="age">Âge</FieldLabel>
                <Input id="age" {...num} {...form.register('age', { valueAsNumber: true })} />
              </Field>
            </div>

            <FieldSet>
              <FieldLegend>Caractéristiques</FieldLegend>
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
                {CHARACTERISTICS.map((k) => (
                  <Field key={k}>
                    <FieldLabel htmlFor={`car-${k}`}>{k}</FieldLabel>
                    <Input id={`car-${k}`} {...num} {...form.register(`characteristics.${k}`, { valueAsNumber: true })} />
                  </Field>
                ))}
              </div>
            </FieldSet>

            <FieldSet>
              <FieldLegend>Valeurs dérivées</FieldLegend>
              <FieldDescription>Laisse vide pour calculer depuis les caractéristiques.</FieldDescription>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(['hp', 'mp', 'san', 'luck'] as const).map((k) => (
                  <Field key={k}>
                    <FieldLabel htmlFor={k}>{{ hp: 'PV', mp: 'PM', san: 'SAN', luck: 'Chance' }[k]}</FieldLabel>
                    <Input
                      id={k}
                      {...num}
                      placeholder={k !== 'luck' && preview[k] !== undefined ? String(preview[k]) : ''}
                      {...form.register(k, { valueAsNumber: true })}
                    />
                  </Field>
                ))}
              </div>
            </FieldSet>

            <Field>
              <FieldLabel htmlFor="skills">Compétences</FieldLabel>
              <Textarea id="skills" rows={8} placeholder={'Trouver Objet Caché 60\nBibliothèque 45'} {...form.register('skills')} />
              <FieldDescription>Une compétence par ligne : nom puis valeur.</FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="background">Historique</FieldLabel>
              <Textarea id="background" rows={4} {...form.register('background')} />
            </Field>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Spinner data-icon="inline-start" />}
                Enregistrer
              </Button>
              <Button type="button" variant="ghost" onClick={() => navigate('/characters')}>Annuler</Button>
              {editing && (
                <span className="ml-auto flex items-center gap-2">
                  {confirmDelete ? (
                    <>
                      <span className="text-sm">Supprimer ?</span>
                      <Button type="button" variant="destructive" onClick={onDelete} disabled={remove.isPending}>Oui</Button>
                      <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>Non</Button>
                    </>
                  ) : (
                    <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)}>Supprimer</Button>
                  )}
                </span>
              )}
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
