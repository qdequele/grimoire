import { defineConfig } from 'vitest/config'

// Integration tests against the local Supabase stack (`supabase start`). Run with `pnpm test:db`.
export default defineConfig({
  // Files share the fake Claude server port, so they run one at a time.
  test: { include: ['supabase/tests/**/*.test.ts'], testTimeout: 20_000, hookTimeout: 30_000, fileParallelism: false },
})
