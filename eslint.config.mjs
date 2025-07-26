import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import pluginReact from 'eslint-plugin-react'
import markdown from '@eslint/markdown'
import { defineConfig } from 'eslint/config'
import stylistic from '@stylistic/eslint-plugin'
import gitignore from 'eslint-config-flat-gitignore'

export default defineConfig([
  gitignore(),
  { files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'], plugins: { js }, extends: ['js/recommended'] },
  { files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'], languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  { files: ['**/*.md'], plugins: { markdown }, language: 'markdown/gfm', extends: ['markdown/recommended'] },
  stylistic.configs.recommended,
])
