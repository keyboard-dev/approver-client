import { PrismaClient } from '@prisma/client'
import * as os from 'os'
import * as path from 'path'
import { CollectionRequest, Message, ShareMessage } from './types'

/**
 * Database service for managing messages using Prisma and SQLite
 */
export class DatabaseService {
  private prisma: PrismaClient
  private initialized = false

  constructor() {
    const dbPath = path.join(os.homedir(), '.keyboard-mcp', '.keyboard-mcp-messages.db')
    const databaseUrl = `file:${dbPath}`

    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    })
  }

  /**
   * Initialize the database connection
   */
  async initialize(): Promise<void> {
    try {
      // Test the connection
      await this.prisma.$connect()
      this.initialized = true

      const messageCount = await this.prisma.message.count()
      const shareMessageCount = await this.prisma.shareMessage.count()
      console.log(`📨 Connected to database: ${messageCount} messages and ${shareMessageCount} share messages`)
    }
    catch (error) {
      console.error('❌ Error initializing database:', error)
      throw error
    }
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    if (this.initialized) {
      await this.prisma.$disconnect()
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
    const messages = await this.prisma.message.findMany({
      where: options?.where,
      orderBy: options?.orderBy,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return messages.map((msg: any) => this.convertDbMessageToMessage(msg))
  }

  /**
   * Get all share messages with optional filtering and ordering
   */
  async findAllShareMessages(options?: {
    where?: { status?: string | null, status_not?: string }
    orderBy?: { timestamp?: 'asc' | 'desc' }
  }): Promise<ShareMessage[]> {
    const shareMessages = await this.prisma.shareMessage.findMany({
      where: options?.where,
      orderBy: options?.orderBy,
    })

    // Prisma-generated types, using any for brevity
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return shareMessages.map((msg: any) => this.convertDbShareMessageToShareMessage(msg))
  }

  /**
   * Create a new message
   */
  async createMessage(message: Message): Promise<Message> {
    const created = await this.prisma.message.create({
      data: {
        id: message.id,
        title: message.title,
        body: message.body,
        timestamp: BigInt(message.timestamp),
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
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.convertDbMessageToMessage(created as any)
  }

  /**
   * Create a new share message
   */
  async createShareMessage(shareMessage: ShareMessage): Promise<ShareMessage> {
    const created = await this.prisma.shareMessage.create({
      data: {
        id: shareMessage.id,
        type: shareMessage.type || 'collection-share',
        title: shareMessage.title,
        body: shareMessage.body,
        timestamp: BigInt(shareMessage.timestamp),
        priority: shareMessage.priority || null,
        sender: shareMessage.sender || null,
        read: shareMessage.read || false,
        status: shareMessage.status || null,
        requiresResponse: shareMessage.requiresResponse || false,
        collectionRequest: JSON.stringify(shareMessage.collectionRequest),
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.convertDbShareMessageToShareMessage(created as any)
  }

  /**
   * Update a message
   */
  async updateMessage(messageId: string, updates: Partial<Message>): Promise<Message | null> {
    try {
      const data: Record<string, unknown> = {}

      // Map updates to database fields
      if (updates.title !== undefined) data.title = updates.title
      if (updates.body !== undefined) data.body = updates.body
      if (updates.timestamp !== undefined) data.timestamp = BigInt(updates.timestamp)
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

      const updated = await this.prisma.message.update({
        where: { id: messageId },
        data,
      })

      return this.convertDbMessageToMessage(updated)
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
      const data: Record<string, unknown> = {}

      // Map updates to database fields
      if (updates.type !== undefined) data.type = updates.type
      if (updates.title !== undefined) data.title = updates.title
      if (updates.body !== undefined) data.body = updates.body
      if (updates.timestamp !== undefined) data.timestamp = BigInt(updates.timestamp)
      if (updates.priority !== undefined) data.priority = updates.priority
      if (updates.sender !== undefined) data.sender = updates.sender
      if (updates.read !== undefined) data.read = updates.read
      if (updates.status !== undefined) data.status = updates.status
      if (updates.requiresResponse !== undefined) data.requiresResponse = updates.requiresResponse
      if (updates.collectionRequest !== undefined) {
        data.collectionRequest = JSON.stringify(updates.collectionRequest)
      }

      const updated = await this.prisma.shareMessage.update({
        where: { id: messageId },
        data,
      })

      return this.convertDbShareMessageToShareMessage(updated)
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
      await this.prisma.message.delete({
        where: { id: messageId },
      })
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
    const result = await this.prisma.message.deleteMany({
      where: where.status_not ? { status: { not: where.status_not } } : { status: where.status },
    })
    return result.count
  }

  /**
   * Delete all messages
   */
  async deleteAllMessages(): Promise<void> {
    await this.prisma.message.deleteMany()
  }

  /**
   * Delete all share messages
   */
  async deleteAllShareMessages(): Promise<void> {
    await this.prisma.shareMessage.deleteMany()
  }

  /**
   * Find a message by ID
   */
  async findMessageById(messageId: string): Promise<Message | undefined> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return message ? this.convertDbMessageToMessage(message as any) : undefined
  }

  /**
   * Find a share message by ID
   */
  async findShareMessageById(messageId: string): Promise<ShareMessage | undefined> {
    const shareMessage = await this.prisma.shareMessage.findUnique({
      where: { id: messageId },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return shareMessage ? this.convertDbShareMessageToShareMessage(shareMessage as any) : undefined
  }

  /**
   * Count messages with optional filtering
   */
  async countMessages(where?: { status?: string | null, OR?: Array<{ status: string | null }> }): Promise<number> {
    return await this.prisma.message.count({ where })
  }

  /**
   * Count share messages with optional filtering
   */
  async countShareMessages(where?: { status?: string | null, OR?: Array<{ status: string | null }> }): Promise<number> {
    return await this.prisma.shareMessage.count({ where })
  }

  /**
   * Convert database message to Message type
   */
  private convertDbMessageToMessage(dbMessage: {
    id: string
    title: string
    body: string
    timestamp: bigint
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
    createdAt: Date
    updatedAt: Date
  }): Message {
    return {
      id: dbMessage.id,
      title: dbMessage.title,
      body: dbMessage.body,
      timestamp: Number(dbMessage.timestamp),
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
   * Convert database share message to ShareMessage type
   */
  private convertDbShareMessageToShareMessage(dbShareMessage: {
    id: string
    type: string
    title: string
    body: string
    timestamp: bigint
    priority: string | null
    sender: string | null
    read: boolean
    status: string | null
    requiresResponse: boolean
    collectionRequest: string
    createdAt: Date
    updatedAt: Date
  }): ShareMessage {
    return {
      id: dbShareMessage.id,
      type: dbShareMessage.type as 'collection-share',
      title: dbShareMessage.title,
      body: dbShareMessage.body,
      timestamp: Number(dbShareMessage.timestamp),
      priority: dbShareMessage.priority as ShareMessage['priority'],
      sender: dbShareMessage.sender || undefined,
      read: dbShareMessage.read,
      status: dbShareMessage.status as ShareMessage['status'],
      requiresResponse: dbShareMessage.requiresResponse,
      collectionRequest: JSON.parse(dbShareMessage.collectionRequest) as CollectionRequest,
    }
  }
}
