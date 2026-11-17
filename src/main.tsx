import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { preloadStory } from './tools/scenarios/stories'

// A scenario page opened directly (prerendered HTML, a link from a search): its story first, so the
// page renders whole at once instead of flashing a loading state over the static HTML. Only a head
// start: if the story's file doesn't arrive, the app must still start (the page then says so and
// offers to try again, ScenarioPage).
const scenario = /^\/scenarios\/([\w-]+)\/?$/.exec(window.location.pathname)
if (scenario) await preloadStory(scenario[1]).catch(() => undefined)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
