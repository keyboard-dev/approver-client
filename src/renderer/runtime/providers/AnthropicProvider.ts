import type { LanguageModelV1CallOptions, ChatModelRunResult } from '@assistant-ui/react'
import { BaseAIProvider, type AIProviderConfig } from './BaseAIProvider'

export class AnthropicProvider extends BaseAIProvider {
  readonly provider = 'anthropic'

  constructor(config: AIProviderConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl || 'https://api.anthropic.com/v1',
      model: config.model || 'claude-3-5-sonnet-20241022',
    })
  }

  async doGenerate(options: LanguageModelV1CallOptions): Promise<ChatModelRunResult> {
    try {
      const messages = this.formatMessages(options.prompt)
      const systemMessage = messages.find(m => m.role === 'system')
      const conversationMessages = messages.filter(m => m.role !== 'system')

      const response = await fetch(`${this.config.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey || '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: conversationMessages,
          system: systemMessage?.content,
          max_tokens: this.config.maxTokens || 4096,
          temperature: this.config.temperature || 0.7,
          stream: false,
        }),
      })

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.statusText}`)
      }

      const data = await response.json()
      const content = data.content[0]

      return {
        text: content?.text || '',
        finishReason: data.stop_reason || 'stop',
        usage: {
          promptTokens: data.usage?.input_tokens || 0,
          completionTokens: data.usage?.output_tokens || 0,
        },
        toolCalls: data.content
          .filter((c: any) => c.type === 'tool_use')
          .map((tc: any) => ({
            type: 'tool-call' as const,
            toolCallId: tc.id,
            toolName: tc.name,
            args: tc.input,
          })),
        toolResults: [],
        rawCall: {
          rawPrompt: options.prompt,
          rawSettings: {},
        },
      }
    }
    catch (error) {
      console.error('Anthropic generation error:', error)
      return this.createErrorResult(error as Error)
    }
  }

  async doStream(options: LanguageModelV1CallOptions): Promise<AsyncIterable<ChatModelRunResult>> {
    const self = this

    return (async function* () {
      try {
        const messages = self.formatMessages(options.prompt)
        const systemMessage = messages.find(m => m.role === 'system')
        const conversationMessages = messages.filter(m => m.role !== 'system')

        const response = await fetch(`${self.config.baseUrl}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': self.config.apiKey || '',
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: self.config.model,
            messages: conversationMessages,
            system: systemMessage?.content,
            max_tokens: self.config.maxTokens || 4096,
            temperature: self.config.temperature || 0.7,
            stream: true,
          }),
        })

        if (!response.ok) {
          throw new Error(`Anthropic API error: ${response.statusText}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body')
        }

        const decoder = new TextDecoder()
        let buffer = ''
        let accumulatedText = ''
        let inputTokens = 0
        let outputTokens = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)

              try {
                const parsed = JSON.parse(data)

                if (parsed.type === 'content_block_delta') {
                  if (parsed.delta?.text) {
                    accumulatedText += parsed.delta.text
                    yield {
                      text: accumulatedText,
                      finishReason: 'unknown',
                      usage: {
                        promptTokens: inputTokens,
                        completionTokens: outputTokens,
                      },
                      toolCalls: [],
                      toolResults: [],
                      rawCall: {
                        rawPrompt: options.prompt,
                        rawSettings: {},
                      },
                    }
                  }
                }

                if (parsed.type === 'message_delta') {
                  yield {
                    text: accumulatedText,
                    finishReason: parsed.delta?.stop_reason || 'stop',
                    usage: {
                      promptTokens: inputTokens,
                      completionTokens: parsed.usage?.output_tokens || outputTokens,
                    },
                    toolCalls: [],
                    toolResults: [],
                    rawCall: {
                      rawPrompt: options.prompt,
                      rawSettings: {},
                    },
                  }
                }

                if (parsed.type === 'message_start') {
                  inputTokens = parsed.message?.usage?.input_tokens || 0
                }
              }
              catch (e) {
                console.error('Error parsing stream chunk:', e)
              }
            }
          }
        }
      }
      catch (error) {
        console.error('Anthropic streaming error:', error)
        yield self.createErrorResult(error as Error)
      }
    })()
  }
}
