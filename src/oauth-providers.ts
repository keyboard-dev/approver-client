import * as crypto from 'crypto'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { decrypt, encrypt } from './encryption'
import { OAuthProviderConfig, ProviderStorage } from './provider-storage'

// Legacy interface for backward compatibility
export interface OAuthProvider {
  id: string
  name: string
  icon?: string
  clientId: string
  clientSecret?: string // Some providers don't require client secret for PKCE
  authorizationUrl: string
  tokenUrl: string
  userInfoUrl?: string
  scopes: string[]
  usePKCE: boolean
  redirectUri: string
  additionalParams?: Record<string, string>
}

export interface ProviderTokens {
  providerId: string
  access_token: string
  refresh_token?: string
  token_type: string
  expires_in: number
  expires_at: number
  scope?: string
  user?: {
    id: string
    email: string
    name: string
    firstName?: string
    lastName?: string
    picture?: string
    [key: string]: unknown // Allow provider-specific user data
  }
}

export interface PKCEParams {
  codeVerifier: string
  codeChallenge: string
  state: string
  providerId: string
  sessionId?: string // For server providers
}

// Simple interface for server providers
export interface ServerProvider {
  id: string
  name: string
  url: string // e.g., "http://localhost:4000"
}

// Response from server authorize endpoint
export interface ServerAuthorizeResponse {
  success: boolean
  provider: string
  authorization_url: string
  session_id: string
  state: string
  redirect_uri: string
  use_pkce: boolean
  expires_in: number
}

// Response from server providers endpoint
export interface ServerProviderInfo {
  name: string
  scopes: string[]
  configured: boolean
}

export interface ServerProvidersResponse {
  success: boolean
  count: number
  providers: ServerProviderInfo[]
  redirect_uri: string
}

export class OAuthProviderManager {
  private customProtocol: string
  private serverProviders: Map<string, ServerProvider> = new Map()
  private readonly SERVER_PROVIDERS_FILE: string
  private isLoaded: boolean = false
  private providerStorage: ProviderStorage
  private getMainAccessToken?: () => Promise<string | null>

  constructor(customProtocol: string = 'mcpauth') {
    this.customProtocol = customProtocol

    // Set up encrypted storage file path
    const storageDir = path.join(os.homedir(), '.keyboard-mcp')
    this.SERVER_PROVIDERS_FILE = path.join(storageDir, 'server-providers.encrypted')

    // Ensure storage directory exists
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true, mode: 0o700 })
    }

    // Initialize provider storage
    this.providerStorage = new ProviderStorage()

    // Load server providers and initialize built-in providers
    this.initialize().catch((error: unknown) => {
      console.error('❌ Failed to initialize OAuth provider manager:', error)
    })
  }

  /**
   * Initialize the provider manager
   */
  private async initialize(): Promise<void> {
    await this.loadServerProviders()
    await this.providerStorage.initializeBuiltInProviders()
  }

  /**
   * Set the main access token getter function (for server provider authentication)
   */
  setMainAccessTokenGetter(getter: () => Promise<string | null>): void {
    this.getMainAccessToken = getter
  }

  /**
   * Load server providers from encrypted file
   */
  private async loadServerProviders(): Promise<void> {
    try {
      if (!fs.existsSync(this.SERVER_PROVIDERS_FILE)) {
        this.serverProviders.clear()
        this.isLoaded = true
        return
      }

      const encryptedData = fs.readFileSync(this.SERVER_PROVIDERS_FILE, 'utf8')
      const decryptedData = decrypt(encryptedData)
      const providersArray = JSON.parse(decryptedData) as ServerProvider[]
      // Clear existing providers and load from file
      this.serverProviders.clear()
      providersArray.forEach((provider) => {
        this.serverProviders.set(provider.id, provider)
      })

      this.isLoaded = true
    }
    catch (error) {
      console.error('❌ Error loading server providers:', error)
      // If decryption fails, start fresh (could be due to key rotation)
      this.serverProviders.clear()
      this.isLoaded = true
    }
  }

  /**
   * Save server providers to encrypted file
   */
  private async saveServerProviders(): Promise<void> {
    try {
      const providersArray = Array.from(this.serverProviders.values())
      const dataToEncrypt = JSON.stringify(providersArray, null, 2)
      const encryptedData = encrypt(dataToEncrypt)

      // Write with restricted permissions
      fs.writeFileSync(this.SERVER_PROVIDERS_FILE, encryptedData, { mode: 0o600 })
    }
    catch (error) {
      console.error('❌ Error saving server providers:', error)
      throw error
    }
  }

  /**
   * Ensure server providers are loaded
   */
  private async ensureLoaded(): Promise<void> {
    if (!this.isLoaded) {
      await this.loadServerProviders()
    }
  }

  /**
   * Get a provider configuration by ID
   */
  async getProvider(providerId: string): Promise<OAuthProvider | null> {
    const config = await this.providerStorage.getProviderConfig(providerId)
    if (!config) return null

    // Convert to legacy format for backward compatibility
    return this.configToProvider(config)
  }

  /**
   * Convert OAuthProviderConfig to legacy OAuthProvider format
   */
  private configToProvider(config: OAuthProviderConfig): OAuthProvider {
    return {
      id: config.id,
      name: config.name,
      icon: config.icon,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      authorizationUrl: config.authorizationUrl,
      tokenUrl: config.tokenUrl,
      userInfoUrl: config.userInfoUrl,
      scopes: config.scopes,
      usePKCE: config.usePKCE,
      redirectUri: config.redirectUri,
      additionalParams: config.additionalParams,
    }
  }

  /**
   * Get all available providers that have client IDs configured
   */
  async getAvailableProviders(): Promise<OAuthProvider[]> {
    const configs = await this.providerStorage.getAvailableProviders()
    return configs.map(config => this.configToProvider(config))
  }

  /**
   * Get all provider configurations (including those without client IDs)
   */
  async getAllProviderConfigs(): Promise<OAuthProviderConfig[]> {
    return await this.providerStorage.getAllProviderConfigs()
  }

  /**
   * Add or update a provider configuration
   */
  async saveProviderConfig(config: Omit<OAuthProviderConfig, 'createdAt' | 'updatedAt'>): Promise<void> {
    await this.providerStorage.saveProviderConfig(config)
  }

  /**
   * Remove a provider configuration
   */
  async removeProviderConfig(providerId: string): Promise<void> {
    await this.providerStorage.removeProviderConfig(providerId)
  }

  /**
   * Check if a provider exists
   */
  async hasProvider(providerId: string): Promise<boolean> {
    return await this.providerStorage.hasProvider(providerId)
  }

  /**
   * Generate PKCE parameters for OAuth flow
   */
  generatePKCE(providerId: string): PKCEParams {
    const codeVerifier = crypto.randomBytes(32).toString('base64url')
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url')
    const state = crypto.randomBytes(16).toString('hex')

    return {
      codeVerifier,
      codeChallenge,
      state,
      providerId,
    }
  }

  /**
   * Build authorization URL for a provider
   */
  async buildAuthorizationUrl(providerId: string, pkceParams?: PKCEParams): Promise<string> {
    const provider = await this.getProvider(providerId)
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`)
    }

    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: provider.redirectUri,
      scope: provider.scopes.join(' '),
      response_type: 'code',
      state: pkceParams?.state || crypto.randomBytes(16).toString('hex'),
    })

    // Add PKCE parameters if the provider supports it
    if (provider.usePKCE && pkceParams) {
      params.append('code_challenge', pkceParams.codeChallenge)
      params.append('code_challenge_method', 'S256')
    }

    // Add additional provider-specific parameters
    if (provider.additionalParams) {
      for (const [key, value] of Object.entries(provider.additionalParams)) {
        params.append(key, value)
      }
    }

    return `${provider.authorizationUrl}?${params.toString()}`
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    providerId: string,
    code: string,
    pkceParams?: PKCEParams,
  ): Promise<ProviderTokens> {
    const provider = await this.getProvider(providerId)
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`)
    }

    const body: Record<string, string> = {
      client_id: provider.clientId,
      redirect_uri: provider.redirectUri,
      code: code,
      grant_type: 'authorization_code',
    }

    // Add client secret if provider requires it
    if (provider.clientSecret) {
      body.client_secret = provider.clientSecret
    }

    // Add PKCE verifier if provider supports it
    if (provider.usePKCE && pkceParams) {
      body.code_verifier = pkceParams.codeVerifier
    }

    const response = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams(body).toString(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Token exchange failed: ${response.status} ${errorText}`)
    }

    const tokenData = await response.json() as Record<string, unknown>

    // Fetch user info if userInfoUrl is provided
    let userData = null
    if (provider.userInfoUrl && tokenData.access_token) {
      try {
        const userResponse = await fetch(provider.userInfoUrl, {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
        })

        if (userResponse.ok) {
          userData = await userResponse.json()
          userData = this.normalizeUserData(provider.id, userData as Record<string, unknown>)
        }
      }
      catch {
        // Ignore errors
      }
    }

    return {
      providerId: provider.id,
      access_token: tokenData.access_token as string,
      refresh_token: tokenData.refresh_token as string | undefined,
      token_type: tokenData.token_type as string || 'Bearer',
      expires_in: tokenData.expires_in as number || 3600,
      expires_at: Date.now() + ((tokenData.expires_in as number || 3600) * 1000),
      scope: tokenData.scope as string | undefined,
      user: userData as ProviderTokens['user'],
    }
  }

  /**
   * Refresh tokens for a provider
   */
  async refreshTokens(providerId: string, refreshToken: string): Promise<ProviderTokens> {
    const provider = await this.getProvider(providerId)

    // If we have a local provider configuration with client credentials, use direct refresh
    if (provider && provider.clientId && provider.clientId.trim() !== '') {
      try {
        return await this.refreshTokensDirect(providerId, refreshToken, provider)
      }
      catch {
        // Ignore error
      }
    }

    // Fallback to server provider refresh (for tokens obtained via server OAuth)
    return await this.refreshTokensViaServer(providerId, refreshToken)
  }

  /**
   * Refresh tokens directly with the provider (requires local client credentials)
   */
  private async refreshTokensDirect(providerId: string, refreshToken: string, provider: OAuthProvider): Promise<ProviderTokens> {
    const body: Record<string, string> = {
      client_id: provider.clientId,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }

    if (provider.clientSecret) {
      body.client_secret = provider.clientSecret
    }

    const response = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams(body).toString(),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Direct token refresh failed: ${response.status} ${errorText}`)
    }

    const tokenData = await response.json() as Record<string, unknown>

    return {
      providerId: provider.id,
      access_token: tokenData.access_token as string,
      refresh_token: tokenData.refresh_token as string | undefined,
      token_type: tokenData.token_type as string || 'Bearer',
      expires_in: tokenData.expires_in as number || 3600,
      expires_at: Date.now() + ((tokenData.expires_in as number || 3600) * 1000),
      scope: tokenData.scope as string | undefined,
    }
  }

  /**
   * Refresh tokens via server provider (for tokens obtained via server OAuth)
   */
  private async refreshTokensViaServer(providerId: string, refreshToken: string): Promise<ProviderTokens> {
    await this.ensureLoaded()

    // Try each configured server provider to see if they can refresh this token
    const servers = Array.from(this.serverProviders.values())

    if (servers.length === 0) {
      throw new Error(`No server providers configured and no local client credentials for ${providerId}`)
    }

    // const lastError: Error | null = null

    for (const server of servers) {
      try {
        const url = `${server.url}/api/oauth/refresh/${providerId}`

        const body = {
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }

        // We need the main OAuth access token to authenticate with the server
        const mainAccessToken = this.getMainAccessToken ? await this.getMainAccessToken() : null

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }

        if (mainAccessToken) {
          headers['Authorization'] = `Bearer ${mainAccessToken}`
        }

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Server refresh failed: ${response.status} ${errorText}`)
        }

        const tokenData = await response.json() as Record<string, unknown>

        if (!tokenData.success) {
          throw new Error('Server token refresh was unsuccessful')
        }

        return {
          providerId: providerId,
          access_token: tokenData.access_token as string,
          refresh_token: tokenData.refresh_token as string | undefined,
          token_type: tokenData.token_type as string || 'Bearer',
          expires_in: tokenData.expires_in as number || 3600,
          expires_at: Date.now() + ((tokenData.expires_in as number || 3600) * 1000),
          scope: tokenData.scope as string | undefined,
          user: tokenData.user as ProviderTokens['user'],
        }
      }
      catch {
        continue // Try next server
      }
    }

    // If we get here, all servers failed
    throw new Error(`Failed to refresh ${providerId} tokens via any server provider.`)
  }

  /**
   * Add a server provider
   */
  async addServerProvider(server: ServerProvider): Promise<void> {
    await this.ensureLoaded()
    this.serverProviders.set(server.id, server)
    await this.saveServerProviders()
  }

  /**
   * Remove a server provider
   */
  async removeServerProvider(serverId: string): Promise<void> {
    await this.ensureLoaded()
    const server = this.serverProviders.get(serverId)
    if (server) {
      this.serverProviders.delete(serverId)
      await this.saveServerProviders()
    }
  }

  /**
   * Get all server providers
   */
  async getServerProviders(): Promise<ServerProvider[]> {
    await this.ensureLoaded()
    return Array.from(this.serverProviders.values())
  }

  /**
   * Fetch available OAuth providers from a server provider
   */
  async fetchServerProviders(serverId: string, accessToken?: string): Promise<ServerProviderInfo[]> {
    await this.ensureLoaded()
    const server = this.serverProviders.get(serverId)
    if (!server) {
      throw new Error(`Server provider ${serverId} not found`)
    }

    const url = `${server.url}/api/oauth/providers`

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      }

      // Add JWT authentication if access token is provided
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
      })

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}: ${response.statusText}`)
      }

      const data = await response.json() as ServerProvidersResponse

      if (!data.success) {
        throw new Error('Server returned unsuccessful response')
      }

      return data.providers
    }
    catch (error) {
      console.error(`❌ Failed to fetch providers from ${server.name}:`, error)
      throw error
    }
  }

  /**
   * Get a server provider by ID
   */
  async getServerProvider(serverId: string): Promise<ServerProvider | null> {
    await this.ensureLoaded()
    return this.serverProviders.get(serverId) || null
  }

  /**
   * Get storage file info for debugging
   */
  getServerProviderStorageInfo(): {
    filePath: string
    exists: boolean
    size?: number
    permissions?: string
    providersCount: number
  } {
    const exists = fs.existsSync(this.SERVER_PROVIDERS_FILE)
    let size: number | undefined
    let permissions: string | undefined

    if (exists) {
      try {
        const stats = fs.statSync(this.SERVER_PROVIDERS_FILE)
        size = stats.size
        permissions = '0' + (stats.mode & parseInt('777', 8)).toString(8)
      }
      catch (error) {
        console.error('Error getting server provider storage file stats:', error)
      }
    }

    return {
      filePath: this.SERVER_PROVIDERS_FILE,
      exists,
      size,
      permissions,
      providersCount: this.serverProviders.size,
    }
  }

  /**
   * Get provider storage info
   */
  getProviderStorageInfo(): Record<string, unknown> {
    return this.providerStorage.getStorageInfo()
  }

  /**
   * Fetch authorization URL from a server provider
   */
  async fetchServerAuthorizationUrl(
    serverId: string,
    provider: string,
    state?: string,
    accessToken?: string,
  ): Promise<{ authUrl: string, sessionId: string, state: string }> {
    await this.ensureLoaded()
    const server = this.serverProviders.get(serverId)
    if (!server) {
      throw new Error(`Server provider ${serverId} not found`)
    }

    const url = `${server.url}/api/oauth/authorize/${provider}`
    const params = new URLSearchParams()

    if (state) {
      params.append('state', state)
    }

    const fullUrl = `${url}?${params.toString()}`

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      }

      // Add JWT authentication if access token is provided
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }

      const response = await fetch(fullUrl, {
        method: 'GET',
        headers,
      })

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}: ${response.statusText}`)
      }

      const data = await response.json() as ServerAuthorizeResponse

      if (!data.success) {
        throw new Error('Server returned unsuccessful response')
      }

      return {
        authUrl: data.authorization_url,
        sessionId: data.session_id,
        state: data.state,
      }
    }
    catch (error) {
      console.error(`❌ Failed to fetch authorization URL from ${server.name}:`, error)
      throw error
    }
  }

  /**
   * Exchange code for tokens using server provider
   */
  async exchangeServerCodeForTokens(
    serverId: string,
    provider: string,
    code: string,
    state: string,
    sessionId: string,
    accessToken?: string,
  ): Promise<ProviderTokens> {
    await this.ensureLoaded()
    const server = this.serverProviders.get(serverId)
    if (!server) {
      throw new Error(`Server provider ${serverId} not found`)
    }

    const url = `${server.url}/api/oauth/token/${provider}`

    const body = {
      code: code,
      state: state,
      session_id: sessionId,
      grant_type: 'authorization_code',
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }

      // Add JWT authentication if access token is provided
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Token exchange failed: ${response.status} ${errorText}`)
      }

      const tokenData = await response.json() as Record<string, unknown>

      if (!tokenData.success) {
        throw new Error('Server token exchange was unsuccessful')
      }

      return {
        providerId: provider, // Use just the provider name (e.g., "google") instead of combined ID
        access_token: tokenData.access_token as string,
        refresh_token: tokenData.refresh_token as string | undefined,
        token_type: tokenData.token_type as string || 'Bearer',
        expires_in: tokenData.expires_in as number || 3600,
        expires_at: Date.now() + ((tokenData.expires_in as number || 3600) * 1000),
        scope: tokenData.scope as string | undefined,
        user: tokenData.user as ProviderTokens['user'],
      }
    }
    catch (error) {
      console.error(`❌ Token exchange failed with ${server.name}:`, error)
      throw error
    }
  }

  /**
   * Normalize user data from different providers to a common format
   */
  private normalizeUserData(providerId: string, userData: Record<string, unknown>): Record<string, unknown> {
    switch (providerId) {
      case 'google':
        return {
          id: userData.id as string,
          email: userData.email as string,
          name: userData.name as string,
          firstName: userData.given_name as string | undefined,
          lastName: userData.family_name as string | undefined,
          picture: userData.picture as string | undefined,
          verified_email: userData.verified_email as boolean | undefined,
          locale: userData.locale as string | undefined,
        }

      case 'github':
        return {
          id: userData.id?.toString(),
          email: userData.email as string | undefined,
          name: (userData.name as string | undefined) || (userData.login as string | undefined),
          firstName: (userData.name as string | undefined)?.split(' ')[0],
          lastName: (userData.name as string | undefined)?.split(' ').slice(1).join(' '),
          picture: userData.avatar_url as string | undefined,
          login: userData.login as string | undefined,
          company: userData.company as string | undefined,
          location: userData.location as string | undefined,
        }

      case 'microsoft':
        return {
          id: userData.id as string,
          email: (userData.mail as string | undefined) || (userData.userPrincipalName as string | undefined),
          name: userData.displayName as string | undefined,
          firstName: userData.givenName as string | undefined,
          lastName: userData.surname as string | undefined,
          picture: userData.photo as string | undefined,
          jobTitle: userData.jobTitle as string | undefined,
          department: userData.department as string | undefined,
        }

      default:
        return userData
    }
  }
}
