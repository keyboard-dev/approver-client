import { AuthTokens } from '../../types'
import { AIMessage, AIProvider, AIProviderConfig } from '../index'

export class KeyboardProvider implements AIProvider {
  name = 'keyboard'

  async sendMessage(messages: AIMessage[], config: AIProviderConfig, authTokens?: AuthTokens): Promise<string> {
    console.log('🎹 Keyboard Provider - sendMessage called with:', {
      messagesCount: messages.length,
      config,
      hasAuthTokens: !!authTokens,
      hasAccessToken: !!authTokens?.access_token,
      accessTokenPrefix: authTokens?.access_token?.substring(0, 10) + '...',
    })

    if (!authTokens?.access_token) {
      console.error('🚨 No access token provided to Keyboard provider')
      throw new Error('Authentication tokens required for Keyboard AI provider')
    }

    const systemMessage = messages.find(m => m.role === 'system')
    const messagesWithoutSystem = messages.filter(m => m.role !== 'system')
    console.log('🎹 Messages without system:', messagesWithoutSystem.length)
    console.log('🎹 System message:', systemMessage?.content?.substring(0, 100) + '...')

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

    console.log('🎹 Keyboard API Request:', {
      url,
      model: requestBody.model,
      hasSystem: !!requestBody.system,
      messagesCount: requestBody.messages.length,
      stream: requestBody.stream,
    })

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authTokens.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    console.log('🎹 Keyboard API Response Status:', response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('🚨 Keyboard API Error Response:', errorText)
      throw new Error(`Keyboard AI API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json() as any
    console.log('🎹 Keyboard API Response Data (Full):', JSON.stringify(data, null, 2))
    console.log('🎹 Available top-level keys:', Object.keys(data))

    // Try different response format patterns based on actual response structure

    // Pattern 1: Direct content array (Anthropic format)
    if (data.content && Array.isArray(data.content) && data.content[0]?.text) {
      console.log('✅ Using direct content[0].text format')
      return data.content[0].text
    }

    // Pattern 2: Nested response.content
    if (data.response?.content && Array.isArray(data.response.content) && data.response.content[0]?.text) {
      console.log('✅ Using response.content[0].text format')
      return data.response.content[0].text
    }

    // Pattern 3: OpenAI choices format
    if (data.choices && data.choices[0]?.message?.content) {
      console.log('✅ Using choices[0].message.content format')
      return data.choices[0].message.content
    }

    // Pattern 4: Simple message.content
    if (data.message && data.message.content) {
      console.log('✅ Using message.content format')
      return data.message.content
    }

    // Pattern 5: Direct text fields
    if (data.text) {
      console.log('✅ Using data.text format')
      return data.text
    }

    // Pattern 6: Direct content string
    if (data.content && typeof data.content === 'string') {
      console.log('✅ Using data.content string format')
      return data.content
    }

    // Pattern 7: Direct string response
    if (typeof data === 'string') {
      console.log('✅ Using direct string format')
      return data
    }

    // Pattern 8: Response wrapper
    if (data.response && typeof data.response === 'string') {
      console.log('✅ Using data.response string format')
      return data.response
    }

    console.error('🚨 Unknown Keyboard API response format!')
    console.error('🚨 Full response structure:', data)
    console.error('🚨 Available keys:', Object.keys(data))

    // Last resort fallbacks
    const fallbackText = data.text || data.content || data.response || data.output || data.result || 'No response received'
    console.log('⚠️ Using fallback response:', fallbackText)
    return fallbackText
  }

  async* streamMessage(messages: AIMessage[], config: AIProviderConfig, authTokens?: AuthTokens): AsyncGenerator<string, void, unknown> {
    console.log('🎹 Keyboard Provider - streamMessage called!')
    
    if (!authTokens?.access_token) {
      throw new Error('Authentication tokens required for Keyboard AI provider')
    }

    const systemMessage = messages.find(m => m.role === 'system')
    const messagesWithoutSystem = messages.filter(m => m.role !== 'system')

    console.log('🎹 Streaming messages:', messages)

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
        // console.log('🔧 Keyboard API Response:', value)
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
                console.log('🔧 Keyboard API Response Text:', parsed.delta.text)
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
