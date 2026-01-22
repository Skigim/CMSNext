import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  // Entry points for the application
  entry: [
    'main.tsx',
    '.storybook/main.ts',
    '.storybook/preview.tsx',
    'scripts/*.ts',
  ],

  // Project source files to analyze
  project: [
    '**/*.{ts,tsx}',
  ],

  // Patterns to ignore
  ignore: [
    'archive/**',
    'dist/**',
    'coverage/**',
    'node_modules/**',
    // Type declaration files
    '**/*.d.ts',
    // Test setup and mocks
    '__tests__/__mocks__/**',
  ],

  // Files that should be ignored for dependency analysis
  ignoreDependencies: [
    // Dev tools that are used via CLI
    '@vitest/ui',
    '@vitest/coverage-v8',
    'tsx',
    // CSS plugins (not detectable via JS imports)
    'tailwindcss-animate',
    // Referenced in vite.config.ts manual chunks
    '@radix-ui/react-toast',
  ],

  // Plugin configuration for framework-specific entry points
  vite: {
    entry: ['vite.config.ts'],
  },

  vitest: {
    entry: ['vitest.config.ts', '__tests__/**/*.test.{ts,tsx}'],
  },

  storybook: {
    entry: ['.storybook/main.ts', '.storybook/preview.tsx'],
    project: ['**/*.stories.tsx'],
  },

  // Ignore exports that are re-exported from barrel files
  // This prevents false positives for index.ts re-exports
  ignoreExportsUsedInFile: true,
};

export default config;
