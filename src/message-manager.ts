import { BrowserWindow, ipcMain } from 'electron'
import { Message, ShareMessage } from './types'

export class MessageManager {
  private mainWindow: BrowserWindow | null = null
  private requestCounter = 0

  constructor() {
    // No database service needed - renderer owns the database
  }

  /**
   * Set the main window reference for IPC communication
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  /**
   * Initialize - no-op since renderer owns database initialization
   */
  async initialize(): Promise<void> {
    // Renderer will initialize the database
    console.log('MessageManager initialized (database in renderer process)')
  }

  /**
   * Add a new message - sends to renderer for storage
   */
  async addMessage(message: Message): Promise<void> {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.warn('Main window not available, cannot add message to database')
      return
    }

    this.mainWindow.webContents.send('db:add-message', message)
  }

  /**
   * Add a new share message - sends to renderer for storage
   */
  async addShareMessage(shareMessage: ShareMessage): Promise<void> {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.warn('Main window not available, cannot add share message to database')
      return
    }

    this.mainWindow.webContents.send('db:add-share-message', shareMessage)
  }

  /**
   * Update a message - sends to renderer for update
   */
  async updateMessage(messageId: string, updates: Partial<Message>): Promise<Message | null> {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.warn('Main window not available, cannot update message')
      return null
    }

    this.mainWindow.webContents.send('db:update-message', messageId, updates)
    return null // Async operation, no return value needed for main process use cases
  }

  /**
   * Update a share message - sends to renderer for update
   */
  async updateShareMessage(messageId: string, updates: Partial<ShareMessage>): Promise<ShareMessage | null> {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.warn('Main window not available, cannot update share message')
      return null
    }

    this.mainWindow.webContents.send('db:update-share-message', messageId, updates)
    return null // Async operation, no return value needed for main process use cases
  }

  /**
   * Get all messages - requests from renderer
   */
  async getMessages(): Promise<Message[]> {
    return this.requestFromRenderer<Message[]>('db:get-messages', 5000)
  }

  /**
   * Get pending message count - requests from renderer
   */
  async getPendingCount(): Promise<number> {
    return this.requestFromRenderer<number>('db:get-pending-count', 5000)
  }

  /**
   * Clear all messages - sends to renderer (fire-and-forget)
   */
  async clearAllMessages(): Promise<void> {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.warn('Main window not available, cannot clear messages')
      return
    }

    this.mainWindow.webContents.send('db:clear-all-messages')
  }

  /**
   * Generic helper to request data from renderer process
   * Implements request/response IPC pattern with timeout
   */
  private requestFromRenderer<T>(channel: string, timeout: number = 5000): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.mainWindow || this.mainWindow.isDestroyed()) {
        reject(new Error('Main window not available'))
        return
      }

      // Generate unique request ID
      const requestId = `${channel}-${++this.requestCounter}-${Date.now()}`
      const responseChannel = `${channel}-response`

      // Set up timeout
      const timeoutId = setTimeout(() => {
        ipcMain.removeHandler(responseChannel)
        reject(new Error(`Request timeout for ${channel}`))
      }, timeout)

      // Listen for response (one-time listener)
      ipcMain.once(responseChannel, (_event, receivedRequestId: string, data: T) => {
        if (receivedRequestId === requestId) {
          clearTimeout(timeoutId)
          resolve(data)
        }
      })

      // Send request to renderer
      this.mainWindow.webContents.send(`${channel}-request`, requestId)
    })
  }
}
