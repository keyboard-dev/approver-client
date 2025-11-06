import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { encrypt, decrypt } from '../encryption'

interface AIProviderKeys {
  [providerName: string]: string
}

interface KeyboardMCPConfig {
  aiProviders?: AIProviderKeys
  version?: string
  lastUpdated?: string
}

export class EncryptedAIKeyStorage {
  private configPath: string

  constructor() {
    const homeDir = os.homedir()
    this.configPath = path.join(homeDir, '.keyboard-mcp')
  }

  private ensureConfigExists(): void {
    if (!fs.existsSync(this.configPath)) {
      const initialConfig: KeyboardMCPConfig = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        aiProviders: {},
      }
      fs.writeFileSync(this.configPath, JSON.stringify(initialConfig, null, 2))
    }
  }

  private readConfig(): KeyboardMCPConfig {
    this.ensureConfigExists()
    try {
      const content = fs.readFileSync(this.configPath, 'utf8')
      return JSON.parse(content)
    } catch (error) {
      console.error('Error reading .keyboard-mcp config:', error)
      return { aiProviders: {} }
    }
  }

  private writeConfig(config: KeyboardMCPConfig): void {
    try {
      config.lastUpdated = new Date().toISOString()
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2))
    } catch (error) {
      console.error('Error writing .keyboard-mcp config:', error)
      throw new Error('Failed to save configuration')
    }
  }

  setAPIKey(providerName: string, apiKey: string): void {
    if (!apiKey || !providerName) {
      throw new Error('Provider name and API key are required')
    }

    const config = this.readConfig()
    if (!config.aiProviders) {
      config.aiProviders = {}
    }

    try {
      config.aiProviders[providerName] = encrypt(apiKey)
      this.writeConfig(config)
    } catch (error) {
      console.error('Error encrypting API key:', error)
      throw new Error('Failed to encrypt and store API key')
    }
  }

  getAPIKey(providerName: string): string | null {
    const config = this.readConfig()
    if (!config.aiProviders || !config.aiProviders[providerName]) {
      return null
    }

    try {
      return decrypt(config.aiProviders[providerName])
    } catch (error) {
      console.error('Error decrypting API key:', error)
      return null
    }
  }

  removeAPIKey(providerName: string): void {
    const config = this.readConfig()
    if (config.aiProviders && config.aiProviders[providerName]) {
      delete config.aiProviders[providerName]
      this.writeConfig(config)
    }
  }

  listProviders(): string[] {
    const config = this.readConfig()
    return Object.keys(config.aiProviders || {})
  }

  hasAPIKey(providerName: string): boolean {
    const config = this.readConfig()
    return !!(config.aiProviders && config.aiProviders[providerName])
  }

  clearAllKeys(): void {
    const config = this.readConfig()
    config.aiProviders = {}
    this.writeConfig(config)
  }
}

export const encryptedAIKeyStorage = new EncryptedAIKeyStorage()