import type { ChatModelAdapter } from '@assistant-ui/react'

interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface AIProviderSelection {
  provider: string
  model?: string
}

export class AIChatAdapter implements ChatModelAdapter {
  private currentProvider: AIProviderSelection = { provider: 'openai', model: 'gpt-3.5-turbo' }

  constructor(provider: string = 'openai', model?: string) {
    this.currentProvider = { provider, model }
  }

  setProvider(provider: string, model?: string) {
    this.currentProvider = { provider, model }
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

      // Check if provider is configured
      const providerStatus = await window.electronAPI.getAIProviderKeys()
      const currentProviderStatus = providerStatus.find(p => p.provider === this.currentProvider.provider)
      
      if (!currentProviderStatus?.configured) {
        return {
          content: [{ 
            type: 'text', 
            text: `❌ ${this.currentProvider.provider} is not configured. Please set up your API key in Settings > AI Providers.` 
          }]
        }
      }

      // Check if request was aborted
      if (abortSignal?.aborted) {
        throw new Error('Request was aborted')
      }

      // Send message to AI provider
      const response = await window.electronAPI.sendAIMessage(
        this.currentProvider.provider,
        aiMessages,
        { model: this.currentProvider.model }
      )

      // Check abort signal again after async operation
      if (abortSignal?.aborted) {
        throw new Error('Request was aborted')
      }

      // Return the response in the correct format
      return {
        content: [{ type: 'text', text: response }]
      }

    } catch (error) {
      // Handle abort errors gracefully
      if (error instanceof Error && error.name === 'AbortError') {
        throw error // Re-throw abort errors
      }
      
      // Handle other errors gracefully
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      
      return {
        content: [{ 
          type: 'text', 
          text: `❌ Error: ${errorMessage}` 
        }]
      }
    }
  }
}

// Helper to create adapters for different providers
export const createOpenAIAdapter = (model: string = 'gpt-3.5-turbo') => 
  new AIChatAdapter('openai', model)

export const createAnthropicAdapter = (model: string = 'claude-3-sonnet-20240229') => 
  new AIChatAdapter('anthropic', model)

export const createGeminiAdapter = (model: string = 'gemini-2.5-flash') => 
  new AIChatAdapter('gemini', model)