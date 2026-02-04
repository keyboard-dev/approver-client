import * as crypto from 'crypto'
import { shell } from 'electron'
import { CodespaceEncryptionConfig, encryptWithCodespaceKey } from '../codespace-encryption'
import { ExecutionPreference } from '../execution-preference'
import { GithubService } from '../Github'
import { OAuthCallbackData, OAuthHttpServer } from '../oauth-http-server'
import { PKCEParams as NewPKCEParams, OAuthProvider, OAuthProviderManager, ProviderTokens, ServerProvider, ServerProviderInfo } from '../oauth-providers'
import { OAuthTokenStorage, StoredProviderTokens } from '../oauth-token-storage'
import { PerProviderTokenStorage } from '../per-provider-token-storage'
import { OAuthProviderConfig } from '../provider-storage'
import { Message } from '../types'
import { ExecutorWebSocketClient } from '../websocket-client-to-executor'
import { WindowManager } from '../window-manager'
import { ConnectedAccountsService } from './connected-accounts-service'
import { ConnectedAccountsTokenSource } from './connected-accounts-token-source'
import { ExternalTokenSourceRegistry } from './external-token-source'

interface OnboardingGitHubResponse {
  session_id: string
  authorization_url: string
  state: string
}

/**
 * OAuthService handles third-party provider OAuth flows (Google, GitHub, Slack, etc.)
 * Responsibilities:
 * - Provider OAuth initialization and management
 * - Direct provider OAuth flows
 * - Server-based provider OAuth flows
 * - Token refresh for providers
 * - Provider token encryption
 * - Executor WebSocket token requests
 * - Provider status management
 */
export class OAuthService {
  private oauthProviderManager!: OAuthProviderManager
  private oauthTokenStorage!: OAuthTokenStorage
  private perProviderTokenStorage!: PerProviderTokenStorage
  private currentProviderPKCE: NewPKCEParams | null = null
  private oauthHttpServer: OAuthHttpServer
  private externalTokenSourceRegistry!: ExternalTokenSourceRegistry

  constructor(
    private windowManager: WindowManager,
    private showNotification: (message: Message) => void,
    private getExecutorWSClient: () => ExecutorWebSocketClient | null,
    private getGithubService: () => GithubService,
    private getEncryptionKey: () => string | null,
    private getMainAccessToken: () => Promise<string | null>,
    private getExecutionPreference: () => Promise<ExecutionPreference | null>,
    private readonly OAUTH_PORT: number,
    private readonly SKIP_AUTH: boolean,
    private getConnectedAccountsService?: () => unknown,
  ) {
    this.oauthHttpServer = new OAuthHttpServer(this.OAUTH_PORT)
  }

  /**
   * Initialize OAuth provider system after encryption is ready
   */
  async initializeOAuthProviderSystem(): Promise<void> {
    try {
      // Initialize OAuth provider system
      this.oauthProviderManager = new OAuthProviderManager()
      this.oauthTokenStorage = new OAuthTokenStorage() // Keep for migration
      this.perProviderTokenStorage = new PerProviderTokenStorage()

      // Initialize external token source registry
      this.externalTokenSourceRegistry = new ExternalTokenSourceRegistry()

      // Register connected accounts as the first external token source
      if (this.getConnectedAccountsService) {
        const service = this.getConnectedAccountsService()
        const connectedAccountsTokenSource = new ConnectedAccountsTokenSource(
          service as ConnectedAccountsService,
          this.getMainAccessToken,
        )
        this.externalTokenSourceRegistry.registerSource(connectedAccountsTokenSource)
      }

      // Inject main access token getter for server provider refresh
      this.oauthProviderManager.setMainAccessTokenGetter(() => this.getMainAccessToken())

      // Migrate from old storage format
      await this.migrateTokenStorage()

      // Automatically refresh expired providers on startup
      await this.refreshAllExpiredProvidersOnStartup()
    }
    catch (error) {
      throw error
    }
  }

  /**
   * Refresh all expired OAuth providers on app startup
   * This runs once during initialization to silently refresh tokens before the UI loads
   */
  private async refreshAllExpiredProvidersOnStartup(): Promise<void> {
    try {
      // Get all provider statuses
      const providerStatuses = await this.perProviderTokenStorage.getProviderStatus()

      // Find expired providers (authenticated but expired)
      const expiredProviders = Object.entries(providerStatuses)
        .filter(([, status]) => status?.authenticated && status?.expired)
        .map(([providerId]) => providerId)

      if (expiredProviders.length === 0) {
        return
      }

      // Attempt to refresh each expired provider
      // Do this sequentially to avoid rate limits and be gentle on startup
      for (const providerId of expiredProviders) {
        try {
          const tokens = await this.perProviderTokenStorage.getTokens(providerId)

          if (!tokens?.refresh_token) {
            continue
          }

          // Attempt to refresh the tokens
          const refreshedTokens = await this.refreshProviderTokens(providerId, tokens.refresh_token)
          await this.perProviderTokenStorage.storeTokens(refreshedTokens)
        }
        catch {
          // Silently fail - user can manually refresh from the UI if needed
        }
      }
    }
    catch (error) {
      // Don't throw - we don't want startup refresh failures to break app initialization
    }
  }

  /**
   * Migrate tokens from old single-file storage to new per-provider storage
   */
  private async migrateTokenStorage(): Promise<void> {
    try {
      const oldTokens = await this.oauthTokenStorage.getAllTokens()
      if (Object.keys(oldTokens).length > 0) {
        await this.perProviderTokenStorage.migrateFromOldStorage(oldTokens)

        // After successful migration, optionally clear old storage
        // Uncomment the next line if you want to remove the old file after migration
        // await this.oauthTokenStorage.clearAllTokens();
      }
    }
    catch (error) {
    }
  }

  /**
   * Helper function to encrypt provider token using codespace or sandbox encryption
   */
  private async encryptProviderToken(token: string): Promise<{
    encryptedToken: string
    encrypted: boolean
    encryptionMethod: string
  }> {
    let encryptedToken = token
    let encrypted = false
    let encryptionMethod = 'none'

    if (token) {
      try {
        const onboardingToken = await this.perProviderTokenStorage.getValidAccessToken(
          'onboarding',
          this.refreshProviderTokens.bind(this),
        )
        const accessToken = await this.getMainAccessToken()

        if (onboardingToken || accessToken) {
          // Get user's execution preference to determine which environment to use
          const executionPreference = await this.getExecutionPreference()

          const config: CodespaceEncryptionConfig = {
            codespaceUrl: 'auto', // Will be auto-discovered based on preference
            bearerToken: accessToken || '', // JWT token for sandbox OR GitHub token for codespace
            githubToken: onboardingToken || '', // GitHub token (used for codespace discovery)
          }

          // Auto-discover and encrypt using the appropriate environment
          encryptedToken = await encryptWithCodespaceKey(token, config, executionPreference || 'github-codespace')
          encrypted = true

          // Set encryption method based on preference
          encryptionMethod = executionPreference === 'keyboard-environment' ? 'rsa-sandbox' : 'rsa-codespace'
        }
      }
      catch (encryptionError) {
      }
    }

    return { encryptedToken, encrypted, encryptionMethod }
  }

  /**
   * Handle provider token request from executor WebSocket
   * Supports both local providers and external token sources (connected accounts, AWS Secrets, etc.)
   */
  async handleExecutorProviderTokenRequest(message: { providerId?: string, requestId?: string }): Promise<void> {
    const { providerId } = message
    const executorWSClient = this.getExecutorWSClient()

    if (!providerId) {
      // Send error response back through executor client
      if (executorWSClient) {
        executorWSClient.send({
          type: 'provider-auth-token',
          error: 'Provider ID is required',
          timestamp: Date.now(),
          requestId: message.requestId,
        })
      }
      return
    }

    try {
      let token: string | null = null
      let providerInfo: { user?: unknown, authenticated?: boolean } | null = null
      let providerName = providerId
      let tokenSource: 'local-provider' | 'external-source' = 'local-provider'
      let actualProviderId = providerId

      // Strategy 1: Try local provider storage first
      token = await this.getValidProviderAccessToken(providerId.toLowerCase())

      if (token) {
        // Local provider token found
        const providerStatus = await this.perProviderTokenStorage.getProviderStatus()
        providerInfo = providerStatus[providerId]
        const provider = await this.oauthProviderManager.getProvider(providerId)
        providerName = provider?.name || providerId
      }
      else {
        const externalResult = await this.externalTokenSourceRegistry.getToken(providerId)

        if (externalResult.success && externalResult.token) {
          token = externalResult.token
          tokenSource = 'external-source'

          if (externalResult.user) {
            providerInfo = {
              user: externalResult.user,
              authenticated: true,
            }
          }

          // Extract the actual provider ID from metadata if available
          if (externalResult.metadata?.actualProviderId) {
            actualProviderId = externalResult.metadata.actualProviderId as string
          }

          providerName = externalResult.providerName || actualProviderId
        }
      }
      if (!token) {
        throw new Error('No token available for this provider from any source')
      }

      // Encrypt token using codespace encryption if available
      const { encryptedToken, encrypted, encryptionMethod } = await this.encryptProviderToken(token)

      if (!encrypted) {
        throw new Error('Failed to encrypt token')
      }

      const tokenResponse = {
        type: 'provider-auth-token',
        providerId: actualProviderId,
        token: encryptedToken,
        encrypted: encrypted,
        encryptionMethod: encryptionMethod,
        timestamp: Date.now(),
        requestId: message.requestId,
        authenticated: !!token || this.SKIP_AUTH,
        user: providerInfo?.user || (this.SKIP_AUTH ? { email: 'test@example.com', firstName: 'Test Provider' } : null),
        providerName: providerName,
        source: tokenSource,
      }
      if (executorWSClient) {
        executorWSClient.send(tokenResponse)
      }
    }
    catch (error) {
      // Send error response back through executor client
      if (executorWSClient) {
        executorWSClient.send({
          type: 'provider-auth-token',
          providerId: providerId,
          error: `Failed to get token: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: Date.now(),
          requestId: message.requestId,
        })
      }
    }
  }

  /**
   * Handle provider status request from executor WebSocket
   * Returns available tokens from all sources: local providers and external sources
   */
  async handleExecutorProviderStatusRequest(message: { requestId?: string }): Promise<void> {
    const executorWSClient = this.getExecutorWSClient()

    try {
      const providerStatus = await this.perProviderTokenStorage.getProviderStatus()

      // Get local provider tokens (direct OAuth and server providers)
      const localTokens = Object.entries(providerStatus)
        .filter(([, status]) => status?.authenticated)
        .map(([providerId]) => `KEYBOARD_PROVIDER_USER_TOKEN_FOR_${providerId.toUpperCase()}`)

      // Get external source tokens (connected accounts, AWS Secrets, WorkOS, etc.)
      let externalTokens: string[] = []
      try {
        externalTokens = await this.externalTokenSourceRegistry.getAllAvailableTokenNames()
      }
      catch (externalError) {
      }

      // Combine all token sources
      const tokensAvailable = [...localTokens, ...externalTokens]

      const statusResponse = {
        type: 'user-tokens-available',
        tokensAvailable: tokensAvailable,
        timestamp: Date.now(),
        requestId: message.requestId,
      }

      // Send response back through executor client
      if (executorWSClient) {
        executorWSClient.send(statusResponse)
      }
    }
    catch (error) {
      // Send error response back through executor client
      if (executorWSClient) {
        executorWSClient.send({
          type: 'user-tokens-available',
          error: `Failed to get provider status: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: Date.now(),
          requestId: message.requestId,
        })
      }
    }
  }

  /**
   * Start OAuth flow for a provider
   */
  async startProviderOAuthFlow(providerId: string): Promise<void> {
    try {
      const provider = await this.oauthProviderManager.getProvider(providerId)
      if (!provider) {
        throw new Error(`Provider ${providerId} not found`)
      }

      if (!provider.clientId) {
        throw new Error(`Provider ${providerId} is not configured (missing client ID)`)
      }

      // Generate PKCE parameters
      this.currentProviderPKCE = this.oauthProviderManager.generatePKCE(providerId)

      // Start HTTP server to handle OAuth callback
      await this.oauthHttpServer.startServer((callbackData: OAuthCallbackData) => {
        this.handleOAuthHttpCallback(callbackData)
      })

      // Build authorization URL
      const authUrl = await this.oauthProviderManager.buildAuthorizationUrl(providerId, this.currentProviderPKCE)

      // Open browser for user authentication
      await shell.openExternal(authUrl)
    }
    catch (error) {
      await this.notifyProviderAuthError(providerId, 'Failed to start authentication')
      this.oauthHttpServer.stopServer() // Clean up on error
      throw error
    }
  }

  /**
   * Handle OAuth callback from HTTP server
   */
  private async handleOAuthHttpCallback(callbackData: OAuthCallbackData): Promise<void> {
    try {
      if (callbackData.error) {
        throw new Error(`OAuth error: ${callbackData.error} - ${callbackData.error_description || ''}`)
      }

      if (!callbackData.code || !callbackData.state) {
        throw new Error('Missing authorization code or state')
      }

      if (!this.currentProviderPKCE) {
        throw new Error('No PKCE parameters stored - possible callback timeout or duplicate callback')
      }

      if (callbackData.state !== this.currentProviderPKCE.state) {
        throw new Error('State mismatch - potential CSRF attack')
      }

      // Exchange code for tokens
      await this.exchangeProviderCodeForTokens(this.currentProviderPKCE.providerId, callbackData.code, this.currentProviderPKCE)
    }
    catch (error) {
      const providerId = this.currentProviderPKCE?.providerId || 'unknown'
      this.notifyProviderAuthError(providerId, `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Exchange authorization code for provider tokens
   */
  private async exchangeProviderCodeForTokens(providerId: string, code: string, pkceParams: NewPKCEParams): Promise<void> {
    try {
      // Exchange code for tokens using provider manager
      const tokens = await this.oauthProviderManager.exchangeCodeForTokens(providerId, code, pkceParams)

      // Store tokens securely
      await this.perProviderTokenStorage.storeTokens(tokens)

      // Clear PKCE data
      this.currentProviderPKCE = null

      // Get provider info for notifications
      const provider = await this.oauthProviderManager.getProvider(providerId)
      const providerName = provider?.name || providerId

      // Notify the renderer process
      this.windowManager.sendMessage('provider-auth-success', {
        providerId: providerId,
        providerName: providerName,
        user: tokens.user,
        authenticated: true,
      })

      // Show the window after successful authentication
      this.windowManager.showWindow()

      // Show success notification
      this.showNotification({
        id: `auth-success-${providerId}`,
        title: `${providerName} Authentication Successful`,
        body: `Successfully connected to ${providerName}${tokens.user ? ` as ${tokens.user.name || tokens.user.email}` : ''}`,
        timestamp: Date.now(),
        priority: 'normal',
      })
    }
    catch (error) {
      await this.notifyProviderAuthError(providerId, `Token exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Refresh provider tokens
   */
  async refreshProviderTokens(providerId: string, refreshToken: string): Promise<ProviderTokens> {
    return await this.oauthProviderManager.refreshTokens(providerId, refreshToken)
  }

  /**
   * Get valid provider access token, refreshing if necessary
   */
  async getValidProviderAccessToken(providerId: string): Promise<string | null> {
    return await this.perProviderTokenStorage.getValidAccessToken(
      providerId,
      this.refreshProviderTokens.bind(this),
    )
  }

  /**
   * Notify about provider authentication errors
   */
  private async notifyProviderAuthError(providerId: string, message: string): Promise<void> {
    this.windowManager.sendMessage('provider-auth-error', {
      providerId,
      message,
    })

    const provider = await this.oauthProviderManager.getProvider(providerId)
    const providerName = provider?.name || providerId

    this.showNotification({
      id: `auth-error-${providerId}`,
      title: `${providerName} Authentication Error`,
      body: message,
      timestamp: Date.now(),
      priority: 'high',
    })
  }

  /**
   * Logout from a provider
   */
  async logoutProvider(providerId: string): Promise<void> {
    await this.perProviderTokenStorage.removeTokens(providerId)
    this.windowManager.sendMessage('provider-auth-logout', { providerId })
  }

  /**
   * Start server provider OAuth flow
   */
  async startServerProviderOAuthFlow(serverId: string, provider: string): Promise<void> {
    try {
      const server = await this.oauthProviderManager.getServerProvider(serverId)
      if (!server) {
        throw new Error(`Server provider ${serverId} not found`)
      }

      // Generate state for the flow
      const state = crypto.randomBytes(16).toString('hex')
      const accessToken = await this.getMainAccessToken() || undefined
      // Start HTTP server to handle OAuth callback
      await this.oauthHttpServer.startServer((callbackData: OAuthCallbackData) => {
        this.handleServerOAuthHttpCallback(callbackData, serverId, provider, { oauthToken: accessToken })
      })

      // Fetch authorization URL from server
      const { authUrl, sessionId } = await this.oauthProviderManager.fetchServerAuthorizationUrl(
        serverId,
        provider,
        state,
        accessToken || undefined,
      )

      // Store session info for callback
      this.currentProviderPKCE = {
        codeVerifier: '',
        codeChallenge: '',
        state: state,
        providerId: provider, // Use just the provider name (e.g., "google")
        sessionId: sessionId,
      }

      // Open browser for user authentication
      await shell.openExternal(authUrl)
    }
    catch (error) {
      this.notifyProviderAuthError(provider, 'Failed to start authentication')
      this.oauthHttpServer.stopServer() // Clean up on error
    }
  }

  /**
   * Fetch onboarding GitHub provider
   */
  async fetchOnboardingGithubProvider(): Promise<void> {
    const provider = 'onboarding'

    const response = await fetch(`http://localhost:4000/auth/keyboard_github/onboarding`)
    const data = await response.json() as OnboardingGitHubResponse
    const sessionId = data.session_id
    const authUrl = data.authorization_url
    const state = data.state
    this.currentProviderPKCE = {
      codeVerifier: '',
      codeChallenge: '',
      state: state,
      providerId: provider, // Use just the provider name (e.g., "google")
      sessionId: sessionId,
    }
    await this.oauthHttpServer.startServer((callbackData: OAuthCallbackData) => {
      this.handleServerOAuthHttpCallback(callbackData, 'onboarding', provider)
    })
    if (!authUrl) throw new Error('No authorization URL found')
    await shell.openExternal(authUrl)
  }

  /**
   * Handle server OAuth HTTP callback
   */
  private async handleServerOAuthHttpCallback(
    callbackData: OAuthCallbackData,
    serverId: string,
    provider: string,
    options?: {
      oauthToken?: string
    },
  ): Promise<void> {
    try {
      if (callbackData.error) {
        throw new Error(`OAuth error: ${callbackData.error} - ${callbackData.error_description || ''}`)
      }

      if (!callbackData.code || !callbackData.state) {
        throw new Error('Missing authorization code or state')
      }

      if (!this.currentProviderPKCE) {
        throw new Error('No session data stored - possible callback timeout')
      }

      if (callbackData.state !== this.currentProviderPKCE.state) {
        throw new Error('State mismatch - potential security issue')
      }

      // Exchange code for tokens using server
      let accessToken = options?.oauthToken
      if (!accessToken) {
        accessToken = await this.getMainAccessToken() || undefined
      }
      const tokens = await this.oauthProviderManager.exchangeServerCodeForTokens(
        serverId,
        provider,
        callbackData.code,
        callbackData.state,
        this.currentProviderPKCE.sessionId!,
        accessToken || undefined,
      )
      // Store tokens securely
      await this.perProviderTokenStorage.storeTokens(tokens)
      if (provider === 'onboarding') {
        await this.perProviderTokenStorage.saveOnboardingTokens(tokens)
        const githubService = this.getGithubService()
        await githubService.initializeToken()
        await githubService.createFork('keyboard-dev', 'codespace-executor')
        await githubService.createFork('keyboard-dev', 'app-creator')

        // Connect to executor with the new onboarding token
        const executorWSClient = this.getExecutorWSClient()
        if (executorWSClient) {
          executorWSClient.setGitHubToken(tokens.access_token)
        }
      }

      this.currentProviderPKCE = null

      // Notify the renderer process
      const providerConfig = await this.oauthProviderManager.getProvider(provider)
      this.windowManager.sendMessage('provider-auth-success', {
        providerId: tokens.providerId,
        providerName: providerConfig?.name || provider,
        user: tokens.user,
        authenticated: true,
      })

      // Show the window after successful authentication
      this.windowManager.showWindow()

      // Show success notification
      this.showNotification({
        id: `auth-success-${tokens.providerId}`,
        title: `Server OAuth Authentication Successful`,
        body: `Successfully connected to ${serverId} (${provider})${tokens.user ? ` as ${tokens.user.name || tokens.user.email}` : ''}`,
        timestamp: Date.now(),
        priority: 'normal',
      })
    }
    catch (error) {
      this.notifyProviderAuthError(provider, `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get available OAuth providers
   */
  async getAvailableProviders(): Promise<OAuthProvider[]> {
    return await this.oauthProviderManager.getAvailableProviders()
  }

  /**
   * Get provider auth status
   */
  async getProviderAuthStatus(): Promise<Record<string, {
    authenticated: boolean
    expired: boolean
    user?: unknown
    storedAt?: number
    updatedAt?: number
  }>> {
    return await this.perProviderTokenStorage.getProviderStatus()
  }

  /**
   * Get provider tokens
   */
  async getProviderTokens(providerId: string): Promise<StoredProviderTokens | null> {
    return await this.perProviderTokenStorage.getTokens(providerId)
  }

  /**
   * Clear all provider tokens
   */
  async clearAllProviderTokens(): Promise<void> {
    await this.perProviderTokenStorage.clearAllTokens()
  }

  /**
   * Get OAuth storage info
   */
  getOAuthStorageInfo(): Record<string, unknown> {
    return {
      ...this.perProviderTokenStorage.getStorageInfo(),
      providerStorage: this.oauthProviderManager.getProviderStorageInfo(),
    }
  }

  /**
   * Get all provider configs
   */
  async getAllProviderConfigs(): Promise<OAuthProviderConfig[]> {
    return await this.oauthProviderManager.getAllProviderConfigs()
  }

  /**
   * Save provider config
   */
  async saveProviderConfig(config: Omit<OAuthProviderConfig, 'createdAt' | 'updatedAt'>): Promise<void> {
    await this.oauthProviderManager.saveProviderConfig(config)
  }

  /**
   * Remove provider config
   */
  async removeProviderConfig(providerId: string): Promise<void> {
    await this.oauthProviderManager.removeProviderConfig(providerId)
  }

  /**
   * Get provider config
   */
  async getProviderConfig(providerId: string): Promise<OAuthProviderConfig | null> {
    const provider = await this.oauthProviderManager.getProvider(providerId)
    if (!provider) return null

    // Get full config including metadata
    const configs = await this.oauthProviderManager.getAllProviderConfigs()
    return configs.find(c => c.id === providerId) || null
  }

  /**
   * Add server provider
   */
  async addServerProvider(server: ServerProvider): Promise<void> {
    await this.oauthProviderManager.addServerProvider(server)
  }

  /**
   * Remove server provider
   */
  async removeServerProvider(serverId: string): Promise<void> {
    await this.oauthProviderManager.removeServerProvider(serverId)
  }

  /**
   * Get server providers
   */
  async getServerProviders(): Promise<ServerProvider[]> {
    return await this.oauthProviderManager.getServerProviders()
  }

  /**
   * Check if onboarding token exists
   */
  async checkOnboardingTokenExists(): Promise<boolean> {
    return await this.perProviderTokenStorage.checkOnboardingTokenExists()
  }

  /**
   * Clear onboarding token
   */
  async clearOnboardingToken(): Promise<void> {
    await this.perProviderTokenStorage.clearOnboardingToken()
  }

  /**
   * Fetch server providers
   */
  async fetchServerProviders(serverId: string): Promise<ServerProviderInfo[]> {
    const accessToken = await this.getMainAccessToken()
    const serverProviders = await this.oauthProviderManager.fetchServerProviders(serverId, accessToken || undefined)
    return serverProviders
  }

  /**
   * Handle WebSocket provider token request (for legacy WebSocket server)
   * Supports both local providers and external token sources (connected accounts, AWS Secrets, etc.)
   */
  async handleWebSocketProviderTokenRequest(providerId: string): Promise<{
    type: string
    providerId: string
    token: string | null
    encrypted: boolean
    encryptionMethod: string
    timestamp: number
    authenticated: boolean
    user?: unknown
    providerName?: string
    error?: string
    requestId?: string
    source?: 'local-provider' | 'external-source'
  }> {
    try {
      let token: string | null = null
      let providerInfo: { user?: unknown, authenticated?: boolean } | null = null
      let providerName = providerId
      let tokenSource: 'local-provider' | 'external-source' = 'local-provider'
      let actualProviderId = providerId

      // Strategy 1: Try local provider storage first
      token = await this.getValidProviderAccessToken(providerId.toLowerCase())
      if (token) {
        // Local provider token found
        const providerStatus = await this.perProviderTokenStorage.getProviderStatus()
        providerInfo = providerStatus[providerId]
        const provider = await this.oauthProviderManager.getProvider(providerId)
        providerName = provider?.name || providerId
      }
      else {
        // Strategy 2: Try external token sources (connected accounts, AWS Secrets, etc.)
        // Note: externalTokenSourceRegistry.getToken now automatically handles extraction
        // of provider ID from token names like KEYBOARD_CONNECTED_ACCOUNT_TOKEN_FOR_*
        const externalResult = await this.externalTokenSourceRegistry.getToken(providerId)
        if (externalResult.success && externalResult.token) {
          token = externalResult.token
          tokenSource = 'external-source'

          if (externalResult.user) {
            providerInfo = {
              user: externalResult.user,
              authenticated: true,
            }
          }

          // Extract the actual provider ID from metadata if available
          if (externalResult.metadata?.actualProviderId) {
            actualProviderId = externalResult.metadata.actualProviderId as string
          }

          providerName = externalResult.providerName || actualProviderId
        }
      }
      const { encryptedToken, encrypted, encryptionMethod } = token
        ? await this.encryptProviderToken(token)
        : { encryptedToken: token, encrypted: false, encryptionMethod: 'none' }

      return {
        type: 'provider-auth-token',
        providerId: actualProviderId,
        token: encryptedToken,
        encrypted: encrypted,
        encryptionMethod: encryptionMethod,
        timestamp: Date.now(),
        authenticated: !!token || this.SKIP_AUTH,
        user: providerInfo?.user || (this.SKIP_AUTH ? { email: 'test@example.com', firstName: 'Test Provider' } : null),
        providerName: providerName,
        source: tokenSource,
      }
    }
    catch (error) {
      return {
        type: 'provider-auth-token',
        providerId: providerId,
        token: null,
        encrypted: false,
        encryptionMethod: 'none',
        error: `Failed to get token: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        authenticated: false,
      }
    }
  }

  /**
   * Handle WebSocket provider status request (for legacy WebSocket server)
   * Returns available tokens from all sources: local providers and external sources
   */
  async handleWebSocketProviderStatusRequest(): Promise<{
    type: string
    tokensAvailable: string[]
    timestamp: number
    error?: string
    requestId?: string
  }> {
    try {
      const providerStatus = await this.perProviderTokenStorage.getProviderStatus()

      // Get local provider tokens (direct OAuth and server providers)
      const localTokens = Object.entries(providerStatus)
        .filter(([, status]) => status?.authenticated)
        .map(([providerId]) => `KEYBOARD_PROVIDER_USER_TOKEN_FOR_${providerId.toUpperCase()}`)

      // Get external source tokens (connected accounts, AWS Secrets, WorkOS, etc.)
      let externalTokens: string[] = []
      try {
        externalTokens = await this.externalTokenSourceRegistry.getAllAvailableTokenNames()
      }
      catch (externalError) {
      }

      // Combine all token sources
      const tokensAvailable = [...localTokens, ...externalTokens]

      return {
        type: 'user-tokens-available',
        tokensAvailable: tokensAvailable,
        timestamp: Date.now(),
      }
    }
    catch (error) {
      return {
        type: 'user-tokens-available',
        tokensAvailable: [],
        error: `Failed to get provider status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
      }
    }
  }

  /**
   * Stop OAuth HTTP server
   */
  stopOAuthHttpServer(): void {
    this.oauthHttpServer.stopServer()
  }

  /**
   * Expire all OAuth tokens for testing auto-refresh functionality
   * This is a developer utility for testing
   */
  async expireAllTokensForTesting(): Promise<number> {
    const count = await this.perProviderTokenStorage.expireAllTokensForTesting()

    return count
  }
}
