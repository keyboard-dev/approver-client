/**
 * Secure Provider Wrapper
 *
 * This wrapper routes all API calls through the secure IPC proxy in the main process.
 * API keys never leave the main process, keeping them secure.
 */

import type { LanguageModelV1CallOptions, ChatModelRunResult } from '@assistant-ui/react'
import { BaseAIProvider, type AIProviderConfig } from './BaseAIProvider'

export class SecureProvider extends BaseAIProvider {
  readonly provider: string

  constructor(providerType: 'openai' | 'anthropic' | 'mcp', config: AIProviderConfig) {
    super(config)
    this.provider = providerType
  }

  async doGenerate(options: LanguageModelV1CallOptions): Promise<ChatModelRunResult> {
    try {
      const messages = this.formatMessages(options.prompt)

      // Call through secure IPC proxy
      const response = await window.electronAPI.aiProxyRequest({
        provider: this.provider,
        model: this.config.model,
        messages,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        serverUrl: this.config.baseUrl, // For MCP
        stream: false,
      })

      if (response.error) {
        throw new Error(response.error)
      }

      return {
        text: response.text || '',
        finishReason: response.finishReason || 'stop',
        usage: {
          promptTokens: response.usage?.promptTokens || 0,
          completionTokens: response.usage?.completionTokens || 0,
        },
        toolCalls: response.toolCalls?.map((tc: any) => ({
          type: 'tool-call' as const,
          toolCallId: tc.id,
          toolName: tc.name,
          args: tc.arguments,
        })) || [],
        toolResults: [],
        rawCall: {
          rawPrompt: options.prompt,
          rawSettings: {},
        },
      }
    }
    catch (error) {
      console.error('Secure provider error:', error)
      return this.createErrorResult(error as Error)
    }
  }

  async doStream(options: LanguageModelV1CallOptions): Promise<AsyncIterable<ChatModelRunResult>> {
    const self = this

    return (async function* () {
      try {
        const messages = self.formatMessages(options.prompt)

        // Call through secure IPC proxy (streaming)
        const response = await window.electronAPI.aiProxyStream({
          provider: self.provider,
          model: self.config.model,
          messages,
          temperature: self.config.temperature,
          maxTokens: self.config.maxTokens,
          serverUrl: self.config.baseUrl,
          stream: true,
        })

        if (response.error) {
          throw new Error(response.error)
        }

        // For now, yield the complete response
        // TODO: Implement true streaming with IPC events
        yield {
          text: response.text || '',
          finishReason: response.finishReason || 'stop',
          usage: {
            promptTokens: response.usage?.promptTokens || 0,
            completionTokens: response.usage?.completionTokens || 0,
          },
          toolCalls: response.toolCalls?.map((tc: any) => ({
            type: 'tool-call' as const,
            toolCallId: tc.id,
            toolName: tc.name,
            args: tc.arguments,
          })) || [],
          toolResults: [],
          rawCall: {
            rawPrompt: options.prompt,
            rawSettings: {},
          },
        }
      }
      catch (error) {
        console.error('Secure provider streaming error:', error)
        yield self.createErrorResult(error as Error)
      }
    })()
  }
}

/**
 * Helper functions to create secure providers
 */

export function createSecureOpenAIProvider(config: AIProviderConfig): SecureProvider {
  return new SecureProvider('openai', {
    ...config,
    model: config.model || 'gpt-4o',
  })
}

export function createSecureAnthropicProvider(config: AIProviderConfig): SecureProvider {
  return new SecureProvider('anthropic', {
    ...config,
    model: config.model || 'claude-3-5-sonnet-20241022',
  })
}

export function createSecureMCPProvider(config: AIProviderConfig & { serverUrl?: string }): SecureProvider {
  return new SecureProvider('mcp', {
    ...config,
    baseUrl: config.serverUrl || config.baseUrl || 'https://mcp.keyboard.dev',
    model: config.model || 'mcp-chat',
  })
}
