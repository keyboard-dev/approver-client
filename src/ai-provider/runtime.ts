import { AuthTokens } from '@/types'
import * as fs from 'fs'
import * as os from 'os'
import path from 'path'
import { decrypt } from '../encryption'
import { encryptedAIKeyStorage } from './encrypted-storage'
import { AIMessage, AIProvider, AIProviderConfig, AIResponse, WebSearchQuery, WebSearchResponse } from './index'

export class AIRuntime {
  private providers = new Map<string, AIProvider>()
  private readonly KEYBOARD_AUTH_TOKENS = path.join(os.homedir(), '.keyboard-mcp', '.keyboard-mcp-tokens.json')

  registerProvider(provider: AIProvider) {
    this.providers.set(provider.name, provider)
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys())
  }

  async sendMessage(
    providerName: string,
    messages: AIMessage[],
    config: Partial<AIProviderConfig>,
    authTokens?: AuthTokens,
  ): Promise<AIResponse> {
    const provider = this.providers.get(providerName)
    if (!provider) {
      throw new Error(`Provider ${providerName} not found`)
    }

    const fullConfig: AIProviderConfig = {
      name: providerName,
      apiKey: providerName === 'keyboard' ? '' : (config.apiKey || this.getStoredApiKey(providerName)),
      baseUrl: config.baseUrl,
      model: config.model,
    }

    if (!provider.validateConfig(fullConfig)) {
      throw new Error(`Invalid configuration for provider ${providerName}`)
    }
    console.log('this is the messages', messages)

    // For keyboard provider, pass auth tokens; for others, use existing method signature
    const content = providerName === 'keyboard'
      ? await (provider as any).sendMessage(messages, fullConfig, authTokens || await this.loadAuthTokens())
      : await provider.sendMessage(messages, fullConfig)

    console.log('this is the content', content)
    return {
      content,
      provider: providerName,
      model: config.model,
    }
  }

  async* streamMessage(
    providerName: string,
    messages: AIMessage[],
    config: Partial<AIProviderConfig>,
    authTokens?: AuthTokens,
  ): AsyncGenerator<string, void, unknown> {
    const provider = this.providers.get(providerName)
    if (!provider || !provider.streamMessage) {
      throw new Error(`Provider ${providerName} not found or does not support streaming`)
    }

    const fullConfig: AIProviderConfig = {
      name: providerName,
      apiKey: providerName === 'keyboard' ? '' : (config.apiKey || this.getStoredApiKey(providerName)),
      baseUrl: config.baseUrl,
      model: config.model,
    }

    if (!provider.validateConfig(fullConfig)) {
      throw new Error(`Invalid configuration for provider ${providerName}`)
    }

    // For keyboard provider, pass auth tokens; for others, use existing method signature
    if (providerName === 'keyboard') {
      yield* (provider as any).streamMessage(messages, fullConfig, authTokens || await this.loadAuthTokens())
    }
    else {
      yield* provider.streamMessage(messages, fullConfig)
    }
  }

  async webSearch(
    providerName: string,
    query: WebSearchQuery,
    config: Partial<AIProviderConfig>,
  ): Promise<WebSearchResponse> {
    const provider = this.providers.get(providerName)
    if (!provider || !provider.webSearch) {
      throw new Error(`Provider ${providerName} not found or does not support web search`)
    }

    const fullConfig: AIProviderConfig = {
      name: providerName,
      apiKey: config.apiKey || this.getStoredApiKey(providerName),
      baseUrl: config.baseUrl,
      model: config.model,
    }

    if (!provider.validateConfig(fullConfig)) {
      throw new Error(`Invalid configuration for provider ${providerName}`)
    }

    console.log('Web search request:', { provider: providerName, query })
    const response = await provider.webSearch(query, fullConfig)
    console.log('Web search response:', response)

    return response
  }

  setApiKey(providerName: string, apiKey: string): void {
    encryptedAIKeyStorage.setAPIKey(providerName, apiKey)
  }

  removeApiKey(providerName: string): void {
    encryptedAIKeyStorage.removeAPIKey(providerName)
  }

  private async loadAuthTokens(): Promise<AuthTokens | null> {
    try {
      if (!fs.existsSync(this.KEYBOARD_AUTH_TOKENS)) {
        return null
      }

      const encryptedData = fs.readFileSync(this.KEYBOARD_AUTH_TOKENS, 'utf8')
      const decryptedData = decrypt(encryptedData)

      if (!decryptedData) {
        return null
      }

      const authTokens = JSON.parse(decryptedData) as AuthTokens

      // Validate token structure
      if (!authTokens.access_token || !authTokens.refresh_token || !authTokens.expires_at) {
        return null
      }

      // Check if tokens are expired (with 5 minute buffer)
      const bufferTime = 5 * 60 * 1000 // 5 minutes
      if (Date.now() >= (authTokens.expires_at - bufferTime)) {
        return null
      }

      return authTokens
    }
    catch (error) {
      console.error('❌ Failed to load auth tokens:', error)
      return null
    }
  }

  private getStoredApiKey(providerName: string): string {
    if (providerName === 'keyboard') {
      return '' // Keyboard provider doesn't use API keys
    }
    const apiKey = encryptedAIKeyStorage.getAPIKey(providerName)
    if (!apiKey) {
      throw new Error(`No API key found for provider ${providerName}`)
    }
    return apiKey
  }

  hasProvider(providerName: string): boolean {
    return this.providers.has(providerName)
  }

  hasApiKey(providerName: string): boolean {
    if (providerName === 'keyboard') {
      return true // Keyboard provider always available via auth tokens
    }
    return encryptedAIKeyStorage.hasAPIKey(providerName)
  }

  getConfiguredProviders(): string[] {
    return encryptedAIKeyStorage.listProviders()
  }
}

export const aiRuntime = new AIRuntime()
