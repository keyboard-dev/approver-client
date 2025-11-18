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
        description: 'use this ability complete any task by running the code necessary to complete the task.  Make sure to run plan before',
      },
      {
        command: 'plan',
        description: 'use this ability to plan the steps necessary to complete the task.  Generates a planning token.  Make sure to run run-code after planning.',
      },
      {
        command: 'web-search',
        description: 'use this ability to search the web for developer documentation, API references, and technical information. Automatically fetches full content from docs sites, processes markdown files, and extracts relevant code examples. Perfect for finding API documentation, tutorials, and technical resources. Example: {"ability": "web-search", "parameters": {"query": "stripe payment intents api"}}',
      },
    ],
  },
}
