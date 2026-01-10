/**
 * Web API Bridge
 *
 * Implements the ElectronAPI interface for web environments.
 * Maps each IPC method to appropriate REST calls, local operations,
 * or web-compatible alternatives.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
import type {
  AuthError,
  AuthStatus,
  CheckoutResponse,
  CreditsResponse,
  ElectronAPI,
  OAuthProvider,
  OAuthStorageInfo,
  PaymentStatusResponse,
  ProgressInfo,
  ProviderAuthErrorData,
  ProviderAuthEventData,
  ProviderConfig,
  ProviderStatus,
  ProviderTokens,
  ServerProvider,
  SubscriptionCheckoutResponse,
  UpdateInfo,
} from '../../preload'
import type { Script } from '../../main'
import type { ServerProviderInfo } from '../../oauth-providers'
import type { OAuthProviderConfig } from '../../provider-storage'
import type { CodespaceInfo, CollectionRequest, Message, ShareMessage } from '../../types'
import type { CodeApprovalLevel, ResponseApprovalLevel } from '../../types/settings-types'
import { API_ENDPOINTS } from './config'
import { api, createSSEConnection } from './services/api-service'
import {
  getAccessToken,
  getAuthStatus as authGetStatus,
  handleOAuthCallback,
  logout as authLogout,
  onAuthError,
  onAuthLogout,
  onAuthSuccess,
  removeAllAuthListeners,
  startOAuth as authStartOAuth,
} from './services/auth-service'
import {
  checkOnboardingCompleted,
  getAutomaticCodeApproval,
  getAutomaticResponseApproval,
  getExecutionPreference,
  getFullCodeExecution,
  getSettings,
  getShowNotifications,
  markOnboardingCompleted,
  setAutomaticCodeApproval,
  setAutomaticResponseApproval,
  setExecutionPreference,
  setFullCodeExecution,
  setShowNotifications,
} from './services/settings-service'

// =============================================================================
// Event Listener Management
// =============================================================================

type EventCallback = (...args: unknown[]) => void
const eventListeners: Map<string, Set<EventCallback>> = new Map()

function addEventListener(channel: string, callback: EventCallback): void {
  if (!eventListeners.has(channel)) {
    eventListeners.set(channel, new Set())
  }
  eventListeners.get(channel)!.add(callback)
}

function removeEventListener(channel: string, callback: EventCallback): void {
  eventListeners.get(channel)?.delete(callback)
}

function removeAllListenersForChannel(channel: string): void {
  eventListeners.delete(channel)

  // Also clean up auth listeners
  if (channel === 'auth-success') removeAllAuthListeners('success')
  if (channel === 'auth-error') removeAllAuthListeners('error')
  if (channel === 'auth-logout') removeAllAuthListeners('logout')
}

function emitEvent(channel: string, ...args: unknown[]): void {
  eventListeners.get(channel)?.forEach(callback => callback(...args))
}

// =============================================================================
// Not Supported Functions (Web limitations)
// =============================================================================

function notSupported(methodName: string): () => Promise<never> {
  return async () => {
    console.warn(`[WebBridge] ${methodName} is not supported in web mode`)
    throw new Error(`${methodName} is not supported in web mode`)
  }
}

function notSupportedSync(methodName: string): () => void {
  return () => {
    console.warn(`[WebBridge] ${methodName} is not supported in web mode`)
  }
}

// =============================================================================
// Web API Bridge Implementation
// =============================================================================

export const webAPIBridge: ElectronAPI = {
  // ===========================================================================
  // Message Operations
  // ===========================================================================

  sendMessageResponse: async (message: Message, feedback?: string): Promise<void> => {
    await api.post('/api/messages/response', { message, feedback })
  },

  approveMessage: async (message: Message, feedback?: string): Promise<void> => {
    await api.post('/api/messages/approve', { message, feedback })
  },

  rejectMessage: async (messageId: string, feedback?: string): Promise<void> => {
    await api.post('/api/messages/reject', { messageId, feedback })
  },

  approveCollectionShare: async (messageId: string, updatedRequest: CollectionRequest): Promise<void> => {
    await api.post('/api/messages/share/approve', { messageId, updatedRequest })
  },

  rejectCollectionShare: async (messageId: string): Promise<void> => {
    await api.post('/api/messages/share/reject', { messageId })
  },

  sendPromptCollectionRequest: async (context: { scripts: Script[], prompt: string, images: string[] }): Promise<string> => {
    const response = await api.post<{ requestId: string }>('/api/prompt/collection', context)
    return response.data?.requestId || ''
  },

  showMessages: notSupportedSync('showMessages'),

  // ===========================================================================
  // Message Event Listeners (via SSE or polling)
  // ===========================================================================

  onShowMessage: (callback) => {
    addEventListener('show-message', callback as EventCallback)
  },

  onWebSocketMessage: (callback) => {
    addEventListener('websocket-message', callback as EventCallback)
  },

  onCollectionShareRequest: (callback) => {
    addEventListener('collection-share-request', callback as EventCallback)
  },

  onShowShareMessage: (callback) => {
    addEventListener('show-share-message', callback as EventCallback)
  },

  onPromptResponse: (callback) => {
    addEventListener('prompt-response', callback as EventCallback)
  },

  onMessagesClear: (callback) => {
    addEventListener('messages-cleared', callback as EventCallback)
  },

  onMessageStatusUpdated: (callback) => {
    addEventListener('message-status-updated', callback as EventCallback)
  },

  onShareMessageStatusUpdated: (callback) => {
    addEventListener('share-message-status-updated', callback as EventCallback)
  },

  removeAllListeners: (channel: string) => {
    removeAllListenersForChannel(channel)
  },

  // ===========================================================================
  // WebSocket Status Event Listeners
  // ===========================================================================

  onWebSocketConnecting: (callback) => {
    addEventListener('websocket-connecting', callback as EventCallback)
  },

  onWebSocketConnected: (callback) => {
    addEventListener('websocket-connected', callback as EventCallback)
  },

  onWebSocketDisconnected: (callback) => {
    addEventListener('websocket-disconnected', callback as EventCallback)
  },

  onWebSocketReconnecting: (callback) => {
    addEventListener('websocket-reconnecting', callback as EventCallback)
  },

  onWebSocketSwitching: (callback) => {
    addEventListener('websocket-switching', callback as EventCallback)
  },

  onWebSocketError: (callback) => {
    addEventListener('websocket-error', callback as EventCallback)
  },

  // ===========================================================================
  // Database Operations (use IndexedDB - already web compatible)
  // ===========================================================================

  dbGetPendingCount: async (): Promise<number> => {
    // This is handled by the existing database-service.ts which uses IndexedDB
    // Return 0 for now - the actual implementation is in the database provider
    return 0
  },

  dbClearAllMessages: async (): Promise<void> => {
    // This is handled by the existing database-service.ts which uses IndexedDB
    // Actual implementation is in the database provider
  },

  // ===========================================================================
  // External Links
  // ===========================================================================

  openExternal: async (url: string): Promise<void> => {
    window.open(url, '_blank', 'noopener,noreferrer')
  },

  openExternalUrl: async (url: string): Promise<void> => {
    window.open(url, '_blank', 'noopener,noreferrer')
  },

  // ===========================================================================
  // Legacy OAuth
  // ===========================================================================

  startOAuth: authStartOAuth,

  getAuthStatus: authGetStatus,

  logout: authLogout,

  getAccessToken: async (): Promise<string | null> => {
    return getAccessToken()
  },

  getScripts: async (): Promise<Script[]> => {
    const response = await api.get<{ scripts: Script[] }>(API_ENDPOINTS.SCRIPTS)
    return response.data?.scripts || []
  },

  deleteScript: async (scriptId: string): Promise<void> => {
    await api.delete(`${API_ENDPOINTS.SCRIPTS}/${scriptId}`)
  },

  // ===========================================================================
  // Legacy OAuth Event Listeners
  // ===========================================================================

  onAuthSuccess: (callback) => {
    onAuthSuccess((data) => callback(null as never, data))
  },

  onAuthError: (callback) => {
    onAuthError((error) => callback(null as never, error))
  },

  onAuthLogout: (callback) => {
    onAuthLogout(() => callback(null as never))
  },

  // ===========================================================================
  // OAuth Providers (Third-party OAuth via Pipedream)
  // ===========================================================================

  getAvailableProviders: async (): Promise<OAuthProvider[]> => {
    // Third-party providers are handled via Pipedream in web mode
    return []
  },

  startProviderOAuth: async (_providerId: string): Promise<void> => {
    // Handled by Pipedream
    console.warn('[WebBridge] Use Pipedream for third-party OAuth')
  },

  getProviderAuthStatus: async (): Promise<Record<string, ProviderStatus>> => {
    return {}
  },

  getProviderAccessToken: async (_providerId: string): Promise<string | null> => {
    return null
  },

  logoutProvider: async (_providerId: string): Promise<void> => {
    // Handled by Pipedream
  },

  getProviderTokens: async (_providerId: string): Promise<ProviderTokens> => {
    return { accessToken: '' }
  },

  refreshProviderTokens: async (_providerId: string): Promise<boolean> => {
    return false
  },

  clearAllProviderTokens: async (): Promise<void> => {
    // Handled by Pipedream
  },

  expireAllTokensForTesting: async (): Promise<number> => {
    return 0
  },

  getOAuthStorageInfo: async (): Promise<OAuthStorageInfo> => {
    return {
      totalProviders: 0,
      authenticatedProviders: 0,
      storageLocation: 'pipedream',
    }
  },

  onProviderAuthSuccess: (callback) => {
    addEventListener('provider-auth-success', callback as EventCallback)
  },

  onProviderAuthError: (callback) => {
    addEventListener('provider-auth-error', callback as EventCallback)
  },

  onProviderAuthLogout: (callback) => {
    addEventListener('provider-auth-logout', callback as EventCallback)
  },

  // ===========================================================================
  // Manual Provider Management (Not supported in web - use Pipedream)
  // ===========================================================================

  getAllProviderConfigs: async (): Promise<OAuthProviderConfig[]> => {
    return []
  },

  saveProviderConfig: notSupported('saveProviderConfig'),

  removeProviderConfig: notSupported('removeProviderConfig'),

  getProviderConfig: async (_providerId: string): Promise<OAuthProviderConfig> => {
    throw new Error('Not supported in web mode')
  },

  // ===========================================================================
  // Server Provider Management
  // ===========================================================================

  addServerProvider: notSupported('addServerProvider'),

  removeServerProvider: notSupported('removeServerProvider'),

  getServerProviders: async (): Promise<ServerProvider[]> => {
    return []
  },

  fetchServerProviders: async (_serverId: string): Promise<ServerProviderInfo[]> => {
    return []
  },

  startServerProviderOAuth: notSupported('startServerProviderOAuth'),

  fetchOnboardingGithubProvider: async (): Promise<void> => {
    // Follow Electron logic: Call production endpoint via local proxy
    // Local server will proxy to https://api.keyboard.dev/auth/keyboard_github/onboarding
    try {
      const state = crypto.randomUUID()

      // Call local API which will proxy to production
      const response = await api.get<{
        authorization_url: string
        state: string
        session_id: string
      }>(`/api/github/onboarding-proxy?state=${encodeURIComponent(state)}`)

      if (!response.ok) {
        throw new Error(response.error || `API call failed with status ${response.status}`)
      }

      if (!response.data?.authorization_url) {
        throw new Error('Failed to initiate GitHub connection - no authorization_url returned')
      }

      // Store session data (following Electron pattern)
      sessionStorage.setItem('github_oauth_state', response.data.state)
      sessionStorage.setItem('github_oauth_session_id', response.data.session_id)

      // Redirect to GitHub OAuth (same as Electron)
      window.location.href = response.data.authorization_url
    }
    catch (error) {
      console.error('Failed to initiate GitHub OAuth:', error)
      throw error
    }
  },

  checkOnboardingGithubToken: async (): Promise<boolean> => {
    // Check via local API proxy (following Electron pattern)
    try {
      const response = await api.get<{ credential: string }>(`/api/oauth/credentials/github`)

      return response.ok && !!response.data?.credential
    }
    catch (error) {
      return false
    }
  },

  exchangeGitHubCodeForToken: async (code: string, sessionId: string, state: string): Promise<unknown> => {
    // Exchange code for token via local server
    try {
      const response = await api.post<{ access_token: string }>(`/api/oauth/token/onboarding`, {
        code,
        session_id: sessionId,
        state,
      })

      if (!response.ok) {
        throw new Error(response.error || `Token exchange failed with status ${response.status}`)
      }

      return response.data
    }
    catch (error) {
      console.error('Failed to exchange GitHub code for token:', error)
      throw error
    }
  },


  clearOnboardingGithubToken: async (): Promise<void> => {
    // Clear GitHub connection via local API proxy (following Electron pattern)
    try {
      const result = await api.delete(`/api/oauth/credentials/github`)
    }
    catch (error) {
      console.error('Failed to clear GitHub connection:', error)
      throw error
    }
  },

  checkOnboardingCompleted: async (): Promise<boolean> => {
    return checkOnboardingCompleted()
  },

  markOnboardingCompleted: async (): Promise<void> => {
    markOnboardingCompleted()
  },

  // ===========================================================================
  // WebSocket Key Management (Not applicable for web)
  // ===========================================================================

  getWSConnectionKey: async (): Promise<string | null> => {
    // Web apps don't need local WS keys - they use server endpoints
    return null
  },

  getWSConnectionUrl: async (): Promise<string> => {
    // Return server SSE endpoint
    return `${window.location.origin}/api/sse`
  },

  regenerateWSKey: async (): Promise<{ key: string, createdAt: number }> => {
    return { key: '', createdAt: Date.now() }
  },

  getWSKeyInfo: async (): Promise<{ key: string | null, createdAt: number | null, keyFile: string }> => {
    return { key: null, createdAt: null, keyFile: 'N/A (web mode)' }
  },

  onWSKeyGenerated: (callback) => {
    addEventListener('ws-key-generated', callback as EventCallback)
  },

  // ===========================================================================
  // Encryption Key Management (Not applicable for web)
  // ===========================================================================

  getEncryptionKey: async (): Promise<string | null> => {
    return null
  },

  regenerateEncryptionKey: async (): Promise<{ key: string, createdAt: number, source: 'environment' | 'generated' | null }> => {
    return { key: '', createdAt: Date.now(), source: null }
  },

  getEncryptionKeyInfo: async (): Promise<{ key: string | null, createdAt: number | null, keyFile: string, source: 'environment' | 'generated' | null }> => {
    return { key: null, createdAt: null, keyFile: 'N/A (web mode)', source: null }
  },

  onEncryptionKeyGenerated: (callback) => {
    addEventListener('encryption-key-generated', callback as EventCallback)
  },

  // ===========================================================================
  // Settings Management
  // ===========================================================================

  getSettings: async () => getSettings(),

  setShowNotifications: async (show: boolean): Promise<void> => {
    setShowNotifications(show)
  },

  getShowNotifications: async (): Promise<boolean> => {
    return getShowNotifications()
  },

  setAutomaticCodeApproval: async (level: CodeApprovalLevel): Promise<void> => {
    setAutomaticCodeApproval(level)
  },

  getAutomaticCodeApproval: async (): Promise<CodeApprovalLevel> => {
    return getAutomaticCodeApproval()
  },

  setAutomaticResponseApproval: async (level: ResponseApprovalLevel): Promise<void> => {
    setAutomaticResponseApproval(level)
  },

  getAutomaticResponseApproval: async (): Promise<ResponseApprovalLevel> => {
    return getAutomaticResponseApproval()
  },

  setFullCodeExecution: async (enabled: boolean): Promise<void> => {
    setFullCodeExecution(enabled)
  },

  getFullCodeExecution: async (): Promise<boolean> => {
    return getFullCodeExecution()
  },

  getExecutionPreference: async () => getExecutionPreference(),

  setExecutionPreference: async (preference: string) => setExecutionPreference(preference),

  // ===========================================================================
  // Assets Path
  // ===========================================================================

  getAssetsPath: async (): Promise<string> => {
    // In web mode, assets are served from the same origin
    return '/assets'
  },

  // ===========================================================================
  // Auto-updater (Not applicable for web)
  // ===========================================================================

  onUpdateAvailable: (callback) => {
    addEventListener('update-available', callback as EventCallback)
  },

  onDownloadProgress: (callback) => {
    addEventListener('download-progress', callback as EventCallback)
  },

  onUpdateDownloaded: (callback) => {
    addEventListener('update-downloaded', callback as EventCallback)
  },

  checkForUpdates: async (): Promise<void> => {
    // Web apps update automatically - no action needed
  },

  downloadUpdate: async (): Promise<void> => {
    // Web apps update automatically
  },

  quitAndInstall: async (): Promise<void> => {
    // For web, just reload the page
    window.location.reload()
  },

  // ===========================================================================
  // Test Methods (Development only)
  // ===========================================================================

  testUpdateAvailable: async (): Promise<void> => {
    emitEvent('update-available', { version: '1.0.0-test' })
  },

  testDownloadUpdate: async (): Promise<void> => {
    emitEvent('download-progress', { percent: 50 })
  },

  testUpdateDownloaded: async (): Promise<void> => {
    emitEvent('update-downloaded', { version: '1.0.0-test' })
  },

  invoke: async (channel: string, ...args: unknown[]): Promise<unknown> => {
    // Generic invoke - route to appropriate handler
    console.warn('[WebBridge] Generic invoke called:', channel, args)
    return null
  },

  // ===========================================================================
  // Executor WebSocket Connection
  // ===========================================================================

  getExecutorConnectionStatus: async (): Promise<{ connected: boolean, target?: { type: 'localhost' | 'codespace', url: string, name?: string, codespaceName?: string } }> => {
    // In web mode, connection is managed via server
    const response = await api.get<{ connected: boolean, target?: { type: 'localhost' | 'codespace', url: string, name?: string, codespaceName?: string } }>('/api/executor/status')
    return response.data || { connected: false }
  },

  reconnectToExecutor: async (): Promise<boolean> => {
    const response = await api.post<{ success: boolean }>('/api/executor/reconnect')
    return response.data?.success || false
  },

  disconnectFromExecutor: async (): Promise<void> => {
    await api.post('/api/executor/disconnect')
  },

  discoverCodespaces: async () => {
    const response = await api.get<{ codespaces: Array<{ codespace: unknown, websocketUrl?: string, available: boolean, error?: string }> }>(API_ENDPOINTS.CODESPACES)
    return response.data?.codespaces || []
  },

  connectToCodespace: async (codespaceName: string): Promise<boolean> => {
    const response = await api.post<{ success: boolean }>(`${API_ENDPOINTS.CODESPACES}/connect`, { codespaceName })
    return response.data?.success || false
  },

  connectToBestCodespace: async (): Promise<boolean> => {
    const response = await api.post<{ success: boolean }>(`${API_ENDPOINTS.CODESPACES}/connect-best`)
    return response.data?.success || false
  },

  connectToLocalhost: async (): Promise<void> => {
    // Not applicable for web - can't connect to user's localhost
    console.warn('[WebBridge] connectToLocalhost is not supported in web mode')
  },

  getLastKnownCodespaces: async () => {
    const response = await api.get<{ codespaces: Array<{ codespace: unknown, websocketUrl?: string, available: boolean, error?: string }> }>(`${API_ENDPOINTS.CODESPACES}/last-known`)
    return response.data?.codespaces || []
  },

  sendManualPing: async () => {
    const response = await api.post<{
      success: boolean
      error?: string
      connectionHealth: {
        isAlive: boolean
        lastActivity: number
        lastPong: number
        timeSinceLastActivity: number
        timeSinceLastPong: number
        connected: boolean
      }
    }>('/api/executor/ping')
    return response.data || {
      success: false,
      connectionHealth: {
        isAlive: false,
        lastActivity: 0,
        lastPong: 0,
        timeSinceLastActivity: 0,
        timeSinceLastPong: 0,
        connected: false,
      },
    }
  },

  // ===========================================================================
  // Database Notification
  // ===========================================================================

  dbPendingCountUpdated: (_count: number): void => {
    // This is a notification from renderer to main - not needed in web mode
  },

  // ===========================================================================
  // Version Install Date
  // ===========================================================================

  getVersionInstallDate: async (): Promise<Date | null> => {
    // Not applicable for web
    return null
  },

  // ===========================================================================
  // AI Provider Management
  // ===========================================================================

  setAIProviderKey: async (provider: string, apiKey: string): Promise<void> => {
    await api.post('/api/ai/providers/key', { provider, apiKey })
  },

  getAIProviderKeys: async (): Promise<Array<{ provider: string, hasKey: boolean, configured: boolean }>> => {
    const response = await api.get<{ providers: Array<{ provider: string, hasKey: boolean, configured: boolean }> }>('/api/ai/providers')
    return response.data?.providers || []
  },

  removeAIProviderKey: async (provider: string): Promise<void> => {
    await api.delete(`/api/ai/providers/${provider}/key`)
  },

  testAIProviderConnection: async (provider: string): Promise<{ success: boolean, error?: string }> => {
    const response = await api.post<{ success: boolean, error?: string }>(`/api/ai/providers/${provider}/test`)
    return response.data || { success: false, error: 'Request failed' }
  },

  sendAIMessage: async (
    provider: string,
    messages: Array<{ role: 'user' | 'assistant' | 'system', content: string }>,
    config?: { model?: string },
  ): Promise<string> => {
    const response = await api.post<{ message: string }>('/api/ai/message', { provider, messages, config })
    return response.data?.message || ''
  },

  sendAIMessageStream: async (
    provider: string,
    messages: Array<{ role: 'user' | 'assistant' | 'system', content: string }>,
    config?: { model?: string },
  ): Promise<string> => {
    // For streaming, we'd need to use SSE or WebSocket
    // For now, fall back to non-streaming
    return webAPIBridge.sendAIMessage(provider, messages, config)
  },

  onAIStreamChunk: (callback) => {
    addEventListener('ai-stream-chunk', (chunk) => callback(chunk as string))
  },

  onAIStreamEnd: (callback) => {
    addEventListener('ai-stream-end', () => callback())
  },

  onAIStreamError: (callback) => {
    addEventListener('ai-stream-error', (error) => callback(error as string))
  },

  removeAIStreamListeners: () => {
    removeAllListenersForChannel('ai-stream-chunk')
    removeAllListenersForChannel('ai-stream-end')
    removeAllListenersForChannel('ai-stream-error')
  },

  webSearch: async (provider: string, query: string, company: string): Promise<unknown> => {
    const response = await api.post('/api/ai/web-search', { provider, query, company })
    return response.data
  },

  getUserTokens: async (): Promise<{ tokensAvailable?: string[], error?: string }> => {
    const response = await api.get<{ tokensAvailable?: string[], error?: string }>(API_ENDPOINTS.USER_TOKENS)
    return response.data || { error: 'Request failed' }
  },

  getCodespaceInfo: async (): Promise<CodespaceInfo> => {
    const response = await api.get<CodespaceInfo>(API_ENDPOINTS.CODESPACE_INFO)
    return response.data || { name: '', url: '' }
  },

  // ===========================================================================
  // Credits
  // ===========================================================================

  getCreditsBalance: async (): Promise<CreditsResponse> => {
    const response = await api.get<CreditsResponse>(API_ENDPOINTS.CREDITS_BALANCE)
    return response.data || { success: false, error: 'Request failed' }
  },

  createCreditsCheckout: async (amountCents: number): Promise<CheckoutResponse> => {
    const response = await api.post<CheckoutResponse>(API_ENDPOINTS.CREDITS_CHECKOUT, { amount_cents: amountCents })
    return response.data || { success: false, error: 'Request failed' }
  },

  // ===========================================================================
  // Subscriptions
  // ===========================================================================

  createSubscriptionCheckout: async (): Promise<SubscriptionCheckoutResponse> => {
    const response = await api.post<SubscriptionCheckoutResponse>(API_ENDPOINTS.SUBSCRIPTION_CHECKOUT)
    return response.data || { success: false, error: 'Request failed' }
  },

  getPaymentStatus: async (): Promise<PaymentStatusResponse> => {
    const response = await api.get<PaymentStatusResponse>(API_ENDPOINTS.PAYMENT_STATUS)
    return response.data || { success: false, error: 'Request failed' }
  },

  // ===========================================================================
  // Connected Accounts (Token Vault)
  // ===========================================================================

  initiateConnectedAccount: async (
    connection: string,
    scopes: string[],
  ): Promise<{ success: boolean, connect_uri?: string, error?: string }> => {
    const response = await api.post<{ success: boolean, connect_uri?: string, error?: string }>(
      `${API_ENDPOINTS.CONNECTED_ACCOUNTS}/initiate`,
      { connection, scopes },
    )
    return response.data || { success: false, error: 'Request failed' }
  },

  getAdditionalConnectedAccounts: async (): Promise<{
    success: boolean
    accounts: Array<{
      id: string
      connection: string
      access_type: string
      scopes: string[]
      created_at: string
      icon?: string
    }>
  }> => {
    const response = await api.get<{
      success: boolean
      accounts: Array<{
        id: string
        connection: string
        access_type: string
        scopes: string[]
        created_at: string
        icon?: string
      }>
    }>(API_ENDPOINTS.CONNECTED_ACCOUNTS)
    return response.data || { success: false, accounts: [] }
  },

  fetchAdditionalConnectors: async (): Promise<Array<{
    id: string
    name: string
    description?: string
    icon: string
    scopes?: string[]
    source?: 'local' | 'pipedream' | 'custom'
    metadata?: Record<string, unknown>
  }>> => {
    const response = await api.get<{
      connectors: Array<{
        id: string
        name: string
        description?: string
        icon: string
        scopes?: string[]
        source?: 'local' | 'pipedream' | 'custom'
        metadata?: Record<string, unknown>
      }>
    }>(API_ENDPOINTS.CONNECTORS)
    return response.data?.connectors || []
  },

  deleteAdditionalAccount: async (accountId: string): Promise<{ success: boolean, message?: string }> => {
    const response = await api.delete<{ success: boolean, message?: string }>(
      `${API_ENDPOINTS.CONNECTED_ACCOUNTS}/${accountId}`,
    )
    return response.data || { success: false }
  },
}

export default webAPIBridge
