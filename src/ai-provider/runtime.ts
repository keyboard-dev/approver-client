import { AIProvider, AIProviderConfig, AIMessage, AIResponse, WebSearchQuery, WebSearchResponse } from './index'
import { encryptedAIKeyStorage } from './encrypted-storage'

export class AIRuntime {
  private providers = new Map<string, AIProvider>()

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
  ): Promise<AIResponse> {
    const provider = this.providers.get(providerName)
    if (!provider) {
      throw new Error(`Provider ${providerName} not found`)
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
    console.log('this is the messages', messages)
    const content = await provider.sendMessage(messages, fullConfig)
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
  ): AsyncGenerator<string, void, unknown> {
    const provider = this.providers.get(providerName)
    if (!provider || !provider.streamMessage) {
      throw new Error(`Provider ${providerName} not found or does not support streaming`)
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

    yield* provider.streamMessage(messages, fullConfig)
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

  private getStoredApiKey(providerName: string): string {
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
    return encryptedAIKeyStorage.hasAPIKey(providerName)
  }

  getConfiguredProviders(): string[] {
    return encryptedAIKeyStorage.listProviders()
  }
}

export const aiRuntime = new AIRuntime()
