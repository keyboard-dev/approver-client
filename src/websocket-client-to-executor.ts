import WebSocket from 'ws'
import { GithubService } from './Github'
import { CodespaceConnectionInfo, GitHubCodespacesService } from './github-codespaces'
import { Message } from './types'

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
  private onConnectionStatusChanged?: (connected: boolean, target?: ConnectionTarget) => void

  constructor(
    onMessageReceived?: (message: ExecutorMessage) => void,
    onConnectionStatusChanged?: (connected: boolean, target?: ConnectionTarget) => void,
  ) {
    this.onMessageReceived = onMessageReceived
    this.onConnectionStatusChanged = onConnectionStatusChanged
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
      }

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
    }
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
    if (!this.codespacesService) {
      this.connectToLocalhost()
      return true
    }

    try {
      // First, try to find and connect to a user's codespace
      const preparedCodespace = await this.codespacesService.discoverAndPrepareCodespace()

      if (preparedCodespace) {
        this.currentTarget = {
          type: 'codespace',
          url: preparedCodespace.websocketUrl,
          name: preparedCodespace.codespace.codespace.display_name || preparedCodespace.codespace.codespace.name,
          codespaceName: preparedCodespace.codespace.codespace.name,
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

        // Notify connection status change
        this.onConnectionStatusChanged?.(true, target)
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

        // Notify connection status change
        this.onConnectionStatusChanged?.(false, target)

        this.attemptReconnect()
      })

      this.ws!.on('error', (error) => {
        // ignore 404 errors, these are expected on startup, we need to wait for the executor to be ready
        if (error.message.includes('Unexpected server response: 404')) {
          return
        }

        console.error(`❌ WebSocket client error (${target.name}):`, error)
      })
    }
    catch (error) {
      console.error(`Failed to connect to ${target.name}:`, error)
      this.ws = null
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

    // Notify connection status change
    this.onConnectionStatusChanged?.(false, this.currentTarget || undefined)

    // Reset reconnect attempts
    this.reconnectAttempts = 0
    this.currentTarget = null
  }
}
