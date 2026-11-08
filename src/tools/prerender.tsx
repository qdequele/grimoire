// Build-time entry (scripts/prerender.mjs builds it for Node): renders each free tool page to HTML,
// so search engines and link previews get the real page instead of an empty SPA shell. The browser
// then renders the same page over it (createRoot, not hydration: the two may differ, e.g. a draft
// kept in localStorage).
import { renderToString } from 'react-dom/server'
import { Route, Routes, StaticRouter } from 'react-router'
import { publicPages, SITE } from './pages'
import { toolRoutes } from './routes'
import { preloadStory, STORY_METAS } from './scenarios/stories'

export { publicPages, SITE }

export async function render(path: string): Promise<string> {
  await Promise.all(STORY_METAS.map((m) => preloadStory(m.id)))
  return renderToString(
    <StaticRouter location={path}>
      <Routes>
        {toolRoutes.map((r) => <Route key={r.path} path={r.path} element={r.element} />)}
      </Routes>
    </StaticRouter>,
  )
}
