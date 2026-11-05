/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

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

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
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
