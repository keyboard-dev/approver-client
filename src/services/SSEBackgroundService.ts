import { EventEmitter } from 'events'

export interface CodespaceData {
  codespace_id: string
  name: string
  url: string
  state: string
  timestamp: string
  repository: {
    name: string
    full_name: string
  }
}

export interface SSEMessage {
  type: 'connected' | 'codespace_online' | 'codespace_offline' | 'codespace_updated' | 'ping'
  data?: CodespaceData
}

// Valid SSE message types
const VALID_MESSAGE_TYPES: ReadonlySet<string> = new Set([
  'connected',
  'codespace_online',
  'codespace_offline',
  'codespace_updated',
  'ping',
])

// Type guard to validate SSE message type
function isValidMessageType(type: unknown): type is SSEMessage['type'] {
  return typeof type === 'string' && VALID_MESSAGE_TYPES.has(type)
}

export interface SSEServiceOptions {
  serverUrl: string
  maxReconnectAttempts?: number
  reconnectDelay?: number
  heartbeatInterval?: number
}

export class SSEBackgroundService extends EventEmitter {
  private authToken: string | null = null
  private options: Required<SSEServiceOptions>
  private reconnectAttempts = 0
  private reconnectTimeout: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private isConnected = false
  private abortController: AbortController | null = null

  constructor(options: SSEServiceOptions) {
    super()
    this.options = {
      maxReconnectAttempts: 10,
      reconnectDelay: 3000,
      heartbeatInterval: 30000,
      ...options,
    }
  }

  setAuthToken(token: string | null): void {
    this.authToken = token

    if (token && !this.isConnected) {
      this.connect()
    }
    else if (!token && this.abortController) {
      this.disconnect()
    }
  }

  async connect(): Promise<void> {
    if (!this.authToken) {
      return
    }

    if (this.isConnected && this.abortController) {
      return
    }

    const url = `${this.options.serverUrl}/notifications/stream`

    this.abortController = new AbortController()

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        signal: this.abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      this.isConnected = true
      this.reconnectAttempts = 0
      this.startHeartbeat()
      this.emit('connected')

      // Process the stream
      await this.processStream(response)
    }
    catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }

      this.isConnected = false
      this.stopHeartbeat()
      this.emit('error', error)
      this.attemptReconnect()
    }
  }

  private async processStream(response: Response): Promise<void> {
    if (!response.body) {
      throw new Error('Response body is null')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')

        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) {
            continue
          }

          const data = line.slice(6).trim()
          if (!data) {
            continue
          }

          try {
            // Try to parse as JSON first
            let message: SSEMessage
            try {
              const parsed = JSON.parse(data)

              // If parsed is not a string, use it as-is (object)
              if (typeof parsed !== 'string') {
                message = parsed
              }
              // If parsed is a string, validate it's a valid type
              else if (!isValidMessageType(parsed)) {
                throw new Error(`Invalid SSE message type: "${parsed}"`)
              }
              // Valid string type
              else {
                message = { type: parsed }
              }
            }
            catch {
              // Treat unparseable data as a plain string type (expected behavior)
              if (!isValidMessageType(data)) {
                throw new Error(`Invalid SSE message type: "${data}"`)
              }
              message = { type: data }
            }

            this.handleMessage(message)
          }
          catch (error) {
            console.error('❌ Failed to handle SSE message with both methods:', error, 'Raw data:', data)
          }
        }
      }
    }
    finally {
      reader.releaseLock()
    }
  }

  private handleMessage(data: SSEMessage): void {
    switch (data.type) {
      case 'connected':

        this.emit('sse-connected', data)
        break

      case 'codespace_online':

        this.emit('codespace-online', data.data)
        break

      case 'codespace_offline':

        this.emit('codespace-offline', data.data)
        break

      case 'codespace_updated':

        this.emit('codespace-updated', data.data)
        break

      case 'ping':
        break

      default:
    }
  }

  private attemptReconnect(): void {
    if (!this.authToken) {
      return
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.reconnectAttempts < this.options.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = Math.min(
        this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
        30000,
      )

      this.reconnectTimeout = setTimeout(() => {
        this.reconnectTimeout = null
        this.connect()
      }, delay)
    }
    else {
      this.emit('max-reconnect-attempts-reached')
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (!this.isConnected || !this.abortController || this.abortController.signal.aborted) {
        this.connect()
      }
    }, this.options.heartbeatInterval)
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  disconnect(): void {
    this.stopHeartbeat()

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }

    this.isConnected = false
    this.reconnectAttempts = 0
    this.emit('disconnected')
  }

  getConnectionStatus(): { connected: boolean, reconnectAttempts: number } {
    return {
      connected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
    }
  }

  isServiceConnected(): boolean {
    return this.isConnected
  }
}
