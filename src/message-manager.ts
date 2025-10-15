import * as WebSocket from 'ws'
import { DatabaseService } from './database-service'
import { CollectionRequest, Message, ShareMessage } from './types'

export class MessageManager {
  private db: DatabaseService

  constructor(databaseService: DatabaseService) {
    this.db = databaseService
  }

  /**
   * Initialize and load messages from database
   */
  async initialize(): Promise<void> {
    await this.db.initialize()
  }

  /**
   * Get all messages sorted by timestamp (newest first)
   */
  async getMessages(): Promise<Message[]> {
    return await this.db.findAllMessages({
      orderBy: { timestamp: 'desc' },
    })
  }

  /**
   * Get all share messages sorted by timestamp (newest first)
   */
  async getShareMessages(): Promise<ShareMessage[]> {
    return await this.db.findAllShareMessages({
      orderBy: { timestamp: 'desc' },
    })
  }

  /**
   * Add a new message
   */
  async addMessage(message: Message): Promise<void> {
    await this.db.createMessage(message)
  }

  /**
   * Add a new share message
   */
  async addShareMessage(shareMessage: ShareMessage): Promise<void> {
    await this.db.createShareMessage(shareMessage)
  }

  /**
   * Update a message
   */
  async updateMessage(messageId: string, updates: Partial<Message>): Promise<Message | null> {
    return await this.db.updateMessage(messageId, updates)
  }

  /**
   * Update a share message
   */
  async updateShareMessage(messageId: string, updates: Partial<ShareMessage>): Promise<ShareMessage | null> {
    return await this.db.updateShareMessage(messageId, updates)
  }

  /**
   * Delete a message by ID
   */
  async deleteMessage(messageId: string): Promise<boolean> {
    return await this.db.deleteMessageById(messageId)
  }

  /**
   * Delete all non-pending messages (business logic: keep only pending)
   */
  async deleteNonPendingMessages(): Promise<void> {
    await this.db.deleteMessages({ status_not: 'pending' })
  }

  /**
   * Mark a message as read (business logic: set read flag to true)
   */
  async markMessageRead(messageId: string): Promise<boolean> {
    const updated = await this.db.updateMessage(messageId, { read: true })
    return updated !== null
  }

  /**
   * Clear all messages and share messages
   */
  async clearAllMessages(): Promise<void> {
    await this.db.deleteAllMessages()
    await this.db.deleteAllShareMessages()
  }

  /**
   * Get the count of pending messages (business logic: pending or null status)
   */
  async getPendingCount(): Promise<number> {
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
    return await this.db.findMessageById(messageId)
  }

  /**
   * Find a share message by ID
   */
  async findShareMessage(messageId: string): Promise<ShareMessage | undefined> {
    return await this.db.findShareMessageById(messageId)
  }

  /**
   * Send WebSocket response for a message
   */
  sendWebSocketResponse(message: Message, wsServer: WebSocket.Server | null): void {
    if (wsServer && message.requiresResponse) {
      // Send response to all connected WebSocket clients
      wsServer.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message))
        }
      })
    }
  }

  /**
   * Send collection share response via WebSocket
   */
  sendCollectionShareResponse(
    shareMessage: ShareMessage,
    status: 'approved' | 'rejected',
    wsServer: WebSocket.Server | null,
    updatedRequest?: CollectionRequest,
  ): void {
    if (wsServer) {
      const response = {
        type: 'collection-share-response',
        id: shareMessage.id,
        status: status,
        timestamp: Date.now(),
        data: status === 'approved' ? updatedRequest : null,
      }

      // Send response to all connected WebSocket clients
      wsServer.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(response))
        }
      })
    }
  }
}
