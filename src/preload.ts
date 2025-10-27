import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { Script } from './main'
import { ServerProviderInfo } from './oauth-providers'
import { OAuthProviderConfig } from './provider-storage'
import { CollectionRequest, Message, ShareMessage } from './types'
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

export interface ProgressInfo {
  bytesPerSecond: number
  percent: number
  transferred: number
  total: number
}

export interface ElectronAPI {
  approveMessage: (message: Message, feedback?: string) => Promise<void>
  rejectMessage: (messageId: string, feedback?: string) => Promise<void>
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

  // Database notification (no return value needed)
  dbPendingCountUpdated: (count: number) => void

  // Version install date
  getVersionInstallDate: () => Promise<Date | null>
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  approveMessage: (message: Message, feedback?: string): Promise<void> => ipcRenderer.invoke('approve-message', message, feedback),
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

  // Database notification (no return value needed)
  dbPendingCountUpdated: (count: number): void => {
    ipcRenderer.invoke('db:pending-count-updated', count)
  },

  // Version install date
  getVersionInstallDate: (): Promise<Date | null> => ipcRenderer.invoke('get-version-install-date'),
} as ElectronAPI)

// Extend the global Window interface
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
