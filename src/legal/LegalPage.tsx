import { Fragment, useEffect, type ReactNode } from 'react'
import { Link } from 'react-router'
import { makeT, type T } from '@/i18n/t'
import { claudeAddLink, connectorUrl } from '@/settings/connectorUrl'
import type { Lang } from '@/settings/lang'
import { LEGAL_PATHS, type LegalKind } from './paths'
import type { Bilingual, Block } from './doc'
import { HELP } from './help'
import { LEGAL } from './info'
import { PRIVACY } from './privacy'
import { TERMS } from './terms'

const DOCS: Record<LegalKind, Bilingual> = { privacy: PRIVACY, terms: TERMS, help: HELP }

const LINK = /(\*\*.+?\*\*|\[[^\]]+\]\([^)\s]+\)|\{contact\})/g

/** **bold**, [text](href) and {contact} → elements; the other placeholders are plain text. */
function Inline({ text }: { text: string }) {
  const filled = text
    .replaceAll('{publisher}', LEGAL.publisher)
    .replaceAll('{site}', LEGAL.site.replace(/^https:\/\//, ''))
    .replaceAll('{mcp}', connectorUrl())
    .replaceAll('{claudeAdd}', claudeAddLink())
  return (
    <>
      {filled.split(LINK).map((part, i): ReactNode => {
        if (i % 2 === 0) return part
        if (part === '{contact}') return <a key={i} href={`mailto:${LEGAL.contact}`} className="text-gold underline underline-offset-4">{LEGAL.contact}</a>
        if (part.startsWith('**')) return <b key={i}>{part.slice(2, -2)}</b>
        const [, label, href] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)!
        return href.startsWith('/')
          ? <Link key={i} to={href} className="text-gold underline underline-offset-4">{label}</Link>
          : <a key={i} href={href} target="_blank" rel="noreferrer" className="text-gold underline underline-offset-4">{label}</a>
      })}
    </>
  )
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return blocks.map((b, i) =>
    typeof b === 'string' ? (
      <p key={i}><Inline text={b} /></p>
    ) : (
      <ul key={i} className="flex list-[square] flex-col gap-1.5 pl-5 marker:text-gold">
        {b.map((item, j) => <li key={j}><Inline text={item} /></li>)}
      </ul>
    ),
  )
}

/** Confidentialité · Conditions · Aide, under the login form, the app and these pages. */
export function LegalLinks({ t, className }: { t: T; className?: string }) {
  const items: [LegalKind, string][] = [['privacy', 'Confidentialité'], ['terms', 'Conditions'], ['help', 'Aide']]
  return (
    <nav aria-label={t('Informations légales')} className={className ?? 'flex flex-wrap gap-x-2 text-xs tracking-[0.14em] text-muted-foreground uppercase'}>
      {items.map(([kind, label], i) => (
        <Fragment key={kind}>
          {i > 0 && <span aria-hidden="true">·</span>}
          <Link to={LEGAL_PATHS[kind][t.lang]} className="hover:text-gold">{t(label)}</Link>
        </Fragment>
      ))}
    </nav>
  )
}

/** Privacy policy, terms of use or connector help: public, no account, in the language of its address. */
export function LegalPage({ kind, lang }: { kind: LegalKind; lang: Lang }) {
  const t = makeT(lang)
  const doc = DOCS[kind][lang]
  const other: Lang = lang === 'fr' ? 'en' : 'fr'

  useEffect(() => {
    const before = { lang: document.documentElement.lang, title: document.title }
    document.documentElement.lang = lang
    document.title = `${doc.title} · Grimoire`
    window.scrollTo(0, 0)
    return () => {
      document.documentElement.lang = before.lang
      document.title = before.title
    }
  }, [lang, doc.title])

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-10 px-4 py-10 sm:px-10">
      <header className="flex items-center justify-between gap-4">
        <Link to="/" className="font-heading text-2xl text-gold">Grimoire</Link>
        <Link to={LEGAL_PATHS[kind][other]} lang={other} className="text-xs tracking-[0.14em] text-muted-foreground uppercase hover:text-gold">
          {other === 'en' ? 'English' : 'Français'}
        </Link>
      </header>

      <main className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <p className="eyebrow">{t(kind === 'help' ? 'Aide' : 'Informations légales')}</p>
          <h1 className="font-heading text-4xl text-balance sm:text-5xl">{doc.title}</h1>
          {kind !== 'help' && (
            <p className="text-sm text-muted-foreground">
              {t('Mise à jour le {date}', { date: t.date(LEGAL.updated, { day: 'numeric', month: 'long', year: 'numeric' }) })}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-4 font-serif text-lg leading-relaxed">
          <Blocks blocks={doc.intro} />
        </div>
        {doc.sections.map((s) => (
          <section key={s.title} className="flex flex-col gap-3 border-t border-gold/30 pt-6">
            <h2 className="font-heading text-2xl">{s.title}</h2>
            <div className="flex flex-col gap-3 font-serif text-lg leading-relaxed">
              <Blocks blocks={s.blocks} />
            </div>
          </section>
        ))}
      </main>

      <footer className="border-t border-gold/30 pt-6">
        <LegalLinks t={t} />
      </footer>
    </div>
  )
}
