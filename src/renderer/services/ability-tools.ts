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
        description: 'use this ability to search the web for information.  Feel free to run this after planning so can gather more information more info before you run-code',
      },
    ],
  },
}
