import { AIProvider, AIProviderConfig, AIMessage } from '../index'

export class GeminiProvider implements AIProvider {
  name = 'gemini'

  async sendMessage(messages: AIMessage[], config: AIProviderConfig): Promise<string> {
    const url = `${config.baseUrl || 'https://generativelanguage.googleapis.com'}/v1beta/models/${config.model || 'gemini-2.5-flash'}:generateContent`

    const contents = this.convertMessagesToGeminiFormat(messages)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey,
      },
      body: JSON.stringify({
        contents,
      }),
    })

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as any
    return data.candidates[0]?.content?.parts[0]?.text || ''
  }

  async* streamMessage(messages: AIMessage[], config: AIProviderConfig): AsyncGenerator<string, void, unknown> {
    const url = `${config.baseUrl || 'https://generativelanguage.googleapis.com'}/v1beta/models/${config.model || 'gemini-2.5-flash'}:streamGenerateContent`

    const contents = this.convertMessagesToGeminiFormat(messages)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey,
      },
      body: JSON.stringify({
        contents,
      }),
    })

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`)
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
          if (line.trim() && line.startsWith('{')) {
            try {
              const parsed = JSON.parse(line)
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text
              if (text) {
                yield text
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
    return !!(config.apiKey && config.apiKey.length > 0)
  }

  private convertMessagesToGeminiFormat(messages: AIMessage[]) {
    const contents = []

    for (const message of messages) {
      if (message.role === 'system') {
        // Gemini doesn't have a system role, prepend to first user message
        continue
      }

      contents.push({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      })
    }

    // Add system message to first user message if exists
    const systemMessage = messages.find(m => m.role === 'system')
    if (systemMessage && contents.length > 0 && contents[0].role === 'user') {
      contents[0].parts[0].text = `${systemMessage.content}\n\n${contents[0].parts[0].text}`
    }

    return contents
  }
}
