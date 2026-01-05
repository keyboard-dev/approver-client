import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { Script } from './main'
import { ServerProviderInfo } from './oauth-providers'
import { OAuthProviderConfig } from './provider-storage'
import { CodespaceInfo, CollectionRequest, Message, ShareMessage } from './types'
import { CodeApprovalLevel, ResponseApprovalLevel } from './types/settings-types'

export interface AuthStatus {
  authenticated: boolean
  user?: {
    id: string
    email: string
    firstName: string
    lastName: string
    profilePictureUrl?: string
  }
}

export interface AuthError {
  message: string
}

export interface OAuthProvider {
  id: string
  name: string
  icon?: string
  clientId: string
  clientSecret?: string
  authorizationUrl: string
  tokenUrl: string
  userInfoUrl?: string
  scopes: string[]
  usePKCE: boolean
  redirectUri: string
  additionalParams?: Record<string, string>
}

export interface ProviderTokens {
  accessToken: string
  refreshToken?: string
  tokenType?: string
  expiresAt?: number
  scope?: string
  [key: string]: unknown
}

export interface OAuthStorageInfo {
  totalProviders: number
  authenticatedProviders: number
  storageLocation: string
  [key: string]: unknown
}

export interface ProviderConfig {
  id: string
  name: string
  clientId: string
  clientSecret?: string
  authorizationUrl: string
  tokenUrl: string
  userInfoUrl?: string
  scopes: string[]
  usePKCE: boolean
  redirectUri: string
  additionalParams?: Record<string, string>
  [key: string]: unknown
}

export interface ServerProvider {
  id: string
  name: string
  url: string
  description?: string
  providers?: string[]
  [key: string]: unknown
}

export interface ProviderAuthEventData {
  providerId: string
  status: ProviderStatus
  [key: string]: unknown
}

export interface ProviderAuthErrorData {
  providerId: string
  error: string
  [key: string]: unknown
}

export interface ProviderStatus {
  authenticated: boolean
  expired: boolean
  user?: {
    id: string
    email: string
    name: string
    firstName?: string
    lastName?: string
    picture?: string
    [key: string]: unknown
  }
  storedAt?: number
  updatedAt?: number
}

export interface UpdateInfo {
  version: string
  releaseDate?: string
  releaseName?: string
  releaseNotes?: string
}

export interface CreditsBalance {
  success: true
  balance_cents: number
  balance_usd: string
  total_earned_cents: number
  total_earned_usd: string
  total_purchased_cents: number
  total_purchased_usd: string
  total_spent_cents: number
  total_spent_usd: string
  created_at: string
  updated_at: string
}

export interface CreditsError {
  success: false
  error: string
}

export type CreditsResponse = CreditsBalance | CreditsError

export interface CheckoutSuccess {
  success: true
  checkout_url: string
  session_id: string
}

export interface CheckoutError {
  success: false
  error: string
}

export type CheckoutResponse = CheckoutSuccess | CheckoutError

export interface SubscriptionCheckoutSuccess {
  success: true
  checkout_url: string
  session_id: string
}

export interface SubscriptionCheckoutError {
  success: false
  error: string
}

export type SubscriptionCheckoutResponse = SubscriptionCheckoutSuccess | SubscriptionCheckoutError

export interface Subscription {
  id: string
  status: string
  plan: string
  [key: string]: unknown
}

export interface PaymentStatusSuccess {
  success: true
  subscriptions: Subscription[]
  [key: string]: unknown
}

export interface PaymentStatusError {
  success: false
  error: string
}

export type PaymentStatusResponse = PaymentStatusSuccess | PaymentStatusError

export interface ProgressInfo {
  bytesPerSecond: number
  percent: number
  transferred: number
  total: number
}

export interface ElectronAPI {
  sendMessageResponse: (message: Message, feedback?: string) => Promise<void>
  approveMessage: (message: Message, feedback?: string) => Promise<void> // @deprecated Use sendMessageResponse instead
  rejectMessage: (messageId: string, feedback?: string) => Promise<void> // @deprecated Use sendMessageResponse instead
  approveCollectionShare: (messageId: string, updatedRequest: CollectionRequest) => Promise<void>
  rejectCollectionShare: (messageId: string) => Promise<void>
  sendPromptCollectionRequest: (context: { scripts: Script[], prompt: string, images: string[] }) => Promise<string>
  showMessages: () => void
  onShowMessage: (callback: (event: IpcRendererEvent, message: Message) => void) => void
  onWebSocketMessage: (callback: (event: IpcRendererEvent, message: Message) => void) => void
  onCollectionShareRequest: (callback: (event: IpcRendererEvent, shareMessage: ShareMessage) => void) => void
  onShowShareMessage: (callback: (event: IpcRendererEvent, shareMessage: ShareMessage) => void) => void
  onPromptResponse: (callback: (event: IpcRendererEvent, message: { requestId?: string, prompt?: string }) => void) => void
  onMessagesClear: (callback: (event: IpcRendererEvent) => void) => void
  onMessageStatusUpdated: (callback: (event: IpcRendererEvent, message: Partial<Message>) => void) => void
  onShareMessageStatusUpdated: (callback: (event: IpcRendererEvent, shareMessage: Partial<ShareMessage>) => void) => void
  removeAllListeners: (channel: string) => void
  // WebSocket connection status event listeners
  onWebSocketConnecting: (callback: (event: IpcRendererEvent, data: { target: string, type: string }) => void) => void
  onWebSocketConnected: (callback: (event: IpcRendererEvent, data: { target: string, type: string, codespaceName?: string }) => void) => void
  onWebSocketDisconnected: (callback: (event: IpcRendererEvent, data: { target: string, type: string }) => void) => void
  onWebSocketReconnecting: (callback: (event: IpcRendererEvent, data: { attempt: number, maxAttempts: number }) => void) => void
  onWebSocketSwitching: (callback: (event: IpcRendererEvent, data: { from: string, to: string }) => void) => void
  onWebSocketError: (callback: (event: IpcRendererEvent, data: { target: string, type: string, error: string }) => void) => void
  // Database operations
  dbGetPendingCount: () => Promise<number>
  dbClearAllMessages: () => Promise<void>
  // Open external links
  openExternal: (url: string) => Promise<void>
  // Legacy OAuth
  startOAuth: () => Promise<void>
  getAuthStatus: () => Promise<AuthStatus>
  logout: () => Promise<void>
  getAccessToken: () => Promise<string | null>
  getScripts: () => Promise<Script[]>
  deleteScript: (scriptId: string) => Promise<void>
  onAuthSuccess: (callback: (event: IpcRendererEvent, data: AuthStatus) => void) => void
  onAuthError: (callback: (event: IpcRendererEvent, error: AuthError) => void) => void
  onAuthLogout: (callback: (event: IpcRendererEvent) => void) => void
  // OAuth Providers
  getAvailableProviders: () => Promise<OAuthProvider[]>
  startProviderOAuth: (providerId: string) => Promise<void>
  getProviderAuthStatus: () => Promise<Record<string, ProviderStatus>>
  getProviderAccessToken: (providerId: string) => Promise<string | null>
  logoutProvider: (providerId: string) => Promise<void>
  getProviderTokens: (providerId: string) => Promise<ProviderTokens>
  refreshProviderTokens: (providerId: string) => Promise<boolean>
  clearAllProviderTokens: () => Promise<void>
  expireAllTokensForTesting: () => Promise<number>
  getOAuthStorageInfo: () => Promise<OAuthStorageInfo>
  onProviderAuthSuccess: (callback: (event: IpcRendererEvent, data: ProviderAuthEventData) => void) => void
  onProviderAuthError: (callback: (event: IpcRendererEvent, error: ProviderAuthErrorData) => void) => void
  onProviderAuthLogout: (callback: (event: IpcRendererEvent, data: ProviderAuthEventData) => void) => void
  // Manual Provider management
  getAllProviderConfigs: () => Promise<OAuthProviderConfig[]>
  saveProviderConfig: (config: Omit<OAuthProviderConfig, 'createdAt' | 'updatedAt'>) => Promise<void>
  removeProviderConfig: (providerId: string) => Promise<void>
  getProviderConfig: (providerId: string) => Promise<OAuthProviderConfig>
  // Server Provider management
  addServerProvider: (server: ServerProvider) => Promise<void>
  removeServerProvider: (serverId: string) => Promise<void>
  getServerProviders: () => Promise<ServerProvider[]>
  fetchServerProviders: (serverId: string) => Promise<ServerProviderInfo[]>
  startServerProviderOAuth: (serverId: string, provider: string) => Promise<void>
  fetchOnboardingGithubProvider: () => Promise<void>
  checkOnboardingGithubToken: () => Promise<boolean>
  clearOnboardingGithubToken: () => Promise<void>
  checkOnboardingCompleted: () => Promise<boolean>
  markOnboardingCompleted: () => Promise<void>
  // WebSocket key management
  getWSConnectionKey: () => Promise<string | null>
  getWSConnectionUrl: () => Promise<string>
  regenerateWSKey: () => Promise<{ key: string, createdAt: number }>
  getWSKeyInfo: () => Promise<{ key: string | null, createdAt: number | null, keyFile: string }>
  onWSKeyGenerated: (callback: (event: IpcRendererEvent, data: { key: string, createdAt: number }) => void) => void
  // Encryption key management
  getEncryptionKey: () => Promise<string | null>
  regenerateEncryptionKey: () => Promise<{ key: string, createdAt: number, source: 'environment' | 'generated' | null }>
  getEncryptionKeyInfo: () => Promise<{ key: string | null, createdAt: number | null, keyFile: string, source: 'environment' | 'generated' | null }>
  onEncryptionKeyGenerated: (callback: (event: IpcRendererEvent, data: { key: string, createdAt: number, source: 'environment' | 'generated' | null }) => void) => void
  // External URL handling
  openExternalUrl: (url: string) => Promise<void>

  // Settings management
  getSettings: () => Promise<{ showNotifications: boolean, automaticCodeApproval: CodeApprovalLevel, automaticResponseApproval: ResponseApprovalLevel, fullCodeExecution: boolean, settingsFile: string, updatedAt: number | null }>
  setShowNotifications: (show: boolean) => Promise<void>
  getShowNotifications: () => Promise<boolean>
  setAutomaticCodeApproval: (level: CodeApprovalLevel) => Promise<void>
  getAutomaticCodeApproval: () => Promise<CodeApprovalLevel>
  setAutomaticResponseApproval: (level: ResponseApprovalLevel) => Promise<void>
  getAutomaticResponseApproval: () => Promise<ResponseApprovalLevel>
  setFullCodeExecution: (enabled: boolean) => Promise<void>
  getFullCodeExecution: () => Promise<boolean>
  getExecutionPreference: () => Promise<{ preference?: string, error?: string }>
  setExecutionPreference: (preference: string) => Promise<{ success: boolean, error?: string }>
  // Assets path
  getAssetsPath: () => Promise<string>

  // Auto-updater methods
  onUpdateAvailable: (callback: (event: IpcRendererEvent, updateInfo: UpdateInfo) => void) => void
  onDownloadProgress: (callback: (event: IpcRendererEvent, progressInfo: ProgressInfo) => void) => void
  onUpdateDownloaded: (callback: (event: IpcRendererEvent, updateInfo: UpdateInfo) => void) => void
  checkForUpdates: () => Promise<void>
  downloadUpdate: () => Promise<void>
  quitAndInstall: () => Promise<void>

  // Test methods for development
  testUpdateAvailable: () => Promise<void>
  testDownloadUpdate: () => Promise<void>
  testUpdateDownloaded: () => Promise<void>
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>

  // Executor WebSocket connection methods
  getExecutorConnectionStatus: () => Promise<{ connected: boolean, target?: { type: 'localhost' | 'codespace', url: string, name?: string, codespaceName?: string } }>
  reconnectToExecutor: () => Promise<boolean>
  disconnectFromExecutor: () => Promise<void>
  discoverCodespaces: () => Promise<Array<{ codespace: unknown, websocketUrl?: string, available: boolean, error?: string }>>
  connectToCodespace: (codespaceName: string) => Promise<boolean>
  connectToBestCodespace: () => Promise<boolean>
  connectToLocalhost: () => Promise<void>
  getLastKnownCodespaces: () => Promise<Array<{ codespace: unknown, websocketUrl?: string, available: boolean, error?: string }>>
  sendManualPing: () => Promise<{
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
  }>

  // Database notification (no return value needed)
  dbPendingCountUpdated: (count: number) => void

  // Version install date
  getVersionInstallDate: () => Promise<Date | null>

  // AI Provider management
  setAIProviderKey: (provider: string, apiKey: string) => Promise<void>
  getAIProviderKeys: () => Promise<Array<{ provider: string, hasKey: boolean, configured: boolean }>>
  removeAIProviderKey: (provider: string) => Promise<void>
  testAIProviderConnection: (provider: string) => Promise<{ success: boolean, error?: string }>
  sendAIMessage: (provider: string, messages: Array<{ role: 'user' | 'assistant' | 'system', content: string }>, config?: { model?: string }) => Promise<string>
  sendAIMessageStream: (provider: string, messages: Array<{ role: 'user' | 'assistant' | 'system', content: string }>, config?: { model?: string }) => Promise<string>
  onAIStreamChunk: (callback: (chunk: string) => void) => void
  onAIStreamEnd: (callback: () => void) => void
  onAIStreamError: (callback: (error: string) => void) => void
  removeAIStreamListeners: () => void
  webSearch: (provider: string, query: string, company: string) => Promise<unknown>
  getUserTokens: () => Promise<{ tokensAvailable?: string[], error?: string }>
  getCodespaceInfo: () => Promise<CodespaceInfo>
  // Credits balance
  getCreditsBalance: () => Promise<CreditsResponse>
  createCreditsCheckout: (amountCents: number) => Promise<CheckoutResponse>
  // Subscriptions
  createSubscriptionCheckout: () => Promise<SubscriptionCheckoutResponse>
  getPaymentStatus: () => Promise<PaymentStatusResponse>
  // Connected Accounts
  initiateConnectedAccount: (connection: string, scopes: string[]) => Promise<{ success: boolean, connect_uri?: string, error?: string }>
  getAdditionalConnectedAccounts: () => Promise<{ success: boolean, accounts: Array<{ id: string, connection: string, access_type: string, scopes: string[], created_at: string, icon?: string }> }>
  fetchAdditionalConnectors: () => Promise<Array<{ id: string, name: string, description?: string, icon: string, scopes?: string[], source?: 'local' | 'pipedream' | 'custom', metadata?: Record<string, unknown> }>>
  deleteAdditionalAccount: (accountId: string) => Promise<{ success: boolean, message?: string }>
  // Pipedream Triggers
  fetchPipedreamAccounts: () => Promise<string[]>
  fetchPipedreamTriggers: (app: string) => Promise<{ success: boolean, data?: unknown, error?: string }>
  deployPipedreamTrigger: (config: {
    componentKey: string
    appName: string
    appSlug: string
    configuredProps?: Record<string, unknown>
    tasks?: Array<{
      keyboard_shortcut_ids?: string[]
      cloud_credentials?: string[]
      pipedream_proxy_apps?: string[]
      ask?: string | null
    }>
  }) => Promise<{ success: boolean, data?: unknown, error?: string }>
  getDeployedPipedreamTriggers: (includeTasks?: boolean) => Promise<{ success: boolean, data?: unknown, error?: string }>
  createTriggerTask: (config: {
    deployed_trigger_id: string
    keyboard_shortcut_ids?: string[]
    cloud_credentials?: string[]
    pipedream_proxy_apps?: string[]
    ask?: string | null
  }) => Promise<{ success: boolean, data?: unknown, error?: string }>
  updateTriggerTask: (taskId: string, config: {
    keyboard_shortcut_ids?: string[]
    cloud_credentials?: string[]
    pipedream_proxy_apps?: string[]
    ask?: string | null
  }) => Promise<{ success: boolean, data?: unknown, error?: string }>
  getTriggerTasks: (deployedTriggerId: string, limit?: number) => Promise<{ success: boolean, data?: unknown, error?: string }>
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  sendMessageResponse: (message: Message, feedback?: string): Promise<void> => {
    return ipcRenderer.invoke('send-message-response', message, feedback)
  },
  // @deprecated - kept for backward compatibility
  approveMessage: (message: Message, feedback?: string): Promise<void> => {
    return ipcRenderer.invoke('approve-message', message, feedback)
  },
  // @deprecated - kept for backward compatibility
  rejectMessage: (messageId: string, feedback?: string): Promise<void> => ipcRenderer.invoke('reject-message', messageId, feedback),
  approveCollectionShare: (messageId: string, updatedRequest: CollectionRequest): Promise<void> => ipcRenderer.invoke('approve-collection-share', messageId, updatedRequest),
  rejectCollectionShare: (messageId: string): Promise<void> => ipcRenderer.invoke('reject-collection-share', messageId),
  sendPromptCollectionRequest: (context: { scripts: Script[], prompt: string, images: string[] }): Promise<string> => ipcRenderer.invoke('send-prompt-collection-request', context),
  showMessages: (): void => ipcRenderer.send('show-messages'),

  // Listen for messages from main process
  onShowMessage: (callback: (event: IpcRendererEvent, message: Message) => void): void => {
    ipcRenderer.on('show-message', callback)
  },
  onWebSocketMessage: (callback: (event: IpcRendererEvent, message: Message) => void): void => {
    ipcRenderer.on('websocket-message', callback)
  },
  onCollectionShareRequest: (callback: (event: IpcRendererEvent, shareMessage: ShareMessage) => void): void => {
    ipcRenderer.on('collection-share-request', callback)
  },
  onShowShareMessage: (callback: (event: IpcRendererEvent, shareMessage: ShareMessage) => void): void => {
    ipcRenderer.on('show-share-message', callback)
  },
  onPromptResponse: (callback: (event: IpcRendererEvent, message: { requestId?: string, prompt?: string }) => void): void => {
    ipcRenderer.on('prompt-response', callback)
  },
  onMessagesClear: (callback: (event: IpcRendererEvent) => void): void => {
    ipcRenderer.on('messages-cleared', callback)
  },
  onMessageStatusUpdated: (callback: (event: IpcRendererEvent, message: Partial<Message>) => void): void => {
    ipcRenderer.on('message-status-updated', callback)
  },
  onShareMessageStatusUpdated: (callback: (event: IpcRendererEvent, shareMessage: Partial<ShareMessage>) => void): void => {
    ipcRenderer.on('share-message-status-updated', callback)
  },
  removeAllListeners: (channel: string): void => {
    ipcRenderer.removeAllListeners(channel)
  },

  // WebSocket connection status event listeners
  onWebSocketConnecting: (callback: (event: IpcRendererEvent, data: { target: string, type: string }) => void): void => {
    ipcRenderer.on('websocket-connecting', callback)
  },
  onWebSocketConnected: (callback: (event: IpcRendererEvent, data: { target: string, type: string, codespaceName?: string }) => void): void => {
    ipcRenderer.on('websocket-connected', callback)
  },
  onWebSocketDisconnected: (callback: (event: IpcRendererEvent, data: { target: string, type: string }) => void): void => {
    ipcRenderer.on('websocket-disconnected', callback)
  },
  onWebSocketReconnecting: (callback: (event: IpcRendererEvent, data: { attempt: number, maxAttempts: number }) => void): void => {
    ipcRenderer.on('websocket-reconnecting', callback)
  },
  onWebSocketSwitching: (callback: (event: IpcRendererEvent, data: { from: string, to: string }) => void): void => {
    ipcRenderer.on('websocket-switching', callback)
  },
  onWebSocketError: (callback: (event: IpcRendererEvent, data: { target: string, type: string, error: string }) => void): void => {
    ipcRenderer.on('websocket-error', callback)
  },

  // Database operations
  dbGetPendingCount: (): Promise<number> => ipcRenderer.invoke('db:get-pending-count'),
  dbClearAllMessages: (): Promise<void> => ipcRenderer.invoke('db:clear-all-messages'),

  // Open external links
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('open-external', url),

  // Legacy OAuth functions
  startOAuth: (): Promise<void> => ipcRenderer.invoke('start-oauth'),
  getAuthStatus: (): Promise<AuthStatus> => ipcRenderer.invoke('get-auth-status'),
  logout: (): Promise<void> => ipcRenderer.invoke('logout'),
  getAccessToken: (): Promise<string | null> => ipcRenderer.invoke('get-access-token'),
  getScripts: (): Promise<Script[]> => ipcRenderer.invoke('get-scripts'),
  deleteScript: (scriptId: string): Promise<void> => ipcRenderer.invoke('delete-script', scriptId),

  // Legacy OAuth event listeners
  onAuthSuccess: (callback: (event: IpcRendererEvent, data: AuthStatus) => void): void => {
    ipcRenderer.on('auth-success', callback)
  },
  onAuthError: (callback: (event: IpcRendererEvent, error: AuthError) => void): void => {
    ipcRenderer.on('auth-error', callback)
  },
  onAuthLogout: (callback: (event: IpcRendererEvent) => void): void => {
    ipcRenderer.on('auth-logout', callback)
  },

  // OAuth Provider functions
  getAvailableProviders: (): Promise<OAuthProvider[]> => ipcRenderer.invoke('get-available-providers'),
  startProviderOAuth: (providerId: string): Promise<void> => ipcRenderer.invoke('start-provider-oauth', providerId),
  getProviderAuthStatus: (): Promise<Record<string, ProviderStatus>> => ipcRenderer.invoke('get-provider-auth-status'),
  getProviderAccessToken: (providerId: string): Promise<string | null> => ipcRenderer.invoke('get-provider-access-token', providerId),
  logoutProvider: (providerId: string): Promise<void> => ipcRenderer.invoke('logout-provider', providerId),
  getProviderTokens: (providerId: string): Promise<ProviderTokens> => ipcRenderer.invoke('get-provider-tokens', providerId),
  refreshProviderTokens: (providerId: string): Promise<boolean> => ipcRenderer.invoke('refresh-provider-tokens', providerId),
  clearAllProviderTokens: (): Promise<void> => ipcRenderer.invoke('clear-all-provider-tokens'),
  expireAllTokensForTesting: (): Promise<number> => ipcRenderer.invoke('expire-all-tokens-for-testing'),
  getOAuthStorageInfo: (): Promise<OAuthStorageInfo> => ipcRenderer.invoke('get-oauth-storage-info'),

  // OAuth Provider event listeners
  onProviderAuthSuccess: (callback: (event: IpcRendererEvent, data: ProviderAuthEventData) => void): void => {
    ipcRenderer.on('provider-auth-success', callback)
  },
  onProviderAuthError: (callback: (event: IpcRendererEvent, error: ProviderAuthErrorData) => void): void => {
    ipcRenderer.on('provider-auth-error', callback)
  },
  onProviderAuthLogout: (callback: (event: IpcRendererEvent, data: ProviderAuthEventData) => void): void => {
    ipcRenderer.on('provider-auth-logout', callback)
  },

  // Manual Provider Management
  getAllProviderConfigs: (): Promise<OAuthProviderConfig[]> => ipcRenderer.invoke('get-all-provider-configs'),
  saveProviderConfig: (config: OAuthProviderConfig): Promise<void> => ipcRenderer.invoke('save-provider-config', config),
  removeProviderConfig: (providerId: string): Promise<void> => ipcRenderer.invoke('remove-provider-config', providerId),
  getProviderConfig: (providerId: string): Promise<OAuthProviderConfig> => ipcRenderer.invoke('get-provider-config', providerId),

  // Server Provider management
  addServerProvider: (server: ServerProvider): Promise<void> => ipcRenderer.invoke('add-server-provider', server),
  removeServerProvider: (serverId: string): Promise<void> => ipcRenderer.invoke('remove-server-provider', serverId),
  getServerProviders: (): Promise<ServerProvider[]> => ipcRenderer.invoke('get-server-providers'),
  fetchServerProviders: (serverId: string): Promise<ServerProviderInfo[]> => ipcRenderer.invoke('fetch-server-providers', serverId),
  startServerProviderOAuth: (serverId: string, provider: string): Promise<void> => ipcRenderer.invoke('start-server-provider-oauth', serverId, provider),
  fetchOnboardingGithubProvider: (): Promise<void> => ipcRenderer.invoke('fetch-onboarding-github-provider'),
  checkOnboardingGithubToken: (): Promise<boolean> => ipcRenderer.invoke('check-onboarding-github-token'),
  clearOnboardingGithubToken: (): Promise<void> => ipcRenderer.invoke('clear-onboarding-github-token'),
  checkOnboardingCompleted: (): Promise<boolean> => ipcRenderer.invoke('check-onboarding-completed'),
  markOnboardingCompleted: (): Promise<void> => ipcRenderer.invoke('mark-onboarding-completed'),

  // WebSocket key management
  getWSConnectionKey: (): Promise<string | null> => ipcRenderer.invoke('get-ws-connection-key'),
  getWSConnectionUrl: (): Promise<string> => ipcRenderer.invoke('get-ws-connection-url'),
  regenerateWSKey: (): Promise<{ key: string, createdAt: number }> => ipcRenderer.invoke('regenerate-ws-key'),
  getWSKeyInfo: (): Promise<{ key: string | null, createdAt: number | null, keyFile: string }> => ipcRenderer.invoke('get-ws-key-info'),
  onWSKeyGenerated: (callback: (event: IpcRendererEvent, data: { key: string, createdAt: number }) => void): void => {
    ipcRenderer.on('ws-key-generated', callback)
  },

  // Encryption key management
  getEncryptionKey: (): Promise<string | null> => ipcRenderer.invoke('get-encryption-key'),
  regenerateEncryptionKey: (): Promise<{ key: string, createdAt: number, source: 'environment' | 'generated' | null }> => ipcRenderer.invoke('regenerate-encryption-key'),
  getEncryptionKeyInfo: (): Promise<{ key: string | null, createdAt: number | null, keyFile: string, source: 'environment' | 'generated' | null }> => ipcRenderer.invoke('get-encryption-key-info'),
  onEncryptionKeyGenerated: (callback: (event: IpcRendererEvent, data: { key: string, createdAt: number, source: 'environment' | 'generated' | null }) => void): void => {
    ipcRenderer.on('encryption-key-generated', callback)
  },

  // External URL handling
  openExternalUrl: (url: string): Promise<void> => ipcRenderer.invoke('open-external-url', url),

  // Settings management
  getSettings: (): Promise<{ showNotifications: boolean, automaticCodeApproval: CodeApprovalLevel, automaticResponseApproval: ResponseApprovalLevel, fullCodeExecution: boolean, settingsFile: string, updatedAt: number | null }> => ipcRenderer.invoke('get-settings'),
  setShowNotifications: (show: boolean): Promise<void> => ipcRenderer.invoke('set-show-notifications', show),
  getShowNotifications: (): Promise<boolean> => ipcRenderer.invoke('get-show-notifications'),
  setAutomaticCodeApproval: (level: CodeApprovalLevel): Promise<void> => ipcRenderer.invoke('set-automatic-code-approval', level),
  getAutomaticCodeApproval: (): Promise<CodeApprovalLevel> => ipcRenderer.invoke('get-automatic-code-approval'),
  setAutomaticResponseApproval: (level: ResponseApprovalLevel): Promise<void> => ipcRenderer.invoke('set-automatic-response-approval', level),
  getAutomaticResponseApproval: (): Promise<ResponseApprovalLevel> => ipcRenderer.invoke('get-automatic-response-approval'),
  setFullCodeExecution: (enabled: boolean): Promise<void> => ipcRenderer.invoke('set-full-code-execution', enabled),
  getFullCodeExecution: (): Promise<boolean> => ipcRenderer.invoke('get-full-code-execution'),
  getExecutionPreference: (): Promise<{ preference?: string, error?: string }> => ipcRenderer.invoke('get-execution-preference'),
  setExecutionPreference: (preference: string): Promise<{ success: boolean, error?: string }> => ipcRenderer.invoke('set-execution-preference', preference),

  // Assets path
  getAssetsPath: (): Promise<string> => ipcRenderer.invoke('get-assets-path'),

  // Auto-updater methods
  onUpdateAvailable: (callback: (event: IpcRendererEvent, updateInfo: UpdateInfo) => void): void => {
    ipcRenderer.on('update-available', callback)
  },
  onDownloadProgress: (callback: (event: IpcRendererEvent, progressInfo: ProgressInfo) => void): void => {
    ipcRenderer.on('download-progress', callback)
  },
  onUpdateDownloaded: (callback: (event: IpcRendererEvent, updateInfo: UpdateInfo) => void): void => {
    ipcRenderer.on('update-downloaded', callback)
  },
  checkForUpdates: (): Promise<void> => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: (): Promise<void> => ipcRenderer.invoke('download-update'),
  quitAndInstall: (): Promise<void> => ipcRenderer.invoke('quit-and-install'),

  // Test methods for development
  testUpdateAvailable: (): Promise<void> => ipcRenderer.invoke('test-update-available'),
  testDownloadUpdate: (): Promise<void> => ipcRenderer.invoke('test-download-update'),
  testUpdateDownloaded: (): Promise<void> => ipcRenderer.invoke('test-update-downloaded'),
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => ipcRenderer.invoke(channel, ...args),

  // Executor WebSocket connection methods
  getExecutorConnectionStatus: () => ipcRenderer.invoke('get-executor-connection-status'),
  reconnectToExecutor: (): Promise<boolean> => ipcRenderer.invoke('reconnect-to-executor'),
  disconnectFromExecutor: (): Promise<void> => ipcRenderer.invoke('disconnect-from-executor'),
  discoverCodespaces: () => ipcRenderer.invoke('discover-codespaces'),
  connectToCodespace: (codespaceName: string): Promise<boolean> => ipcRenderer.invoke('connect-to-codespace', codespaceName),
  connectToBestCodespace: (): Promise<boolean> => ipcRenderer.invoke('connect-to-best-codespace'),
  connectToLocalhost: (): Promise<void> => ipcRenderer.invoke('connect-to-localhost'),
  getLastKnownCodespaces: () => ipcRenderer.invoke('get-last-known-codespaces'),
  sendManualPing: () => ipcRenderer.invoke('send-manual-ping'),

  // Database notification (no return value needed)
  dbPendingCountUpdated: (count: number): void => {
    ipcRenderer.invoke('db:pending-count-updated', count)
  },

  // Version install date
  getVersionInstallDate: (): Promise<Date | null> => ipcRenderer.invoke('get-version-install-date'),

  // AI Provider management
  setAIProviderKey: (provider: string, apiKey: string): Promise<void> => ipcRenderer.invoke('set-ai-provider-key', provider, apiKey),
  getAIProviderKeys: (): Promise<Array<{ provider: string, hasKey: boolean, configured: boolean }>> => ipcRenderer.invoke('get-ai-provider-keys'),
  removeAIProviderKey: (provider: string): Promise<void> => ipcRenderer.invoke('remove-ai-provider-key', provider),
  testAIProviderConnection: (provider: string): Promise<{ success: boolean, error?: string }> => ipcRenderer.invoke('test-ai-provider-connection', provider),
  sendAIMessage: (provider: string, messages: Array<{ role: 'user' | 'assistant' | 'system', content: string }>, config?: { model?: string }): Promise<string> => ipcRenderer.invoke('send-ai-message', provider, messages, config),
  sendAIMessageStream: (provider: string, messages: Array<{ role: 'user' | 'assistant' | 'system', content: string }>, config?: { model?: string }): Promise<string> => ipcRenderer.invoke('send-ai-message-stream', provider, messages, config),
  onAIStreamChunk: (callback: (chunk: string) => void): void => {
    ipcRenderer.on('ai-stream-chunk', (_event, chunk) => callback(chunk))
  },
  onAIStreamEnd: (callback: () => void): void => {
    ipcRenderer.on('ai-stream-end', () => callback())
  },
  onAIStreamError: (callback: (error: string) => void): void => {
    ipcRenderer.on('ai-stream-error', (_event, error) => callback(error))
  },
  removeAIStreamListeners: (): void => {
    ipcRenderer.removeAllListeners('ai-stream-chunk')
    ipcRenderer.removeAllListeners('ai-stream-end')
    ipcRenderer.removeAllListeners('ai-stream-error')
  },
  webSearch: (provider: string, query: string, company: string): Promise<unknown> => ipcRenderer.invoke('web-search', provider, query, company),
  getUserTokens: (): Promise<{ tokensAvailable?: string[], error?: string }> => ipcRenderer.invoke('get-user-tokens'),
  getCodespaceInfo: (): Promise<CodespaceInfo> => ipcRenderer.invoke('get-codespace-info'),
  // Credits balance
  getCreditsBalance: (): Promise<CreditsResponse> => ipcRenderer.invoke('get-credits-balance'),
  createCreditsCheckout: (amountCents: number): Promise<CheckoutResponse> => ipcRenderer.invoke('create-credits-checkout', amountCents),
  // Subscriptions
  createSubscriptionCheckout: (): Promise<SubscriptionCheckoutResponse> => ipcRenderer.invoke('create-subscription-checkout'),
  getPaymentStatus: (): Promise<PaymentStatusResponse> => ipcRenderer.invoke('get-payment-status'),
  // Connected Accounts
  initiateConnectedAccount: (connection: string, scopes: string[]): Promise<{ success: boolean, connect_uri?: string, error?: string }> => ipcRenderer.invoke('initiate-connected-account', connection, scopes),
  getAdditionalConnectedAccounts: (): Promise<{ success: boolean, accounts: Array<{ id: string, connection: string, access_type: string, scopes: string[], created_at: string, icon?: string }> }> => ipcRenderer.invoke('get-additional-connected-accounts'),
  deleteAdditionalAccount: (accountId: string): Promise<{ success: boolean, message?: string }> => ipcRenderer.invoke('delete-additional-account', accountId),
  fetchAdditionalConnectors: (): Promise<Array<{ id: string, name: string, description?: string, icon: string, scopes?: string[], source?: 'local' | 'pipedream' | 'custom', metadata?: Record<string, unknown> }>> => ipcRenderer.invoke('fetch-additional-connectors'),
  // Pipedream Triggers
  fetchPipedreamAccounts: (): Promise<string[]> => ipcRenderer.invoke('fetch-pipedream-accounts'),
  fetchPipedreamTriggers: (app: string): Promise<{ success: boolean, data?: unknown, error?: string }> => ipcRenderer.invoke('fetch-pipedream-triggers', app),
  deployPipedreamTrigger: (config: {
    componentKey: string
    appName: string
    appSlug: string
    configuredProps?: Record<string, unknown>
    tasks?: Array<{
      keyboard_shortcut_ids?: string[]
      cloud_credentials?: string[]
      pipedream_proxy_apps?: string[]
      ask?: string | null
    }>
  }): Promise<{ success: boolean, data?: unknown, error?: string }> => ipcRenderer.invoke('deploy-pipedream-trigger', config),
  getDeployedPipedreamTriggers: (includeTasks = false): Promise<{ success: boolean, data?: unknown, error?: string }> => ipcRenderer.invoke('get-deployed-pipedream-triggers', includeTasks),
  createTriggerTask: (config: {
    deployed_trigger_id: string
    keyboard_shortcut_ids?: string[]
    cloud_credentials?: string[]
    pipedream_proxy_apps?: string[]
    ask?: string | null
  }): Promise<{ success: boolean, data?: unknown, error?: string }> => ipcRenderer.invoke('create-trigger-task', config),
  updateTriggerTask: (taskId: string, config: {
    keyboard_shortcut_ids?: string[]
    cloud_credentials?: string[]
    pipedream_proxy_apps?: string[]
    ask?: string | null
  }): Promise<{ success: boolean, data?: unknown, error?: string }> => ipcRenderer.invoke('update-trigger-task', taskId, config),
  getTriggerTasks: (deployedTriggerId: string, limit = 10): Promise<{ success: boolean, data?: unknown, error?: string }> => ipcRenderer.invoke('get-trigger-tasks', deployedTriggerId, limit),
} as ElectronAPI)

// Extend the global Window interface
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
