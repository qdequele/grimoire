import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { tMsg, useT } from '@/i18n/t'
import { functionErrorMessage } from '@/lib/functions'
import { useLang } from '@/settings/lang'
import { useComposeMap } from './api'
import { MapEditor } from './editor/MapEditor'
import { MAP_KIND_LABEL } from './editor/labels'
import { MAP_KINDS, type MapDoc, type MapKind } from './kit/model.ts'

// Histoires → Plans (/stories/maps): the map editor, plus "describe the place and Grimoire draws it".

const DESCRIPTION_MAX = 1500

function Describe({ load }: { load: (doc: MapDoc) => void }) {
  const t = useT()
  const lang = useLang((s) => s.lang)
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState<MapKind | ''>('')
  const compose = useComposeMap()

  async function go() {
    try {
      const { map, problems } = await compose.mutateAsync({ description: description.trim(), kind: kind || undefined, lang })
      load(map)
      if (problems.length) toast(t('Plan dessiné. Quelques détails ont été corrigés : vérifie les portes et les objets.'))
      else toast.success(t('Plan dessiné. Retouche-le à ta guise.'))
    } catch (e) {
      toast.error(tMsg(t, await functionErrorMessage(e, 'Plan impossible. Réessaie.')))
    }
  }

  return (
    <section className="flex flex-col gap-3 border border-gold/40 bg-card p-4" aria-labelledby="describe-map">
      <h2 id="describe-map" className="flex items-center gap-2 font-heading text-2xl"><Sparkles className="size-5 text-gold" /> {t('Décris le lieu, Grimoire dessine le plan')}</h2>
      <p className="font-serif text-muted-foreground">
        {t('Quelques phrases suffisent : le genre de lieu, ses pièces ou ses parties, ce qu’on y trouve, et ce qui doit rester secret. Le plan s’ouvre ensuite ici pour être retouché.')}
      </p>
      <Textarea
        value={description}
        maxLength={DESCRIPTION_MAX}
        rows={4}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t('Ex. : le presbytère d’un village, un rez-de-chaussée avec cuisine, salon, bureau du curé et une petite chapelle ; une trappe secrète sous le tapis du bureau.')}
        aria-label={t('Description du lieu')}
      />
      <div className="flex flex-wrap items-center gap-3">
        <NativeSelect value={kind} onChange={(e) => setKind(e.target.value as MapKind | '')} aria-label={t('Type de lieu')}>
          <NativeSelectOption value="">{t('Type de lieu : au choix de l’IA')}</NativeSelectOption>
          {MAP_KINDS.map((k) => (
            <NativeSelectOption key={k} value={k}>{t(MAP_KIND_LABEL[k])}</NativeSelectOption>
          ))}
        </NativeSelect>
        <Button onClick={go} disabled={compose.isPending || description.trim().length < 10}>
          {compose.isPending ? <Spinner /> : <Sparkles />} {compose.isPending ? t('Dessin du plan… (jusqu’à une minute)') : t('Dessiner le plan')}
        </Button>
        <span className="text-xs text-muted-foreground">{description.length}/{DESCRIPTION_MAX}</span>
      </div>
    </section>
  )
}

export function MapsPage() {
  const lang = useLang((s) => s.lang)
  return <MapEditor lang={lang} storageKey="grimoire-map-app" header={(load) => <Describe load={load} />} />
}
