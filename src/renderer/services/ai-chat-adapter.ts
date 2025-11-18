import type { ChatModelAdapter } from '@assistant-ui/react'
import { createAbilityDiscoveryPrompt } from './ability-discovery'
import { useMCPIntegration } from './mcp-tool-integration'

interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface AIProviderSelection {
  provider: string
  model?: string
  mcpEnabled?: boolean
}

export class AIChatAdapter implements ChatModelAdapter {
  private currentProvider: AIProviderSelection = { provider: 'openai', model: 'gpt-3.5-turbo', mcpEnabled: false }
  private mcpIntegration: ReturnType<typeof useMCPIntegration> | null = null
  private setToolExecutionState?: (isExecuting: boolean, toolName?: string) => void
  private attempts = 5
  private maxAgenticIterations = 10
  private onTaskProgress?: (progress: { step: number, totalSteps: number, currentAction: string, isComplete: boolean }) => void

  constructor(provider: string = 'openai', model?: string, mcpEnabled: boolean = false) {
    this.currentProvider = { provider, model, mcpEnabled }
  }

  setProvider(provider: string, model?: string, mcpEnabled?: boolean) {
    this.currentProvider = {
      provider,
      model,
      mcpEnabled: mcpEnabled ?? this.currentProvider.mcpEnabled,
    }
  }

  setMCPIntegration(mcpIntegration: ReturnType<typeof useMCPIntegration> | null) {
    this.mcpIntegration = mcpIntegration
  }

  setToolExecutionTracker(tracker: (isExecuting: boolean, toolName?: string) => void) {
    this.setToolExecutionState = tracker
  }

  setTaskProgressTracker(tracker: (progress: { step: number, totalSteps: number, currentAction: string, isComplete: boolean }) => void) {
    this.onTaskProgress = tracker
  }

  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 10) // Limit to most relevant keywords
  }

  private findMatchedAbilities(aiMessages: AIMessage[], abortSignal?: AbortSignal) {
    const messagesToCheck = [...aiMessages]
    // can we check all the messages to see if they mention any of the abilities, if they do we should return an array of abilities that are mentioned with the full ability name and description
    const abilities = this.mcpIntegration?.functions || []
    const matchedAbilities = []
    if (!abilities) return []
    for (const message of messagesToCheck) {
      for (const ability of abilities) {
        if (message.content.includes(ability.function.name)) {
          matchedAbilities.push({
            name: ability.function.name,
            description: ability.function.description,
            parameters: ability.function.parameters,
          })
        }
      }
    }
    return matchedAbilities
  }

  private preContextPrompt(aiMessages: AIMessage[], abortSignal?: AbortSignal) {
    const matchedAbilities = this.findMatchedAbilities(aiMessages) || []
    if (matchedAbilities?.length > 0) {
      const preContextPrompt = `<context>
      This conversation has mentioned these specific keyboard's abilities, 
      so here is additional context if you need to use any of these abilities: 
      ${matchedAbilities.map(a => `${a.name}: \n\n parameters: ${JSON.stringify(a.parameters, null, 2)}\n\n description: ${a.description}`).join('\n')}
      </context>`
      aiMessages[aiMessages.length - 1].content += `\n\n${preContextPrompt} 
      
      When you are ready to call an ability, please use the following JSON format:
      \`\`\`json
      {
        "ability": "ability-name",
        "parameters": {
          "param1": "value1",
          "param2": "value2",
          "param3": true,
          "param4": ["value4", "value5"],
          "param5": {
            "nested1": "value6",
            "nested2": "value7"
          }
        }
      }
      \`\`\`
      `
    }
    return aiMessages
  }

  private isTaskComplete(response: string): boolean {
    const completionIndicators = [
      'task completed',
      'task complete',
      'finished',
      'done',
      'completed successfully',
      'all set',
      'no further action needed',
      'task accomplished',
    ]

    const lowerResponse = response.toLowerCase()
    return completionIndicators.some(indicator => lowerResponse.includes(indicator))
      || !this.hasMoreAbilityCallsInResponse(response)
  }

  private hasMoreAbilityCallsInResponse(response: string): boolean {
    const jsonPattern = /```json\s*(.*?)\s*```/gs
    const jsonMatches = Array.from(response.matchAll(jsonPattern))

    for (const match of jsonMatches) {
      try {
        const parsed = JSON.parse(match[1])
        if (parsed.ability && typeof parsed.ability === 'string') {
          return true
        }
      }
      catch (error) {
        continue
      }
    }
    return false
  }

  private foundAbilityCallsInResponse(response: string) {
    const jsonPattern = /```json\s*(.*?)\s*```/gs
    const jsonMatches = Array.from(response.matchAll(jsonPattern))
    const abilityCalls: Array<{ ability: string, parameters: Record<string, unknown> }> = []

    for (const match of jsonMatches) {
      try {
        const jsonContent = match[1]
        const parsed = JSON.parse(jsonContent)

        if (parsed.ability && typeof parsed.ability === 'string') {
          abilityCalls.push({
            ability: parsed.ability,
            parameters: parsed.parameters || {},
          })
        }
      }
      catch (error) {
        console.log('⚠️ Failed to parse JSON block:', error)
      }
    }
    return abilityCalls
  }

  private async executeAbilityCalls(abilityCalls: Array<{ ability: string, parameters: Record<string, unknown> }>, currentIteration: number, originalUserMessage: AIMessage, abortSignal?: AbortSignal) {
    if (!this.mcpIntegration) {
      throw new Error('MCP integration not available')
    }

    let abilityResults = ''
    for (const abilityCall of abilityCalls) {
      const { ability: abilityName, parameters } = abilityCall
      console.log(`🔧 Executing: ${abilityName}`)

      this.onTaskProgress?.({
        step: currentIteration,
        totalSteps: this.maxAgenticIterations,
        currentAction: `Executing ${abilityName}`,
        isComplete: false,
      })

      const abilityExists = this.mcpIntegration.functions.some(f => f.function.name === abilityName)

      if (abilityExists) {
        try {
          this.setToolExecutionState?.(true, abilityName)

          // Execute with context-aware processing options
          const processingOptions = {
            maxTokens: 300, // Limit result size for efficient context
            contextKeywords: this.extractKeywords(originalUserMessage.content),
            filterSensitiveData: true,
          }

          console.log('🔧 Processing options:', processingOptions)

          const processedResult = await this.mcpIntegration.executeAbilityCall(abilityName, parameters, processingOptions)

          abilityResults += `\n\n🚀 **${abilityName}** executed`
          // if (processedResult.wasFiltered) {
          //   abilityResults += ` (${processedResult.filterReason})`
          // }
          abilityResults += `\n**Result ${processedResult}`

          // Check abort signal after tool execution
          if (abortSignal?.aborted) {
            throw new Error('Request was aborted')
          }
        }
        catch (error) {
          abilityResults += `\n\n❌ **Error:** Failed to execute ${abilityName} - ${error instanceof Error ? error.message : 'Unknown error'}`
        }
        finally {
          this.setToolExecutionState?.(false)
        }
      }
      else {
        // If ability not found, search for similar ones
        const searchResult = this.mcpIntegration.searchAbilities(abilityName, 3)
        if (searchResult.matches.length > 0) {
          const suggestions = searchResult.matches.map(m => m.ability.name).join(', ')
          abilityResults += `\n\n⚠️ **Error:** Ability '${abilityName}' not found. Similar abilities: ${suggestions}`
        }
        else {
          abilityResults += `\n\n⚠️ **Error:** Ability '${abilityName}' not found`
        }
      }
    }
    return abilityResults
  }

  private async handleWithAbilityCalling(aiMessages: AIMessage[], abortSignal?: AbortSignal) {
    if (!this.mcpIntegration) {
      throw new Error('MCP integration not available')
    }

    const conversationHistory = [...aiMessages]
    const originalUserMessage = conversationHistory[conversationHistory.length - 1]
    let currentIteration = 0
    let finalResponse = ''
    let abilitiesRan = ''

    // Add efficient tool discovery instruction
    const lastUserMessage = conversationHistory[conversationHistory.length - 1]
    //     if (lastUserMessage?.role === 'user') {
    //       // Use progressive ability discovery instead of listing all abilities
    //       const searchResult = this.mcpIntegration.searchAbilities(lastUserMessage.content)

    //       const discoveryPrompt = createAbilityDiscoveryPrompt(lastUserMessage.content, searchResult, this.mcpIntegration.abilityDiscovery['filesystem'])

    //       lastUserMessage.content += `\n\n(Note: You are an agentic AI that should work until the user's request is fully completed. I will help you discover relevant abilities as needed.

    // ${discoveryPrompt}

    // When the task is fully complete, make sure to indicate this clearly in your response.)`
    //     }
    if (lastUserMessage?.role === 'user') {
      const searchResult = this.mcpIntegration.searchAbilities(lastUserMessage.content)
      const discoveryPrompt = createAbilityDiscoveryPrompt(lastUserMessage.content, searchResult, this.mcpIntegration.abilityDiscovery['filesystem'])
      conversationHistory[conversationHistory.length - 1].content += `\n\n(Note: You are an agentic AI that should work until the user's request is fully completed. I will help you discover relevant abilities as needed.

${discoveryPrompt}

When the task is fully complete, make sure to indicate this clearly in your response.)`
    }

    // Agentic loop - continue until task is complete or max iterations reached
    while (currentIteration < this.maxAgenticIterations) {
      currentIteration++

      // Report progress
      this.onTaskProgress?.({
        step: currentIteration,
        totalSteps: this.maxAgenticIterations,
        currentAction: `Processing step ${currentIteration}`,
        isComplete: false,
      })

      // Check abort signal
      if (abortSignal?.aborted) {
        throw new Error('Request was aborted')
      }

      // Send enhanced message with context
      // const enhancedMessages = this.preContextPrompt([...conversationHistory])
      const enhancedMessages = conversationHistory
      console.log(`🔄 Agentic Iteration ${currentIteration}/${this.maxAgenticIterations}`)
      console.log('🔧 Enhanced Messages:', enhancedMessages)

      const toolChoiceResponse = await window.electronAPI.sendAIMessage(
        this.currentProvider.provider,
        enhancedMessages,
        { model: this.currentProvider.model },
      )

      const selectedTools = this.preContextPrompt([{ role: 'user', content: toolChoiceResponse }])
      console.log('🔧 Selected Tools:', selectedTools)
      const response = await window.electronAPI.sendAIMessage(
        this.currentProvider.provider,
        selectedTools,
        { model: this.currentProvider.model },
      )
      console.log('📥 AI Response:', response)
      finalResponse = response

      const abilityCalls = this.foundAbilityCallsInResponse(response)

      // If no abilities to execute, check if task is complete
      if (abilityCalls.length === 0) {
        if (this.isTaskComplete(response)) {
          console.log('✅ Task completed - no more abilities needed')
          this.onTaskProgress?.({
            step: currentIteration,
            totalSteps: this.maxAgenticIterations,
            currentAction: 'Task completed successfully',
            isComplete: true,
          })
          break
        }
        else {
          // AI didn't call abilities but task might not be complete - continue for one more iteration
          conversationHistory.push({
            role: 'assistant',
            content: response,
          })
          conversationHistory.push({
            role: 'user',
            content: 'Please continue working on the original request or indicate if you need more information to complete the task.',
          })
          continue
        }
      }

      // Execute abilities with efficient result processing
      const abilityResults = await this.executeAbilityCalls(abilityCalls, currentIteration, originalUserMessage, abortSignal)
      abilitiesRan += abilityResults
      // Add conversation history for next iteration
      conversationHistory.push({
        role: 'assistant',
        content: response,
      })

      // For next iteration, provide efficient context and new ability discovery
      const nextSearchResult = this.mcpIntegration.searchAbilities(originalUserMessage.content + ' ' + abilityResults, 5)
      const nextDiscoveryPrompt = nextSearchResult.matches.length > 0
        ? `\n\nIf you need more abilities, here are relevant options based on current context:\n${nextSearchResult.matches.map(m => `- ${m.ability.name}: ${m.ability.description}`).join('\n')}`
        : '\n\nIf you need to search for other abilities, let me know what type of operation you want to perform.'

      conversationHistory.push({
        role: 'user',
        content: `Here are the results from the abilities you executed:${abilityResults}\n\nOriginal user request: "${originalUserMessage.content}"\n\nPlease analyze these results and either:\n1. Continue working by calling more abilities if needed, OR\n2. Provide your final response if the task is now complete.\n\nMake sure to clearly indicate when the task is complete.`,
      })
    }

    // If we've reached max iterations, indicate this
    if (currentIteration >= this.maxAgenticIterations) {
      finalResponse += `\n\n⚠️ **Note:** Reached maximum number of agentic iterations (${this.maxAgenticIterations}). The task may not be fully complete.`
      this.onTaskProgress?.({
        step: currentIteration,
        totalSteps: this.maxAgenticIterations,
        currentAction: 'Maximum iterations reached',
        isComplete: false,
      })
    }

    // Get AI analysis of the results
    const analysisResponse = await this.getAbilityResultsAnalysis(finalResponse, abilitiesRan, originalUserMessage.content)

    // Format the complete response with collapsible JSON results
    const formattedResponse = `${finalResponse}

<details>
<summary>🔧 Execution Results (Click to expand)</summary>

\`\`\`ability-result
${this.formatAbilityResultsAsJSON(abilitiesRan)}
\`\`\`

</details>

## Analysis
${analysisResponse}`

    return {
      content: [{ type: 'text' as const, text: formattedResponse }],
    }
  }

  private formatAbilityResultsAsJSON(abilitiesRan: string): string {
    try {
      // Parse the ability results and format as clean JSON
      const lines = abilitiesRan.split('\n').filter(line => line.trim())
      const results = []

      for (const line of lines) {
        const match = line.match(/^(\d+)\.\s*(.+):\s*(.+)$/)
        if (match) {
          const [, index, ability, result] = match
          results.push({
            step: parseInt(index),
            ability: ability.trim(),
            result: result.trim(),
            timestamp: new Date().toISOString(),
          })
        }
        else {
          // Fallback for non-standard format
          results.push({
            raw_output: line.trim(),
            timestamp: new Date().toISOString(),
          })
        }
      }

      return JSON.stringify({ execution_results: results }, null, 2)
    }
    catch (error) {
      // Fallback to simple JSON structure
      return JSON.stringify({
        execution_results: [
          {
            raw_output: abilitiesRan,
            error: 'Failed to parse structured results',
            timestamp: new Date().toISOString(),
          },
        ],
      }, null, 2)
    }
  }

  private async getAbilityResultsAnalysis(finalResponse: string, abilitiesRan: string, originalRequest: string): Promise<string> {
    try {
      const analysisPrompt = [{
        role: 'user' as const,
        content: `Please analyze the following execution results and provide a clear summary:

**Original Request:** ${originalRequest}

**AI Response:** ${finalResponse}

**Execution Results:**
${abilitiesRan}

Provide a concise analysis covering:
1. What was accomplished
2. Key results or outputs
3. Whether the original request was fully satisfied
4. Any important findings or next steps

Keep it clear and actionable.`,
      }]

      const analysis = await window.electronAPI.sendAIMessage(
        this.currentProvider.provider,
        analysisPrompt,
        { model: this.currentProvider.model },
      )

      return analysis
    }
    catch (error) {
      console.error('Failed to get AI analysis:', error)
      return `**Summary**: ${abilitiesRan.split('\n').length} abilities were executed. See detailed results above.`
    }
  }

  async run({ messages, abortSignal }: { messages: readonly any[], abortSignal?: AbortSignal }) {
    try {
      // Convert assistant-ui messages to our AI provider format
      const aiMessages: AIMessage[] = messages.map((message: any) => {
        // Get the text content from message
        const textContent = message.content
          ?.find((c: any) => c.type === 'text')?.text || ''

        return {
          role: message.role as 'user' | 'assistant' | 'system',
          content: textContent,
        }
      })

      // Special handling for MCP provider (legacy)
      if (this.currentProvider.provider === 'mcp') {
        return {
          content: [{
            type: 'text' as const,
            text: `🔌 MCP Provider: This provider uses the Model Context Protocol. Please use the MCP chat component for full functionality.`,
          }],
        }
      }

      // Add keyboard.dev abilities system message if enabled and available
      if (this.currentProvider.mcpEnabled && this.mcpIntegration?.isConnected) {
        // const abilitiesSystemMessage = this.mcpIntegration.getAbilitiesSystemMessage()
        // if (abilitiesSystemMessage) {
        //   // Check if there's already a system message
        //   const existingSystemIndex = aiMessages.findIndex(m => m.role === 'system')
        //   if (existingSystemIndex >= 0) {
        //     // Append to existing system message
        //     aiMessages[existingSystemIndex].content += '\n\n' + abilitiesSystemMessage
        //   }
        //   else {
        //     // Add new system message at the beginning
        //     aiMessages.unshift({
        //       role: 'system',
        //       content: abilitiesSystemMessage,
        //     })
        //   }
        // }
      }

      // Check if provider is configured
      const providerStatus = await window.electronAPI.getAIProviderKeys()
      const currentProviderStatus = providerStatus.find(p => p.provider === this.currentProvider.provider)

      if (!currentProviderStatus?.configured && this.currentProvider.provider !== 'keyboard') {
        return {
          content: [{
            type: 'text' as const,
            text: `❌ ${this.currentProvider.provider} is not configured. Please set up your API key in Settings > AI Providers.`,
          }],
        }
      }

      // Check if request was aborted
      if (abortSignal?.aborted) {
        throw new Error('Request was aborted')
      }

      // Handle keyboard.dev ability calling if enabled
      if (this.currentProvider.mcpEnabled && this.mcpIntegration?.isConnected) {
        return await this.handleWithAbilityCalling(aiMessages, abortSignal)
      }

      // Send message to AI provider (without tools)
      const response = await window.electronAPI.sendAIMessage(
        this.currentProvider.provider,
        aiMessages,
        { model: this.currentProvider.model },
      )

      // Check abort signal again after async operation
      if (abortSignal?.aborted) {
        throw new Error('Request was aborted')
      }

      // Return the response in the correct format
      return {
        content: [{ type: 'text' as const, text: response }],
      }
    }
    catch (error) {
      // Handle abort errors gracefully
      if (error instanceof Error && error.name === 'AbortError') {
        throw error // Re-throw abort errors
      }

      // Handle other errors gracefully
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

      return {
        content: [{
          type: 'text' as const,
          text: `❌ Error: ${errorMessage}`,
        }],
      }
    }
  }
}

// Helper to create adapters for different providers
export const createOpenAIAdapter = (model: string = 'gpt-3.5-turbo', mcpEnabled: boolean = false) =>
  new AIChatAdapter('openai', model, mcpEnabled)

export const createAnthropicAdapter = (model: string = 'claude-sonnet-4-5', mcpEnabled: boolean = false) =>
  new AIChatAdapter('anthropic', model, mcpEnabled)

export const createGeminiAdapter = (model: string = 'gemini-2.5-flash', mcpEnabled: boolean = false) =>
  new AIChatAdapter('gemini', model, mcpEnabled)

export const createMCPAdapter = (model: string = 'mcp-server') =>
  new AIChatAdapter('mcp', model)

// Check provider availability function
export async function checkProviderAvailability(): Promise<Array<{ provider: string, configured: boolean }>> {
  try {
    const providerStatus = await window.electronAPI.getAIProviderKeys()
    return providerStatus || []
  }
  catch (error) {
    console.error('Failed to check provider availability:', error)
    return []
  }
}
