export function generatePlanningToken(): string {
  const timestamp = Date.now()
  const randomHex = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0'),
  ).join('')

  return `plan_${timestamp}_${randomHex}`
}

export const toolsToAbilities = {
  categories: {
    'abilities around running tasks': [
      {
        command: 'run-code',
        description: 'use this ability to complete any task by running the code necessary to complete the task. Planning token is automatically provided in your context.',
      },
      {
        command: 'web-search',
        description: 'use this ability to search the web for developer documentation, API references, and technical information. Automatically fetches full content from docs sites, processes markdown files, and extracts relevant code examples. Perfect for finding API documentation, tutorials, and technical resources. Example: {"ability": "web-search", "parameters": {"query": "stripe payment intents api"}}',
      },
      {
        command: 'save-keyboard-shortcut-script-template',
        description: 'use this ability to save a keyboard shortcut script, try to save one task per script',
      },
      {
        command: 'update-keyboard-shortcut-script-template',
        description: 'use this ability to update a keyboard shortcut script template',
      },
    ],
  },
}
