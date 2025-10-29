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
      console.warn('Cannot connect to SSE: No auth token available')
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

      console.log('🔗 SSE connection opened')
      this.isConnected = true
      this.reconnectAttempts = 0
      this.startHeartbeat()
      this.emit('connected')

      // Process the stream
      await this.processStream(response)
    }
    catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('🔌 SSE connection aborted')
        return
      }

      console.error('❌ SSE connection error:', error)
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
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data) {
              try {
                const parsedData: SSEMessage = JSON.parse(data)
                this.handleMessage(parsedData)
              }
              catch (error) {
                console.error('❌ Failed to parse SSE message:', error, 'Raw data:', data)
              }
            }
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
        console.log('✅ SSE connection confirmed')
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
        console.log('❓ Unknown SSE message type:', data.type)
    }
  }

  private attemptReconnect(): void {
    if (!this.authToken) {
      console.log('⏸️ Skipping SSE reconnect: No auth token')
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

      console.log(`🔄 SSE reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts})`)

      this.reconnectTimeout = setTimeout(() => {
        this.reconnectTimeout = null
        this.connect()
      }, delay)
    }
    else {
      console.error('❌ SSE max reconnection attempts reached')
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
    console.log('🔌 SSE disconnected')
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
