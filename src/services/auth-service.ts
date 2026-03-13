import * as crypto from 'crypto'
import { shell } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { decrypt, encrypt } from '../encryption'
import type { AuthUser } from '../main'
import { AuthorizeResponse, AuthTokens, ErrorResponse, Message, PKCEParams, TokenResponse } from '../types'
import { WindowManager } from '../window-manager'
import { SSEBackgroundService } from './SSEBackgroundService'

/**
 * AuthService handles main application authentication using WorkOS OAuth flow
 * Responsibilities:
 * - OAuth PKCE flow generation and handling
 * - Token exchange and refresh
 * - Token persistence (encrypted storage)
 * - Session validation
 * - Logout functionality
 */
export class AuthService {
  private currentPKCE: PKCEParams | null = null
  private authTokens: AuthTokens | null = null

  constructor(
    private windowManager: WindowManager,
    private showNotification: (message: Message) => void,
    private getSseBackgroundService: () => SSEBackgroundService | null,
    private setSseBackgroundService: (service: SSEBackgroundService) => void,
    private readonly OAUTH_SERVER_URL: string,
    private readonly CUSTOM_PROTOCOL: string,
    private readonly KEYBOARD_AUTH_TOKENS: string,
    private readonly SKIP_AUTH: boolean,
    private onAuthSuccess?: () => Promise<void>,
  ) {}

  /**
   * Load persisted auth tokens on startup
   */
  async loadPersistedAuthTokens(): Promise<void> {
    // Only load if we don't already have tokens in memory
    if (this.authTokens) {
      return
    }

    const persistedTokens = await this.loadAuthTokens()
    if (persistedTokens) {
      this.authTokens = persistedTokens

      // Notify the renderer process about restored auth
      this.windowManager.sendMessage('auth-success', {
        user: persistedTokens.user,
        authenticated: true,
      })

      // Set up SSE service with restored token
      this.initializeSSEService()
    }
  }

  /**
   * Initialize SSE background service for real-time notifications
   */
  private initializeSSEService(): void {
    if (!this.authTokens?.access_token) {
      return
    }

    // Don't create duplicate SSE services
    if (this.getSseBackgroundService()) {
      return
    }

    const sseBackgroundService = new SSEBackgroundService({
      serverUrl: 'https://mcp.keyboard.dev',
    })
    sseBackgroundService.setAuthToken(this.authTokens.access_token)
    sseBackgroundService.connect()
    this.setSseBackgroundService(sseBackgroundService)
  }

  /**
   * Generate PKCE parameters for OAuth flow
   */
  private generatePKCE(): PKCEParams {
    const codeVerifier = crypto.randomBytes(32).toString('base64url')
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url')
    const state = crypto.randomBytes(16).toString('hex')

    return { codeVerifier, codeChallenge, state }
  }

  /**
   * Start OAuth flow - generates PKCE and opens browser for authentication
   */
  async startOAuthFlow(): Promise<void> {
    try {
      // Generate PKCE parameters
      this.currentPKCE = this.generatePKCE()

      // Get authorization URL from server
      const params = new URLSearchParams({
        redirect_uri: `${this.CUSTOM_PROTOCOL}://callback`,
        state: this.currentPKCE.state,
        code_challenge: this.currentPKCE.codeChallenge,
        code_challenge_method: 'S256',
      })

      const response = await fetch(`${this.OAUTH_SERVER_URL}/oauth/authorize?${params}`)

      if (!response.ok) {
        throw new Error(`Failed to get authorization URL: ${response.statusText}`)
      }

      const data = await response.json() as AuthorizeResponse

      // Open browser for user authentication
      await shell.openExternal(data.authorization_url)
    }
    catch (error) {
      this.notifyAuthError('Failed to start authentication')
    }
  }

  /**
   * Handle OAuth callback from browser (public for protocol handler)
   */
  public async handleOAuthCallback(url: string): Promise<void> {
    try {
      const urlObj = new URL(url)
      const code = urlObj.searchParams.get('code')
      const state = urlObj.searchParams.get('state')
      const error = urlObj.searchParams.get('error')

      if (error) {
        throw new Error(`OAuth error: ${error} - ${urlObj.searchParams.get('error_description')}`)
      }

      if (!code || !state) {
        throw new Error('Missing authorization code or state')
      }

      if (!this.currentPKCE || state !== this.currentPKCE.state) {
        throw new Error('State mismatch - potential CSRF attack')
      }

      // Exchange code for tokens
      await this.exchangeCodeForTokens(code)
    }
    catch (error) {
      this.notifyAuthError(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Exchange authorization code for access and refresh tokens
   */
  private async exchangeCodeForTokens(code: string): Promise<void> {
    try {
      if (!this.currentPKCE) {
        throw new Error('No PKCE parameters available')
      }

      const tokenUrl = `${this.OAUTH_SERVER_URL}/oauth/token`

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code,
          redirect_uri: `${this.CUSTOM_PROTOCOL}://callback`,
          code_verifier: this.currentPKCE.codeVerifier,
          grant_type: 'authorization_code',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as ErrorResponse
        throw new Error(`Token exchange failed: ${errorData.error_description || response.statusText}`)
      }

      const tokens = await response.json() as TokenResponse

      // Calculate expiration time and create AuthTokens object
      const authTokens: AuthTokens = {
        ...tokens,
        expires_at: Date.now() + (tokens.expires_in * 1000),
      }

      this.authTokens = authTokens

      await this.refreshTokens()

      // Store tokens securely to encrypted storage
      await this.saveAuthTokens(this.authTokens)

      this.currentPKCE = null // Clear PKCE data

      // Notify the renderer process
      this.windowManager.sendMessage('auth-success', {
        user: tokens.user,
        authenticated: true,
      })

      // Show the window after successful authentication
      this.windowManager.showWindow()

      // Show success notification
      this.showNotification({
        id: 'auth-success',
        title: 'Authentication Successful',
        body: `Welcome back, ${tokens.user.firstName || tokens.user.email}!`,
        timestamp: Date.now(),
        priority: 'normal',
      })

      // Initialize SSE for real-time notifications
      this.initializeSSEService()

      // Re-initialize executor connection with fresh tokens
      if (this.onAuthSuccess) {
        this.onAuthSuccess().catch(() => {})
      }
    }
    catch (error) {
      this.notifyAuthError(`Token exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error // Re-throw to let caller handle
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async getRefreshToken(): Promise<string | null> {
    if (!this.authTokens?.refresh_token) {
      this.authTokens = await this.loadAuthTokens()
      if (!this.authTokens?.refresh_token) {
        return null
      }
    }
    return this.authTokens.refresh_token
  }

  async refreshTokens(): Promise<boolean> {
    try {
      if (!this.authTokens?.refresh_token) {
        this.authTokens = await this.loadAuthTokens()
        if (!this.authTokens?.refresh_token) {
          return false
        }
      }

      const response = await fetch(`${this.OAUTH_SERVER_URL}/oauth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: this.authTokens.refresh_token,
          grant_type: 'refresh_token',
        }),
      })

      if (!response.ok) {
        return false
      }

      const tokens = await response.json() as TokenResponse
      // Update tokens

      this.authTokens = {
        ...this.authTokens,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        expires_at: Date.now() + (tokens.expires_in * 1000),
      }

      // Save updated tokens to encrypted storage
      await this.saveAuthTokens(this.authTokens)

      return true
    }
    catch (error) {
      return false
    }
  }

  /**
   * Get valid access token, refreshing if necessary
   * @param source - Context of the call: 'main' (default) or 'provider'
   *                 Provider context will NOT trigger logout on failure
   */
  async getValidAccessToken(source: 'main' | 'provider' = 'main'): Promise<string | null> {
    // Use the centralized token validation method
    const isValid = await this.ensureValidAuthTokens()

    if (!isValid) {
      // Only logout if this is a main auth request (not provider token refresh)
      if (source === 'main') {
        // All token recovery attempts failed, show notification and logout

        this.showNotification({
          id: 'session-expired',
          title: 'Session Expired',
          body: 'Your session has expired. Please log in again to continue.',
          timestamp: Date.now(),
          priority: 'high',
        })

        // Log the user out completely and show login screen
        this.logout()
        this.windowManager.showWindow() // Bring app to foreground
      }
      else {
        // Provider token refresh context - just log without logout

      }
      return null
    }

    return this.authTokens!.access_token
  }

  /**
   * Centralized method to ensure auth tokens are valid and fresh
   */
  private async ensureValidAuthTokens(): Promise<boolean> {
    // Return false if no tokens at all
    if (!this.authTokens) {
      return false
    }

    // Check if token is expired (with 5 minute buffer)
    const bufferTime = 5 * 60 * 1000 // 5 minutes
    if (Date.now() < (this.authTokens.expires_at - bufferTime)) {
      // Token is still valid, no action needed
      return true
    }

    // Token is expired/expiring, try to refresh

    const refreshed = await this.refreshTokens()

    if (refreshed) {
      return true
    }

    // Refresh failed, try storage fallback

    const storageTokens = await this.loadAuthTokens()

    if (storageTokens && storageTokens.access_token !== this.authTokens.access_token) {
      // Found different tokens in storage, use them
      this.authTokens = storageTokens

      return true
    }

    // All recovery attempts failed

    return false
  }

  /**
   * Notify about authentication errors
   */
  private notifyAuthError(message: string): void {
    this.windowManager.sendMessage('auth-error', { message })

    this.showNotification({
      id: 'auth-error',
      title: 'Authentication Error',
      body: message,
      timestamp: Date.now(),
      priority: 'high',
    })
  }

  /**
   * Save auth tokens to encrypted storage
   */
  private async saveAuthTokens(authTokens: AuthTokens): Promise<void> {
    try {
      const tokenData = JSON.stringify(authTokens)
      const encryptedData = encrypt(tokenData)

      // Ensure directory exists
      const dir = path.dirname(this.KEYBOARD_AUTH_TOKENS)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      // Write with secure permissions
      fs.writeFileSync(this.KEYBOARD_AUTH_TOKENS, encryptedData, { mode: 0o600 })
    }
    catch (error) {
    }
  }

  /**
   * Load auth tokens from encrypted storage
   */
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
      return null
    }
  }

  /**
   * Clear auth tokens from storage
   */
  private async clearAuthTokens(): Promise<void> {
    try {
      if (fs.existsSync(this.KEYBOARD_AUTH_TOKENS)) {
        fs.unlinkSync(this.KEYBOARD_AUTH_TOKENS)
      }
    }
    catch (error) {
    }
  }

  /**
   * Logout user - clear tokens and disconnect services
   */
  logout(): void {
    this.authTokens = null
    this.currentPKCE = null

    // Clear stored tokens
    this.clearAuthTokens()

    // Disconnect from SSE when logging out
    const sseService = this.getSseBackgroundService()
    if (sseService) {
      sseService.disconnect()
    }

    this.windowManager.sendMessage('auth-logout')
  }

  /**
   * Get current auth status
   */
  getAuthStatus(): { authenticated: boolean, user?: AuthUser } {
    return {
      authenticated: !!this.authTokens || this.SKIP_AUTH,
      user: this.authTokens?.user,
    }
  }

  /**
   * Get current auth tokens (for external use)
   */
  getAuthTokens(): AuthTokens | null {
    return this.authTokens
  }
}
