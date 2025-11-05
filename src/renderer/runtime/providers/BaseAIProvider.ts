import type { LanguageModelV1, LanguageModelV1CallOptions, ChatModelRunResult } from '@assistant-ui/react'

export interface AIProviderConfig {
  apiKey?: string
  baseUrl?: string
  model?: string
  temperature?: number
  maxTokens?: number
}

export interface StreamChunk {
  type: 'text' | 'tool-call' | 'tool-result'
  content?: string
  toolCall?: {
    id: string
    name: string
    arguments: Record<string, unknown>
  }
  toolResult?: {
    id: string
    result: unknown
  }
  done?: boolean
}

export abstract class BaseAIProvider implements LanguageModelV1 {
  readonly specificationVersion = 'v1' as const
  abstract readonly provider: string
  readonly modelId: string
  readonly defaultObjectGenerationMode = 'tool' as const

  protected config: AIProviderConfig

  constructor(config: AIProviderConfig) {
    this.config = config
    this.modelId = config.model || 'default'
  }

  abstract doGenerate(options: LanguageModelV1CallOptions): Promise<ChatModelRunResult>

  abstract doStream(options: LanguageModelV1CallOptions): Promise<AsyncIterable<ChatModelRunResult>>

  protected formatMessages(prompt: LanguageModelV1CallOptions['prompt']) {
    return prompt.map((msg) => {
      if (msg.role === 'system') {
        return { role: 'system', content: msg.content }
      }
      return {
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      }
    })
  }

  protected createErrorResult(error: Error): ChatModelRunResult {
    return {
      text: `Error: ${error.message}`,
      finishReason: 'error',
      usage: {
        promptTokens: 0,
        completionTokens: 0,
      },
      toolCalls: [],
      toolResults: [],
      rawCall: {
        rawPrompt: [],
        rawSettings: {},
      },
    }
  }
}
