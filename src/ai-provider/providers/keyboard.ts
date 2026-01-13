import { AuthTokens } from '../../types'
import { AIMessage, AIProvider, AIProviderConfig } from '../index'

export class KeyboardProvider implements AIProvider {
  name = 'keyboard'

  async sendMessage(messages: AIMessage[], config: AIProviderConfig, authTokens?: AuthTokens): Promise<string> {
    if (!authTokens?.access_token) {
      throw new Error('Authentication tokens required for Keyboard AI provider')
    }

    const systemMessage = messages.find(m => m.role === 'system')
    const messagesWithoutSystem = messages.filter(m => m.role !== 'system')

    const url = 'https://api.keyboard.dev/api/ai/inference'
    const requestBody = {
      model: config.model || 'claude-sonnet-4-5-20250929',
      system: systemMessage?.content,
      messages: messagesWithoutSystem.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: 0.7,
      stream: false,
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

  async* streamMessage(messages: AIMessage[], config: AIProviderConfig, authTokens?: AuthTokens): AsyncGenerator<string, void, unknown> {
    if (!authTokens?.access_token) {
      throw new Error('Authentication tokens required for Keyboard AI provider')
    }

    const systemMessage = messages.find(m => m.role === 'system')
    const messagesWithoutSystem = messages.filter(m => m.role !== 'system')

    const url = 'https://api.keyboard.dev/api/ai/inference'
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authTokens.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model || 'claude-sonnet-4-5-20250929',
        system: systemMessage?.content,
        messages: messagesWithoutSystem.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature: 0.7,
        stream: true,
      }),
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
        //
        if (done) break

        buffer += decoder.decode(value, { stream: true })
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
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                yield parsed.delta.text
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
    // Keyboard provider doesn't need API key validation since it uses auth tokens
    return true
  }
}
