import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'tests/acceptance/**/*.test.ts',
      'src/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      include: [
        'packages/**/*.ts',
        'apps/**/*.ts',
        'src/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        '**/node_modules/**',
        'apps/frontend/src/canvas/**',
        'apps/frontend/src/audio/**',
      ],
      reporter: ['html', 'text-summary', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage',
      thresholds: {
        statements: 60,
        branches: 55,
        functions: 60,
        lines: 60,
      },
    },
  },
});

