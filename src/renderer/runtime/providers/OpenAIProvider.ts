import type { LanguageModelV1CallOptions, ChatModelRunResult } from '@assistant-ui/react'
import { BaseAIProvider, type AIProviderConfig, type StreamChunk } from './BaseAIProvider'

export class OpenAIProvider extends BaseAIProvider {
  readonly provider = 'openai'

  constructor(config: AIProviderConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl || 'https://api.openai.com/v1',
      model: config.model || 'gpt-4o',
    })
  }

  async doGenerate(options: LanguageModelV1CallOptions): Promise<ChatModelRunResult> {
    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: this.formatMessages(options.prompt),
          temperature: this.config.temperature || 0.7,
          max_tokens: this.config.maxTokens,
          stream: false,
        }),
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`)
      }

      const data = await response.json()
      const message = data.choices[0]?.message

      return {
        text: message?.content || '',
        finishReason: data.choices[0]?.finish_reason || 'stop',
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
        },
        toolCalls: message?.tool_calls?.map((tc: any) => ({
          type: 'tool-call' as const,
          toolCallId: tc.id,
          toolName: tc.function.name,
          args: JSON.parse(tc.function.arguments),
        })) || [],
        toolResults: [],
        rawCall: {
          rawPrompt: options.prompt,
          rawSettings: {},
        },
      }
    }
    catch (error) {
      console.error('OpenAI generation error:', error)
      return this.createErrorResult(error as Error)
    }
  }

  async doStream(options: LanguageModelV1CallOptions): Promise<AsyncIterable<ChatModelRunResult>> {
    const self = this

    return (async function* () {
      try {
        const response = await fetch(`${self.config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${self.config.apiKey}`,
          },
          body: JSON.stringify({
            model: self.config.model,
            messages: self.formatMessages(options.prompt),
            temperature: self.config.temperature || 0.7,
            max_tokens: self.config.maxTokens,
            stream: true,
          }),
        })

        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.statusText}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error('No response body')
        }

        const decoder = new TextDecoder()
        let buffer = ''
        let accumulatedText = ''
        let totalPromptTokens = 0
        let totalCompletionTokens = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') continue

              try {
                const parsed = JSON.parse(data)
                const delta = parsed.choices[0]?.delta

                if (delta?.content) {
                  accumulatedText += delta.content
                  yield {
                    text: accumulatedText,
                    finishReason: 'unknown',
                    usage: {
                      promptTokens: totalPromptTokens,
                      completionTokens: totalCompletionTokens,
                    },
                    toolCalls: [],
                    toolResults: [],
                    rawCall: {
                      rawPrompt: options.prompt,
                      rawSettings: {},
                    },
                  }
                }

                if (parsed.choices[0]?.finish_reason) {
                  yield {
                    text: accumulatedText,
                    finishReason: parsed.choices[0].finish_reason,
                    usage: {
                      promptTokens: parsed.usage?.prompt_tokens || totalPromptTokens,
                      completionTokens: parsed.usage?.completion_tokens || totalCompletionTokens,
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
              catch (e) {
                console.error('Error parsing stream chunk:', e)
              }
            }
          }
        }
      }
      catch (error) {
        console.error('OpenAI streaming error:', error)
        yield self.createErrorResult(error as Error)
      }
    })()
  }
}
