export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | Array<{ type: string; [key: string]: unknown }>
  timestamp?: number
}

export interface AIProviderConfig {
  name: string
  apiKey: string
  baseUrl?: string
  model?: string
  tools?: Array<{ name: string; description: string; input_schema: Record<string, unknown> }>
}

export type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_use_start'; id: string; name: string }
  | { type: 'tool_use_delta'; id: string; json: string }
  | { type: 'tool_use_end'; id: string }
  | { type: 'message_end'; stop_reason: string }

export interface WebSearchQuery {
  query: string
  maxResults?: number
  includeDomains?: string[]
  excludeDomains?: string[]
  prioritizeMarkdown?: boolean
  prioritizeDocs?: boolean
}

export interface WebSearchResult {
  title: string
  url: string
  snippet: string
  relevanceScore?: number
  isMarkdown?: boolean
  isDocs?: boolean
}

export interface WebSearchResponse {
  results: WebSearchResult[]
  searchQuery: string
  provider: string
}

export interface AIProvider {
  name: string
  sendMessage(messages: AIMessage[], config: AIProviderConfig): Promise<string>
  streamMessage?(messages: AIMessage[], config: AIProviderConfig): AsyncGenerator<string | StreamEvent, void, unknown>
  webSearch?(query: WebSearchQuery, config: AIProviderConfig): Promise<WebSearchResponse>
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
