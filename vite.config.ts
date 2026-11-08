/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readdirSync, readFileSync } from 'node:fs'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// On Vercel, the Supabase integration provides NEXT_PUBLIC_SUPABASE_*: use them when VITE_SUPABASE_*
// (local .env.local) aren't set. Only the public URL and anon key reach the browser.
function supabaseEnv(mode: string) {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const define: Record<string, string> = {}
  for (const name of ['URL', 'ANON_KEY']) {
    const fallback = env[`NEXT_PUBLIC_SUPABASE_${name}`]
    if (!env[`VITE_SUPABASE_${name}`] && fallback) define[`import.meta.env.VITE_SUPABASE_${name}`] = JSON.stringify(fallback)
  }
  return define
}

// `virtual:story-metas`: the meta of every story in stories/ (the free scenarios list), without
// bundling the stories themselves (src/tools/scenarios/stories.ts loads each one on demand).
function storyMetas(): Plugin {
  const id = 'virtual:story-metas'
  const dir = path.resolve(import.meta.dirname, 'stories')
  return {
    name: 'story-metas',
    resolveId: (source) => (source === id ? `\0${id}` : undefined),
    load(resolved) {
      if (resolved !== `\0${id}`) return
      const metas = readdirSync(dir).sort().flatMap((name) => {
        const file = path.join(dir, name, 'story.json')
        try {
          this.addWatchFile(file)
          return [JSON.parse(readFileSync(file, 'utf8')).meta]
        } catch {
          return []
        }
      })
      return `export default ${JSON.stringify(metas)}`
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), storyMetas()],
  define: supabaseEnv(mode),
  build: {
    // Two pages: the app, and the game screen it embeds (the legacy engine, see src/play/boot.ts).
    rolldownOptions: { input: { main: 'index.html', play: 'play.html' } },
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'supabase/functions/_shared/**/*.test.ts'],
  },
}))
