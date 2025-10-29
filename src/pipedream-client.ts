/**
 * Pipedream Client
 *
 * Manages Pipedream OAuth connections and API interactions from the Electron app.
 * Handles token storage, account management, and authenticated requests.
 */

import { PerProviderTokenStorage, type ProviderTokens } from './per-provider-token-storage'

// =============================================================================
// Interfaces
// =============================================================================

export interface PipedreamAccount {
  id: string
  external_user_id: string
  app: string // e.g., 'google_drive', 'github', 'notion'
  oauth_access_token?: string
  oauth_refresh_token?: string
  created_at: string
  updated_at?: string
  healthy?: boolean
  token_metadata?: {
    expires_at?: string
    scopes?: string[]
  }
}

export interface CreateConnectionRequest {
  app: string
  oauth_client_id?: string
  scopes?: string[]
  redirect_uri?: string
}

export interface CreateConnectionResponse {
  success: boolean
  account?: PipedreamAccount
  authorization_url?: string
  message?: string
  error?: string
  error_description?: string
}

export interface ListAccountsResponse {
  success: boolean
  accounts: PipedreamAccount[]
  count: number
  error?: string
}

export interface ProxyRequestOptions {
  method: string
  path: string
  headers?: Record<string, string>
  body?: any
  queryParams?: Record<string, string>
}

export interface ProxyResponse {
  success: boolean
  status: number
  data?: any
  error?: string
  error_description?: string
}

// =============================================================================
// Pipedream Client Class
// =============================================================================

export class PipedreamClient {
  private serverUrl: string
  private tokenStorage: PerProviderTokenStorage
  private cachedAccounts: PipedreamAccount[] = []
  private lastAccountsFetch: number = 0
  private accountsCacheDuration: number = 5 * 60 * 1000 // 5 minutes
  private getAccessToken?: () => Promise<string | null>

  constructor(
    serverUrl: string,
    tokenStorage: PerProviderTokenStorage,
    getAccessToken?: () => Promise<string | null>,
  ) {
    this.serverUrl = serverUrl
    this.tokenStorage = tokenStorage
    this.getAccessToken = getAccessToken
  }

  // =============================================================================
  // Authentication & Token Management
  // =============================================================================

  /**
   * Get the current access token for authentication
   */
  private async getAuthToken(): Promise<string | null> {
    if (this.getAccessToken) {
      return await this.getAccessToken()
    }
    return null
  }

  /**
   * Make authenticated request to the server
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const accessToken = await this.getAuthToken()

    if (!accessToken) {
      throw new Error('No access token available. Please authenticate first.')
    }

    const url = `${this.serverUrl}${endpoint}`

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    }

    console.log(`[Pipedream Client] ${options.method || 'GET'} ${endpoint}`)

    const response = await fetch(url, {
      ...options,
      headers,
    })

    const contentType = response.headers.get('content-type')
    const isJson = contentType?.includes('application/json')

    if (!response.ok) {
      let errorData: any = null

      try {
        errorData = isJson ? await response.json() : await response.text()
      }
      catch {
        // Ignore parse errors
      }

      const errorMessage = errorData?.error || errorData?.message || `HTTP ${response.status}`
      const errorDescription = errorData?.error_description || errorData?.details || response.statusText

      throw new Error(`${errorMessage}: ${errorDescription}`)
    }

    if (isJson) {
      return response.json()
    }

    return response.text() as any
  }

  // =============================================================================
  // Account Management
  // =============================================================================

  /**
   * Create a new OAuth connection to a service through Pipedream
   * Returns authorization URL if user authorization is required
   */
  async createServiceConnection(
    request: CreateConnectionRequest,
  ): Promise<CreateConnectionResponse> {
    try {
      console.log(`[Pipedream Client] Creating connection to ${request.app}`)

      const response = await this.makeRequest<CreateConnectionResponse>(
        '/api/pipedream/accounts/create',
        {
          method: 'POST',
          body: JSON.stringify(request),
        },
      )

      // Invalidate accounts cache
      this.lastAccountsFetch = 0

      return response
    }
    catch (error: any) {
      console.error('[Pipedream Client] Error creating service connection:', error)
      return {
        success: false,
        error: 'connection_failed',
        error_description: error.message || 'Failed to create service connection',
      }
    }
  }

  /**
   * List all connected services for the authenticated user
   * Uses caching to reduce server requests
   */
  async listConnectedServices(app?: string, forceRefresh: boolean = false): Promise<ListAccountsResponse> {
    try {
      // Check cache
      const now = Date.now()
      if (!forceRefresh && this.cachedAccounts.length > 0 && (now - this.lastAccountsFetch) < this.accountsCacheDuration) {
        let accounts = this.cachedAccounts

        // Filter by app if specified
        if (app) {
          accounts = accounts.filter(a => a.app === app)
        }

        return {
          success: true,
          accounts,
          count: accounts.length,
        }
      }

      console.log(`[Pipedream Client] Fetching connected services${app ? ` for ${app}` : ''}`)

      const endpoint = app
        ? `/api/pipedream/accounts/list?app=${encodeURIComponent(app)}`
        : '/api/pipedream/accounts/list'

      const response = await this.makeRequest<ListAccountsResponse>(endpoint, {
        method: 'GET',
      })

      // Update cache
      if (response.success && !app) {
        this.cachedAccounts = response.accounts
        this.lastAccountsFetch = now
      }

      return response
    }
    catch (error: any) {
      console.error('[Pipedream Client] Error listing connected services:', error)
      return {
        success: false,
        accounts: [],
        count: 0,
        error: error.message || 'Failed to list connected services',
      }
    }
  }

  /**
   * Get a specific account by ID
   */
  async getAccount(accountId: string): Promise<PipedreamAccount | null> {
    try {
      console.log(`[Pipedream Client] Getting account ${accountId}`)

      const response = await this.makeRequest<{ success: boolean, account: PipedreamAccount }>(
        `/api/pipedream/accounts/${encodeURIComponent(accountId)}`,
        {
          method: 'GET',
        },
      )

      return response.account
    }
    catch (error: any) {
      console.error('[Pipedream Client] Error getting account:', error)
      return null
    }
  }

  /**
   * Disconnect a service (delete the OAuth connection)
   */
  async disconnectService(accountId: string): Promise<boolean> {
    try {
      console.log(`[Pipedream Client] Disconnecting service ${accountId}`)

      const response = await this.makeRequest<{ success: boolean, message?: string }>(
        `/api/pipedream/accounts/${encodeURIComponent(accountId)}`,
        {
          method: 'DELETE',
        },
      )

      // Invalidate accounts cache
      this.lastAccountsFetch = 0
      this.cachedAccounts = this.cachedAccounts.filter(a => a.id !== accountId)

      return response.success
    }
    catch (error: any) {
      console.error('[Pipedream Client] Error disconnecting service:', error)
      return false
    }
  }

  /**
   * Refresh OAuth tokens for an account
   */
  async refreshAccountTokens(accountId: string): Promise<PipedreamAccount | null> {
    try {
      console.log(`[Pipedream Client] Refreshing tokens for account ${accountId}`)

      const response = await this.makeRequest<{ success: boolean, account: PipedreamAccount }>(
        `/api/pipedream/accounts/${encodeURIComponent(accountId)}/refresh`,
        {
          method: 'POST',
        },
      )

      // Update cache
      if (response.success && response.account) {
        const index = this.cachedAccounts.findIndex(a => a.id === accountId)
        if (index >= 0) {
          this.cachedAccounts[index] = response.account
        }
      }

      return response.account
    }
    catch (error: any) {
      console.error('[Pipedream Client] Error refreshing account tokens:', error)
      return null
    }
  }

  // =============================================================================
  // API Proxy Methods
  // =============================================================================

  /**
   * Make an authenticated API request to a third-party service through Pipedream
   */
  async makeAuthenticatedRequest(
    accountId: string,
    options: ProxyRequestOptions,
  ): Promise<ProxyResponse> {
    try {
      console.log(`[Pipedream Client] Proxying ${options.method} request for account ${accountId}`)

      const response = await this.makeRequest<ProxyResponse>(
        `/api/pipedream/accounts/${encodeURIComponent(accountId)}/proxy`,
        {
          method: 'POST',
          body: JSON.stringify(options),
        },
      )

      return response
    }
    catch (error: any) {
      console.error('[Pipedream Client] Error making authenticated request:', error)
      return {
        success: false,
        status: 500,
        error: 'proxy_failed',
        error_description: error.message || 'Failed to make authenticated request',
      }
    }
  }

  // =============================================================================
  // Service Status
  // =============================================================================

  /**
   * Check if Pipedream is configured on the server
   */
  async checkServiceStatus(): Promise<{ configured: boolean, projectId?: string, baseUrl?: string }> {
    try {
      const response = await this.makeRequest<{
        success: boolean
        configured: boolean
        config?: { projectId: string, baseUrl: string }
      }>(
        '/api/pipedream/status',
        {
          method: 'GET',
        },
      )

      return {
        configured: response.configured,
        projectId: response.config?.projectId,
        baseUrl: response.config?.baseUrl,
      }
    }
    catch (error: any) {
      console.error('[Pipedream Client] Error checking service status:', error)
      return {
        configured: false,
      }
    }
  }

  // =============================================================================
  // Cache Management
  // =============================================================================

  /**
   * Clear the accounts cache
   */
  clearCache(): void {
    this.cachedAccounts = []
    this.lastAccountsFetch = 0
  }

  /**
   * Get cached accounts without making a server request
   */
  getCachedAccounts(): PipedreamAccount[] {
    return [...this.cachedAccounts]
  }
}

// =============================================================================
// Singleton Instance Management
// =============================================================================

let pipedreamClientInstance: PipedreamClient | null = null

export function initializePipedreamClient(
  serverUrl: string,
  tokenStorage: PerProviderTokenStorage,
  getAccessToken: () => Promise<string | null>,
): PipedreamClient {
  pipedreamClientInstance = new PipedreamClient(serverUrl, tokenStorage, getAccessToken)
  return pipedreamClientInstance
}

export function getPipedreamClient(): PipedreamClient | null {
  return pipedreamClientInstance
}

export function resetPipedreamClient(): void {
  pipedreamClientInstance = null
}
