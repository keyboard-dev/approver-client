// import { Notification } from 'electron'
import WebSocket from 'ws'
import { GithubService } from './Github'
import { CodespaceConnectionInfo, GitHubCodespacesService } from './github-codespaces'
import { Message } from './types'
import { KeyboardEnvironmentManager, KeyboardEnvironmentConfig } from './keyboard-environment'
import { ExecutionPreference } from './execution-preference'

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
  type: 'localhost' | 'codespace' | 'keyboard-env'
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
  private maxReconnectAttempts = Infinity // Keep trying forever
  private baseReconnectDelay = 1000 // Start at 1 second
  private maxReconnectDelay = 30000 // Max 30 seconds
  private reconnectTimeout: NodeJS.Timeout | null = null
  private persistentRetryInterval: NodeJS.Timeout | null = null
  private readonly PERSISTENT_RETRY_INTERVAL = 60000 // Check every minute for long-term retry
  private githubToken: string | null = null
  private codespacesService: GitHubCodespacesService | null = null
  private keyboardEnvironmentManager: KeyboardEnvironmentManager | null = null
  private currentTarget: ConnectionTarget | null = null
  private lastKnownCodespaces: CodespaceConnectionInfo[] = []
  private executionPreference: ExecutionPreference = 'github-codespace'

  // Callback to handle messages from executor
  private onMessageReceived?: (message: ExecutorMessage) => void
  private windowManager?: IWindowManager

  // Keepalive and connection health
  private readonly CLIENT_PING_INTERVAL = 35000 // 35 seconds (offset from server's 30s)
  private connectionAliveStatus: boolean = false
  private lastPongReceived: number = 0
  private clientPingInterval: NodeJS.Timeout | null = null
  private lastActivityTime: number = Date.now()

  constructor(
    onMessageReceived?: (message: ExecutorMessage) => void,
    windowManager?: IWindowManager,
  ) {
    this.onMessageReceived = onMessageReceived
    this.windowManager = windowManager
  }

  // Debug notification helper for production debugging
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private showDebugNotification(title: string, body: string): void {
    return
    // try {
    //   if (Notification.isSupported()) {
    //     new Notification({ title: `[DEBUG] ${title}`, body }).show()
    //   }
    // }
    // catch {
    //   // Silently fail if notification fails
    // }
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

    // Handle connection logic
    this.updateGitHubTokenConnectionLogic(token)
  }

  setExecutionPreference(preference: ExecutionPreference): void {
    this.executionPreference = preference
  }

  // Set JWT token for keyboard environment access
  setKeyboardJwtToken(jwtToken: string | null): void {
    if (jwtToken) {
      this.keyboardEnvironmentManager = new KeyboardEnvironmentManager({
        jwtToken,
        defaultTimeout: 60,
        maxRetries: 3,
        retryDelay: 2000,
      })
    }
    else {
      this.keyboardEnvironmentManager = null
    }

    // If we have a JWT token and we're not connected, try to connect
    if (jwtToken && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
      // Start persistent retry system
      this.startPersistentRetry()

      // Use async connect with auto-discovery
      this.connect().catch((error) => {
      })
    }
    // If token is cleared and we're connected, disconnect
    else if (!jwtToken && this.ws) {
      this.stopPersistentRetry()
      this.disconnect()
    }
  }

  // Update the original setGitHubToken to include connection logic
  private updateGitHubTokenConnectionLogic(token: string | null): void {
    // If we have a token and we're not connected, try to connect
    if (token && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
      // Start persistent retry system
      this.startPersistentRetry()

      // Use async connect with auto-discovery
      this.connect().catch((error) => {
      })
    }
    // If token is cleared and we're connected, disconnect
    else if (!token && this.ws) {
      this.stopPersistentRetry()
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

  // Get enhanced connection info with ping test and health data
  async getEnhancedConnectionInfo(): Promise<{
    connected: boolean
    target?: ConnectionTarget
    pingTest?: {
      success: boolean
      error?: string
    }
    connectionHealth?: {
      isAlive: boolean
      lastActivity: number
      lastPong: number
      timeSinceLastActivity: number
      timeSinceLastPong: number
    }
  }> {
    const basicInfo = this.getConnectionInfo()

    if (!basicInfo.connected) {
      return basicInfo
    }

    try {
      const pingResult = await this.sendManualPing()
      return {
        ...basicInfo,
        pingTest: {
          success: pingResult.success,
          error: pingResult.error,
        },
        connectionHealth: {
          isAlive: pingResult.connectionHealth.isAlive,
          lastActivity: pingResult.connectionHealth.lastActivity,
          lastPong: pingResult.connectionHealth.lastPong,
          timeSinceLastActivity: pingResult.connectionHealth.timeSinceLastActivity,
          timeSinceLastPong: pingResult.connectionHealth.timeSinceLastPong,
        },
      }
    }
    catch (error) {
      return {
        ...basicInfo,
        pingTest: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        connectionHealth: this.getConnectionHealth(),
      }
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
      return []
    }
  }

  // Connect to a specific codespace
  async connectToCodespace(codespaceName: string): Promise<boolean> {
    if (!this.codespacesService) {
      return false
    }

    try {
      // First discover codespaces to get connection info
      const codespaces = await this.discoverCodespaces()
      const targetCodespace = codespaces.find(cs => cs.codespace.name === codespaceName)

      if (!targetCodespace) {
        return false
      }

      if (!targetCodespace.available || !targetCodespace.websocketUrl) {
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

  // Connect to keyboard environment target using Sandbox Orchestrator API
  async connectToKeyboardEnvTarget(): Promise<boolean> {
    if (!this.keyboardEnvironmentManager) {
      // Fallback to environment variables for legacy support
      return this.connectToLegacyKeyboardEnvTarget()
    }

    try {
      // Try to find or create a sandbox environment
      const sandboxInfo = await this.keyboardEnvironmentManager.findOrCreateEnvironment()

      // Create connection target from sandbox info
      this.currentTarget = this.keyboardEnvironmentManager.createConnectionTarget(sandboxInfo)

      // Emit connecting event
      this.windowManager?.sendMessage('websocket-connecting', {
        target: this.currentTarget.name!,
        type: this.currentTarget.type,
      })

      this.connectToTarget(this.currentTarget)
      return true
    }
    catch (error) {
      return this.connectToLegacyKeyboardEnvTarget()
    }
  }

  // Legacy method for environment variable-based connections
  private connectToLegacyKeyboardEnvTarget(): boolean {
    // Check for environment variables that define alternative WebSocket targets
    const keyboardWsUrl = process.env.KEYBOARD_WEBSOCKET_URL
    const keyboardExecutorHost = process.env.KEYBOARD_EXECUTOR_HOST
    const keyboardExecutorPort = process.env.KEYBOARD_EXECUTOR_PORT

    let targetUrl: string | null = null
    let targetName = 'keyboard-env'

    if (keyboardWsUrl) {
      targetUrl = keyboardWsUrl
      targetName = 'custom-websocket'
    }
    else if (keyboardExecutorHost) {
      const port = keyboardExecutorPort || this.EXECUTOR_WS_PORT
      targetUrl = `ws://${keyboardExecutorHost}:${port}`
      targetName = `${keyboardExecutorHost}:${port}`
    }

    if (!targetUrl) {
      return false
    }

    this.currentTarget = {
      type: 'keyboard-env',
      url: targetUrl,
      name: targetName,
      connectedAt: Date.now(),
      source: 'auto',
    }

    // Emit connecting event
    this.windowManager?.sendMessage('websocket-connecting', {
      target: this.currentTarget.name!,
      type: this.currentTarget.type,
    })

    this.connectToTarget(this.currentTarget)
    return true
  }

  // Get list of last known codespaces
  getLastKnownCodespaces(): CodespaceConnectionInfo[] {
    return this.lastKnownCodespaces
  }

  // Get keyboard environment manager for external access
  getKeyboardEnvironmentManager(): KeyboardEnvironmentManager | null {
    return this.keyboardEnvironmentManager
  }

  // Get available keyboard environments
  async getAvailableKeyboardEnvironments() {
    if (!this.keyboardEnvironmentManager) {
      return []
    }

    try {
      const { sandboxes } = await this.keyboardEnvironmentManager.listUserSandboxes()
      return sandboxes
    }
    catch (error) {
      return []
    }
  }

  // Connect to a specific keyboard environment
  async connectToSpecificKeyboardEnvironment(sessionId: string): Promise<boolean> {
    if (!this.keyboardEnvironmentManager) {
      return false
    }

    try {
      // Validate the environment exists and is running
      const isValid = await this.keyboardEnvironmentManager.validateEnvironment(sessionId)
      if (!isValid) {
        return false
      }

      // Get sandbox info
      const sandboxInfo = await this.keyboardEnvironmentManager.getSandboxStatus(sessionId)

      // Create connection target
      this.currentTarget = this.keyboardEnvironmentManager.createConnectionTarget(sandboxInfo)
      this.currentTarget.source = 'manual'

      // Emit connecting event
      this.windowManager?.sendMessage('websocket-connecting', {
        target: this.currentTarget.name!,
        type: this.currentTarget.type,
      })

      // Connect to the environment
      this.connectToTarget(this.currentTarget)
      return true
    }
    catch (error) {
      return false
    }
  }

  // Clean up expired keyboard environments
  async cleanupKeyboardEnvironments(): Promise<void> {
    if (!this.keyboardEnvironmentManager) {
      return
    }

    try {
      await this.keyboardEnvironmentManager.cleanupExpiredEnvironments()
    }
    catch (error) {
    }
  }

  // Force reconnection with auto-discovery
  async reconnect(): Promise<boolean> {
    this.disconnect()
    return await this.connect()
  }

  // Connect to a codespace from SSE event
  async connectFromSSEEvent(codespace: { codespace_id: string, name: string, url: string, state: string }): Promise<boolean> {
    // If already connected to this exact codespace, do nothing
    if (this.isConnected() && this.currentTarget?.codespaceName === codespace.name) {
      return true
    }

    // Determine if we should switch based on current connection
    if (this.isConnected() && this.currentTarget) {
      const shouldSwitch = this.shouldSwitchToNewCodespace(this.currentTarget)

      if (!shouldSwitch) {
        return false
      }

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
    // If we have neither GitHub token nor keyboard environment manager, can't connect
    if (!this.githubToken && !this.keyboardEnvironmentManager) {
      return false
    }

    // Always try to discover codespaces first, even if we have a current target
    // This ensures we always try to find the best available codespace
    const connected = await this.autoConnect()

    if (connected) {
      return true
    }

    // If auto-connect failed and we have a previous target, try that
    if (this.currentTarget) {
      this.connectToTarget(this.currentTarget)
      return true
    }

    return false
  }

  // Automatically discover and connect to the best available executor
  async autoConnect(): Promise<boolean> {
    // If we have a GitHub token and codespaces service, try GitHub codespaces first
    if (this.codespacesService && this.githubToken && this.executionPreference != 'keyboard-environment') {
      try {
        // Try to find and connect to a user's codespace
        const preparedCodespace = await this.codespacesService.discoverAndPrepareCodespace()

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

        // If no suitable codespace found, continue to fallback options below
      }
      catch (error) {
      }
    }

    // If no GitHub token available, try keyboard environment target
    if (!this.githubToken || this.executionPreference === 'keyboard-environment') {
      try {
        return await this.connectToKeyboardEnvTarget()
      }
      catch (error) {
        return false
      }
    }

    // If we have a token but no codespace was found, let retry handle it
    return false
  }

  // Internal method to connect to a specific target
  private connectToTarget(target: ConnectionTarget): void {
    // For keyboard-env targets, we don't require a GitHub token
    if (target.type !== 'keyboard-env' && !this.githubToken) {
      return
    }

    // Don't connect if already connected or connecting
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return
    }

    try {
      // Prepare headers based on target type
      const headers: Record<string, string> = {
        'User-Agent': 'KeyboardApproverClient/1.0',
      }

      // Only add GitHub authentication headers for codespace targets
      if (target.type === 'codespace' && this.githubToken) {
        headers['Authorization'] = `Bearer ${this.githubToken}`
        headers['X-GitHub-Token'] = this.githubToken
      }

      // Only add keyboard environment authentication headers for keyboard environment targets
      if (target.type === 'keyboard-env' && this.keyboardEnvironmentManager) {
        headers['Authorization'] = `Bearer ${this.keyboardEnvironmentManager.getJwtToken()}`
      }

      this.ws = new WebSocket(target.url, { headers })

      this.ws!.on('open', () => {
        // Reset reconnect state on successful connection
        this.reconnectAttempts = 0

        // Clear any pending reconnect timeout
        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout)
          this.reconnectTimeout = null
        }

        // Set up keepalive for this connection
        this.setupConnectionKeepalive()

        // Emit connected event
        this.windowManager?.sendMessage('websocket-connected', {
          target: target.name || target.url,
          type: target.type,
          codespaceName: target.codespaceName,
        })
      })

      this.ws!.on('message', (data: WebSocket.Data) => {
        try {
          // Update activity time for any message received
          this.lastActivityTime = Date.now()

          const message = JSON.parse(data.toString()) as ExecutorMessage

          // Forward to message handler
          this.onMessageReceived?.(message)
        }
        catch (error) {
        }
      })

      // Set up ping/pong handlers for keepalive
      this.ws!.on('ping', (data: Buffer) => {
        // Respond to server ping with pong
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.pong(data)
          this.lastActivityTime = Date.now()
        }
      })

      this.ws!.on('pong', () => {
        // Server responded to our ping
        this.connectionAliveStatus = true
        this.lastPongReceived = Date.now()
        this.lastActivityTime = Date.now()
      })

      this.ws!.on('close', () => {
        this.ws = null

        // Clean up keepalive resources
        this.cleanupKeepalive()

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

        this.windowManager?.sendMessage('websocket-error', {
          target: target.name || target.url,
          type: target.type,
          error: error.message,
        })
      })
    }
    catch (error) {
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
    // Don't reconnect if we don't have any authentication tokens
    if (!this.githubToken && !this.keyboardEnvironmentManager) {
      return
    }

    // Clear any existing timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    this.reconnectAttempts++

    // Calculate exponential backoff delay
    const exponentialDelay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay,
    )

    // Add some jitter to prevent thundering herd
    const jitterDelay = exponentialDelay + Math.random() * 1000

    // Emit reconnecting event
    this.windowManager?.sendMessage('websocket-reconnecting', {
      attempt: this.reconnectAttempts,
      maxAttempts: this.maxReconnectAttempts,
    })

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null
      this.connect()
    }, jitterDelay)
  }

  // Send a message to the executor
  send(message: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
      // Update activity time when sending messages
      this.lastActivityTime = Date.now()
    }
    else {
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

    // Stop persistent retry system
    this.stopPersistentRetry()

    // Clean up keepalive resources
    this.cleanupKeepalive()

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    // Reset reconnect attempts
    this.reconnectAttempts = 0
    this.currentTarget = null
  }

  /**
   * Sets up client-side keepalive system to prevent idle disconnections
   * Sends periodic pings to server and monitors connection health
   */
  private setupConnectionKeepalive(): void {
    // Initialize connection state
    this.connectionAliveStatus = true
    this.lastPongReceived = Date.now()
    this.lastActivityTime = Date.now()

    // Clean up any existing interval
    this.cleanupKeepalive()

    // Set up periodic ping to server (complementary to server's ping)
    this.clientPingInterval = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return
      }

      const timeSinceLastActivity = Date.now() - this.lastActivityTime
      const timeSinceLastPong = Date.now() - this.lastPongReceived

      // If connection seems dead (no pong responses), don't send more pings
      if (timeSinceLastPong > 90000 && !this.connectionAliveStatus) { // 90 seconds
        return
      }

      // Send ping to server
      try {
        this.ws.ping()
        this.connectionAliveStatus = false // Will be set to true when pong is received

        // Also send a keepalive message if we've been idle
        if (timeSinceLastActivity > 25000) { // 25 seconds of no messages
          this.sendKeepaliveMessage()
        }
      }
      catch (error) {
      }
    }, this.CLIENT_PING_INTERVAL)
  }

  /**
   * Sends a keepalive message to prevent server-side timeout
   */
  private sendKeepaliveMessage(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          type: 'keepalive',
          timestamp: Date.now(),
          clientId: 'keyboard-approver-client',
        }))
      }
      catch (error) {
      }
    }
  }

  /**
   * Cleans up keepalive resources
   */
  private cleanupKeepalive(): void {
    if (this.clientPingInterval) {
      clearInterval(this.clientPingInterval)
      this.clientPingInterval = null
    }

    // Reset connection state
    this.connectionAliveStatus = false
    this.lastPongReceived = 0
  }

  /**
   * Gets connection health information for monitoring
   */
  getConnectionHealth(): {
    isAlive: boolean
    lastActivity: number
    lastPong: number
    timeSinceLastActivity: number
    timeSinceLastPong: number
  } {
    const now = Date.now()
    return {
      isAlive: this.connectionAliveStatus,
      lastActivity: this.lastActivityTime,
      lastPong: this.lastPongReceived,
      timeSinceLastActivity: now - this.lastActivityTime,
      timeSinceLastPong: now - this.lastPongReceived,
    }
  }

  /**
   * Send a manual ping for testing and debugging
   */
  async sendManualPing(): Promise<{
    success: boolean
    error?: string
    connectionHealth: {
      isAlive: boolean
      lastActivity: number
      lastPong: number
      timeSinceLastActivity: number
      timeSinceLastPong: number
      connected: boolean
    }
  }> {
    try {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return {
          success: false,
          error: 'WebSocket not connected',
          connectionHealth: {
            ...this.getConnectionHealth(),
            connected: false,
          },
        }
      }

      // Send manual ping
      this.ws.ping()
      this.connectionAliveStatus = false // Will be set to true when pong is received

      // Wait a short time for pong response
      await new Promise(resolve => setTimeout(resolve, 1000))

      return {
        success: true,
        connectionHealth: {
          ...this.getConnectionHealth(),
          connected: this.ws?.readyState === WebSocket.OPEN,
        },
      }
    }
    catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        connectionHealth: {
          ...this.getConnectionHealth(),
          connected: this.ws?.readyState === WebSocket.OPEN || false,
        },
      }
    }
  }

  /**
   * Starts persistent retry system for long-term connection attempts
   */
  private startPersistentRetry(): void {
    // Don't start multiple intervals
    if (this.persistentRetryInterval) {
      return
    }

    this.persistentRetryInterval = setInterval(() => {
      // Only attempt if we have tokens and are not connected
      if ((this.githubToken || this.keyboardEnvironmentManager) && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
        this.connect().catch((error) => {
        })
      }
    }, this.PERSISTENT_RETRY_INTERVAL)
  }

  /**
   * Stops persistent retry system
   */
  private stopPersistentRetry(): void {
    if (this.persistentRetryInterval) {
      clearInterval(this.persistentRetryInterval)
      this.persistentRetryInterval = null
    }
  }
}
