import _ from 'lodash'
import { Message, ShareMessage } from '../../types'

const DB_NAME = 'keyboard-approver-db'
const DB_VERSION = 1
const MESSAGES_STORE = 'messages'
const SHARE_MESSAGES_STORE = 'shareMessages'

export interface DatabaseConfig {
  name: string
  version: number
}

export class DatabaseService {
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null

  // Event notification for UI updates
  private notifyChange(type: 'messages' | 'shareMessages' | 'both' = 'both'): void {
    window.dispatchEvent(new CustomEvent('db-change', { detail: { type } }))
  }

  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        console.error('Failed to open database:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result

        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create messages object store
        if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
          const messagesStore = db.createObjectStore(MESSAGES_STORE, { keyPath: 'id' })
          messagesStore.createIndex('status', 'status', { unique: false })
          messagesStore.createIndex('timestamp', 'timestamp', { unique: false })
        }

        // Create shareMessages object store
        if (!db.objectStoreNames.contains(SHARE_MESSAGES_STORE)) {
          const shareMessagesStore = db.createObjectStore(SHARE_MESSAGES_STORE, { keyPath: 'id' })
          shareMessagesStore.createIndex('status', 'status', { unique: false })
          shareMessagesStore.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
    })

    return this.initPromise
  }

  private ensureInitialized(): void {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.')
    }
  }

  // Message operations
  async addMessage(message: Message): Promise<void> {
    this.ensureInitialized()

    // Ensure status defaults to 'pending' if not provided
    const messageWithStatus: Message = {
      ...message,
      status: message.status || 'pending',
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([MESSAGES_STORE], 'readwrite')
      const store = transaction.objectStore(MESSAGES_STORE)

      transaction.oncomplete = () => {
        this.notifyChange('messages')
        resolve()
      }
      transaction.onerror = () => reject(transaction.error)

      // Sanitize the message to prevent DataCloneError
      store.put(messageWithStatus)
    })
  }

  async updateMessage(messageId: string, updates: Partial<Message>): Promise<void> {
    this.ensureInitialized()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([MESSAGES_STORE], 'readwrite')
      const store = transaction.objectStore(MESSAGES_STORE)

      // Use transaction-level error handling for better performance
      transaction.onerror = () => reject(transaction.error)
      transaction.oncomplete = () => {
        this.notifyChange('messages')
        resolve()
      }

      const getRequest = store.get(messageId)

      getRequest.onsuccess = () => {
        const message = getRequest.result
        if (message) {
          const updatedMessage = _.merge({}, message, updates)
          store.put(updatedMessage)
        }
        else {
          transaction.abort()
          reject(new Error(`Message ${messageId} not found`))
        }
      }
    })
  }

  async deleteMessage(messageId: string): Promise<void> {
    this.ensureInitialized()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([MESSAGES_STORE], 'readwrite')
      const store = transaction.objectStore(MESSAGES_STORE)

      transaction.oncomplete = () => {
        this.notifyChange('messages')
        resolve()
      }
      transaction.onerror = () => reject(transaction.error)

      store.delete(messageId)
    })
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    this.ensureInitialized()

    // Handle empty array case early
    if (messageIds.length === 0) {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([MESSAGES_STORE], 'readwrite')
      const store = transaction.objectStore(MESSAGES_STORE)

      // Use transaction-level events for cleaner, more reliable batch operations
      transaction.oncomplete = () => {
        this.notifyChange('messages')
        resolve()
      }
      transaction.onerror = () => reject(transaction.error)

      // Queue all delete operations in the transaction
      for (const messageId of messageIds) {
        store.delete(messageId)
      }
    })
  }

  async getMessage(messageId: string): Promise<Message | null> {
    this.ensureInitialized()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([MESSAGES_STORE], 'readonly')
      const store = transaction.objectStore(MESSAGES_STORE)
      const request = store.get(messageId)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  async getAllMessages(): Promise<Message[]> {
    this.ensureInitialized()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([MESSAGES_STORE], 'readonly')
      const store = transaction.objectStore(MESSAGES_STORE)
      const index = store.index('timestamp')

      // Use cursor with 'prev' direction to get messages sorted by timestamp descending (newest first)
      const messages: Message[] = []
      const request = index.openCursor(null, 'prev')

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          messages.push(cursor.value as Message)
          cursor.continue()
        }
        else {
          // Cursor finished, return all messages
          resolve(messages)
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  async clearAllMessages(): Promise<void> {
    this.ensureInitialized()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([MESSAGES_STORE], 'readwrite')
      const store = transaction.objectStore(MESSAGES_STORE)

      transaction.oncomplete = () => {
        this.notifyChange('messages')
        resolve()
      }
      transaction.onerror = () => reject(transaction.error)

      store.clear()
    })
  }

  async countMessages(filter?: { status?: string }): Promise<number> {
    this.ensureInitialized()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([MESSAGES_STORE], 'readonly')
      const store = transaction.objectStore(MESSAGES_STORE)

      if (filter?.status) {
        const index = store.index('status')
        const request = index.count(filter.status)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      }
      else {
        const request = store.count()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      }
    })
  }

  async countPendingMessages(): Promise<number> {
    this.ensureInitialized()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([MESSAGES_STORE], 'readonly')
      const store = transaction.objectStore(MESSAGES_STORE)
      const index = store.index('status')

      // Count messages with status === 'pending' using the index
      // Note: All messages now have a status field (default 'pending'), no need for cursor iteration
      const pendingRequest = index.count('pending')

      pendingRequest.onsuccess = () => {
        resolve(pendingRequest.result)
      }

      pendingRequest.onerror = () => reject(pendingRequest.error)
    })
  }

  // ShareMessage operations
  async addShareMessage(shareMessage: ShareMessage): Promise<void> {
    this.ensureInitialized()

    // Ensure status defaults to 'pending' if not provided
    const shareMessageWithStatus: ShareMessage = {
      ...shareMessage,
      status: shareMessage.status || 'pending',
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([SHARE_MESSAGES_STORE], 'readwrite')
      const store = transaction.objectStore(SHARE_MESSAGES_STORE)

      transaction.oncomplete = () => {
        this.notifyChange('shareMessages')
        resolve()
      }
      transaction.onerror = () => reject(transaction.error)

      store.put(shareMessageWithStatus)
    })
  }

  async updateShareMessage(messageId: string, updates: Partial<ShareMessage>): Promise<void> {
    this.ensureInitialized()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([SHARE_MESSAGES_STORE], 'readwrite')
      const store = transaction.objectStore(SHARE_MESSAGES_STORE)

      // Use transaction-level error handling for better performance
      transaction.onerror = () => reject(transaction.error)
      transaction.oncomplete = () => {
        this.notifyChange('shareMessages')
        resolve()
      }

      const getRequest = store.get(messageId)

      getRequest.onsuccess = () => {
        const shareMessage = getRequest.result
        if (shareMessage) {
          const updatedShareMessage = _.merge({}, shareMessage, updates)
          store.put(updatedShareMessage)
        }
        else {
          transaction.abort()
          reject(new Error(`ShareMessage ${messageId} not found`))
        }
      }
    })
  }

  async getShareMessage(messageId: string): Promise<ShareMessage | null> {
    this.ensureInitialized()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([SHARE_MESSAGES_STORE], 'readonly')
      const store = transaction.objectStore(SHARE_MESSAGES_STORE)
      const request = store.get(messageId)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  async getAllShareMessages(): Promise<ShareMessage[]> {
    this.ensureInitialized()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([SHARE_MESSAGES_STORE], 'readonly')
      const store = transaction.objectStore(SHARE_MESSAGES_STORE)
      const index = store.index('timestamp')

      // Use cursor with 'prev' direction to get messages sorted by timestamp descending (newest first)
      const shareMessages: ShareMessage[] = []
      const request = index.openCursor(null, 'prev')

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          shareMessages.push(cursor.value as ShareMessage)
          cursor.continue()
        }
        else {
          // Cursor finished, return all messages
          resolve(shareMessages)
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  async clearAllShareMessages(): Promise<void> {
    this.ensureInitialized()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([SHARE_MESSAGES_STORE], 'readwrite')
      const store = transaction.objectStore(SHARE_MESSAGES_STORE)

      transaction.oncomplete = () => {
        this.notifyChange('shareMessages')
        resolve()
      }
      transaction.onerror = () => reject(transaction.error)

      store.clear()
    })
  }

  async countPendingShareMessages(): Promise<number> {
    this.ensureInitialized()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([SHARE_MESSAGES_STORE], 'readonly')
      const store = transaction.objectStore(SHARE_MESSAGES_STORE)
      const index = store.index('status')

      // Count messages with status === 'pending' using the index
      // Note: All shareMessages now have a status field (default 'pending'), no need for cursor iteration
      const pendingRequest = index.count('pending')

      pendingRequest.onsuccess = () => {
        resolve(pendingRequest.result)
      }

      pendingRequest.onerror = () => reject(pendingRequest.error)
    })
  }

  async getTotalPendingCount(): Promise<number> {
    // Fetch both counts in parallel for better performance
    const [messagePending, sharePending] = await Promise.all([
      this.countPendingMessages(),
      this.countPendingShareMessages(),
    ])
    return messagePending + sharePending
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
      this.initPromise = null
    }
  }
}

// Singleton instance
export const databaseService = new DatabaseService()
