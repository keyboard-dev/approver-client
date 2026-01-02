import css from '@eslint/css'
import js from '@eslint/js'
import json from '@eslint/json'
import markdown from '@eslint/markdown'
import stylistic from '@stylistic/eslint-plugin'
import gitignore from 'eslint-config-flat-gitignore'
import pluginReact from 'eslint-plugin-react'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// Custom rule to remove console statements with auto-fix
const noConsoleWithFix = {
  meta: {
    type: 'suggestion' as const,
    fixable: 'code' as const,
    messages: {
      unexpected: 'Unexpected console statement.',
    },
    schema: [],
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  create(context: any) {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      'CallExpression[callee.object.name="console"]'(node: any) {
        context.report({
          node,
          messageId: 'unexpected',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          fix(fixer: any) {
            // Find the parent expression statement
            let parent = node.parent
            while (parent && parent.type !== 'ExpressionStatement') {
              parent = parent.parent
            }

            if (parent && parent.type === 'ExpressionStatement') {
              // Get the source code to find the full line including semicolon
              const sourceCode = context.sourceCode || context.getSourceCode()
              const tokenAfter = sourceCode.getTokenAfter(parent)

              // Remove the entire statement including newline
              return fixer.removeRange([
                parent.range[0],
                tokenAfter ? tokenAfter.range[0] : parent.range[1],
              ])
            }
            return null
          },
        })
      },
    }
  },
}

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
    rules: {
      // Disable this rule since we're using the new JSX transform (React 17+)
      // With "jsx": "react-jsx", React doesn't need to be imported explicitly
      'react/react-in-jsx-scope': 'off',
    },
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    ...stylistic.configs.recommended,
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    plugins: {
      custom: {
        rules: {
          'no-console': noConsoleWithFix,
        },
      },
    },
    rules: {
      'custom/no-console': 'error',
    },
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
