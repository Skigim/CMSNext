import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  // Entry points for the application
  entry: [
    'main.tsx',
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
    // shadcn/ui components - intentional full API surface
    'components/ui/**',
    // Dead code detection utility - for future use
    'hooks/useTombstone.ts',
    // Validation schemas - public API for form validation
    'domain/validation/forms.ts',
  ],

  // Files that should be ignored for dependency analysis
  ignoreDependencies: [
    // CSS plugins (not detectable via JS imports)
    'tailwindcss-animate',
    // Referenced in vite.config.ts manual chunks
    '@radix-ui/react-toast',
    // ESLint flat config deps - Knip can't parse FlatCompat pattern
    '@eslint/js',
    'eslint-plugin-react-refresh',
    'globals',
  ],

  // Plugin configuration for framework-specific entry points
  vite: {
    entry: ['vite.config.ts'],
  },

  vitest: {
    entry: ['vitest.config.ts', '__tests__/**/*.test.{ts,tsx}'],
  },

  // Ignore exports that are re-exported from barrel files
  // This prevents false positives for index.ts re-exports
  ignoreExportsUsedInFile: true,

  // Disable ESLint plugin to avoid compat layer issues with Knip
  eslint: false,
};

export default config;
