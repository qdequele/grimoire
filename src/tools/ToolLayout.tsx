import { useEffect, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import { LinkButton } from '@/landing/parts'
import { PageLang, useT } from '@/i18n/t'
import { LegalLinks } from '@/legal/LegalPage'
import { cn } from '@/lib/utils'
import { LANG_LABEL, type Lang } from '@/settings/lang'
import { SkinToggle } from '@/theme/Masthead'
import { publicPage, TOOL_PATHS, type ToolKind } from './pages'

// The frame of the free public tools: no account, the language of the address, a header with the
// other tools, and a footer that sends visitors to Grimoire. Printing keeps only the page's content
// (`print:hidden` on the chrome, src/tools/print.css for the rest).

const SIGN_UP = '/login?mode=signup'

const NAV: [ToolKind, string][] = [
  ['dice', 'Lanceur de dés'],
  ['investigator', 'Créer un investigateur'],
  ['sheet', 'Fiche vierge'],
  ['scenarios', 'Scénarios'],
]

/** Sets the tab title, the description and <html lang> from the page registry while the page is shown. */
function useHead(lang: Lang) {
  const { pathname } = useLocation()
  useEffect(() => {
    const page = publicPage(pathname)
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const before = { title: document.title, lang: document.documentElement.lang, description: meta?.content }
    document.documentElement.lang = lang
    if (page) {
      document.title = `${page.title} · Grimoire`
      if (meta) meta.content = page.description
    }
    return () => {
      document.title = before.title
      document.documentElement.lang = before.lang
      if (meta && before.description !== undefined) meta.content = before.description
    }
  }, [pathname, lang])
}

function Header({ lang, alternate }: { lang: Lang; alternate?: string }) {
  const t = useT()
  const other: Lang = lang === 'fr' ? 'en' : 'fr'
  return (
    <header className="app-header sticky top-0 z-20 bg-background/90 backdrop-blur print:hidden">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-10">
        <Link to="/" className="font-heading text-2xl text-gold">Grimoire</Link>
        <NavLink to={TOOL_PATHS.hub[lang]} end className={({ isActive }) => cn('text-xs tracking-[0.14em] uppercase hover:text-gold', isActive ? 'text-gold' : 'text-muted-foreground')}>
          {t('Outils')}
        </NavLink>
        <span className="flex-1" />
        {alternate && (
          <Link to={alternate} lang={other} hrefLang={other} className="text-xs tracking-[0.14em] text-muted-foreground uppercase hover:text-gold">
            <span className="sm:hidden">{other}</span>
            <span className="hidden sm:inline">{LANG_LABEL[other]}</span>
          </Link>
        )}
        {/* Phones: no room next to the language switch; the call to action ends every page. */}
        <span className="hidden sm:contents">
          <LinkButton variant="outline" size="sm" to={SIGN_UP}>{t('Créer un compte')}</LinkButton>
        </span>
      </div>
      <nav aria-label={t('Outils gratuits')} className="mx-auto flex w-full max-w-6xl gap-x-5 overflow-x-auto px-4 pb-2 sm:px-10">
        {NAV.map(([kind, label]) => (
          <NavLink
            key={kind}
            to={TOOL_PATHS[kind][lang]}
            className={({ isActive }) => cn('shrink-0 border-b py-1 text-sm whitespace-nowrap hover:text-gold', isActive ? 'border-gold text-gold' : 'border-transparent text-muted-foreground')}
          >
            {t(label)}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}

/** What Grimoire is, under every tool: the reason these pages exist. */
function Pitch() {
  const t = useT()
  return (
    <section className="grid items-center gap-6 border-t border-gold/40 pt-10 lg:grid-cols-[3fr_2fr] print:hidden">
      <div className="flex flex-col gap-3">
        <p className="eyebrow">{t('Pour aller plus loin')}</p>
        <h2 className="font-heading text-3xl leading-tight text-balance">{t('Mène toute la partie avec Grimoire')}</h2>
        <p className="font-serif text-lg leading-relaxed text-muted-foreground">
          {t('Ces outils sont des morceaux de Grimoire, le compagnon du gardien : l’histoire scène par scène, les fiches des joueurs sur leur téléphone, les dés, le combat et un écran d’ambiance pour la table.')}
        </p>
      </div>
      <div className="flex flex-wrap gap-3 lg:justify-end">
        <LinkButton size="lg" to={SIGN_UP}>{t('Créer un compte')}</LinkButton>
        <LinkButton variant="ghost" size="lg" to="/">{t('Découvrir Grimoire')}</LinkButton>
      </div>
    </section>
  )
}

function Footer({ lang }: { lang: Lang }) {
  const t = useT()
  return (
    <footer className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-8 sm:px-10 print:hidden">
      <nav aria-label={t('Outils gratuits')} className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-6 text-sm">
        <Link to={TOOL_PATHS.hub[lang]} className="text-muted-foreground hover:text-gold">{t('Tous les outils')}</Link>
        {NAV.map(([kind, label]) => (
          <Link key={kind} to={TOOL_PATHS[kind][lang]} className="text-muted-foreground hover:text-gold">{t(label)}</Link>
        ))}
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <LegalLinks t={t} />
        <SkinToggle />
      </div>
    </footer>
  )
}

/**
 * One public page: `lang` comes from its address and applies to everything inside (PageLang), without
 * touching the visitor's own language setting. `alternate`: the same page in the other language.
 */
export function ToolLayout({ lang, alternate, children, pitch = true }: { lang: Lang; alternate?: string; children: ReactNode; pitch?: boolean }) {
  useHead(lang)
  const { pathname } = useLocation()
  useEffect(() => {
    // A body, not an expression: scrollTo returns a Promise in recent browsers, not a cleanup.
    window.scrollTo(0, 0)
  }, [pathname])
  return (
    <PageLang value={lang}>
      <div lang={lang} className="tool-page flex min-h-svh flex-col">
        <Header lang={lang} alternate={alternate} />
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-4 py-10 sm:px-10 lg:py-14 print:max-w-none print:p-0">
          {children}
          {pitch && <Pitch />}
        </main>
        <Footer lang={lang} />
      </div>
    </PageLang>
  )
}

/** Eyebrow, title, intro: the top of every tool page (the page's one <h1>). */
export function ToolIntro({ eyebrow, title, children, crumbs }: { eyebrow: string; title: string; children?: ReactNode; crumbs?: [string, string][] }) {
  const t = useT()
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {crumbs && (
        <nav aria-label={t('Fil d’Ariane')} className="text-xs tracking-[0.12em] text-muted-foreground uppercase print:hidden">
          <ol className="flex flex-wrap gap-2">
            {crumbs.map(([label, to], i) => (
              <li key={to} className="flex gap-2">
                {i > 0 && <span aria-hidden="true">›</span>}
                <Link to={to} className="hover:text-gold">{label}</Link>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="font-heading text-4xl leading-tight text-balance sm:text-5xl">{title}</h1>
      <span className="deco-rule print:hidden" aria-hidden="true" />
      {children && <div className="flex flex-col gap-3 font-serif text-lg leading-relaxed text-pretty text-muted-foreground">{children}</div>}
    </div>
  )
}

/** A "how it works" block of plain text under a tool: what search engines read, what newcomers need. */
export function ToolArticle({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex max-w-3xl flex-col gap-4 print:hidden">
      <h2 className="font-heading text-3xl leading-tight">{title}</h2>
      <div className="flex flex-col gap-3 font-serif text-lg leading-relaxed text-muted-foreground [&_b]:text-foreground [&_h3]:mt-3 [&_h3]:font-heading [&_h3]:text-xl [&_h3]:text-foreground">
        {children}
      </div>
    </section>
  )
}
