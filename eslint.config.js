import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import reactRefresh from 'eslint-plugin-react-refresh';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  resolvePluginsRelativeTo: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [{
  ignores: [
    'dist',
    'scripts/',
    'supabase/',
    'archive/',
    'docs/development/performance/**/*.html',
  ],
}, {
  languageOptions: {
    globals: {
      ...globals.browser,
      ...globals.es2020,
    },
  },
}, js.configs.recommended, ...compat.extends(
  'plugin:@typescript-eslint/recommended',
  'plugin:react-hooks/recommended'
), {
  plugins: {
    'react-refresh': reactRefresh,
  },
  rules: {
    'react-refresh/only-export-components': 'off',
    '@typescript-eslint/no-unused-vars': ['error', {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
caughtErrorsIgnorePattern: '^(err|error|e|_)$'
    }],
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/triple-slash-reference': 'off',
    '@typescript-eslint/no-empty-object-type': 'off',
    'no-var': 'warn',
    'prefer-const': 'warn',
    'no-useless-escape': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
    // Downgrade new react-hooks 5.x rules to warnings for gradual migration
    'react-hooks/set-state-in-effect': 'warn',
    'react-hooks/refs': 'warn',
    'react-hooks/purity': 'warn',
  },
}, {
  files: ['**/*.d.ts'],
  rules: {
    '@typescript-eslint/no-unused-vars': 'off',
    'no-var': 'off',
  },
}];
