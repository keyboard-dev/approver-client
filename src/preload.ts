import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export interface Message {
  id: string;
  title: string;
  body: string;
  timestamp: number;
  priority?: 'low' | 'normal' | 'high';
  sender?: string;
  read?: boolean;
  status?: 'pending' | 'approved' | 'rejected';
  feedback?: string;
  requiresResponse?: boolean;
  codeEval?: boolean;
  code?: string;
  explaination?: string;
}

export interface AuthStatus {
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    profilePictureUrl?: string;
  };
}

export interface AuthError {
  message: string;
}

export interface OAuthProvider {
  id: string;
  name: string;
  icon?: string;
  clientId: string;
  clientSecret?: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl?: string;
  scopes: string[];
  usePKCE: boolean;
  redirectUri: string;
  additionalParams?: Record<string, string>;
}

export interface ProviderStatus {
  authenticated: boolean;
  expired: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    firstName?: string;
    lastName?: string;
    picture?: string;
    [key: string]: any;
  };
  storedAt?: number;
  updatedAt?: number;
}

export interface ElectronAPI {
  getMessages: () => Promise<Message[]>;
  markMessageRead: (messageId: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  approveMessage: (messageId: string, feedback?: string, messageBody?: string) => Promise<void>;
  rejectMessage: (messageId: string, feedback?: string) => Promise<void>;
  showMessages: () => void;
  onShowMessage: (callback: (event: IpcRendererEvent, message: Message) => void) => void;
  onWebSocketMessage: (callback: (event: IpcRendererEvent, message: Message) => void) => void;
  removeAllListeners: (channel: string) => void;
  // Legacy OAuth
  startOAuth: () => Promise<void>;
  getAuthStatus: () => Promise<AuthStatus>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  onAuthSuccess: (callback: (event: IpcRendererEvent, data: AuthStatus) => void) => void;
  onAuthError: (callback: (event: IpcRendererEvent, error: AuthError) => void) => void;
  onAuthLogout: (callback: (event: IpcRendererEvent) => void) => void;
  // OAuth Providers
  getAvailableProviders: () => Promise<OAuthProvider[]>;
  startProviderOAuth: (providerId: string) => Promise<void>;
  getProviderAuthStatus: () => Promise<Record<string, ProviderStatus>>;
  getProviderAccessToken: (providerId: string) => Promise<string | null>;
  logoutProvider: (providerId: string) => Promise<void>;
  getProviderTokens: (providerId: string) => Promise<any>;
  refreshProviderTokens: (providerId: string) => Promise<boolean>;
  clearAllProviderTokens: () => Promise<void>;
  getOAuthStorageInfo: () => Promise<any>;
  onProviderAuthSuccess: (callback: (event: IpcRendererEvent, data: any) => void) => void;
  onProviderAuthError: (callback: (event: IpcRendererEvent, error: any) => void) => void;
  onProviderAuthLogout: (callback: (event: IpcRendererEvent, data: any) => void) => void;
  // Server Provider management
  addServerProvider: (server: any) => Promise<void>;
  removeServerProvider: (serverId: string) => Promise<void>;
  getServerProviders: () => Promise<any[]>;
  fetchServerProviders: (serverId: string) => Promise<any[]>;
  startServerProviderOAuth: (serverId: string, provider: string) => Promise<void>;
  // WebSocket key management
  getWSConnectionKey: () => Promise<string | null>;
  getWSConnectionUrl: () => Promise<string>;
  regenerateWSKey: () => Promise<{ key: string; createdAt: number }>;
  getWSKeyInfo: () => Promise<{ key: string | null; createdAt: number | null; keyFile: string }>;
  onWSKeyGenerated: (callback: (event: IpcRendererEvent, data: { key: string; createdAt: number }) => void) => void;
  // Encryption key management
  getEncryptionKey: () => Promise<string | null>;
  regenerateEncryptionKey: () => Promise<{ key: string; createdAt: number; source: string }>;
  getEncryptionKeyInfo: () => Promise<{ key: string | null; createdAt: number | null; keyFile: string; source: 'environment' | 'generated' | null }>;
  onEncryptionKeyGenerated: (callback: (event: IpcRendererEvent, data: { key: string; createdAt: number; source: string }) => void) => void;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getMessages: (): Promise<Message[]> => ipcRenderer.invoke('get-messages'),
  markMessageRead: (messageId: string): Promise<void> => ipcRenderer.invoke('mark-message-read', messageId),
  deleteMessage: (messageId: string): Promise<void> => ipcRenderer.invoke('delete-message', messageId),
  approveMessage: (messageId: string, feedback?: string, messageBody?: string): Promise<void> => ipcRenderer.invoke('approve-message', messageId, feedback, messageBody),
  rejectMessage: (messageId: string, feedback?: string): Promise<void> => ipcRenderer.invoke('reject-message', messageId, feedback),
  showMessages: (): void => ipcRenderer.send('show-messages'),

  // Listen for messages from main process
  onShowMessage: (callback: (event: IpcRendererEvent, message: Message) => void): void => {
    ipcRenderer.on('show-message', callback);
  },
  onWebSocketMessage: (callback: (event: IpcRendererEvent, message: Message) => void): void => {
    ipcRenderer.on('websocket-message', callback);
  },
  removeAllListeners: (channel: string): void => {
    ipcRenderer.removeAllListeners(channel);
  },

  // Legacy OAuth functions
  startOAuth: (): Promise<void> => ipcRenderer.invoke('start-oauth'),
  getAuthStatus: (): Promise<AuthStatus> => ipcRenderer.invoke('get-auth-status'),
  logout: (): Promise<void> => ipcRenderer.invoke('logout'),
  getAccessToken: (): Promise<string | null> => ipcRenderer.invoke('get-access-token'),

  // Legacy OAuth event listeners
  onAuthSuccess: (callback: (event: IpcRendererEvent, data: AuthStatus) => void): void => {
    ipcRenderer.on('auth-success', callback);
  },
  onAuthError: (callback: (event: IpcRendererEvent, error: AuthError) => void): void => {
    ipcRenderer.on('auth-error', callback);
  },
  onAuthLogout: (callback: (event: IpcRendererEvent) => void): void => {
    ipcRenderer.on('auth-logout', callback);
  },

  // OAuth Provider functions
  getAvailableProviders: (): Promise<OAuthProvider[]> => ipcRenderer.invoke('get-available-providers'),
  startProviderOAuth: (providerId: string): Promise<void> => ipcRenderer.invoke('start-provider-oauth', providerId),
  getProviderAuthStatus: (): Promise<Record<string, ProviderStatus>> => ipcRenderer.invoke('get-provider-auth-status'),
  getProviderAccessToken: (providerId: string): Promise<string | null> => ipcRenderer.invoke('get-provider-access-token', providerId),
  logoutProvider: (providerId: string): Promise<void> => ipcRenderer.invoke('logout-provider', providerId),
  getProviderTokens: (providerId: string): Promise<any> => ipcRenderer.invoke('get-provider-tokens', providerId),
  refreshProviderTokens: (providerId: string): Promise<boolean> => ipcRenderer.invoke('refresh-provider-tokens', providerId),
  clearAllProviderTokens: (): Promise<void> => ipcRenderer.invoke('clear-all-provider-tokens'),
  getOAuthStorageInfo: (): Promise<any> => ipcRenderer.invoke('get-oauth-storage-info'),

  // OAuth Provider event listeners
  onProviderAuthSuccess: (callback: (event: IpcRendererEvent, data: any) => void): void => {
    ipcRenderer.on('provider-auth-success', callback);
  },
  onProviderAuthError: (callback: (event: IpcRendererEvent, error: any) => void): void => {
    ipcRenderer.on('provider-auth-error', callback);
  },
  onProviderAuthLogout: (callback: (event: IpcRendererEvent, data: any) => void): void => {
    ipcRenderer.on('provider-auth-logout', callback);
  },

  // Server Provider management
  addServerProvider: (server: any): Promise<void> => ipcRenderer.invoke('add-server-provider', server),
  removeServerProvider: (serverId: string): Promise<void> => ipcRenderer.invoke('remove-server-provider', serverId),
  getServerProviders: (): Promise<any[]> => ipcRenderer.invoke('get-server-providers'),
  fetchServerProviders: (serverId: string): Promise<any[]> => ipcRenderer.invoke('fetch-server-providers', serverId),
  startServerProviderOAuth: (serverId: string, provider: string): Promise<void> => ipcRenderer.invoke('start-server-provider-oauth', serverId, provider),

  // WebSocket key management
  getWSConnectionKey: (): Promise<string | null> => ipcRenderer.invoke('get-ws-connection-key'),
  getWSConnectionUrl: (): Promise<string> => ipcRenderer.invoke('get-ws-connection-url'),
  regenerateWSKey: (): Promise<{ key: string; createdAt: number }> => ipcRenderer.invoke('regenerate-ws-key'),
  // Window control
  closeWindow: (): Promise<void> => ipcRenderer.invoke('window-close'),
  getWSKeyInfo: (): Promise<{ key: string | null; createdAt: number | null; keyFile: string }> => ipcRenderer.invoke('get-ws-key-info'),
  onWSKeyGenerated: (callback: (event: IpcRendererEvent, data: { key: string; createdAt: number }) => void): void => {
    ipcRenderer.on('ws-key-generated', callback);
  },

  // Encryption key management
  getEncryptionKey: (): Promise<string | null> => ipcRenderer.invoke('get-encryption-key'),
  regenerateEncryptionKey: (): Promise<{ key: string; createdAt: number; source: string }> => ipcRenderer.invoke('regenerate-encryption-key'),
  getEncryptionKeyInfo: (): Promise<{ key: string | null; createdAt: number | null; keyFile: string; source: 'environment' | 'generated' | null }> => ipcRenderer.invoke('get-encryption-key-info'),
  onEncryptionKeyGenerated: (callback: (event: IpcRendererEvent, data: { key: string; createdAt: number; source: string }) => void): void => {
    ipcRenderer.on('encryption-key-generated', callback);
  }
} as ElectronAPI);

// Extend the global Window interface
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}