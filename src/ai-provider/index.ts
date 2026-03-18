export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | Array<{ type: string, [key: string]: unknown }>
  timestamp?: number
}

export interface AIProviderConfig {
  name: string
  apiKey: string
  baseUrl?: string
  model?: string
  tools?: Array<{ name: string, description: string, input_schema: Record<string, unknown> }>
}

export type StreamEvent
  = | { type: 'text', text: string }
    | { type: 'tool_use_start', id: string, name: string }
    | { type: 'tool_use_delta', id: string, json: string }
    | { type: 'tool_use_end', id: string }
    | { type: 'message_end', stop_reason: string }

export interface AIProvider {
  name: string
  sendMessage(messages: AIMessage[], config: AIProviderConfig): Promise<string>
  streamMessage?(messages: AIMessage[], config: AIProviderConfig): AsyncGenerator<string | StreamEvent, void, unknown>
  validateConfig(config: AIProviderConfig): boolean
}

export interface AIResponse {
  content: string
  provider: string
  model?: string
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

export * from './runtime'
export * from './encrypted-storage'
export * from './providers/openai'
export * from './providers/anthropic'
export * from './providers/gemini'
export * from './providers/keyboard'
