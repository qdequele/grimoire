import { Play, Printer } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { netLabel } from '@/companion/rolls'
import { LinkButton } from '@/landing/parts'
import { skillName, useT, type T } from '@/i18n/t'
import { cn } from '@/lib/utils'
import { CHARACTERISTIC_INFO, type Characteristic } from '@/rules/d100'
import type { Lang } from '@/settings/lang'
import { TOOL_PATHS } from '../pages'
import { ToolLayout } from '../ToolLayout'
import { anchor, namesOf, StoryNames, StoryText } from './StoryText'
import { preloadStory, storyExists, storyIfLoaded, type FlowStep, type NoteBlock, type Npc, type PublicStory, type Scene, type StoryRoll } from './stories'

// One original story as a public page, whole: the pitch for everyone, then the keeper's part (secret,
// scenes with their read-aloud text and flow, NPCs, handouts), printable. The page is in the story's
// own language. Stories are CC BY: the licence is stated at the end.

const langOf = (story: { meta: { lang: string } }): Lang => (story.meta.lang === 'en' ? 'en' : 'fr')

function characteristicName(t: T, code: string): string {
  if (code === 'luck') return t('Chance')
  if (code === 'san') return 'SAN'
  const info = CHARACTERISTIC_INFO[code as Characteristic]
  return info ? t(info.short) : code
}

function skillOf(t: T, key: string): string {
  const [id, specialty] = key.split(/:(.*)/)
  return skillName(t, id, specialty)
}

/** A roll in words: "Écouter ou Trouver Objet Caché · difficulté majeure". */
function rollText(t: T, r: StoryRoll, npcName: (id: string) => string): string {
  const options = (r.options ?? []).map((o) => (r.type === 'characteristic' ? characteristicName(t, o) : skillOf(t, o)))
  const or = options.join(t(' ou '))
  let text: string
  switch (r.type) {
    case 'luck': text = t('Chance'); break
    case 'san': text = `SAN ${r.san ?? ''}`.trim(); break
    case 'damage': text = t('Dégâts {dice}', { dice: r.dice ?? '' }); break
    case 'group': text = t('Tout le groupe : {skills}', { skills: or }); break
    case 'opposed':
      text = r.against?.npc
        ? t('{skills} contre {npc}', { skills: or, npc: npcName(r.against.npc) + (r.against.skill ? ` (${skillOf(t, r.against.skill)})` : '') })
        : or
      break
    default: text = or
  }
  const extras = [
    r.difficulty === 'hard' && t('difficulté majeure'),
    r.difficulty === 'extreme' && t('difficulté extrême'),
    r.bonus && netLabel(t, r.bonus),
  ].filter(Boolean)
  return [r.label, text, ...extras].filter(Boolean).join(' · ')
}

function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-2 font-serif text-lg leading-relaxed', className)}>{children}</div>
}

function Paragraphs({ items }: { items?: string[] }) {
  if (!items?.length) return null
  return <>{items.map((p, i) => <p key={i}><StoryText text={p} /></p>)}</>
}

function Bullets({ items }: { items?: string[] }) {
  if (!items?.length) return null
  return (
    <ul className="flex list-[square] flex-col gap-1.5 pl-5 font-serif text-lg leading-relaxed marker:text-gold">
      {items.map((p, i) => <li key={i}><StoryText text={p} /></li>)}
    </ul>
  )
}

function Notes({ notes }: { notes?: NoteBlock[] }) {
  if (!notes?.length) return null
  return (
    <>
      {notes.map((n, i) => (
        <div key={i} className="flex flex-col gap-1.5 border-l-2 border-border pl-4 break-inside-avoid">
          {n.title && <h4 className="eyebrow">{n.title}</h4>}
          <Bullets items={n.items} />
        </div>
      ))}
    </>
  )
}

function Outcome({ label, text, tone }: { label: string; text?: string; tone?: 'good' | 'bad' }) {
  if (!text) return null
  return (
    <p className="font-serif text-base leading-relaxed">
      <span className={cn('mr-1.5 text-[0.6875rem] font-semibold tracking-[0.12em] uppercase', tone === 'good' ? 'text-gold' : tone === 'bad' ? 'text-destructive' : 'text-muted-foreground')}>{label}</span>
      <StoryText text={text} />
    </p>
  )
}

function Step({ step, n, npcName }: { step: FlowStep; n: string; npcName: (id: string) => string }) {
  const t = useT()
  const roll = step.roll ? rollText(t, step.roll, npcName) : step.test
  return (
    <li className={cn('flex gap-3 break-inside-avoid', step.branch && 'pl-6')}>
      <span className="w-6 shrink-0 font-heading text-lg text-gold">{n}</span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <h4 className="font-heading text-xl leading-snug">
          {step.branch && <span className="text-muted-foreground">{step.branch} · </span>}
          {step.title}
        </h4>
        {step.text && <p className="font-serif text-lg leading-relaxed"><StoryText text={step.text} /></p>}
        {roll && (
          <p className="text-sm">
            <span className="mr-1.5 text-[0.6875rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{t('Jet')}</span>
            <span className="font-mono">{roll}</span>
          </p>
        )}
        <Outcome label={t('Réussite')} text={step.success} tone="good" />
        <Outcome label={t('Échec')} text={step.failure} tone="bad" />
        <Outcome label={t('Jet forcé raté')} text={step.pushed} />
        {step.extra && <p className="font-serif text-base text-muted-foreground italic"><StoryText text={step.extra} /></p>}
      </div>
    </li>
  )
}

/** Main steps are numbered; the choices under a step get letters (A, B…). */
function stepLabels(flow: FlowStep[]): string[] {
  const out: string[] = []
  let main = 0
  let letter = 0
  for (const s of flow) {
    if (s.branch) out.push(String.fromCharCode(65 + letter++))
    else {
      letter = 0
      out.push(String(++main))
    }
  }
  return out
}

function SceneBlock({ scene, number, story }: { scene: Scene; number: string; story: PublicStory }) {
  const t = useT()
  const npcName = (id: string) => story.npcs?.find((n) => n.id === id)?.name ?? id
  const labels = stepLabels(scene.flow ?? [])
  const handouts = (story.handouts ?? []).filter((h) => scene.handouts?.includes(h.id) || h.scene === scene.id)
  return (
    <section id={anchor('scene', scene.id)} className="flex scroll-mt-28 flex-col gap-4 border-t border-gold/30 pt-6">
      <div className="flex flex-col gap-1">
        <p className="eyebrow">{t('Scène {n}', { n: number })}{scene.optional && ` · ${t('facultative')}`}</p>
        <h3 className="font-heading text-3xl leading-tight">{scene.title}</h3>
        {scene.lead && <p className="font-serif text-lg text-muted-foreground italic"><StoryText text={scene.lead} /></p>}
      </div>
      {scene.notesFirst && <Notes notes={scene.notes} />}
      {scene.readAloud?.length ? (
        <div className="read-aloud flex flex-col gap-2 border border-gold/50 bg-gold/5 p-4 break-inside-avoid">
          <p className="eyebrow">{t('À lire aux joueurs')}</p>
          <Prose className="italic"><Paragraphs items={scene.readAloud} /></Prose>
        </div>
      ) : null}
      {!scene.notesFirst && <Notes notes={scene.notes} />}
      {scene.flow?.length ? (
        <div className="flex flex-col gap-3">
          <h4 className="eyebrow">{t('Fil de la scène')}</h4>
          <ol className="flex flex-col gap-4">
            {scene.flow.map((s, i) => <Step key={i} step={s} n={labels[i]} npcName={npcName} />)}
          </ol>
        </div>
      ) : null}
      <Notes notes={scene.notesAfter} />
      {scene.callout && (
        <p className="border-l-2 border-gold pl-4 font-serif text-lg italic"><StoryText text={scene.callout} /></p>
      )}
      {(scene.npcs?.length || handouts.length) ? (
        <p className="text-sm text-muted-foreground">
          {scene.npcs?.length ? <>{t('PNJ')} : <StoryText text={scene.npcs.map((id) => `{{npc:${id}}}`).join(', ')} /></> : null}
          {scene.npcs?.length && handouts.length ? ' · ' : null}
          {handouts.length ? <>{t('Documents')} : <StoryText text={handouts.map((h) => `{{handout:${h.id}}}`).join(', ')} /></> : null}
        </p>
      ) : null}
    </section>
  )
}

function NpcBlock({ npc }: { npc: Npc }) {
  const t = useT()
  const stats = [
    ...Object.entries(npc.characteristics ?? {}).map(([k, v]) => `${characteristicName(t, k)} ${v}`),
    npc.hp !== undefined && `${t('PV')} ${npc.hp}`,
    npc.dodge !== undefined && `${t('Esquive')} ${npc.dodge}`,
    npc.armor !== undefined && `${t('Armure')} ${npc.armor}`,
    npc.damageBonus && `${t('Impact')} ${npc.damageBonus}`,
    npc.build !== undefined && `${t('Carrure')} ${npc.build}`,
    npc.sanLoss && `${t('Perte de SAN')} ${npc.sanLoss}`,
  ].filter(Boolean)
  const skills = Object.entries(npc.skills ?? {}).map(([k, v]) => `${skillOf(t, k)} ${v}`)
  const special = Array.isArray(npc.special) ? npc.special : npc.special ? [npc.special] : []
  return (
    <li id={anchor('npc', npc.id)} className="flex scroll-mt-28 flex-col gap-1.5 border-b border-border pb-4 break-inside-avoid">
      <h3 className="font-heading text-2xl leading-tight">
        {npc.name}
        {npc.role && <span className="font-serif text-lg text-muted-foreground italic"> · {npc.role}</span>}
      </h3>
      {npc.description && <p className="font-serif text-lg leading-relaxed"><StoryText text={npc.description} /></p>}
      {npc.personality && <p className="font-serif text-lg leading-relaxed text-muted-foreground"><StoryText text={npc.personality} /></p>}
      {npc.knows?.length ? (
        <div className="flex flex-col gap-1">
          <h4 className="eyebrow">{t('Ce qu’il sait')}</h4>
          <Bullets items={npc.knows} />
        </div>
      ) : null}
      {stats.length > 0 && <p className="font-mono text-sm">{stats.join(' · ')}</p>}
      {skills.length > 0 && <p className="text-sm">{skills.join(' · ')}</p>}
      {npc.attacks?.length ? (
        <p className="text-sm">
          <span className="mr-1.5 text-[0.6875rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            {npc.attacksPerRound && npc.attacksPerRound > 1 ? t('Attaques ({n} par round)', { n: npc.attacksPerRound }) : t('Attaques')}
          </span>
          {npc.attacks.map((a) => [a.name, a.skill !== undefined && `${a.skill} %`, a.damage, a.note].filter(Boolean).join(' ')).join(' · ')}
        </p>
      ) : null}
      {special.length > 0 && <Bullets items={special} />}
    </li>
  )
}

function Fact({ label, value, wide }: { label: string; value?: string; wide?: boolean }) {
  if (!value) return null
  return (
    <div className={cn('flex flex-col gap-0.5', wide && 'col-span-2 sm:col-span-3')}>
      <dt className="text-[0.6875rem] tracking-[0.12em] text-muted-foreground uppercase">{label}</dt>
      <dd className="font-serif text-lg">{value}</dd>
    </div>
  )
}

function KeeperSection({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="flex scroll-mt-28 flex-col gap-4">
      <h2 className="font-heading text-4xl leading-tight">{title}</h2>
      <span className="deco-rule print:hidden" aria-hidden="true" />
      {children}
    </section>
  )
}

function Story({ story }: { story: PublicStory }) {
  const t = useT()
  const lang = langOf(story)
  const m = story.meta
  const o = story.overview ?? {}
  const players = m.players?.min && m.players?.max
    ? m.players.min === m.players.max ? t.n(m.players.min, '{n} joueur', '{n} joueurs') : t('{min} à {max} joueurs', { min: m.players.min, max: m.players.max })
    : undefined
  const overview: [string, string[] | undefined][] = [
    [t('Les grandes étapes'), o.steps],
    [t('À ne pas manquer'), o.mustNotMiss],
    [t('Les embranchements'), o.branches],
    [t('Si les joueurs bloquent'), o.ifStuck],
    [t('Conseils au gardien'), o.keeperTips],
  ]
  const playHref = `/login?next=${encodeURIComponent(`/stories?lang=${lang}`)}`
  // Scenes are numbered across acts.
  const firstNo = story.acts.map((_, i) => story.acts.slice(0, i).reduce((n, a) => n + a.scenes.length, 0))

  return (
    <StoryNames value={namesOf(story)}>
      <article className="flex flex-col gap-14">
        <header className="flex max-w-3xl flex-col gap-5">
          <nav aria-label={t('Fil d’Ariane')} className="text-xs tracking-[0.12em] text-muted-foreground uppercase print:hidden">
            <ol className="flex flex-wrap gap-2">
              <li><Link to={TOOL_PATHS.hub[lang]} className="hover:text-gold">{t('Outils')}</Link></li>
              <li aria-hidden="true">›</li>
              <li><Link to={TOOL_PATHS.scenarios[lang]} className="hover:text-gold">{t('Scénarios')}</Link></li>
            </ol>
          </nav>
          <p className="eyebrow">{t('Scénario gratuit')}</p>
          <h1 className="font-heading text-5xl leading-tight text-balance sm:text-6xl">{m.title}</h1>
          <span className="deco-rule print:hidden" aria-hidden="true" />
          {m.summary && <p className="font-serif text-xl leading-relaxed text-pretty"><StoryText text={m.summary} /></p>}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <Fact label={t('Joueurs')} value={players} />
            <Fact label={t('Durée')} value={m.duration} />
            <Fact label={t('Époque')} value={m.era} />
            <Fact label={t('Cadre')} value={m.setting} wide />
          </dl>
          {m.contentWarnings?.length ? (
            <p className="text-sm text-muted-foreground">{t('Thèmes sensibles')} : {m.contentWarnings.join(', ')}</p>
          ) : null}
          <div className="flex flex-wrap gap-3 print:hidden">
            <LinkButton size="lg" to={playHref}><Play data-icon="inline-start" />{t('Jouer dans Grimoire')}</LinkButton>
            <Button size="lg" variant="outline" onClick={() => window.print()}>
              <Printer data-icon="inline-start" />
              {t('Imprimer le scénario')}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground print:hidden">
            {t('Dans Grimoire, le scénario se joue scène par scène : jets en un clic, fiches des joueurs sur leur téléphone, sons et écran d’ambiance.')}
          </p>
        </header>

        <div className="max-w-3xl border border-destructive/50 p-4 font-serif text-lg print:hidden">
          <b>{t('Joueurs, arrêtez-vous ici.')}</b> {t('La suite est réservée au gardien : elle dévoile le secret de l’histoire.')}
        </div>

        <nav aria-label={t('Sommaire')} className="flex max-w-3xl flex-col gap-2 print:hidden">
          <h2 className="eyebrow">{t('Sommaire')}</h2>
          <ol className="flex flex-col gap-1 text-sm">
            <li><a href="#secret" className="hover:text-gold">{t('Le secret')}</a></li>
            {story.acts.map((a) => (
              <li key={a.id} className="flex flex-col gap-0.5">
                <span className="text-muted-foreground">{a.title}</span>
                <ol className="flex flex-col gap-0.5 pl-4">
                  {a.scenes.map((s) => <li key={s.id}><a href={`#${anchor('scene', s.id)}`} className="hover:text-gold">{s.title}</a></li>)}
                </ol>
              </li>
            ))}
            {story.npcs?.length ? <li><a href="#pnj" className="hover:text-gold">{t('Personnages')}</a></li> : null}
            {story.handouts?.length ? <li><a href="#documents" className="hover:text-gold">{t('Documents')}</a></li> : null}
          </ol>
        </nav>

        <div className="flex max-w-3xl flex-col gap-14">
          <KeeperSection id="secret" title={t('Le secret')}>
            {o.secret && <Prose><p><StoryText text={o.secret} /></p></Prose>}
            {overview.map(([title, items]) => items?.length ? (
              <div key={title} className="flex flex-col gap-2">
                <h3 className="eyebrow">{title}</h3>
                <Bullets items={items} />
              </div>
            ) : null)}
          </KeeperSection>

          {story.acts.map((act, ai) => (
            <KeeperSection key={act.id} title={story.acts.length > 1 ? t('Acte {n} · {title}', { n: ai + 1, title: act.title }) : act.title}>
              {act.scenes.map((s, si) => <SceneBlock key={s.id} scene={s} number={String(firstNo[ai] + si + 1)} story={story} />)}
            </KeeperSection>
          ))}

          {story.knowledge?.length ? (
            <KeeperSection title={t('Qui sait quoi')}>
              <table className="w-full text-left font-serif text-base">
                <thead className="text-[0.6875rem] tracking-[0.12em] text-muted-foreground uppercase">
                  <tr>
                    <th className="border-b border-border py-1 pr-3 font-normal">{t('Pour')}</th>
                    <th className="border-b border-border py-1 pr-3 font-normal">{t('Le mieux')}</th>
                    <th className="border-b border-border py-1 font-normal">{t('Sinon')}</th>
                  </tr>
                </thead>
                <tbody>
                  {story.knowledge.map((k, i) => (
                    <tr key={i} className="align-top">
                      <td className="border-b border-border py-2 pr-3"><StoryText text={k.need} /></td>
                      <td className="border-b border-border py-2 pr-3"><StoryText text={k.best ?? ''} /></td>
                      <td className="border-b border-border py-2"><StoryText text={k.backup ?? ''} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </KeeperSection>
          ) : null}

          {story.trackers?.length ? (
            <KeeperSection title={t('Compteurs')}>
              {story.trackers.map((tr) => (
                <div key={tr.id} className="flex flex-col gap-1 break-inside-avoid">
                  <h3 className="font-heading text-xl">{tr.label}{tr.max ? ` · ${tr.max}${tr.unit ? ` ${tr.unit}` : ''}` : ''}</h3>
                  {tr.help && <p className="font-serif text-lg leading-relaxed"><StoryText text={tr.help} /></p>}
                </div>
              ))}
            </KeeperSection>
          ) : null}

          {story.npcs?.length ? (
            <KeeperSection id="pnj" title={t('Personnages')}>
              <ul className="flex flex-col gap-4">
                {story.npcs.map((n) => <NpcBlock key={n.id} npc={n} />)}
              </ul>
            </KeeperSection>
          ) : null}

          {story.handouts?.length ? (
            <KeeperSection id="documents" title={t('Documents à remettre aux joueurs')}>
              <div className="flex flex-col gap-6">
                {story.handouts.map((h) => (
                  <figure key={h.id} id={anchor('handout', h.id)} className="handout flex scroll-mt-28 flex-col gap-3 break-inside-avoid border border-[#c9b88f] bg-[#efe6cf] p-5 text-[#2b2416] shadow-[0_8px_30px_-12px_rgba(0,0,0,.6)]">
                    <figcaption className="font-heading text-xl">{h.title}</figcaption>
                    {h.text && <p className="font-serif text-lg leading-relaxed whitespace-pre-line"><StoryText text={h.text} /></p>}
                  </figure>
                ))}
              </div>
            </KeeperSection>
          ) : null}

          <p className="border-t border-gold/30 pt-6 text-sm text-muted-foreground">
            {m.license === 'CC-BY-4.0'
              ? t('« {title} » est publié par {author} sous licence Creative Commons BY 4.0 : tu peux le copier, l’adapter et le partager, même pour un usage commercial, en citant {author}.', { title: m.title, author: m.author ?? 'Grimoire' })
              : m.license && t('Licence : {license}', { license: m.license })}
          </p>
        </div>
      </article>
    </StoryNames>
  )
}

/** `/scenarios/:id`. Rendered whole when the story was preloaded (build, first visit), else after loading it. */
export function ScenarioPage() {
  const { id = '' } = useParams()
  const [story, setStory] = useState(() => storyIfLoaded(id))
  const current = story?.meta.id === id ? story : storyIfLoaded(id)

  useEffect(() => {
    if (!current && storyExists(id)) void preloadStory(id).then(setStory)
  }, [id, current])

  if (!current) {
    return (
      <ToolLayout lang="fr" pitch={false}>
        {storyExists(id) ? <p className="text-muted-foreground">…</p> : <NotFound />}
      </ToolLayout>
    )
  }
  return (
    <ToolLayout lang={langOf(current)}>
      <Story story={current} />
    </ToolLayout>
  )
}

function NotFound() {
  const t = useT()
  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-heading text-4xl">{t('Ce scénario n’existe pas.')}</h1>
      <Link to={TOOL_PATHS.scenarios.fr} className="text-gold underline underline-offset-4">{t('Tous les scénarios gratuits')}</Link>
    </div>
  )
}

