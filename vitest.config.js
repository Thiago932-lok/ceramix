import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['apps/api/tests/**/*.test.js'],
    environment: 'node',
    globals: false,
    pool: 'forks',
    hookTimeout: 30_000,
    testTimeout: 20_000
  }
})
