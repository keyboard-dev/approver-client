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
  }
} as ElectronAPI);

// Extend the global Window interface
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
} 