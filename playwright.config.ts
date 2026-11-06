import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// The legacy single-file app is private (gitignored). Its tests only run where it exists.
const hasLegacy = existsSync('legacy/index.html')

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: 'list',
  use: { ...devices['Desktop Chrome'], trace: 'retain-on-failure' },
  projects: [
    ...(hasLegacy
      ? [{ name: 'legacy', testMatch: 'legacy.spec.ts', use: { baseURL: 'http://localhost:8000' } }]
      : []),
    { name: 'app', testMatch: 'app.spec.ts', use: { baseURL: 'http://localhost:5173' } },
    // Keeper (desktop) and a player's phone (390×844, no account) side by side.
    { name: 'companion', testMatch: 'companion.spec.ts', use: { baseURL: 'http://localhost:5173' } },
    // MCP connector sign-in (OAuth with Supabase Auth's OAuth server).
    { name: 'mcp', testMatch: 'mcp.spec.ts', use: { baseURL: 'http://localhost:5173' } },
    // Original vs new game screen, scene by scene (private data only): pnpm e2e:parity
    ...(hasLegacy ? [{ name: 'parity', testMatch: 'parity.spec.ts' }] : []),
  ],
  webServer: [
    ...(hasLegacy
      ? [{ command: 'pnpm legacy', url: 'http://localhost:8000', reuseExistingServer: true }]
      : []),
    { command: 'pnpm dev --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: true },
  ],
})
