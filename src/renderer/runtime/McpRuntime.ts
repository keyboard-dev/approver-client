import type { ChatModelRunResult, LanguageModelV1, LanguageModelV1CallOptions } from '@assistant-ui/react'
import { ExternalStoreRuntime } from '@assistant-ui/react'

export interface McpTool {
  name: string
  description?: string
  inputSchema: {
    type: 'object'
    properties?: Record<string, unknown>
    required?: string[]
  }
}

export interface McpMessage {
  role: 'user' | 'assistant'
  content: string | Array<{ type: string, text?: string, [key: string]: unknown }>
  toolCalls?: Array<{
    id: string
    name: string
    arguments: Record<string, unknown>
    status?: 'pending' | 'approved' | 'rejected'
  }>
  toolResults?: Array<{
    id: string
    result: unknown
  }>
}

export interface McpChatOptions {
  serverUrl: string
  apiKey?: string
  onToolCall?: (toolCall: { id: string, name: string, arguments: Record<string, unknown> }) => Promise<'approved' | 'rejected'>
}

export class McpChatModel implements LanguageModelV1 {
  readonly specificationVersion = 'v1' as const
  readonly provider = 'mcp'
  readonly modelId: string
  readonly defaultObjectGenerationMode = 'tool' as const

  private serverUrl: string
  private apiKey?: string
  private onToolCall?: (toolCall: { id: string, name: string, arguments: Record<string, unknown> }) => Promise<'approved' | 'rejected'>

  constructor(options: McpChatOptions) {
    this.serverUrl = options.serverUrl
    this.apiKey = options.apiKey
    this.onToolCall = options.onToolCall
    this.modelId = 'mcp-chat'
  }

  async doGenerate(options: LanguageModelV1CallOptions): Promise<ChatModelRunResult> {
    const messages = options.prompt.map((msg) => {
      if (msg.role === 'system') {
        return { role: 'user', content: `System: ${msg.content}` }
      }
      return {
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      }
    })

    try {
      const response = await fetch(`${this.serverUrl}/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          messages,
          stream: false,
        }),
      })

      if (!response.ok) {
        throw new Error(`MCP server error: ${response.statusText}`)
      }

      const data = await response.json()

      // Extract tool calls if present
      const toolCalls = data.toolCalls || []

      // Handle tool approval if callback is provided
      if (toolCalls.length > 0 && this.onToolCall) {
        for (const toolCall of toolCalls) {
          const approval = await this.onToolCall(toolCall)
          toolCall.status = approval
        }
      }

      return {
        text: data.content || '',
        finishReason: data.finishReason || 'stop',
        usage: {
          promptTokens: data.usage?.promptTokens || 0,
          completionTokens: data.usage?.completionTokens || 0,
        },
        toolCalls: toolCalls.map((tc: { id: string, name: string, arguments: Record<string, unknown> }) => ({
          type: 'tool-call' as const,
          toolCallId: tc.id,
          toolName: tc.name,
          args: tc.arguments,
        })),
        toolResults: [],
        rawCall: {
          rawPrompt: options.prompt,
          rawSettings: {},
        },
      }
    }
    catch (error) {
      console.error('MCP generation error:', error)
      throw error
    }
  }

  async doStream(options: LanguageModelV1CallOptions): Promise<AsyncIterable<ChatModelRunResult>> {
    // For now, we'll implement streaming as a single yield
    // You can enhance this to use SSE or WebSocket streaming
    const result = await this.doGenerate(options)
    return (async function* () {
      yield result
    })()
  }
}

export interface McpRuntimeOptions {
  serverUrl: string
  apiKey?: string
  initialMessages?: McpMessage[]
  onToolCall?: (toolCall: { id: string, name: string, arguments: Record<string, unknown> }) => Promise<'approved' | 'rejected'>
}

export function createMcpRuntime(options: McpRuntimeOptions): ExternalStoreRuntime {
  const model = new McpChatModel({
    serverUrl: options.serverUrl,
    apiKey: options.apiKey,
    onToolCall: options.onToolCall,
  })

  // Convert initial messages to assistant-ui format
  const messages = (options.initialMessages || []).map((msg, idx) => ({
    id: `msg-${idx}`,
    role: msg.role,
    content: [
      {
        type: 'text' as const,
        text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      },
    ],
    createdAt: new Date(),
  }))

  return new ExternalStoreRuntime({
    messages,
    isRunning: false,
    onNew: async (message) => {
      const userMessage = {
        id: `msg-${Date.now()}`,
        role: 'user' as const,
        content: message.content,
        createdAt: new Date(),
      }

      // Add user message to store
      const newMessages = [...messages, userMessage]

      try {
        // Call the model
        const result = await model.doGenerate({
          prompt: newMessages.map(m => ({
            role: m.role,
            content: m.content.map(c => c.text || '').join(''),
          })),
          mode: { type: 'regular' },
        })

        // Add assistant response
        const assistantMessage = {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant' as const,
          content: [
            {
              type: 'text' as const,
              text: result.text || '',
            },
          ],
          createdAt: new Date(),
        }

        newMessages.push(assistantMessage)
        return { messages: newMessages }
      }
      catch (error) {
        console.error('Error generating response:', error)
        throw error
      }
    },
  })
}
