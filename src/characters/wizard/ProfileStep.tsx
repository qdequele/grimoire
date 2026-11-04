import { RefreshCw, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { occupationOf, skillTotal, type CreationDraft } from '@/engine/creation'
import { functionErrorMessage } from '@/lib/functions'
import { supabase } from '@/lib/supabase'
import { PROFILE_FIELDS, skillLabel, type ProfileField } from '@/rules/d100'
import { Tuto } from './parts'
import type { StepProps } from './steps'

/** What the suggest-profile function needs to know (see supabase/functions/_shared/profile.ts). */
function profileRequest(d: CreationDraft, field?: ProfileField) {
  const skills = [...d.occupationSkills, ...d.personalInterests]
    .map((id) => ({ label: skillLabel(id, d.specialties[id]), value: skillTotal(id, d) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6)
    .map((s) => `${s.label} ${s.value}`)
  return {
    name: d.name,
    occupation: occupationOf(d).label,
    age: d.age,
    link: d.link,
    characteristics: d.characteristics,
    skills,
    profile: d.profile,
    field,
  }
}

export function ProfileStep({ draft: d, update }: StepProps) {
  // 'all' while filling every empty field, or the id of the field being regenerated.
  const [busy, setBusy] = useState<'all' | ProfileField | null>(null)
  const empty = PROFILE_FIELDS.filter((f) => !d.profile[f.id]?.trim()).length

  async function suggest(field?: ProfileField) {
    setBusy(field ?? 'all')
    try {
      const { data, error } = await supabase.functions.invoke<{ suggestions: Partial<Record<ProfileField, string>> }>(
        'suggest-profile',
        { body: profileRequest(d, field) },
      )
      if (error) throw error
      const suggestions = data?.suggestions ?? {}
      if (!Object.keys(suggestions).length) toast.info('Pas de nouvelle idée cette fois. Réessaie.')
      update((x) => ({ ...x, profile: { ...x.profile, ...suggestions } }))
    } catch (e) {
      toast.error(await functionErrorMessage(e, 'Suggestion impossible.'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <Tuto>
        <p>
          Quelques affirmations courtes. Deux ou trois suffisent pour commencer. Le gardien s'en sert : une folie
          passagère peut par exemple faire voir une <b>personne importante</b> dans un inconnu.
        </p>
        <p>
          L'IA peut proposer des idées à partir de l'occupation, des caractéristiques et du lien avec l'histoire. Ce que
          tu as déjà écrit est gardé, et tout reste modifiable.
        </p>
      </Tuto>
      <div>
        <Button type="button" variant="outline" onClick={() => suggest()} disabled={busy !== null || empty === 0}>
          {busy === 'all' ? <Spinner data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
          {empty === PROFILE_FIELDS.length ? 'Suggérer avec l’IA' : `Compléter les ${empty} champ${empty > 1 ? 's' : ''} vide${empty > 1 ? 's' : ''}`}
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {PROFILE_FIELDS.map((f) => (
          <Field key={f.id}>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel htmlFor={`bg-${f.id}`}>{f.label}</FieldLabel>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={`Autre idée pour ${f.label}`}
                title="Autre idée"
                disabled={busy !== null}
                onClick={() => suggest(f.id)}
              >
                {busy === f.id ? <Spinner /> : <RefreshCw />}
              </Button>
            </div>
            <Textarea
              id={`bg-${f.id}`}
              placeholder={f.placeholder}
              value={d.profile[f.id] ?? ''}
              aria-busy={busy === f.id || (busy === 'all' && !d.profile[f.id])}
              onChange={(e) => update((x) => ({ ...x, profile: { ...x.profile, [f.id]: e.target.value } }))}
            />
          </Field>
        ))}
      </div>
    </>
  )
}
