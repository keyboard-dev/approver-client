import type { ChatModelAdapter } from '@assistant-ui/react'
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

  private findMatchedAbilities(aiMessages: AIMessage[], abortSignal?: AbortSignal) {
    const messagesToCheck = [...aiMessages]
    // can we check all the messages to see if they mention any of the abilities, if they do we should return an array of abilities that are mentioned with the full ability name and description
    const abilities = this.mcpIntegration?.functions || []
    const matchedAbilities = []
    if (!abilities) return []
    for (const message of messagesToCheck) {
      if (message.role === 'user') {
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
      aiMessages[aiMessages.length - 1].content += `\n\n${preContextPrompt}`
    }
    return aiMessages
  }

  private async handleWithAbilityCalling(aiMessages: AIMessage[], abortSignal?: AbortSignal) {
    if (!this.mcpIntegration) {
      throw new Error('MCP integration not available')
    }

    // For now, implement a simple approach: send initial message and check if AI mentions ability usage
    // In a full implementation, this would need provider-specific function calling support

    // Add instruction for two-stage keyboard.dev-ability discovery
    let enhancedMessages = [...aiMessages]
    const lastUserMessage = enhancedMessages[enhancedMessages.length - 1]
    if (lastUserMessage?.role === 'user') {
      // Get list of available ability names
      const availableAbilities = this.mcpIntegration.functions.map(f => f.function.name)
      const abilitiesList = availableAbilities.map(name => `- ${name}`).join('\n')

      lastUserMessage.content += `\n\n(Note: If you need to use any keyboard.dev abilities to answer this question, provide your ability call in this JSON format:

\`\`\`json
{
  "ability": "ability-name",
  "parameters": {
    "param1": "value1",
    "param2": "value2"
  }
}
\`\`\`

Here are the available keyboard.dev abilities you can call:
${abilitiesList})`
    }

    // Send enhanced message

    enhancedMessages = this.preContextPrompt(enhancedMessages)

    const response = await window.electronAPI.sendAIMessage(
      this.currentProvider.provider,
      enhancedMessages,
      { model: this.currentProvider.model },
    )

    console.log('📥 AI Response:', response)

    // Check abort signal
    if (abortSignal?.aborted) {
      throw new Error('Request was aborted')
    }

    // Look for JSON code blocks with ability calls

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

    if (abilityCalls.length > 0 && this.mcpIntegration.functions.length > 0) {
      let enhancedResponse = response

      for (const abilityCall of abilityCalls) {
        console.log('YAKAKA WHAT IS THE ABILITY CALL', abilityCall)
        const { ability: abilityName, parameters } = abilityCall
        console.log(`🔧 Executing: ${abilityName}`)

        // Check if ability exists
        const abilityExists = this.mcpIntegration.functions.some(f => f.function.name === abilityName)

        if (abilityExists) {
          try {
            // Start execution tracking
            this.setToolExecutionState?.(true, abilityName)

            // Execute ability with provided parameters
            const abilityResult = await this.mcpIntegration.executeToolCall(abilityName, parameters)

            // Add result to response
            enhancedResponse += `\n\n🚀 **${abilityName}** executed\n**Result:**\n${abilityResult}`

            const responsePrompt = `This is the result of the ability call: ${abilityResult}. Please use this result to answer the user's question.
            
            User question: ${lastUserMessage.content}
            `
            enhancedResponse = await window.electronAPI.sendAIMessage(this.currentProvider.provider, [
              {
                role: 'user',
                content: responsePrompt,
              },
            ], { model: this.currentProvider.model })

            console.log('this is the enhanced response', enhancedResponse)

            // Check abort signal after tool execution
            if (abortSignal?.aborted) {
              throw new Error('Request was aborted')
            }
          }
          catch (error) {
            enhancedResponse += `\n\n❌ **Error:** Failed to execute ${abilityName} - ${error instanceof Error ? error.message : 'Unknown error'}`
          }
          finally {
            // End execution tracking
            this.setToolExecutionState?.(false)
          }
        }
        else {
          enhancedResponse += `\n\n⚠️ **Error:** Ability '${abilityName}' not found`
        }
      }

      return {
        content: [{ type: 'text' as const, text: enhancedResponse }],
      }
    }

    // No abilities called, return original response
    return {
      content: [{ type: 'text' as const, text: response }],
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
        const abilitiesSystemMessage = this.mcpIntegration.getToolsSystemMessage()
        if (abilitiesSystemMessage) {
          // Check if there's already a system message
          const existingSystemIndex = aiMessages.findIndex(m => m.role === 'system')
          if (existingSystemIndex >= 0) {
            // Append to existing system message
            aiMessages[existingSystemIndex].content += '\n\n' + abilitiesSystemMessage
          }
          else {
            // Add new system message at the beginning
            aiMessages.unshift({
              role: 'system',
              content: abilitiesSystemMessage,
            })
          }
        }
      }

      // Check if provider is configured
      const providerStatus = await window.electronAPI.getAIProviderKeys()
      const currentProviderStatus = providerStatus.find(p => p.provider === this.currentProvider.provider)

      if (!currentProviderStatus?.configured) {
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

export const createAnthropicAdapter = (model: string = 'claude-3-sonnet-20240229', mcpEnabled: boolean = false) =>
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
