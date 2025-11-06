import { AIProvider, AIProviderConfig, AIMessage, AIResponse } from './index'
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

    const content = await provider.sendMessage(messages, fullConfig)

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
