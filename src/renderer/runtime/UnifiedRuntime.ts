import { ExternalStoreRuntime } from '@assistant-ui/react'
import type { BaseAIProvider } from './providers/BaseAIProvider'
import {
  createSecureOpenAIProvider,
  createSecureAnthropicProvider,
  createSecureMCPProvider,
} from './providers/SecureProvider'
import type { AIProviderType } from './providers'

export interface UnifiedRuntimeOptions {
  provider: AIProviderType
  apiKey?: string
  baseUrl?: string
  model?: string
  temperature?: number
  maxTokens?: number
  serverUrl?: string // For MCP provider
  onToolCall?: (toolCall: { id: string, name: string, arguments: Record<string, unknown> }) => Promise<'approved' | 'rejected'>
  onSaveMessage?: (message: any) => Promise<void>
  enableStreaming?: boolean
}

export function createUnifiedRuntime(options: UnifiedRuntimeOptions): ExternalStoreRuntime {
  // Create the appropriate SECURE provider (API calls go through main process)
  let aiProvider: BaseAIProvider

  // Store the API key securely in main process (if provided)
  if (options.apiKey) {
    window.electronAPI.aiProxySetKey(options.provider, options.apiKey)
      .catch(err => console.error('Error setting API key:', err))
  }

  switch (options.provider) {
    case 'openai':
      aiProvider = createSecureOpenAIProvider({
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      })
      break

    case 'anthropic':
      aiProvider = createSecureAnthropicProvider({
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      })
      break

    case 'mcp':
      aiProvider = createSecureMCPProvider({
        serverUrl: options.serverUrl || 'https://mcp.keyboard.dev',
        model: options.model,
      })
      break

    default:
      throw new Error(`Unknown provider: ${options.provider}`)
  }

  // Create runtime with streaming support
  return new ExternalStoreRuntime({
    messages: [],
    isRunning: false,
    onNew: async (message) => {
      const userMessage = {
        id: `msg-${Date.now()}`,
        role: 'user' as const,
        content: message.content,
        createdAt: new Date(),
      }

      // Save user message if callback provided
      if (options.onSaveMessage) {
        await options.onSaveMessage(userMessage)
      }

      try {
        if (options.enableStreaming) {
          // Use streaming
          const stream = await aiProvider.doStream({
            prompt: [
              {
                role: 'user',
                content: message.content.map(c => c.text || '').join(''),
              },
            ],
            mode: { type: 'regular' },
          })

          let finalResult
          for await (const chunk of stream) {
            finalResult = chunk
          }

          if (finalResult) {
            const assistantMessage = {
              id: `msg-${Date.now() + 1}`,
              role: 'assistant' as const,
              content: [
                {
                  type: 'text' as const,
                  text: finalResult.text || '',
                },
              ],
              createdAt: new Date(),
            }

            // Save assistant message if callback provided
            if (options.onSaveMessage) {
              await options.onSaveMessage(assistantMessage)
            }

            return { messages: [userMessage, assistantMessage] }
          }
        }
        else {
          // Use non-streaming
          const result = await aiProvider.doGenerate({
            prompt: [
              {
                role: 'user',
                content: message.content.map(c => c.text || '').join(''),
              },
            ],
            mode: { type: 'regular' },
          })

          const assistantMessage = {
            id: `msg-${Date.now() + 1}`,
            role: 'assistant' as const,
            content: [
              {
                type: 'text' as const,
                text: result.text || '',
              },
              ...result.toolCalls.map(tc => ({
                type: 'tool-call' as const,
                ...tc,
              })),
            ],
            createdAt: new Date(),
          }

          // Save assistant message if callback provided
          if (options.onSaveMessage) {
            await options.onSaveMessage(assistantMessage)
          }

          return { messages: [userMessage, assistantMessage] }
        }
      }
      catch (error) {
        console.error('Error generating response:', error)
        throw error
      }

      return { messages: [] }
    },
  })
}
