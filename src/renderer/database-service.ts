import Dexie, { Table } from 'dexie'
import { CollectionRequest, Message, ShareMessage } from '../types'

/**
 * IndexedDB table interfaces for internal storage
 */
interface DbMessage {
  id: string
  title: string
  body: string
  timestamp: number
  priority: string | null
  sender: string | null
  read: boolean
  status: string | null
  feedback: string | null
  requiresResponse: boolean
  codeEval: boolean
  code: string | null
  explanation: string | null
  type: string | null
  risk_level: string | null
  codespaceResponse: string | null
}

interface DbShareMessage {
  id: string
  type: string
  title: string
  body: string
  timestamp: number
  priority: string | null
  sender: string | null
  read: boolean
  status: string | null
  requiresResponse: boolean
  collectionRequest: string
}

/**
 * Dexie database class for managing messages using IndexedDB
 */
class AppDatabase extends Dexie {
  messages!: Table<DbMessage, string>
  shareMessages!: Table<DbShareMessage, string>

  constructor() {
    super('KeyboardMCPDatabase')

    this.version(1).stores({
      messages: 'id, timestamp, status',
      shareMessages: 'id, timestamp, status',
    })
  }
}

/**
 * Database service for managing messages using IndexedDB
 */
export class DatabaseService {
  private db: AppDatabase
  private initialized = false

  constructor() {
    this.db = new AppDatabase()
  }

  /**
   * Initialize the database connection
   */
  async initialize(): Promise<void> {
    try {
      // Try to open the database
      // This will fail gracefully if IndexedDB is not available (e.g., in Node.js/Electron main process)
      await this.db.open()

      this.initialized = true

      const messageCount = await this.db.messages.count()
      const shareMessageCount = await this.db.shareMessages.count()
      console.log(`📨 Connected to database: ${messageCount} messages and ${shareMessageCount} share messages`)
    }
    catch (error) {
      // Check if error is due to missing IndexedDB API
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('IndexedDB') || errorMessage.includes('MissingAPIError')) {
        console.warn('⚠️  IndexedDB not available in this environment (running in Node.js/main process)')
        console.log('📨 Database service running in compatibility mode without persistent storage')
      }
      else {
        console.error('❌ Error initializing database:', error)
        console.log('📨 Continuing without database - data will not persist')
      }
      this.initialized = false
      // Don't throw - allow the app to continue without persistent storage
    }
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    if (this.initialized) {
      this.db.close()
      this.initialized = false
    }
  }

  /**
   * Get all messages with optional filtering and ordering
   */
  async findAllMessages(options?: {
    where?: { status?: string | null, status_not?: string }
    orderBy?: { timestamp?: 'asc' | 'desc' }
  }): Promise<Message[]> {
    if (!this.initialized) {
      return []
    }

    let collection = this.db.messages.toCollection()

    // Apply filters
    if (options?.where) {
      if (options.where.status) {
        collection = this.db.messages.where('status').equals(options.where.status)
      }
      else if (options.where.status_not) {
        collection = this.db.messages.where('status').notEqual(options.where.status_not)
      }
    }

    // Get all items
    let messages = await collection.toArray()

    // Apply ordering
    if (options?.orderBy?.timestamp) {
      messages = messages.sort((a: DbMessage, b: DbMessage) => {
        if (options.orderBy!.timestamp === 'asc') {
          return a.timestamp - b.timestamp
        }
        return b.timestamp - a.timestamp
      })
    }

    return messages.map((msg: DbMessage) => this.convertDbMessageToMessage(msg))
  }

  /**
   * Get all share messages with optional filtering and ordering
   */
  async findAllShareMessages(options?: {
    where?: { status?: string | null, status_not?: string }
    orderBy?: { timestamp?: 'asc' | 'desc' }
  }): Promise<ShareMessage[]> {
    if (!this.initialized) {
      return []
    }

    let collection = this.db.shareMessages.toCollection()

    // Apply filters
    if (options?.where) {
      if (options.where.status) {
        collection = this.db.shareMessages.where('status').equals(options.where.status)
      }
      else if (options.where.status_not) {
        collection = this.db.shareMessages.where('status').notEqual(options.where.status_not)
      }
    }

    // Get all items
    let shareMessages = await collection.toArray()

    // Apply ordering
    if (options?.orderBy?.timestamp) {
      shareMessages = shareMessages.sort((a: DbShareMessage, b: DbShareMessage) => {
        if (options.orderBy!.timestamp === 'asc') {
          return a.timestamp - b.timestamp
        }
        return b.timestamp - a.timestamp
      })
    }

    return shareMessages.map((msg: DbShareMessage) => this.convertDbShareMessageToShareMessage(msg))
  }

  /**
   * Create a new message
   */
  async createMessage(message: Message): Promise<Message> {
    const dbMessage = this.convertMessageToDbMessage(message)

    await this.db.messages.add(dbMessage)

    return this.convertDbMessageToMessage(dbMessage)
  }

  /**
   * Create a new share message
   */
  async createShareMessage(shareMessage: ShareMessage): Promise<ShareMessage> {
    const dbShareMessage = this.convertShareMessageToDbShareMessage(shareMessage)

    await this.db.shareMessages.add(dbShareMessage)

    return this.convertDbShareMessageToShareMessage(dbShareMessage)
  }

  /**
   * Update a message
   */
  async updateMessage(messageId: string, updates: Partial<Message>): Promise<Message | null> {
    try {
      const data = this.convertMessageUpdatesToDbMessageUpdates(updates)

      await this.db.messages.update(messageId, data)

      const updated = await this.db.messages.get(messageId)
      return updated ? this.convertDbMessageToMessage(updated) : null
    }
    catch (error) {
      console.error('Error updating message:', error)
      return null
    }
  }

  /**
   * Update a share message
   */
  async updateShareMessage(messageId: string, updates: Partial<ShareMessage>): Promise<ShareMessage | null> {
    try {
      const data = this.convertShareMessageUpdatesToDbShareMessageUpdates(updates)

      await this.db.shareMessages.update(messageId, data)

      const updated = await this.db.shareMessages.get(messageId)
      return updated ? this.convertDbShareMessageToShareMessage(updated) : null
    }
    catch (error) {
      console.error('Error updating share message:', error)
      return null
    }
  }

  /**
   * Delete a message by ID
   */
  async deleteMessageById(messageId: string): Promise<boolean> {
    try {
      await this.db.messages.delete(messageId)
      return true
    }
    catch {
      return false
    }
  }

  /**
   * Delete messages matching criteria
   */
  async deleteMessages(where: { status?: string, status_not?: string }): Promise<number> {
    let collection = this.db.messages.toCollection()

    if (where.status) {
      collection = this.db.messages.where('status').equals(where.status)
    }
    else if (where.status_not) {
      collection = this.db.messages.where('status').notEqual(where.status_not)
    }

    return await collection.delete()
  }

  /**
   * Delete all messages
   */
  async deleteAllMessages(): Promise<void> {
    await this.db.messages.clear()
  }

  /**
   * Delete all share messages
   */
  async deleteAllShareMessages(): Promise<void> {
    await this.db.shareMessages.clear()
  }

  /**
   * Find a message by ID
   */
  async findMessageById(messageId: string): Promise<Message | undefined> {
    const message = await this.db.messages.get(messageId)
    return message ? this.convertDbMessageToMessage(message) : undefined
  }

  /**
   * Find a share message by ID
   */
  async findShareMessageById(messageId: string): Promise<ShareMessage | undefined> {
    const shareMessage = await this.db.shareMessages.get(messageId)
    return shareMessage ? this.convertDbShareMessageToShareMessage(shareMessage) : undefined
  }

  /**
   * Count messages with optional filtering
   */
  async countMessages(where?: { status?: string | null, OR?: Array<{ status: string | null }> }): Promise<number> {
    if (!this.initialized) {
      return 0
    }

    if (!where) {
      return await this.db.messages.count()
    }

    // Handle OR conditions
    if (where.OR) {
      const statuses = where.OR.map(condition => condition.status).filter((s): s is string => s !== null)
      return await this.db.messages
        .where('status')
        .anyOf(statuses)
        .count()
    }

    // Handle simple status filter
    if (where.status !== undefined) {
      if (where.status === null) {
        return await this.db.messages.filter(m => m.status === null).count()
      }
      return await this.db.messages
        .where('status')
        .equals(where.status)
        .count()
    }

    return await this.db.messages.count()
  }

  /**
   * Count share messages with optional filtering
   */
  async countShareMessages(where?: { status?: string | null, OR?: Array<{ status: string | null }> }): Promise<number> {
    if (!this.initialized) {
      return 0
    }

    if (!where) {
      return await this.db.shareMessages.count()
    }

    // Handle OR conditions
    if (where.OR) {
      const statuses = where.OR.map(condition => condition.status).filter((s): s is string => s !== null)
      return await this.db.shareMessages
        .where('status')
        .anyOf(statuses)
        .count()
    }

    // Handle simple status filter
    if (where.status !== undefined) {
      if (where.status === null) {
        return await this.db.shareMessages.filter(m => m.status === null).count()
      }
      return await this.db.shareMessages
        .where('status')
        .equals(where.status)
        .count()
    }

    return await this.db.shareMessages.count()
  }

  /**
   * Convert partial Message updates to database message updates
   */
  private convertMessageUpdatesToDbMessageUpdates(updates: Partial<Message>): Partial<DbMessage> {
    const data: Partial<DbMessage> = {}

    // Map updates to database fields
    if (updates.title !== undefined) data.title = updates.title
    if (updates.body !== undefined) data.body = updates.body
    if (updates.timestamp !== undefined) data.timestamp = updates.timestamp
    if (updates.priority !== undefined) data.priority = updates.priority
    if (updates.sender !== undefined) data.sender = updates.sender
    if (updates.read !== undefined) data.read = updates.read
    if (updates.status !== undefined) data.status = updates.status
    if (updates.feedback !== undefined) data.feedback = updates.feedback
    if (updates.requiresResponse !== undefined) data.requiresResponse = updates.requiresResponse
    if (updates.codeEval !== undefined) data.codeEval = updates.codeEval
    if (updates.code !== undefined) data.code = updates.code
    if (updates.explanation !== undefined) data.explanation = updates.explanation
    if (updates.type !== undefined) data.type = updates.type
    if (updates.risk_level !== undefined) data.risk_level = updates.risk_level
    if (updates.codespaceResponse !== undefined) {
      data.codespaceResponse = JSON.stringify(updates.codespaceResponse)
    }

    return data
  }

  /**
   * Convert partial ShareMessage updates to database share message updates
   */
  private convertShareMessageUpdatesToDbShareMessageUpdates(updates: Partial<ShareMessage>): Partial<DbShareMessage> {
    const data: Partial<DbShareMessage> = {}

    // Map updates to database fields
    if (updates.type !== undefined) data.type = updates.type
    if (updates.title !== undefined) data.title = updates.title
    if (updates.body !== undefined) data.body = updates.body
    if (updates.timestamp !== undefined) data.timestamp = updates.timestamp
    if (updates.priority !== undefined) data.priority = updates.priority
    if (updates.sender !== undefined) data.sender = updates.sender
    if (updates.read !== undefined) data.read = updates.read
    if (updates.status !== undefined) data.status = updates.status
    if (updates.requiresResponse !== undefined) data.requiresResponse = updates.requiresResponse
    if (updates.collectionRequest !== undefined) {
      data.collectionRequest = JSON.stringify(updates.collectionRequest)
    }

    return data
  }

  /**
   * Convert Message to database message
   */
  private convertMessageToDbMessage(message: Message): DbMessage {
    return {
      id: message.id,
      title: message.title,
      body: message.body,
      timestamp: message.timestamp,
      priority: message.priority || null,
      sender: message.sender || null,
      read: message.read || false,
      status: message.status || null,
      feedback: message.feedback || null,
      requiresResponse: message.requiresResponse || false,
      codeEval: message.codeEval || false,
      code: message.code || null,
      explanation: message.explanation || null,
      type: message.type || null,
      risk_level: message.risk_level || null,
      codespaceResponse: message.codespaceResponse ? JSON.stringify(message.codespaceResponse) : null,
    }
  }

  /**
   * Convert database message to Message type
   */
  private convertDbMessageToMessage(dbMessage: DbMessage): Message {
    return {
      id: dbMessage.id,
      title: dbMessage.title,
      body: dbMessage.body,
      timestamp: dbMessage.timestamp,
      priority: dbMessage.priority as Message['priority'],
      sender: dbMessage.sender || undefined,
      read: dbMessage.read,
      status: dbMessage.status as Message['status'],
      feedback: dbMessage.feedback || undefined,
      requiresResponse: dbMessage.requiresResponse,
      codeEval: dbMessage.codeEval,
      code: dbMessage.code || undefined,
      explanation: dbMessage.explanation || undefined,
      type: dbMessage.type || undefined,
      risk_level: dbMessage.risk_level as Message['risk_level'],
      codespaceResponse: dbMessage.codespaceResponse
        ? JSON.parse(dbMessage.codespaceResponse)
        : undefined,
    }
  }

  /**
   * Convert ShareMessage to database share message
   */
  private convertShareMessageToDbShareMessage(shareMessage: ShareMessage): DbShareMessage {
    return {
      id: shareMessage.id,
      type: shareMessage.type || 'collection-share',
      title: shareMessage.title,
      body: shareMessage.body,
      timestamp: shareMessage.timestamp,
      priority: shareMessage.priority || null,
      sender: shareMessage.sender || null,
      read: shareMessage.read || false,
      status: shareMessage.status || null,
      requiresResponse: shareMessage.requiresResponse || false,
      collectionRequest: JSON.stringify(shareMessage.collectionRequest),
    }
  }

  /**
   * Convert database share message to ShareMessage type
   */
  private convertDbShareMessageToShareMessage(dbShareMessage: DbShareMessage): ShareMessage {
    return {
      id: dbShareMessage.id,
      type: dbShareMessage.type as 'collection-share',
      title: dbShareMessage.title,
      body: dbShareMessage.body,
      timestamp: dbShareMessage.timestamp,
      priority: dbShareMessage.priority as ShareMessage['priority'],
      sender: dbShareMessage.sender || undefined,
      read: dbShareMessage.read,
      status: dbShareMessage.status as ShareMessage['status'],
      requiresResponse: dbShareMessage.requiresResponse,
      collectionRequest: JSON.parse(dbShareMessage.collectionRequest) as CollectionRequest,
    }
  }
}
