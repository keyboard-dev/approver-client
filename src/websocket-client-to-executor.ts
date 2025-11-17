import WebSocket from 'ws'
import { GithubService } from './Github'
import { CodespaceConnectionInfo, GitHubCodespacesService } from './github-codespaces'
import { Message } from './types'

export interface IWindowManager {
  sendMessage(channel: string, ...args: unknown[]): void
}

export interface ExecutorMessage {
  type: string
  id?: string
  data?: unknown
  message?: Message
  requestId?: string
  timestamp?: number
}

export interface ConnectionTarget {
  type: 'localhost' | 'codespace'
  url: string
  name?: string
  codespaceName?: string
  connectedAt?: number
  source?: 'manual' | 'sse' | 'auto'
}

export class ExecutorWebSocketClient {
  private ws: WebSocket | null = null
  private readonly EXECUTOR_WS_PORT = 4002
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 5000 // 5 seconds
  private reconnectTimeout: NodeJS.Timeout | null = null
  private githubToken: string | null = null
  private codespacesService: GitHubCodespacesService | null = null
  private currentTarget: ConnectionTarget | null = null
  private lastKnownCodespaces: CodespaceConnectionInfo[] = []

  // Callback to handle messages from executor
  private onMessageReceived?: (message: ExecutorMessage) => void
  private windowManager?: IWindowManager

  constructor(
    onMessageReceived?: (message: ExecutorMessage) => void,
    windowManager?: IWindowManager,
  ) {
    this.onMessageReceived = onMessageReceived
    this.windowManager = windowManager
  }

  // Set the GitHub token to use for authentication
  setGitHubToken(token: string | null): void {
    this.githubToken = token

    // Initialize codespaces service when token is available
    if (token) {
      const githubService = new GithubService()
      this.codespacesService = new GitHubCodespacesService(githubService)
    }
    else {
      this.codespacesService = null
    }

    // If we have a token and we're not connected, try to connect
    if (token && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
      // Use async connect with auto-discovery
      this.connect().catch((error) => {
        console.error('Failed to connect after setting GitHub token:', error)
      })
    }
    // If token is cleared and we're connected, disconnect
    else if (!token && this.ws) {
      this.disconnect()
    }
  }

  // Check if connected
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }

  // Get current connection info
  getConnectionInfo(): { connected: boolean, target?: ConnectionTarget } {
    return {
      connected: this.isConnected(),
      target: this.currentTarget || undefined,
    }
  }

  // Discover available codespaces with WebSocket support
  async discoverCodespaces(): Promise<CodespaceConnectionInfo[]> {
    if (!this.codespacesService) {
      return []
    }

    try {
      const connectionInfo = await this.codespacesService.getCodespaceConnectionInfo()
      this.lastKnownCodespaces = connectionInfo

      connectionInfo.forEach(() => {

      })

      return connectionInfo
    }
    catch (error) {
      console.error('Failed to discover codespaces:', error)
      return []
    }
  }

  // Connect to a specific codespace
  async connectToCodespace(codespaceName: string): Promise<boolean> {
    if (!this.codespacesService) {
      console.error('❌ Cannot connect to codespace: GitHub token required')
      return false
    }

    try {
      // First discover codespaces to get connection info
      const codespaces = await this.discoverCodespaces()
      const targetCodespace = codespaces.find(cs => cs.codespace.name === codespaceName)

      if (!targetCodespace) {
        console.error(`❌ Codespace ${codespaceName} not found`)
        return false
      }

      if (!targetCodespace.available || !targetCodespace.websocketUrl) {
        console.error(`❌ Codespace ${codespaceName} does not have WebSocket available`)
        return false
      }

      // Set connection target
      this.currentTarget = {
        type: 'codespace',
        url: targetCodespace.websocketUrl,
        name: targetCodespace.codespace.display_name || targetCodespace.codespace.name,
        codespaceName: targetCodespace.codespace.name,
        connectedAt: Date.now(),
        source: 'manual',
      }

      // Emit connecting event
      this.windowManager?.sendMessage('websocket-connecting', {
        target: this.currentTarget.name!,
        type: this.currentTarget.type,
      })

      // Connect to the codespace
      this.connectToTarget(this.currentTarget)
      return true
    }
    catch (error) {
      console.error(`Failed to connect to codespace ${codespaceName}:`, error)
      return false
    }
  }

  // Connect to localhost (default behavior)
  connectToLocalhost(): void {
    this.currentTarget = {
      type: 'localhost',
      url: `ws://127.0.0.1:${this.EXECUTOR_WS_PORT}`,
      name: 'localhost',
      connectedAt: Date.now(),
      source: 'auto',
    }

    // Emit connecting event
    this.windowManager?.sendMessage('websocket-connecting', {
      target: this.currentTarget.name!,
      type: this.currentTarget.type,
    })

    this.connectToTarget(this.currentTarget)
  }

  // Get list of last known codespaces
  getLastKnownCodespaces(): CodespaceConnectionInfo[] {
    return this.lastKnownCodespaces
  }

  // Force reconnection with auto-discovery
  async reconnect(): Promise<boolean> {
    this.disconnect()
    return await this.connect()
  }

  // Connect to a codespace from SSE event
  async connectFromSSEEvent(codespace: { codespace_id: string, name: string, url: string, state: string }): Promise<boolean> {
    console.log('🔔 SSE triggered codespace connection:', codespace.name)

    // If already connected to this exact codespace, do nothing
    if (this.isConnected() && this.currentTarget?.codespaceName === codespace.name) {
      console.log('✅ Already connected to codespace:', codespace.name)
      return true
    }

    // Determine if we should switch based on current connection
    if (this.isConnected() && this.currentTarget) {
      const shouldSwitch = this.shouldSwitchToNewCodespace(
        this.currentTarget,
        // codespace,
      )

      if (!shouldSwitch) {
        console.log(`⏸️ Staying connected to ${this.currentTarget.name} (manual override or recent connection)`)
        return false
      }

      console.log(`🔄 Switching from ${this.currentTarget.name} to ${codespace.name}`)
      // Emit switching event
      this.windowManager?.sendMessage('websocket-switching', {
        from: this.currentTarget.name!,
        to: codespace.name,
      })
      this.disconnect()
    }

    // Attempt to connect to the new codespace with SSE source
    const success = await this.connectToCodespace(codespace.name)

    // Update source metadata if connection succeeded
    if (success && this.currentTarget) {
      this.currentTarget.source = 'sse'
      this.currentTarget.connectedAt = Date.now()
    }

    return success
  }

  // Determine if we should switch from current connection to new codespace
  private shouldSwitchToNewCodespace(
    currentTarget: ConnectionTarget,
    // _newCodespace: { codespace_id: string, name: string, url: string, state: string },
  ): boolean {
    // Never switch away from manual connections (user explicitly chose)
    if (currentTarget.source === 'manual') {
      return false
    }

    // If connected to localhost, always switch to a real codespace
    if (currentTarget.type === 'localhost') {
      return true
    }

    // If current connection is recent (< 30 seconds), don't switch
    const connectionAge = Date.now() - (currentTarget.connectedAt || 0)
    if (connectionAge < 30000) {
      return false
    }

    // Otherwise, switch to the new codespace
    return true
  }

  // Manual connection to a specific codespace (for UI override)
  async connectToSpecificCodespace(codespaceName: string): Promise<boolean> {
    return await this.connectToCodespace(codespaceName)
  }

  // Connect to codespace-executor WebSocket server (with automatic codespace discovery)
  async connect(): Promise<boolean> {
    if (!this.githubToken) {
      return false
    }

    // If no target is set, try to auto-discover the best option
    if (!this.currentTarget) {
      const connected = await this.autoConnect()
      return connected
    }

    // Connect to the current target
    this.connectToTarget(this.currentTarget)
    return true
  }

  // Automatically discover and connect to the best available executor
  async autoConnect(): Promise<boolean> {
    console.log('🔗 Auto-connecting to executor')
    if (!this.codespacesService) {
      this.connectToLocalhost()
      return true
    }
    console.log('🔗 Codespaces service available')

    try {
      // First, try to find and connect to a user's codespace
      const preparedCodespace = await this.codespacesService.discoverAndPrepareCodespace()
      console.log('🔗 Prepared codespace:', preparedCodespace)
      if (preparedCodespace) {
        this.currentTarget = {
          type: 'codespace',
          url: preparedCodespace.websocketUrl,
          name: preparedCodespace.codespace.codespace.display_name || preparedCodespace.codespace.codespace.name,
          codespaceName: preparedCodespace.codespace.codespace.name,
          connectedAt: Date.now(),
          source: 'auto',
        }

        this.connectToTarget(this.currentTarget)
        return true
      }

      // If no suitable codespace found, fall back to localhost

      this.connectToLocalhost()
      return true
    }
    catch (error) {
      console.error('Failed to auto-discover connection target:', error)

      this.connectToLocalhost()
      return true
    }
  }

  // Internal method to connect to a specific target
  private connectToTarget(target: ConnectionTarget): void {
    if (!this.githubToken) {
      return
    }

    // Don't connect if already connected or connecting
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return
    }

    try {
      this.ws = new WebSocket(target.url, {
        headers: {
          'Authorization': `Bearer ${this.githubToken}`,
          'X-GitHub-Token': this.githubToken,
          'User-Agent': 'KeyboardApproverClient/1.0',
        },
      })

      this.ws!.on('open', () => {
        this.reconnectAttempts = 0

        // Clear any pending reconnect timeout
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout)
          this.reconnectTimeout = null
        }
        console.log('🔗 WebSocket connected to:', target.url)

        // Emit connected event
        this.windowManager?.sendMessage('websocket-connected', {
          target: target.name || target.url,
          type: target.type,
          codespaceName: target.codespaceName,
        })
      })

      this.ws!.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString()) as ExecutorMessage

          // Forward to message handler
          this.onMessageReceived?.(message)
        }
        catch (error) {
          console.error('Error parsing message from executor:', error)
        }
      })

      this.ws!.on('close', () => {
        this.ws = null

        // Emit disconnected event
        this.windowManager?.sendMessage('websocket-disconnected', {
          target: target.name || target.url,
          type: target.type,
        })

        this.attemptReconnect()
      })

      this.ws!.on('error', (error) => {
        // ignore 404 errors, these are expected on startup, we need to wait for the executor to be ready
        if (error.message.includes('Unexpected server response: 404')) {
          return
        }

        console.error(`❌ WebSocket client error (${target.name}):`, error)

        // Emit error event for non-404 errors
        this.windowManager?.sendMessage('websocket-error', {
          target: target.name || target.url,
          type: target.type,
          error: error.message,
        })
      })
    }
    catch (error) {
      console.error(`Failed to connect to ${target.name}:`, error)
      this.ws = null

      // Emit error event
      this.windowManager?.sendMessage('websocket-error', {
        target: target.name || target.url,
        type: target.type,
        error: error instanceof Error ? error.message : String(error),
      })

      this.attemptReconnect()
    }
  }

  private attemptReconnect(): void {
    // Don't reconnect if we don't have a token
    if (!this.githubToken) {
      return
    }

    // Clear any existing timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++

      // Emit reconnecting event
      this.windowManager?.sendMessage('websocket-reconnecting', {
        attempt: this.reconnectAttempts,
        maxAttempts: this.maxReconnectAttempts,
      })

      this.reconnectTimeout = setTimeout(() => {
        this.reconnectTimeout = null
        this.connect()
      }, this.reconnectDelay)
    }
    else {
      // console.error('❌ Max reconnection attempts reached. Will retry when token is refreshed.')
      this.reconnectAttempts = 0 // Reset for next time token is available
    }
  }

  // Send a message to the executor
  send(message: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
    else {
      console.error('❌ Cannot send message: WebSocket not connected')
    }
  }

  // Send approval response
  sendApproval(messageId: string, feedback?: string): void {
    this.send({
      type: 'approval-response',
      id: messageId,
      status: 'approved',
      feedback: feedback,
      timestamp: Date.now(),
    })
  }

  // Send rejection response
  sendRejection(messageId: string, feedback?: string): void {
    this.send({
      type: 'approval-response',
      id: messageId,
      status: 'rejected',
      feedback: feedback,
      timestamp: Date.now(),
    })
  }

  // Disconnect from executor
  disconnect(): void {
    // Clear any pending reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    // Reset reconnect attempts
    this.reconnectAttempts = 0
    this.currentTarget = null
  }
}
