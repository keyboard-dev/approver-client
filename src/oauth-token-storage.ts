import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { encrypt, decrypt } from './encryption'
import { ProviderTokens } from './oauth-providers'

// OAuth user type based on the structure in oauth-providers.ts
export interface OAuthUser {
  id: string
  email: string
  name: string
  firstName?: string
  lastName?: string
  picture?: string
  [key: string]: unknown // Allow provider-specific user data
}

// Provider status information interface
export interface ProviderStatusInfo {
  authenticated: boolean
  expired: boolean
  user?: OAuthUser
  storedAt?: number
  updatedAt?: number
}

export interface StoredProviderTokens extends ProviderTokens {
  storedAt: number
  updatedAt: number
}

export interface TokenStorage {
  [providerId: string]: StoredProviderTokens
}

export class OAuthTokenStorage {
  private readonly TOKENS_FILE: string
  private tokensCache: TokenStorage = {}
  private isLoaded: boolean = false

  constructor(customDir?: string) {
    const storageDir = customDir || path.join(os.homedir(), '.keyboard-mcp')
    this.TOKENS_FILE = path.join(storageDir, 'oauth-tokens.encrypted')

    // Ensure storage directory exists
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true, mode: 0o700 })
    }
  }

  /**
   * Load tokens from encrypted file
   */
  private async loadTokens(): Promise<void> {
    try {
      if (!fs.existsSync(this.TOKENS_FILE)) {
        this.tokensCache = {}
        this.isLoaded = true
        return
      }

      const encryptedData = fs.readFileSync(this.TOKENS_FILE, 'utf8')
      const decryptedData = decrypt(encryptedData)
      this.tokensCache = JSON.parse(decryptedData)
      this.isLoaded = true
    }
    catch (error) {
      this.tokensCache = {}
      this.isLoaded = true
    }
  }

  /**
   * Save tokens to encrypted file
   */
  private async saveTokens(): Promise<void> {
    try {
      const dataToEncrypt = JSON.stringify(this.tokensCache, null, 2)
      const encryptedData = encrypt(dataToEncrypt)

      // Write with restricted permissions
      fs.writeFileSync(this.TOKENS_FILE, encryptedData, { mode: 0o600 })
    }
    catch (error) {
      throw error
    }
  }

  /**
   * Ensure tokens are loaded
   */
  private async ensureLoaded(): Promise<void> {
    if (!this.isLoaded) {
      await this.loadTokens()
    }
  }

  /**
   * Store tokens for a provider
   */
  async storeTokens(tokens: ProviderTokens): Promise<void> {
    await this.ensureLoaded()

    const storedTokens: StoredProviderTokens = {
      ...tokens,
      storedAt: this.tokensCache[tokens.providerId]?.storedAt || Date.now(),
      updatedAt: Date.now(),
    }

    this.tokensCache[tokens.providerId] = storedTokens
    await this.saveTokens()
  }

  /**
   * Get tokens for a provider
   */
  async getTokens(providerId: string): Promise<StoredProviderTokens | null> {
    await this.ensureLoaded()
    return this.tokensCache[providerId] || null
  }

  /**
   * Get all stored provider tokens
   */
  async getAllTokens(): Promise<Record<string, StoredProviderTokens>> {
    await this.ensureLoaded()
    return { ...this.tokensCache }
  }

  /**
   * Check if tokens exist for a provider
   */
  async hasTokens(providerId: string): Promise<boolean> {
    await this.ensureLoaded()
    return !!this.tokensCache[providerId]
  }

  /**
   * Check if tokens are expired (with 5 minute buffer)
   */
  async areTokensExpired(providerId: string): Promise<boolean> {
    const tokens = await this.getTokens(providerId)
    if (!tokens) return true

    const bufferTime = 5 * 60 * 1000 // 5 minutes
    return Date.now() >= (tokens.expires_at - bufferTime)
  }

  /**
   * Get valid access token (refresh if needed)
   */
  async getValidAccessToken(
    providerId: string,
    refreshCallback?: (providerId: string, refreshToken: string) => Promise<ProviderTokens>,
  ): Promise<string | null> {
    const tokens = await this.getTokens(providerId)
    if (!tokens) return null

    // Check if token is expired
    if (await this.areTokensExpired(providerId)) {
      if (tokens.refresh_token && refreshCallback) {
        try {
          const newTokens = await refreshCallback(providerId, tokens.refresh_token)
          await this.storeTokens(newTokens)
          return newTokens.access_token
        }
        catch (error) {
          await this.removeTokens(providerId)
          return null
        }
      }
      else {
        return null
      }
    }

    return tokens.access_token
  }

  /**
   * Remove tokens for a provider
   */
  async removeTokens(providerId: string): Promise<void> {
    await this.ensureLoaded()

    if (this.tokensCache[providerId]) {
      delete this.tokensCache[providerId]
      await this.saveTokens()
    }
  }

  /**
   * Remove all tokens
   */
  async clearAllTokens(): Promise<void> {
    this.tokensCache = {}
    await this.saveTokens()
  }

  /**
   * Get provider list with authentication status
   */
  async getProviderStatus(): Promise<Record<string, ProviderStatusInfo>> {
    await this.ensureLoaded()

    const status: Record<string, ProviderStatusInfo> = {}

    for (const [providerId, tokens] of Object.entries(this.tokensCache)) {
      const expired = await this.areTokensExpired(providerId)
      status[providerId] = {
        authenticated: true,
        expired,
        user: tokens.user,
        storedAt: tokens.storedAt,
        updatedAt: tokens.updatedAt,
      }
    }

    return status
  }

  /**
   * Update user info for a provider
   */
  async updateUserInfo(providerId: string, user: OAuthUser): Promise<void> {
    await this.ensureLoaded()

    if (this.tokensCache[providerId]) {
      this.tokensCache[providerId].user = user
      this.tokensCache[providerId].updatedAt = Date.now()
      await this.saveTokens()
    }
  }

  /**
   * Get storage file info for debugging
   */
  getStorageInfo(): {
    filePath: string
    exists: boolean
    size?: number
    permissions?: string
    providersCount: number
  } {
    const exists = fs.existsSync(this.TOKENS_FILE)
    let size: number | undefined
    let permissions: string | undefined

    if (exists) {
      try {
        const stats = fs.statSync(this.TOKENS_FILE)
        size = stats.size
        permissions = '0' + (stats.mode & parseInt('777', 8)).toString(8)
      }
      catch (error) {
      }
    }

    return {
      filePath: this.TOKENS_FILE,
      exists,
      size,
      permissions,
      providersCount: Object.keys(this.tokensCache).length,
    }
  }
}
