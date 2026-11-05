import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Rich } from '@/i18n/Rich'
import { useT } from '@/i18n/t'
import { removeScene, sceneTotal, type Outline, type OutlineScene } from './brief'

/**
 * The outline Claude wrote, editable before the scenes are written: title, pitch, secret, each
 * scene's title and summary, removing scenes. NPCs and clues are shown for reference.
 */
export function OutlineReview({ outline: o, onChange, disabled }: { outline: Outline; onChange: (o: Outline) => void; disabled?: boolean }) {
  const t = useT()
  const npcName = (id: string) => o.npcs.find((n) => n.id === id)?.name ?? id
  const sceneTitle = (id: string) => o.acts.flatMap((a) => a.scenes).find((s) => s.id === id)?.title ?? id
  // {{npc:id}} and [[scene-id]] references, shown as names.
  const plain = (text: string) =>
    text.replace(/\{\{npc:([\w-]+)\}\}/g, (_, id: string) => npcName(id)).replace(/\[\[([\w-]+)\]\]/g, (_, id: string) => sceneTitle(id))
  const editScene = (id: string, patch: Partial<OutlineScene>) =>
    onChange({ ...o, acts: o.acts.map((a) => ({ ...a, scenes: a.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s)) })) })
  let n = 0

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="outline-title">{t('Titre')}</FieldLabel>
          <Input id="outline-title" className="font-heading text-xl" value={o.title} disabled={disabled} onChange={(e) => onChange({ ...o, title: e.target.value })} />
        </Field>
        <Field>
          <FieldLabel htmlFor="outline-summary">{t('Accroche')}</FieldLabel>
          <Textarea id="outline-summary" rows={2} value={o.summary} disabled={disabled} onChange={(e) => onChange({ ...o, summary: e.target.value })} />
        </Field>
        <Field>
          <FieldLabel htmlFor="outline-secret">{t('Le secret (pour le gardien)')}</FieldLabel>
          <Textarea
            id="outline-secret"
            rows={4}
            value={o.overview.secret}
            disabled={disabled}
            onChange={(e) => onChange({ ...o, overview: { ...o.overview, secret: e.target.value } })}
          />
        </Field>
        <p className="text-sm text-muted-foreground">
          {[o.era, o.setting].filter(Boolean).join(' · ')}
          {o.contentWarnings.length > 0 && ` · ${t('Thèmes sensibles : {list}', { list: o.contentWarnings.join(', ') })}`}
        </p>
      </div>

      {o.acts.map((act) => (
        <section key={act.id} className="flex flex-col gap-3" aria-label={act.title}>
          <h2 className="font-heading text-2xl">{act.title}</h2>
          <ol className="flex flex-col gap-3">
            {act.scenes.map((s) => {
              n++
              return (
                <li key={s.id} className="flex flex-col gap-2 border-l-2 border-gold bg-card px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{n}</span>
                    <Input
                      aria-label={t('Titre de la scène {n}', { n })}
                      className="font-heading text-lg"
                      value={s.title}
                      disabled={disabled}
                      onChange={(e) => editScene(s.id, { title: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t('Retirer la scène {n}', { n })}
                      disabled={disabled || sceneTotal(o) <= 1}
                      onClick={() => onChange(removeScene(o, s.id))}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <Textarea
                    aria-label={t('Résumé de la scène {n}', { n })}
                    rows={2}
                    value={s.summary}
                    disabled={disabled}
                    onChange={(e) => editScene(s.id, { summary: e.target.value })}
                  />
                  {(s.clues.length > 0 || s.npcs.length > 0) && (
                    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                      {s.clues.length > 0 && <p>{t('Indices : {list}', { list: s.clues.join(' · ') })}</p>}
                      {s.npcs.length > 0 && <p>{t('PNJ : {list}', { list: s.npcs.map(npcName).join(', ') })}</p>}
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        </section>
      ))}

      {o.npcs.length > 0 && (
        <section className="flex flex-col gap-3" aria-label={t('Personnages')}>
          <p className="eyebrow">{t('Personnages')}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {o.npcs.map((npc) => (
              <li key={npc.id} className="flex flex-col gap-1 border bg-card px-4 py-3">
                <span className="font-heading text-lg">{npc.name}</span>
                {npc.role && <span className="text-sm text-gold">{npc.role}</span>}
                {npc.description && <span className="text-sm text-muted-foreground"><Rich text={plain(npc.description)} /></span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
