import { AIMessage, AIProvider, AIProviderConfig } from '../index'

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
      const errorText = await response.text().catch(() => 'Unable to read error response')
      if (response.status === 503) {
        throw new Error(`Gemini service unavailable (503). This may be due to invalid request format or temporary service issues. Error: ${errorText}`)
      }

      throw new Error(`Gemini API error: ${response.status} ${response.statusText}. ${errorText}`)
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
      const errorText = await response.text().catch(() => 'Unable to read error response')
      if (response.status === 503) {
        throw new Error(`Gemini service unavailable (503). This may be due to invalid request format or temporary service issues. Error: ${errorText}`)
      }

      throw new Error(`Gemini API error: ${response.status} ${response.statusText}. ${errorText}`)
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
    const contents: Array<{ role: 'user' | 'model', parts: Array<{ text: string }> }> = []

    // Extract system message first
    const systemMessage = messages.find(m => m.role === 'system')
    const nonSystemMessages = messages.filter(m => m.role !== 'system')

    if (nonSystemMessages.length === 0) {
      return contents
    }

    let currentRole: 'user' | 'model' | null = null
    let currentContent: string[] = []

    for (const message of nonSystemMessages) {
      const geminiRole = message.role === 'assistant' ? 'model' : 'user'

      // Coerce content to string (Gemini doesn't support structured content)
      const contentStr = typeof message.content === 'string' ? message.content : JSON.stringify(message.content)

      // Skip empty content
      if (!contentStr || contentStr.trim() === '') {
        continue
      }

      if (currentRole === null) {
        // First message
        currentRole = geminiRole
        currentContent = [contentStr]
      }
      else if (currentRole === geminiRole) {
        // Same role as previous - merge content
        currentContent.push(contentStr)
      }
      else {
        // Role changed - push current content and start new
        contents.push({
          role: currentRole,
          parts: [{ text: currentContent.join('\n\n') }],
        })

        currentRole = geminiRole
        currentContent = [contentStr]
      }
    }

    // Push final content if exists
    if (currentRole && currentContent.length > 0) {
      contents.push({
        role: currentRole,
        parts: [{ text: currentContent.join('\n\n') }],
      })
    }

    // Add system message to first user message if exists
    if (systemMessage && contents.length > 0) {
      // Find first user message to prepend system content
      const firstUserIndex = contents.findIndex(c => c.role === 'user')
      if (firstUserIndex !== -1) {
        const originalText = contents[firstUserIndex].parts[0].text
        const sysContent = typeof systemMessage.content === 'string' ? systemMessage.content : JSON.stringify(systemMessage.content)
        contents[firstUserIndex].parts[0].text = `${sysContent}\n\n${originalText}`
      }
      else {
        // No user messages, create one with system content
        const sysContent = typeof systemMessage.content === 'string' ? systemMessage.content : JSON.stringify(systemMessage.content)
        contents.unshift({
          role: 'user',
          parts: [{ text: sysContent }],
        })
      }
    }

    // Ensure conversation starts with user message
    if (contents.length > 0 && contents[0].role === 'model') {
      // If first message is from model, add a generic user starter
      contents.unshift({
        role: 'user',
        parts: [{ text: 'Please assist me with the following.' }],
      })
    }

    return contents
  }
}
