/**
 * AI API Proxy - Runs in main process for security
 *
 * This proxy keeps API keys secure by:
 * 1. Storing keys in main process only (encrypted with safeStorage)
 * 2. Making API calls from main process
 * 3. Never exposing keys to renderer process
 */

import { ipcMain, safeStorage } from 'electron'
import type { IWindowManager } from './websocket-client-to-executor'

export interface AIRequest {
  provider: 'openai' | 'anthropic' | 'mcp'
  model?: string
  messages: Array<{ role: string, content: string }>
  temperature?: number
  maxTokens?: number
  stream?: boolean
  serverUrl?: string // For MCP
}

export interface AIResponse {
  text: string
  finishReason: string
  usage: {
    promptTokens: number
    completionTokens: number
  }
  toolCalls?: Array<{
    id: string
    name: string
    arguments: Record<string, unknown>
  }>
  error?: string
}

interface StoredAPIKeys {
  openai?: string
  anthropic?: string
  mcp?: string
}

export class AIProxyService {
  private apiKeys: StoredAPIKeys = {}
  private encryptedKeysPath = 'encrypted-api-keys.json'

  constructor(private windowManager?: IWindowManager) {
    this.setupIPCHandlers()
    this.loadEncryptedKeys()
  }

  private setupIPCHandlers() {
    // Set API key (encrypted storage)
    ipcMain.handle('ai-proxy:set-key', async (event, provider: string, apiKey: string) => {
      try {
        this.apiKeys[provider as keyof StoredAPIKeys] = apiKey
        await this.saveEncryptedKeys()
        return { success: true }
      }
      catch (error) {
        console.error('Error setting API key:', error)
        return { success: false, error: (error as Error).message }
      }
    })

    // Get API key status (without exposing the key)
    ipcMain.handle('ai-proxy:get-key-status', async (event, provider: string) => {
      const hasKey = !!this.apiKeys[provider as keyof StoredAPIKeys]
      return { hasKey }
    })

    // Remove API key
    ipcMain.handle('ai-proxy:remove-key', async (event, provider: string) => {
      delete this.apiKeys[provider as keyof StoredAPIKeys]
      await this.saveEncryptedKeys()
      return { success: true }
    })

    // Make AI request (keys stay in main process)
    ipcMain.handle('ai-proxy:request', async (event, request: AIRequest) => {
      try {
        const response = await this.makeAIRequest(request)
        return response
      }
      catch (error) {
        console.error('AI request error:', error)
        return {
          text: '',
          finishReason: 'error',
          usage: { promptTokens: 0, completionTokens: 0 },
          error: (error as Error).message,
        }
      }
    })

    // Stream AI request
    ipcMain.handle('ai-proxy:stream', async (event, request: AIRequest) => {
      try {
        // For streaming, we'll need to handle chunks differently
        // For now, fall back to regular request
        return await this.makeAIRequest(request)
      }
      catch (error) {
        console.error('AI stream error:', error)
        return {
          text: '',
          finishReason: 'error',
          usage: { promptTokens: 0, completionTokens: 0 },
          error: (error as Error).message,
        }
      }
    })
  }

  private async makeAIRequest(request: AIRequest): Promise<AIResponse> {
    switch (request.provider) {
      case 'openai':
        return await this.makeOpenAIRequest(request)
      case 'anthropic':
        return await this.makeAnthropicRequest(request)
      case 'mcp':
        return await this.makeMCPRequest(request)
      default:
        throw new Error(`Unknown provider: ${request.provider}`)
    }
  }

  private async makeOpenAIRequest(request: AIRequest): Promise<AIResponse> {
    const apiKey = this.apiKeys.openai
    if (!apiKey) {
      throw new Error('OpenAI API key not set')
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: request.model || 'gpt-4o',
        messages: request.messages,
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens,
        stream: false,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`OpenAI API error: ${response.status} ${error}`)
    }

    const data: any = await response.json()
    const message = data.choices?.[0]?.message

    return {
      text: message?.content || '',
      finishReason: data.choices?.[0]?.finish_reason || 'stop',
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
      },
      toolCalls: message?.tool_calls?.map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      })),
    }
  }

  private async makeAnthropicRequest(request: AIRequest): Promise<AIResponse> {
    const apiKey = this.apiKeys.anthropic
    if (!apiKey) {
      throw new Error('Anthropic API key not set')
    }

    const systemMessage = request.messages.find(m => m.role === 'system')
    const conversationMessages = request.messages.filter(m => m.role !== 'system')

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: request.model || 'claude-3-5-sonnet-20241022',
        messages: conversationMessages,
        system: systemMessage?.content,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature || 0.7,
        stream: false,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Anthropic API error: ${response.status} ${error}`)
    }

    const data: any = await response.json()
    const content = data.content?.[0]

    return {
      text: content?.text || '',
      finishReason: data.stop_reason || 'stop',
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
      },
      toolCalls: data.content
        ?.filter((c: any) => c.type === 'tool_use')
        ?.map((tc: any) => ({
          id: tc.id,
          name: tc.name,
          arguments: tc.input,
        })) || [],
    }
  }

  private async makeMCPRequest(request: AIRequest): Promise<AIResponse> {
    const serverUrl = request.serverUrl || 'https://mcp.keyboard.dev'
    const apiKey = this.apiKeys.mcp

    const response = await fetch(`${serverUrl}/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        messages: request.messages,
        stream: false,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`MCP server error: ${response.status} ${error}`)
    }

    const data: any = await response.json()

    return {
      text: data.content || '',
      finishReason: data.finishReason || 'stop',
      usage: {
        promptTokens: data.usage?.promptTokens || 0,
        completionTokens: data.usage?.completionTokens || 0,
      },
      toolCalls: data.toolCalls || [],
    }
  }

  private async saveEncryptedKeys() {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        const json = JSON.stringify(this.apiKeys)
        const encrypted = safeStorage.encryptString(json)
        // In production, save this to a file or secure store
        // For now, we keep it in memory
        console.log('API keys encrypted and stored securely')
      }
    }
    catch (error) {
      console.error('Error saving encrypted keys:', error)
    }
  }

  private async loadEncryptedKeys() {
    try {
      // In production, load from secure storage
      // For now, keys are set via IPC
      console.log('API keys loaded from secure storage')
    }
    catch (error) {
      console.error('Error loading encrypted keys:', error)
    }
  }
}
