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
    console.log('this is the messages without system', messagesWithoutSystem)
    console.log('this is the system message', systemMessage?.content)

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
        stream: false,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Keyboard AI API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json() as any

    const { response: responseData } = data
    // Handle different response formats based on your API
    if (responseData.content && Array.isArray(responseData.content) && responseData.content[0]?.text) {
      return responseData.content[0].text
    }

    // Fallback for different response structure
    if (responseData.message && responseData.message.content) {
      return responseData.message.content
    }

    // Another possible structure
    if (responseData.choices && responseData.choices[0]?.message?.content) {
      return responseData.choices[0].message.content
    }

    // Direct text response
    if (typeof responseData === 'string') {
      return responseData
    }

    console.error('Unknown Keyboard API response format:', data)
    return responseData.text || responseData.content || 'No response received'
  }

  async* streamMessage(messages: AIMessage[], config: AIProviderConfig, authTokens?: AuthTokens): AsyncGenerator<string, void, unknown> {
    if (!authTokens?.access_token) {
      throw new Error('Authentication tokens required for Keyboard AI provider')
    }

    const systemMessage = messages.find(m => m.role === 'system')
    const messagesWithoutSystem = messages.filter(m => m.role !== 'system')

    console.log('this is the messages', messages)

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
