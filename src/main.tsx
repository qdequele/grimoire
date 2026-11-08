import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { preloadStory } from './tools/scenarios/stories'

// A scenario page opened directly (prerendered HTML, a link from a search): its story first, so the
// page renders whole at once instead of flashing a loading state over the static HTML.
const scenario = /^\/scenarios\/([\w-]+)\/?$/.exec(window.location.pathname)
if (scenario) await preloadStory(scenario[1])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
