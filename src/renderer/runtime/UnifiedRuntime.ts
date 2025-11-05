import { ExternalStoreRuntime } from '@assistant-ui/react'
import type { BaseAIProvider } from './providers/BaseAIProvider'
import { OpenAIProvider } from './providers/OpenAIProvider'
import { AnthropicProvider } from './providers/AnthropicProvider'
import { McpProvider } from './McpRuntime'
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
  // Create the appropriate provider
  let aiProvider: BaseAIProvider

  switch (options.provider) {
    case 'openai':
      aiProvider = new OpenAIProvider({
        apiKey: options.apiKey,
        baseUrl: options.baseUrl,
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      })
      break

    case 'anthropic':
      aiProvider = new AnthropicProvider({
        apiKey: options.apiKey,
        baseUrl: options.baseUrl,
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      })
      break

    case 'mcp':
      aiProvider = new McpProvider({
        serverUrl: options.serverUrl || 'https://mcp.keyboard.dev',
        apiKey: options.apiKey,
        model: options.model,
        onToolCall: options.onToolCall,
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
