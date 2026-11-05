import { NavLink, Outlet } from 'react-router'
import { useT } from '@/i18n/t'
import { cn } from '@/lib/utils'

export interface SectionTab {
  to: string
  label: string
  /** Match only this exact path (for the section's first tab). */
  end?: boolean
}

/** A main-menu section (Histoires, Investigateurs): its title, its tabs, then the tab's page. */
export function Section({ title, tabs }: { title: string; tabs: SectionTab[] }) {
  const t = useT()
  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <h1 className="font-heading text-4xl">{t(title)}</h1>
        <nav aria-label={t(title)} className="flex gap-1 overflow-x-auto border-b border-border">
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  '-mb-px border-b-2 border-transparent px-3 py-2 text-xs font-semibold tracking-[0.14em] whitespace-nowrap text-muted-foreground uppercase hover:text-gold',
                  isActive && 'border-gold text-gold',
                )
              }
            >
              {t(tab.label)}
            </NavLink>
          ))}
        </nav>
      </header>
      <Outlet />
    </section>
  )
}
