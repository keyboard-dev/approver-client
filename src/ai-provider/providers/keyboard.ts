import { AuthTokens } from '../../types'
import { AIMessage, AIProvider, AIProviderConfig, StreamEvent } from '../index'

// API URL - configurable via environment variable for local development
const KEYBOARD_API_URL = process.env.KEYBOARD_API_URL || 'https://api.keyboard.dev'

export class KeyboardProvider implements AIProvider {
  name = 'keyboard'

  async sendMessage(messages: AIMessage[], config: AIProviderConfig, authTokens?: AuthTokens): Promise<string> {
    if (!authTokens?.access_token) {
      throw new Error('Authentication tokens required for Keyboard AI provider')
    }

    const systemMessage = messages.find(m => m.role === 'system')
    const messagesWithoutSystem = messages.filter(m => m.role !== 'system')

    const url = `${KEYBOARD_API_URL}/api/ai/inference`
    const requestBody: Record<string, unknown> = {
      model: config.model || 'claude-sonnet-4-6',
      system: systemMessage?.content,
      messages: messagesWithoutSystem.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: 0.7,
      stream: false,
    }

    if (config.tools?.length) {
      requestBody.tools = config.tools
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authTokens.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Keyboard AI API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json() as any

    // Try different response format patterns based on actual response structure

    // Pattern 1: Direct content array (Anthropic format)
    if (data.content && Array.isArray(data.content) && data.content[0]?.text) {
      return data.content[0].text
    }

    // Pattern 2: Nested response.content
    if (data.response?.content && Array.isArray(data.response.content) && data.response.content[0]?.text) {
      return data.response.content[0].text
    }

    // Pattern 3: OpenAI choices format
    if (data.choices && data.choices[0]?.message?.content) {
      return data.choices[0].message.content
    }

    // Pattern 4: Simple message.content
    if (data.message && data.message.content) {
      return data.message.content
    }

    // Pattern 5: Direct text fields
    if (data.text) {
      return data.text
    }

    // Pattern 6: Direct content string
    if (data.content && typeof data.content === 'string') {
      return data.content
    }

    // Pattern 7: Direct string response
    if (typeof data === 'string') {
      return data
    }

    // Pattern 8: Response wrapper
    if (data.response && typeof data.response === 'string') {
      return data.response
    }

    const fallbackText = data.text || data.content || data.response || data.output || data.result || 'No response received'

    return fallbackText
  }

  async* streamMessage(messages: AIMessage[], config: AIProviderConfig, authTokens?: AuthTokens): AsyncGenerator<string | StreamEvent, void, unknown> {
    if (!authTokens?.access_token) {
      throw new Error('Authentication tokens required for Keyboard AI provider')
    }

    const systemMessage = messages.find(m => m.role === 'system')
    const messagesWithoutSystem = messages.filter(m => m.role !== 'system')

    const url = `${KEYBOARD_API_URL}/api/ai/inference`

    // Transform messages: flatten tool_use/tool_result blocks into text
    // The API Zod schema only accepts string or text/image content blocks
    const transformedMessages = messagesWithoutSystem.map((msg) => {
      if (typeof msg.content === 'string') {
        return { role: msg.role, content: msg.content }
      }
      if (Array.isArray(msg.content)) {
        const parts: string[] = []
        for (const block of msg.content as Array<Record<string, unknown>>) {
          if (block.type === 'text') {
            parts.push(block.text as string)
          }
          else if (block.type === 'tool_use') {
            parts.push(`[Used tool: ${block.name}(${JSON.stringify(block.input)})]`)
          }
          else if (block.type === 'tool_result') {
            parts.push(`[Tool result for ${block.tool_use_id}]: ${block.content}`)
          }
        }
        return { role: msg.role, content: parts.join('\n') }
      }
      return { role: msg.role, content: msg.content }
    })

    // Filter out messages with empty content — these poison the conversation
    // and cause the model to return empty responses after MCP disconnects
    const validMessages = transformedMessages.filter((msg) => {
      if (typeof msg.content === 'string' && msg.content.trim() === '') return false
      return true
    })

    const requestBody: Record<string, unknown> = {
      model: config.model || 'claude-sonnet-4-6',
      system: systemMessage?.content,
      messages: validMessages,
      temperature: 0.7,
      stream: true,
    }

    if (config.tools?.length) {
      // Deduplicate tools by name — API requires unique tool names
      const seen = new Set<string>()
      requestBody.tools = config.tools.filter((t: any) => {
        if (seen.has(t.name)) return false
        seen.add(t.name)
        return true
      })
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authTokens.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Keyboard AI API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const rawChunk = decoder.decode(value, { stream: true })
        buffer += rawChunk
        // Log first 500 chars of raw chunk to see what the API is actually returning
        if (rawChunk.length > 0) {
        }
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)

            if (data === '[DONE]') {
              return
            }

            try {
              const parsed = JSON.parse(data)
              if (parsed.error) {
                throw new Error(parsed.error)
              }
              if (parsed.type === 'content_block_start' && parsed.content_block?.type === 'tool_use') {
                yield { type: 'tool_use_start', id: parsed.content_block.id, name: parsed.content_block.name } as StreamEvent
              }
              else if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'input_json_delta') {
                yield { type: 'tool_use_delta', id: String(parsed.index), json: parsed.delta.partial_json } as StreamEvent
              }
              else if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                yield parsed.delta.text
              }
              else if (parsed.type === 'content_block_stop') {
                yield { type: 'tool_use_end', id: String(parsed.index) } as StreamEvent
              }
              else if (parsed.type === 'message_delta' && parsed.delta?.stop_reason) {
                yield { type: 'message_end', stop_reason: parsed.delta.stop_reason } as StreamEvent
              }
            }
            catch (e) {
            }
          }
          else if (line.trim().length > 0) {
          }
        }
      }
    }
    finally {
      reader.releaseLock()
    }
  }

  validateConfig(config: AIProviderConfig): boolean {
    // Keyboard provider doesn't need API key validation since it uses auth tokens
    return true
  }
}
