import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { decrypt, encrypt } from './encryption'

export const BUILT_IN_PROVIDERS = [
  {
    id: 'google',
    name: 'Google',
    iconSrc: '/assets/icon-logo-google.png',
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v1/userinfo',
    scopes: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/presentations',
      'https://www.googleapis.com/auth/drive.file',
    ],
    usePKCE: true,
    redirectUri: 'http://localhost:8082/callback',
    additionalParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
    isCustom: false,
  },
  {
    id: 'github',
    name: 'GitHub',
    iconSrc: '/assets/icon-logo-github.png',
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: ['user:email', 'repo'],
    usePKCE: false,
    redirectUri: 'http://localhost:8082/callback',
    isCustom: false,
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    iconSrc: '/assets/icon-logo-microsoft.png',
    clientId: process.env.MICROSOFT_CLIENT_ID || '',
    authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    scopes: ['openid', 'profile', 'email', 'User.Read'],
    usePKCE: true,
    redirectUri: 'http://localhost:8082/callback',
    isCustom: false,
  },
]

export interface OAuthProviderConfig {
  id: string
  name: string
  iconSrc?: string
  clientId: string
  clientSecret?: string
  authorizationUrl: string
  tokenUrl: string
  userInfoUrl?: string
  scopes: string[]
  usePKCE: boolean
  redirectUri: string
  additionalParams?: Record<string, string>
  createdAt: number
  updatedAt: number
  isCustom: boolean // true for manually added, false for built-in
}

export class ProviderStorage {
  private readonly storageDir: string
  private providersCache: Map<string, OAuthProviderConfig> = new Map()
  private isLoaded: boolean = false

  constructor(customDir?: string) {
    this.storageDir = customDir || path.join(os.homedir(), '.keyboard-mcp')

    // Ensure storage directory exists
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true, mode: 0o700 })
    }
  }

  /**
   * Get provider config file path
   */
  private getProviderFilePath(providerId: string): string {
    return path.join(this.storageDir, `provider.${providerId}.encrypted`)
  }

  /**
   * Load a single provider from file
   */
  private async loadProvider(providerId: string): Promise<OAuthProviderConfig | null> {
    try {
      const filePath = this.getProviderFilePath(providerId)
      if (!fs.existsSync(filePath)) {
        return null
      }

      const encryptedData = fs.readFileSync(filePath, 'utf8')
      const decryptedData = decrypt(encryptedData)
      const provider = JSON.parse(decryptedData) as OAuthProviderConfig

      return provider
    }
    catch (error) {
      return null
    }
  }

  /**
   * Save a single provider to file
   */
  private async saveProvider(provider: OAuthProviderConfig): Promise<void> {
    try {
      const filePath = this.getProviderFilePath(provider.id)
      const dataToEncrypt = JSON.stringify(provider, null, 2)
      const encryptedData = encrypt(dataToEncrypt)

      // Write with restricted permissions
      fs.writeFileSync(filePath, encryptedData, { mode: 0o600 })
    }
    catch (error) {
      throw error
    }
  }

  /**
   * Load all providers from files
   */
  private async loadAllProviders(): Promise<void> {
    try {
      this.providersCache.clear()

      // Get all provider files
      const files = fs.readdirSync(this.storageDir)
      const providerFiles = files.filter(file =>
        file.startsWith('provider.') && file.endsWith('.encrypted'),
      )

      for (const file of providerFiles) {
        const providerId = file.replace('provider.', '').replace('.encrypted', '')
        const provider = await this.loadProvider(providerId)
        if (provider) {
          this.providersCache.set(provider.id, provider)
        }
      }

      this.isLoaded = true
    }
    catch (error) {
      this.providersCache.clear()
      this.isLoaded = true
    }
  }

  /**
   * Ensure providers are loaded
   */
  private async ensureLoaded(): Promise<void> {
    if (!this.isLoaded) {
      await this.loadAllProviders()
    }
  }

  /**
   * Add or update a provider configuration
   */
  async saveProviderConfig(config: Omit<OAuthProviderConfig, 'createdAt' | 'updatedAt'>): Promise<void> {
    await this.ensureLoaded()

    const existingProvider = this.providersCache.get(config.id)
    const now = Date.now()

    const provider: OAuthProviderConfig = {
      ...config,
      createdAt: existingProvider?.createdAt || now,
      updatedAt: now,
    }

    await this.saveProvider(provider)
    this.providersCache.set(provider.id, provider)
  }

  /**
   * Get a provider configuration
   */
  async getProviderConfig(providerId: string): Promise<OAuthProviderConfig | null> {
    await this.ensureLoaded()
    return this.providersCache.get(providerId) || null
  }

  /**
   * Get all provider configurations
   */
  async getAllProviderConfigs(): Promise<OAuthProviderConfig[]> {
    await this.ensureLoaded()
    return Array.from(this.providersCache.values()).sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * Get available providers (those with client IDs configured)
   */
  async getAvailableProviders(): Promise<OAuthProviderConfig[]> {
    const allProviders = await this.getAllProviderConfigs()
    return allProviders.filter(provider => provider.clientId && provider.clientId.trim() !== '')
  }

  /**
   * Remove a provider configuration
   */
  async removeProviderConfig(providerId: string): Promise<void> {
    await this.ensureLoaded()

    const filePath = this.getProviderFilePath(providerId)

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    if (this.providersCache.has(providerId)) {
      // const provider = this.providersCache.get(providerId)
      this.providersCache.delete(providerId)
    }

    const builtInProvider = BUILT_IN_PROVIDERS.find(provider => provider.id === providerId)
    if (builtInProvider) {
      const now = Date.now()
      const providerConfig: OAuthProviderConfig = {
        ...builtInProvider,
        createdAt: now,
        updatedAt: now,
      }
      this.providersCache.set(providerId, providerConfig)
    }
  }

  /**
   * Check if a provider exists
   */
  async hasProvider(providerId: string): Promise<boolean> {
    await this.ensureLoaded()
    return this.providersCache.has(providerId)
  }

  /**
   * Get storage info for debugging
   */
  getStorageInfo(): {
    storageDir: string
    providersCount: number
    providers: { id: string, name: string, isCustom: boolean, filePath: string, exists: boolean }[]
  } {
    const providers = Array.from(this.providersCache.values()).map(provider => ({
      id: provider.id,
      name: provider.name,
      isCustom: provider.isCustom,
      filePath: this.getProviderFilePath(provider.id),
      exists: fs.existsSync(this.getProviderFilePath(provider.id)),
    }))

    return {
      storageDir: this.storageDir,
      providersCount: this.providersCache.size,
      providers,
    }
  }

  /**
   * Initialize built-in providers if they don't exist
   */
  async initializeBuiltInProviders(): Promise<void> {
    for (const provider of BUILT_IN_PROVIDERS) {
      const exists = await this.hasProvider(provider.id)
      if (!exists) {
        await this.saveProviderConfig(provider)
      }
    }
  }
}
