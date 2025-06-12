import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export interface Message {
  id: string;
  title: string;
  body: string;
  timestamp: number;
  priority?: 'low' | 'normal' | 'high';
  sender?: string;
  read?: boolean;
}

export interface ElectronAPI {
  getMessages: () => Promise<Message[]>;
  markMessageRead: (messageId: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  showMessages: () => void;
  onShowMessage: (callback: (event: IpcRendererEvent, message: Message) => void) => void;
  removeAllListeners: (channel: string) => void;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getMessages: (): Promise<Message[]> => ipcRenderer.invoke('get-messages'),
  markMessageRead: (messageId: string): Promise<void> => ipcRenderer.invoke('mark-message-read', messageId),
  deleteMessage: (messageId: string): Promise<void> => ipcRenderer.invoke('delete-message', messageId),
  showMessages: (): void => ipcRenderer.send('show-messages'),
  
  // Listen for messages from main process
  onShowMessage: (callback: (event: IpcRendererEvent, message: Message) => void): void => {
    ipcRenderer.on('show-message', callback);
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