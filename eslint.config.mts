import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import pluginReact from 'eslint-plugin-react'
import json from '@eslint/json'
import markdown from '@eslint/markdown'
import css from '@eslint/css'
import stylistic from '@stylistic/eslint-plugin'
import gitignore from 'eslint-config-flat-gitignore'

export default tseslint.config([
  gitignore(),
  // Additional ignores for files that should be excluded but might not be in gitignore
  {
    ignores: [
      '**/package-lock.json',
      '**/yarn.lock',
      '**/pnpm-lock.yaml',
      '**/bun.lockb',
    ],
  },
  { files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'], plugins: { js }, extends: [js.configs.recommended], languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  tseslint.configs.recommended,
  {
    files: ['**/*.{jsx,tsx}'],
    ...pluginReact.configs.flat.recommended,
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    ...stylistic.configs.recommended,
  },
  { files: ['**/*.json'], plugins: { json }, language: 'json/json', extends: [json.configs.recommended] },
  { files: ['**/*.jsonc'], plugins: { json }, language: 'json/jsonc', extends: [json.configs.recommended] },
  { files: ['**/*.json5'], plugins: { json }, language: 'json/json5', extends: [json.configs.recommended] },
  { files: ['**/*.md'], plugins: { markdown }, language: 'markdown/gfm', extends: [markdown.configs.recommended] },
  {
    files: ['**/*.css'],
    plugins: { css },
    language: 'css/css',
    extends: [css.configs.recommended],
    rules: {
      'css/no-invalid-at-rules': 'off', // Disabled to allow Tailwind CSS directives
    },
  },
])
