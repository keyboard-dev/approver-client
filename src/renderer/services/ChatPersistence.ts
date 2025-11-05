// Chat persistence service using IndexedDB
export interface ChatSession {
  id: string
  name: string
  provider: string
  model?: string
  createdAt: number
  updatedAt: number
}

export interface ChatMessageRecord {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: any[]
  createdAt: number
  metadata?: Record<string, unknown>
}

class ChatPersistenceService {
  private dbName = 'chat-persistence'
  private dbVersion = 1
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create sessions store
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionsStore = db.createObjectStore('sessions', { keyPath: 'id' })
          sessionsStore.createIndex('createdAt', 'createdAt', { unique: false })
          sessionsStore.createIndex('updatedAt', 'updatedAt', { unique: false })
        }

        // Create messages store
        if (!db.objectStoreNames.contains('messages')) {
          const messagesStore = db.createObjectStore('messages', { keyPath: 'id' })
          messagesStore.createIndex('sessionId', 'sessionId', { unique: false })
          messagesStore.createIndex('createdAt', 'createdAt', { unique: false })
        }
      }
    })
  }

  // Session methods
  async createSession(session: ChatSession): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readwrite')
      const store = transaction.objectStore('sessions')
      const request = store.add(session)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readonly')
      const store = transaction.objectStore('sessions')
      const request = store.get(sessionId)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  async getAllSessions(): Promise<ChatSession[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readonly')
      const store = transaction.objectStore('sessions')
      const index = store.index('updatedAt')
      const request = index.openCursor(null, 'prev') // Most recent first

      const sessions: ChatSession[] = []

      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          sessions.push(cursor.value)
          cursor.continue()
        }
        else {
          resolve(sessions)
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  async updateSession(sessionId: string, updates: Partial<ChatSession>): Promise<void> {
    if (!this.db) await this.init()

    const session = await this.getSession(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    const updatedSession = { ...session, ...updates, updatedAt: Date.now() }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readwrite')
      const store = transaction.objectStore('sessions')
      const request = store.put(updatedSession)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (!this.db) await this.init()

    // Delete session
    await new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction(['sessions'], 'readwrite')
      const store = transaction.objectStore('sessions')
      const request = store.delete(sessionId)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })

    // Delete all messages for this session
    await this.deleteMessagesBySession(sessionId)
  }

  // Message methods
  async saveMessage(message: ChatMessageRecord): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readwrite')
      const store = transaction.objectStore('messages')
      const request = store.add(message)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getMessagesBySession(sessionId: string): Promise<ChatMessageRecord[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readonly')
      const store = transaction.objectStore('messages')
      const index = store.index('sessionId')
      const request = index.openCursor(IDBKeyRange.only(sessionId))

      const messages: ChatMessageRecord[] = []

      request.onsuccess = () => {
        const cursor = request.result
        if (cursor) {
          messages.push(cursor.value)
          cursor.continue()
        }
        else {
          // Sort by createdAt
          resolve(messages.sort((a, b) => a.createdAt - b.createdAt))
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  async deleteMessagesBySession(sessionId: string): Promise<void> {
    if (!this.db) await this.init()

    const messages = await this.getMessagesBySession(sessionId)

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['messages'], 'readwrite')
      const store = transaction.objectStore('messages')

      let remaining = messages.length
      if (remaining === 0) {
        resolve()
        return
      }

      for (const message of messages) {
        const request = store.delete(message.id)
        request.onsuccess = () => {
          remaining--
          if (remaining === 0) {
            resolve()
          }
        }
        request.onerror = () => reject(request.error)
      }
    })
  }

  async clearAllData(): Promise<void> {
    if (!this.db) await this.init()

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction(['sessions'], 'readwrite')
        const request = transaction.objectStore('sessions').clear()
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      }),
      new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction(['messages'], 'readwrite')
        const request = transaction.objectStore('messages').clear()
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      }),
    ])
  }
}

export const chatPersistence = new ChatPersistenceService()
