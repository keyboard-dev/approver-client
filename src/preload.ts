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
  skipAuth?: boolean;
}

export interface AuthError {
  message: string;
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
  startOAuth: () => Promise<void>;
  getAuthStatus: () => Promise<AuthStatus>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  onAuthSuccess: (callback: (event: IpcRendererEvent, data: AuthStatus) => void) => void;
  onAuthError: (callback: (event: IpcRendererEvent, error: AuthError) => void) => void;
  onAuthLogout: (callback: (event: IpcRendererEvent) => void) => void;
  // Window control methods
  windowClose: () => Promise<void>;
  windowToggleVisibility: () => Promise<void>;
  windowSetOpacity: (opacity: number) => Promise<void>;
  windowResize: (dimensions: { width: number; height: number }) => Promise<void>;
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
  
  // OAuth-related functions
  startOAuth: (): Promise<void> => ipcRenderer.invoke('start-oauth'),
  getAuthStatus: (): Promise<AuthStatus> => ipcRenderer.invoke('get-auth-status'),
  logout: (): Promise<void> => ipcRenderer.invoke('logout'),
  getAccessToken: (): Promise<string | null> => ipcRenderer.invoke('get-access-token'),
  
  // OAuth event listeners
  onAuthSuccess: (callback: (event: IpcRendererEvent, data: AuthStatus) => void): void => {
    ipcRenderer.on('auth-success', callback);
  },
  onAuthError: (callback: (event: IpcRendererEvent, error: AuthError) => void): void => {
    ipcRenderer.on('auth-error', callback);
  },
  onAuthLogout: (callback: (event: IpcRendererEvent) => void): void => {
    ipcRenderer.on('auth-logout', callback);
  },
  
  // Window control methods
  windowClose: (): Promise<void> => ipcRenderer.invoke('window-close'),
  windowToggleVisibility: (): Promise<void> => ipcRenderer.invoke('window-toggle-visibility'),
  windowSetOpacity: (opacity: number): Promise<void> => ipcRenderer.invoke('window-set-opacity', opacity),
  windowResize: (dimensions: { width: number; height: number }): Promise<void> => ipcRenderer.invoke('window-resize', dimensions)
} as ElectronAPI);

// Extend the global Window interface
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
} 