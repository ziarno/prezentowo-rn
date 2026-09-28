// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')
const reactCompiler = require('eslint-plugin-react-compiler')
const prettierPlugin = require('eslint-plugin-prettier')
const prettierConfig = require('eslint-config-prettier')

module.exports = defineConfig([
  expoConfig,
  reactCompiler.configs.recommended,
  prettierConfig,
  {
    plugins: { prettier: prettierPlugin },
    rules: { 'prettier/prettier': 'warn' },
  },
  {
    // The sync layer is the only code allowed to touch the DDP client
    // (docs/spec.md §6.1, ADR 0001).
    files: ['**/*.{js,jsx,ts,tsx}'],
    ignores: ['src/sync/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@meteorrn/core',
              message:
                'Import from @/sync — the only importer of @meteorrn/core.',
            },
          ],
          patterns: [
            {
              group: ['@meteorrn/core/*'],
              message:
                'Import from @/sync — the only importer of @meteorrn/core.',
            },
          ],
        },
      ],
    },
  },
  {
    ignores: ['dist/*'],
  },
])
