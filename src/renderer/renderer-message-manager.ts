import { ipcRenderer } from 'electron'
import { Message, ShareMessage } from '../types'
import { DatabaseService } from './database-service'

/**
 * RendererMessageManager - Handles all database operations in the renderer process
 * Exposes IPC handlers for the main process to interact with the database
 */
export class RendererMessageManager {
  private db: DatabaseService
  private initialized = false

  constructor() {
    this.db = new DatabaseService()
  }

  /**
   * Initialize the database and set up IPC handlers for main process
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      await this.db.initialize()
      this.initialized = true
      console.log('✅ Renderer database initialized')

      // Set up IPC handlers for main process to call
      this.setupIPCHandlers()
    }
    catch (error) {
      console.error('❌ Failed to initialize renderer database:', error)
      throw error
    }
  }

  /**
   * Set up IPC handlers for main process → renderer communication
   */
  private setupIPCHandlers(): void {
    // Handle add message requests from main process
    ipcRenderer.on('db:add-message', async (_event, message: Message) => {
      try {
        await this.addMessage(message)
      }
      catch (error) {
        console.error('Error adding message from main process:', error)
      }
    })

    // Handle add share message requests from main process
    ipcRenderer.on('db:add-share-message', async (_event, shareMessage: ShareMessage) => {
      try {
        await this.addShareMessage(shareMessage)
      }
      catch (error) {
        console.error('Error adding share message from main process:', error)
      }
    })

    // Handle update message requests from main process
    ipcRenderer.on('db:update-message', async (_event, messageId: string, updates: Partial<Message>) => {
      try {
        await this.updateMessage(messageId, updates)
      }
      catch (error) {
        console.error('Error updating message from main process:', error)
      }
    })

    // Handle update share message requests from main process
    ipcRenderer.on('db:update-share-message', async (_event, messageId: string, updates: Partial<ShareMessage>) => {
      try {
        await this.updateShareMessage(messageId, updates)
      }
      catch (error) {
        console.error('Error updating share message from main process:', error)
      }
    })

    // Handle get messages requests from main process (request/response pattern)
    ipcRenderer.on('db:get-messages-request', async (_event, requestId: string) => {
      try {
        const messages = await this.getMessages()
        ipcRenderer.send('db:get-messages-response', requestId, messages)
      }
      catch (error) {
        console.error('Error getting messages from main process:', error)
        ipcRenderer.send('db:get-messages-response', requestId, [])
      }
    })

    // Handle get pending count requests from main process (request/response pattern)
    ipcRenderer.on('db:get-pending-count-request', async (_event, requestId: string) => {
      try {
        const count = await this.getPendingCount()
        ipcRenderer.send('db:get-pending-count-response', requestId, count)
      }
      catch (error) {
        console.error('Error getting pending count from main process:', error)
        ipcRenderer.send('db:get-pending-count-response', requestId, 0)
      }
    })

    // Handle clear all messages requests from main process (fire-and-forget)
    ipcRenderer.on('db:clear-all-messages', async () => {
      try {
        await this.clearAllMessages()
      }
      catch (error) {
        console.error('Error clearing all messages from main process:', error)
      }
    })

    console.log('✅ IPC handlers set up for main → renderer database operations')
  }

  /**
   * Get all messages sorted by timestamp (newest first)
   */
  async getMessages(): Promise<Message[]> {
    if (!this.initialized) {
      console.warn('Database not initialized, returning empty array')
      return []
    }

    return await this.db.findAllMessages({
      orderBy: { timestamp: 'desc' },
    })
  }

  /**
   * Get all share messages sorted by timestamp (newest first)
   */
  async getShareMessages(): Promise<ShareMessage[]> {
    if (!this.initialized) {
      console.warn('Database not initialized, returning empty array')
      return []
    }

    return await this.db.findAllShareMessages({
      orderBy: { timestamp: 'desc' },
    })
  }

  /**
   * Add a new message
   */
  async addMessage(message: Message): Promise<void> {
    if (!this.initialized) {
      console.warn('Database not initialized, cannot add message')
      return
    }

    await this.db.createMessage(message)

    // Notify main process that pending count may have changed
    ipcRenderer.send('db:pending-count-changed')
  }

  /**
   * Add a new share message
   */
  async addShareMessage(shareMessage: ShareMessage): Promise<void> {
    if (!this.initialized) {
      console.warn('Database not initialized, cannot add share message')
      return
    }

    await this.db.createShareMessage(shareMessage)

    // Notify main process that pending count may have changed
    ipcRenderer.send('db:pending-count-changed')
  }

  /**
   * Update a message
   */
  async updateMessage(messageId: string, updates: Partial<Message>): Promise<Message | null> {
    if (!this.initialized) {
      console.warn('Database not initialized, cannot update message')
      return null
    }

    const result = await this.db.updateMessage(messageId, updates)

    // Notify main process that pending count may have changed
    ipcRenderer.send('db:pending-count-changed')

    return result
  }

  /**
   * Update a share message
   */
  async updateShareMessage(messageId: string, updates: Partial<ShareMessage>): Promise<ShareMessage | null> {
    if (!this.initialized) {
      console.warn('Database not initialized, cannot update share message')
      return null
    }

    const result = await this.db.updateShareMessage(messageId, updates)

    // Notify main process that pending count may have changed
    ipcRenderer.send('db:pending-count-changed')

    return result
  }

  /**
   * Delete a message by ID
   */
  async deleteMessage(messageId: string): Promise<boolean> {
    if (!this.initialized) {
      console.warn('Database not initialized, cannot delete message')
      return false
    }

    const result = await this.db.deleteMessageById(messageId)

    // Notify main process that pending count may have changed
    ipcRenderer.send('db:pending-count-changed')

    return result
  }

  /**
   * Delete all non-pending messages (business logic: keep only pending)
   */
  async deleteNonPendingMessages(): Promise<void> {
    if (!this.initialized) {
      console.warn('Database not initialized, cannot delete messages')
      return
    }

    await this.db.deleteMessages({ status_not: 'pending' })

    // Notify main process that pending count may have changed
    ipcRenderer.send('db:pending-count-changed')
  }

  /**
   * Mark a message as read (business logic: set read flag to true)
   */
  async markMessageRead(messageId: string): Promise<boolean> {
    if (!this.initialized) {
      console.warn('Database not initialized, cannot mark message read')
      return false
    }

    const updated = await this.db.updateMessage(messageId, { read: true })
    return updated !== null
  }

  /**
   * Clear all messages and share messages
   */
  async clearAllMessages(): Promise<void> {
    if (!this.initialized) {
      console.warn('Database not initialized, cannot clear messages')
      return
    }

    await this.db.deleteAllMessages()
    await this.db.deleteAllShareMessages()

    // Notify main process that pending count may have changed
    ipcRenderer.send('db:pending-count-changed')
  }

  /**
   * Get the count of pending messages (business logic: pending or null status)
   */
  async getPendingCount(): Promise<number> {
    if (!this.initialized) {
      return 0
    }

    const pendingMessages = await this.db.countMessages({
      OR: [
        { status: 'pending' },
        { status: null },
      ],
    })

    const pendingShareMessages = await this.db.countShareMessages({
      OR: [
        { status: 'pending' },
        { status: null },
      ],
    })

    return pendingMessages + pendingShareMessages
  }

  /**
   * Find a message by ID
   */
  async findMessage(messageId: string): Promise<Message | undefined> {
    if (!this.initialized) {
      return undefined
    }

    return await this.db.findMessageById(messageId)
  }

  /**
   * Find a share message by ID
   */
  async findShareMessage(messageId: string): Promise<ShareMessage | undefined> {
    if (!this.initialized) {
      return undefined
    }

    return await this.db.findShareMessageById(messageId)
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    if (this.initialized) {
      await this.db.disconnect()
      this.initialized = false
    }
  }
}
