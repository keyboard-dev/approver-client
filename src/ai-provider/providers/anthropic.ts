import { AIMessage, AIProvider, AIProviderConfig, StreamEvent } from '../index'

export class AnthropicProvider implements AIProvider {
  name = 'anthropic'

  async sendMessage(messages: AIMessage[], config: AIProviderConfig): Promise<string> {
    const url = `${config.baseUrl || 'https://api.anthropic.com'}/v1/messages`

    const systemMessage = messages.find(m => m.role === 'system')
    const conversationMessages = messages.filter(m => m.role !== 'system')

    const body: Record<string, unknown> = {
      model: config.model || 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemMessage?.content,
      messages: conversationMessages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    }

    if (config.tools?.length) {
      body.tools = config.tools
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as any
    return data.content[0]?.text || ''
  }

  async* streamMessage(messages: AIMessage[], config: AIProviderConfig): AsyncGenerator<string | StreamEvent, void, unknown> {
    const url = `${config.baseUrl || 'https://api.anthropic.com'}/v1/messages`

    const systemMessage = messages.find(m => m.role === 'system')
    const conversationMessages = messages.filter(m => m.role !== 'system')

    const body: Record<string, unknown> = {
      model: config.model || 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemMessage?.content,
      messages: conversationMessages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      stream: true,
    }

    if (config.tools?.length) {
      body.tools = config.tools
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`)
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

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)

            try {
              const parsed = JSON.parse(data)
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
              // Skip invalid JSON
            }
          }
        }
      }
    }
    finally {
      reader.releaseLock()
    }
  }

  validateConfig(config: AIProviderConfig): boolean {
    return !!(config.apiKey && config.apiKey.startsWith('sk-ant-'))
  }
}
