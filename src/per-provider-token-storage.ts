import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { decrypt, encrypt } from './encryption'
import { ProviderTokens } from './oauth-providers'

export interface UserInfo {
  id: string
  email: string
  name: string
  firstName?: string
  lastName?: string
  picture?: string
  [key: string]: unknown // Allow provider-specific user data
}

export interface StoredProviderTokens extends ProviderTokens {
  storedAt: number
  updatedAt: number
}

export class PerProviderTokenStorage {
  private readonly storageDir: string
  private tokensCache: Map<string, StoredProviderTokens> = new Map()
  private loadedProviders: Set<string> = new Set()
  private readonly ONBOARDING_KEY_FILE = path.join(os.homedir(), '.keyboard-mcp', '.keyboard-mcp-onboarding-gh-token')

  constructor(customDir?: string) {
    this.storageDir = customDir || path.join(os.homedir(), '.keyboard-mcp')

    // Ensure storage directory exists
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true, mode: 0o700 })
    }
  }

  /**
   * Get token file path for a provider
   */
  private getTokenFilePath(providerId: string): string {
    return path.join(this.storageDir, `oauth-tokens.${providerId}.encrypted`)
  }

  /**
   * Load tokens for a specific provider
   */
  private async loadProviderTokens(providerId: string): Promise<StoredProviderTokens | null> {
    try {
      const filePath = this.getTokenFilePath(providerId)
      if (!fs.existsSync(filePath)) {
        this.loadedProviders.add(providerId)
        return null
      }

      const encryptedData = fs.readFileSync(filePath, 'utf8')
      const decryptedData = decrypt(encryptedData)
      const tokens = JSON.parse(decryptedData) as StoredProviderTokens

      this.tokensCache.set(providerId, tokens)
      this.loadedProviders.add(providerId)

      return tokens
    }
    catch (error) {
      console.error(`❌ Error loading OAuth tokens for ${providerId}:`, error)
      // If decryption fails, mark as loaded but return null
      this.loadedProviders.add(providerId)
      return null
    }
  }

  /**
   * Save tokens for a specific provider
   */
  private async saveProviderTokens(tokens: StoredProviderTokens): Promise<void> {
    try {
      const filePath = this.getTokenFilePath(tokens.providerId)
      const dataToEncrypt = JSON.stringify(tokens, null, 2)
      const encryptedData = encrypt(dataToEncrypt)

      // Write with restricted permissions
      fs.writeFileSync(filePath, encryptedData, { mode: 0o600 })
    }
    catch (error) {
      console.error(`❌ Error saving OAuth tokens for ${tokens.providerId}:`, error)
      throw error
    }
  }

  /**
   * Ensure tokens are loaded for a provider
   */
  private async ensureProviderLoaded(providerId: string): Promise<void> {
    if (!this.loadedProviders.has(providerId)) {
      await this.loadProviderTokens(providerId)
    }
  }

  /**
   * Store tokens for a provider
   */
  async storeTokens(tokens: ProviderTokens): Promise<void> {
    await this.ensureProviderLoaded(tokens.providerId)

    const existingTokens = this.tokensCache.get(tokens.providerId)
    const storedTokens: StoredProviderTokens = {
      ...tokens,
      storedAt: existingTokens?.storedAt || Date.now(),
      updatedAt: Date.now(),
    }

    this.tokensCache.set(tokens.providerId, storedTokens)
    await this.saveProviderTokens(storedTokens)
  }

  /**
   * Get tokens for a provider
   */
  async getTokens(providerId: string): Promise<StoredProviderTokens | null> {
    await this.ensureProviderLoaded(providerId)
    return this.tokensCache.get(providerId) || null
  }

  /**
   * Get all stored provider tokens
   */
  async getAllTokens(): Promise<Record<string, StoredProviderTokens>> {
    // Load all token files
    await this.loadAllProviderTokens()

    const result: Record<string, StoredProviderTokens> = {}
    for (const [providerId, tokens] of this.tokensCache.entries()) {
      result[providerId] = tokens
    }
    return result
  }

  /**
   * Load all provider token files
   */
  private async loadAllProviderTokens(): Promise<void> {
    try {
      // Get all token files
      const files = fs.readdirSync(this.storageDir)
      const tokenFiles = files.filter(file =>
        file.startsWith('oauth-tokens.') && file.endsWith('.encrypted'),
      )

      for (const file of tokenFiles) {
        const providerId = file.replace('oauth-tokens.', '').replace('.encrypted', '')
        if (!this.loadedProviders.has(providerId)) {
          await this.loadProviderTokens(providerId)
        }
      }
    }
    catch (error) {
      console.error('❌ Error loading all provider tokens:', error)
    }
  }

  /**
   * Check if tokens exist for a provider
   */
  async hasTokens(providerId: string): Promise<boolean> {
    await this.ensureProviderLoaded(providerId)
    return this.tokensCache.has(providerId)
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
    // if (await this.areTokensExpired(providerId)) {
    if (tokens.refresh_token && refreshCallback) {
      try {
        const newTokens = await refreshCallback(providerId, tokens.refresh_token)
        if (newTokens.access_token) {
          await this.storeTokens(newTokens)
          return newTokens.access_token
        }
        if (tokens.access_token) {
          return tokens.access_token
        }
      }
      catch (error) {
        console.error(`❌ Failed to refresh tokens for ${providerId}:`, error)
        // Remove invalid tokens
        return null
      }
    }
    // else {
    //   return tokens.access_token
    // }
    // }

    return tokens.access_token
  }

  /**
   * Remove tokens for a provider
   */
  async removeTokens(providerId: string): Promise<void> {
    await this.ensureProviderLoaded(providerId)

    // Remove from cache
    if (this.tokensCache.has(providerId)) {
      this.tokensCache.delete(providerId)
    }

    // Remove file
    const filePath = this.getTokenFilePath(providerId)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  }

  /**
   * Remove all tokens
   */
  async clearAllTokens(): Promise<void> {
    // Load all tokens first to know what files exist
    await this.loadAllProviderTokens()

    // Remove all files
    for (const providerId of this.tokensCache.keys()) {
      const filePath = this.getTokenFilePath(providerId)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }

    this.tokensCache.clear()
    this.loadedProviders.clear()
  }

  /**
   * Get provider list with authentication status
   */
  async getProviderStatus(): Promise<Record<string, {
    authenticated: boolean
    expired: boolean
    user?: UserInfo
    storedAt?: number
    updatedAt?: number
  }>> {
    await this.loadAllProviderTokens()

    const status: Record<string, {
      authenticated: boolean
      expired: boolean
      user?: UserInfo
      storedAt?: number
      updatedAt?: number
    }> = {}

    for (const [providerId, tokens] of this.tokensCache.entries()) {
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
  async updateUserInfo(providerId: string, user: UserInfo): Promise<void> {
    await this.ensureProviderLoaded(providerId)

    const tokens = this.tokensCache.get(providerId)
    if (tokens) {
      tokens.user = user
      tokens.updatedAt = Date.now()
      this.tokensCache.set(providerId, tokens)
      await this.saveProviderTokens(tokens)
    }
  }

  /**
   * Get storage file info for debugging
   */
  getStorageInfo(): {
    storageDir: string
    totalProviders: number
    providers: {
      id: string
      filePath: string
      exists: boolean
      size?: number
      permissions?: string
      authenticated: boolean
    }[]
  } {
    // Scan for all token files
    const tokenFiles: { id: string, filePath: string, exists: boolean, size?: number, permissions?: string, authenticated: boolean }[] = []

    try {
      const files = fs.readdirSync(this.storageDir)
      const providerTokenFiles = files.filter(file =>
        file.startsWith('oauth-tokens.') && file.endsWith('.encrypted'),
      )

      for (const file of providerTokenFiles) {
        const providerId = file.replace('oauth-tokens.', '').replace('.encrypted', '')
        const filePath = this.getTokenFilePath(providerId)
        const exists = fs.existsSync(filePath)

        let size: number | undefined
        let permissions: string | undefined

        if (exists) {
          try {
            const stats = fs.statSync(filePath)
            size = stats.size
            permissions = '0' + (stats.mode & parseInt('777', 8)).toString(8)
          }
          catch (error) {
            console.error(`Error getting file stats for ${providerId}:`, error)
          }
        }

        tokenFiles.push({
          id: providerId,
          filePath,
          exists,
          size,
          permissions,
          authenticated: this.tokensCache.has(providerId),
        })
      }
    }
    catch (error) {
      console.error('Error scanning token files:', error)
    }

    return {
      storageDir: this.storageDir,
      totalProviders: tokenFiles.length,
      providers: tokenFiles,
    }
  }

  /**
   * Migrate from old single-file storage to per-provider files
   */
  async migrateFromOldStorage(oldStorageData: Record<string, StoredProviderTokens>): Promise<void> {
    for (const [providerId, tokens] of Object.entries(oldStorageData)) {
      // Only migrate if we don't already have a file for this provider
      const filePath = this.getTokenFilePath(providerId)
      if (!fs.existsSync(filePath)) {
        await this.storeTokens(tokens)
      }
      // else {
      // }
    }
  }

  async saveOnboardingTokens(tokens: ProviderTokens): Promise<void> {
    fs.writeFileSync(this.ONBOARDING_KEY_FILE, JSON.stringify(tokens, null, 2), { mode: 0o600 })
  }

  /**
   * Check if onboarding GitHub token exists and has access_token
   */
  async checkOnboardingTokenExists(): Promise<boolean> {
    try {
      if (!fs.existsSync(this.ONBOARDING_KEY_FILE)) {
        return false
      }

      const fileContent = fs.readFileSync(this.ONBOARDING_KEY_FILE, 'utf8')
      const tokens = JSON.parse(fileContent) as ProviderTokens

      return !!(tokens && tokens.access_token)
    }
    catch (error) {
      console.error('Error checking onboarding token:', error)
      return false
    }
  }

  /**
   * Clear onboarding GitHub token
   */
  async clearOnboardingToken(): Promise<void> {
    try {
      if (fs.existsSync(this.ONBOARDING_KEY_FILE)) {
        fs.unlinkSync(this.ONBOARDING_KEY_FILE)
      }
    }
    catch (error) {
      console.error('Error clearing onboarding token:', error)
      throw error
    }
  }
}
