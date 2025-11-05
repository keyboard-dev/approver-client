export { BaseAIProvider, type AIProviderConfig, type StreamChunk } from './BaseAIProvider'
export { OpenAIProvider } from './OpenAIProvider'
export { AnthropicProvider } from './AnthropicProvider'
export { McpProvider } from './McpProvider'

export type AIProviderType = 'openai' | 'anthropic' | 'mcp' | 'custom'

export interface ProviderOption {
  id: AIProviderType
  name: string
  description: string
  requiresApiKey: boolean
  defaultModel?: string
  models?: string[]
}

export const AVAILABLE_PROVIDERS: ProviderOption[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4, GPT-3.5, and other OpenAI models',
    requiresApiKey: true,
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 3.5 Sonnet, Opus, and other Claude models',
    requiresApiKey: true,
    defaultModel: 'claude-3-5-sonnet-20241022',
    models: [
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ],
  },
  {
    id: 'mcp',
    name: 'MCP Server',
    description: 'Connect to your Model Context Protocol server',
    requiresApiKey: false,
    defaultModel: 'mcp-chat',
  },
]
