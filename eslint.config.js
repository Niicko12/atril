// Reglas de estructura: technical-decisions.md secciones 9.1, 9.2 y 17.1.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

const lines = (max) => ['error', { max, skipBlankLines: true, skipComments: true }];

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'legacy', 'node_modules', 'src/vendor', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-syntax': ['error', { selector: 'TSEnumDeclaration', message: 'Usar uniones de strings (9.6).' }],
      'max-lines': lines(150),
      'max-lines-per-function': ['error', { max: 40, skipBlankLines: true, skipComments: true, IIFEs: true }],
      complexity: ['error', 10],
      'max-depth': ['error', 4],
      'max-params': ['error', 4],
    },
  },
  {
    files: ['src/**/components/**/*.tsx', 'src/app/**/*.tsx'],
    rules: { 'max-lines': lines(200), 'max-lines-per-function': 'off' },
  },
  { files: ['src/spikes/**/*.ts'], rules: { 'max-lines-per-function': 'off', complexity: 'off' } },
  { files: ['src/**/hooks/**/*.ts'], rules: { 'max-lines': lines(100) } },
  { files: ['src/**/services/**/*.ts'], rules: { 'max-lines': lines(300) } },
  { files: ['src/**/store/**/*.ts'], rules: { 'max-lines': lines(250) } },
  { files: ['src/core/types/**/*.ts'], rules: { 'max-lines': lines(200) } },
  {
    files: ['src/core/analysis/**/*.ts'],
    rules: {
      'max-lines': lines(250),
      'max-lines-per-function': ['error', { max: 60, skipBlankLines: true, skipComments: true }],
    },
  },
  { files: ['src/workers/**/*.ts'], rules: { 'max-lines': lines(150) } },
  {
    files: ['src/**/*.test.{ts,tsx}'],
    rules: {
      'max-lines': lines(400),
      'max-lines-per-function': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  { files: ['scripts/**/*.mjs', '*.config.{js,ts}', '*.cjs', '.*.cjs'], languageOptions: { globals: globals.node } },
);
