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
        command: 'plan',
        description: 'DEPRECATED: Planning is now handled automatically. Use run-code directly instead.',
      },
      {
        command: 'web-search',
        description: 'use this ability to search the web for developer documentation, API references, and technical information. Automatically fetches full content from docs sites, processes markdown files, and extracts relevant code examples. Perfect for finding API documentation, tutorials, and technical resources. Example: {"ability": "web-search", "parameters": {"query": "stripe payment intents api"}}',
      },
    ],
  },
}
