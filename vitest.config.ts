import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    // Live data-quality suite is opt-in (needs real credentials); see tests/data-quality.
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts', 'helpers/**/*.ts', 'app/api/**/*.ts', 'middleware.ts'],
      exclude: ['lib/db/neo4j.ts', 'lib/db/supabase.ts', 'tests/**'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
      },
    },
  },
});
