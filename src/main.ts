// CRITICAL: Filter protocol URLs from process.argv BEFORE Electron processes them
// This prevents Electron from treating OAuth callback URLs as file paths
// Must run BEFORE any imports or other code
const CUSTOM_PROTOCOL = 'mcpauth'
let earlyProtocolUrl: string | null = null

// Find and extract protocol URL from argv
const protocolUrlIndex = process.argv.findIndex(arg =>
  arg.startsWith(`${CUSTOM_PROTOCOL}://`)
  || arg.includes(`${CUSTOM_PROTOCOL}://`),
)

if (protocolUrlIndex !== -1) {
  const foundArg = process.argv[protocolUrlIndex]

  // Extract the URL (it might be just the URL or have other text)
  const urlMatch = foundArg.match(new RegExp(`${CUSTOM_PROTOCOL}://[^\\s]*`))
  if (urlMatch) {
    earlyProtocolUrl = urlMatch[0]

    // Remove the protocol URL from argv to prevent Electron from processing it
    process.argv.splice(protocolUrlIndex, 1)
  }
}
else {
  // On Windows, protocol URLs might be split or mangled in various ways:
  // 1. Full URL split across arguments: ["mcpauth://callback?code=X", "&state=Y"]
  // 2. Just query params: ["?code=X&state=Y"]
  // 3. URL-encoded variations

  // Join all arguments and look for the protocol URL
  const joinedArgs = process.argv.join(' ')
  const protocolMatch = joinedArgs.match(new RegExp(`${CUSTOM_PROTOCOL}://[^\\s]*`))

  if (protocolMatch) {
    earlyProtocolUrl = protocolMatch[0]

    // Remove arguments that contain parts of the protocol URL
    process.argv = process.argv.filter(arg =>
      !arg.includes(`${CUSTOM_PROTOCOL}://`)
      && !arg.includes('?code=')
      && !arg.includes('&state=')
      && !arg.includes('code=')
      && !arg.includes('state='),
    )
  }
  else {
    // Check for bare query parameters (Windows may pass just "?code=...&state=...")
    // This happens when the protocol registration doesn't properly preserve the full URL
    const queryParamPattern = /\?(.*code=.*state=|.*state=.*code=)/
    const queryParamIndex = process.argv.findIndex(arg => queryParamPattern.test(arg))

    if (queryParamIndex !== -1) {
      const queryArg = process.argv[queryParamIndex]

      // Reconstruct the full protocol URL
      earlyProtocolUrl = `${CUSTOM_PROTOCOL}://callback${queryArg}`

      // Remove the query parameter argument
      process.argv.splice(queryParamIndex, 1)
    }
    else {
      // Check if query params are split across multiple arguments
      const codeArg = process.argv.find(arg => arg.includes('code='))
      const stateArg = process.argv.find(arg => arg.includes('state='))

      if (codeArg || stateArg) {
        // Reconstruct query string from fragments
        const fragments = process.argv.filter(arg =>
          arg.includes('code=') || arg.includes('state=') || arg.startsWith('?') || arg.startsWith('&'),
        )

        let queryString = fragments.join('').replace(/^[?&]+/, '?').replace(/&&+/g, '&')

        // Ensure it starts with ?
        if (!queryString.startsWith('?')) {
          queryString = '?' + queryString
        }

        earlyProtocolUrl = `${CUSTOM_PROTOCOL}://callback${queryString}`

        // Remove all query-related arguments
        process.argv = process.argv.filter(arg =>
          !arg.includes('code=')
          && !arg.includes('state=')
          && !arg.startsWith('?')
          && !arg.startsWith('&'),
        )
      }
    }
  }
}

import * as crypto from 'crypto'
import { app, autoUpdater, BrowserWindow, ipcMain, Menu, Notification, shell } from 'electron'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as WebSocket from 'ws'
import { aiRuntime, initializeAIProviders } from './ai-provider/setup'
import { webSearch } from './ai-provider/utils/dedicated-web'
import { getQueuedProtocolUrls, initializeApp as initializeElectronApp, type AppInitializerResult } from './app-initializer'
import { setEncryptionKeyProvider } from './encryption'
import { GithubService } from './Github'
import { GitHubCodespacesService } from './github-codespaces'
import { deleteScriptTemplate } from './keyboard-shortcuts'
import { OAuthProvider, ServerProvider, ServerProviderInfo } from './oauth-providers'
import { StoredProviderTokens } from './oauth-token-storage'
import { OAuthProviderConfig } from './provider-storage'
import { createRestAPIServer } from './rest-api'
import { AuthService } from './services/auth-service'
import { OAuthService } from './services/oauth-service'
import { CodespaceData, SSEBackgroundService } from './services/SSEBackgroundService'
import { TrayManager } from './tray-manager'
import { CodespaceInfo, CollectionRequest, Message, ShareMessage } from './types'
import { CODE_APPROVAL_ORDER, CodeApprovalLevel, RESPONSE_APPROVAL_ORDER, ResponseApprovalLevel } from './types/settings-types'
import { ExecutorWebSocketClient } from './websocket-client-to-executor'
import { WindowManager } from './window-manager'

// Helper function to find assets directory reliably
export function getAssetsPath(): string {
  const appPath = app.getAppPath()

  // In development, assets are in project root
  // In production (packaged), assets should be in app bundle
  const devAssetsPath = path.join(appPath, '..', 'assets')
  const prodAssetsPath = path.join(appPath, 'assets')

  // Check development path first
  if (fs.existsSync(devAssetsPath)) {
    return devAssetsPath
  }

  // Fallback to production path
  return prodAssetsPath
}

// Types for WebSocket server configuration
interface WebSocketVerifyInfo {
  req: {
    url?: string
    connection: {
      remoteAddress?: string
    }
  }
}

// Types for REST API Server interface
interface RestAPIServerInterface {
  start: () => Promise<void>
  stop: () => Promise<void>
  getPort: () => number
}

// Types for user objects in auth responses
export interface AuthUser {
  id?: string
  email?: string
  firstName?: string
  lastName?: string
  name?: string
  profile_picture?: string
}

// Types for WebSocket message with collection request
interface WebSocketMessage {
  type: string
  id?: string
  data?: CollectionRequest
  requestId?: string
}

export interface Script {
  id: string
  name: string
  description: string
  tags?: string[]
  services?: string[]
  isExpanded?: boolean
}

class MenuBarNotificationApp {
  private trayManager: TrayManager
  private windowManager: WindowManager
  private wsServer: WebSocket.Server | null = null
  private restApiServer: RestAPIServerInterface | null = null
  private pendingCount: number = 0
  private readonly WS_PORT = 8080
  private readonly OAUTH_PORT = 8082
  private readonly OAUTH_SERVER_URL = process.env.OAUTH_SERVER_URL || 'https://api.keyboard.dev'
  private readonly SKIP_AUTH = process.env.SKIP_AUTH === 'true'
  private readonly CUSTOM_PROTOCOL = 'mcpauth'
  private sseBackgroundService: SSEBackgroundService | null = null
  private githubService!: GithubService
  private githubCodespacesService!: GitHubCodespacesService
  // WebSocket security
  private wsConnectionKey: string | null = null
  private readonly STORAGE_DIR = path.join(os.homedir(), '.keyboard-mcp')
  private readonly WS_KEY_FILE = path.join(os.homedir(), '.keyboard-mcp', '.keyboard-mcp-ws-key')
  private readonly KEYBOARD_AUTH_TOKENS = path.join(os.homedir(), '.keyboard-mcp', '.keyboard-mcp-tokens.json')
  private readonly ONBOARDING_COMPLETED_FILE = path.join(os.homedir(), '.keyboard-mcp', 'completed-onboarding')

  // Encryption key management
  private encryptionKey: string | null = null
  private readonly ENCRYPTION_KEY_FILE = path.join(os.homedir(), '.keyboard-mcp-encryption-key')
  private readonly VERSION_TIMESTAMP_FILE = path.join(os.homedir(), '.keyboard-mcp-version-timestamp.json')

  // Settings management
  private showNotifications: boolean = true
  private automaticCodeApproval: CodeApprovalLevel = 'never'
  private automaticResponseApproval: ResponseApprovalLevel = 'never'
  private fullCodeExecution: boolean = false
  private readonly SETTINGS_FILE = path.join(os.homedir(), '.keyboard-mcp-settings')
  private readonly FULL_CODE_EXECUTION_FILE = path.join(os.homedir(), '.keyboard-mcp', 'full-code-execution')

  // Executor WebSocket client
  private executorWSClient: ExecutorWebSocketClient | null = null

  // OAuth Services
  private authService!: AuthService
  private oauthService!: OAuthService

  // Startup protocol URL (for Windows OAuth callback handling)
  private startupProtocolUrl: string | null = null

  constructor() {
    // Initialize managers
    this.windowManager = new WindowManager({
      onWindowClosed: () => {
        // Handle window closed
      },
      onMessageShow: () => {
        // Handle message show
      },
    })

    this.trayManager = new TrayManager({
      onToggleWindow: (bounds?: Electron.Rectangle) => {
        this.windowManager.toggleWindow(bounds)
      },
      onShowWindow: () => {
        this.windowManager.showWindow()
      },
      onClearAllMessages: () => {
        this.clearAllMessages()
      },
      onQuit: () => {
        app.quit()
      },
      onCheckForUpdates: () => {
        this.checkForUpdates()
      },
      getMessages: () => [], // Messages now stored in renderer DB
      getPendingCount: () => this.pendingCount,
    })

    // Set up encryption key provider
    setEncryptionKeyProvider({
      getActiveEncryptionKey: () => this.getActiveEncryptionKey(),
    })

    // Initialize executor WebSocket client
    this.executorWSClient = new ExecutorWebSocketClient((message) => {
      this.handleExecutorMessage(message)
    })

    this.initializeApp()
  }

  private initializeApp(): void {
    // Initialize the Electron app with platform-specific handlers
    const initResult: AppInitializerResult = initializeElectronApp({
      customProtocol: this.CUSTOM_PROTOCOL,
      getAuthService: () => this.authService,
      windowManager: this.windowManager,
    })

    if (!initResult.shouldContinue) {
      app.quit()
      return
    }

    // Store startup protocol URL for processing after OAuth services are ready
    // Prefer early-captured URL (filtered before Electron processed argv)
    this.startupProtocolUrl = earlyProtocolUrl || initResult.startupProtocolUrl

    // App ready event
    app.whenReady().then(async () => {
      // Set application icon for notifications (especially important for macOS)
      const assetsPath = getAssetsPath()
      const iconPath = path.join(assetsPath, 'keyboard-dock.png')

      if (process.platform === 'darwin' && fs.existsSync(iconPath)) {
        // On macOS, set the dock icon which is used for notifications
        try {
          app.dock?.setIcon(iconPath)
        }
        catch {
          // Silently fail if dock icon cannot be set
        }
      }

      // Initialize WebSocket security key first
      await this.initializeStorageDir()
      await this.initializeWebSocketKey()

      // Initialize encryption key
      await this.initializeEncryptionKey()

      // Initialize app settings
      await this.initializeSettings()

      // Initialize version timestamp tracking
      await this.getVersionInstallTimestamp()

      // Initialize GitHub service
      await this.initializeGithubService()

      // Initialize OAuth services (after encryption is ready)
      // This creates both authService and oauthService instances
      await this.initializeOAuthServices()

      // Process startup protocol URL if one was passed (Windows OAuth callback handling)
      if (this.startupProtocolUrl) {
        try {
          await this.authService.handleOAuthCallback(this.startupProtocolUrl)
        }
        catch (error) {
          console.error('Error processing startup protocol URL:', error)
        }
        finally {
          this.startupProtocolUrl = null // Clear after processing
        }
      }

      // Process any queued protocol URLs that arrived before auth service was ready
      // This is critical on Windows where second-instance events can fire during initialization
      const queuedUrls = getQueuedProtocolUrls()

      if (queuedUrls.length > 0) {
        for (const queuedUrl of queuedUrls) {
          try {
            await this.authService.handleOAuthCallback(queuedUrl)
          }
          catch (error) {
            console.error('Error processing queued URL:', error)
          }
        }
      }

      // Setup IPC handlers early so renderer can communicate with main process
      this.setupIPC()

      // Try to connect to executor with onboarding token
      await this.connectToExecutorWithToken()

      // Configure auto-updater (only on macOS and Windows)
      // Skip in development mode to avoid Squirrel errors on Windows
      const isDev = process.argv.includes('--dev') || !app.isPackaged
      if ((process.platform === 'darwin' || process.platform === 'win32') && !isDev) {
        const feedURL = `https://api.keyboard.dev/update/${process.platform}/${app.getVersion()}`
        autoUpdater.setFeedURL({
          url: feedURL,
        })

        // Auto-updater event handlers
        autoUpdater.on('checking-for-update', () => {

        })

        autoUpdater.on('update-available', () => {

        })

        autoUpdater.on('update-not-available', () => {

        })

        autoUpdater.on('update-downloaded', () => {
          // Notify user and ask if they want to restart
          const notification = new Notification({
            title: 'Update Ready',
            body: 'A new version has been downloaded. Restart now to apply the update?',
          })
          notification.show()
          notification.on('click', () => {
            autoUpdater.quitAndInstall()
          })
        })

        autoUpdater.on('error', (error) => {
          console.error('Update error:', error)
        })

        // Check for updates
        autoUpdater.checkForUpdates()
      }

      this.trayManager.createTray()
      this.setupApplicationMenu()
      this.setupWebSocketServer()
      this.setupRestAPI()
      this.initializeAIProviders()
      // this.setupIPC()

      // Request notification permissions on all platforms
      await this.requestNotificationPermissions()

      app.on('activate', () => {
        // On macOS, show window when app is activated
        this.windowManager.showWindow()
      })
    }).catch((error) => {
      console.error('Fatal error during initialization:', error)
      // Still try to show the window so user isn't left with nothing
      try {
        this.windowManager.showWindow()
      }
      catch (e) {
        console.error('Failed to show window after initialization error:', e)
      }
    })

    // Don't quit when all windows are closed (menu bar app behavior)
    app.on('window-all-closed', () => {
      // Keep running in background for menu bar app
    })

    // Handle app termination
    app.on('before-quit', () => {
      this.cleanup()
    })
  }

  /**
   * Initialize OAuth services (both AuthService and OAuthService)
   */
  private async initializeOAuthServices(): Promise<void> {
    try {
      // Initialize AuthService for main app authentication
      this.authService = new AuthService(
        this.windowManager,
        this.showNotification.bind(this),
        () => this.sseBackgroundService,
        (service: SSEBackgroundService) => {
          this.sseBackgroundService = service
          // Set up event handlers when SSE service is created
          this.setupSSEEventHandlers()
        },
        this.OAUTH_SERVER_URL,
        this.CUSTOM_PROTOCOL,
        this.KEYBOARD_AUTH_TOKENS,
        this.SKIP_AUTH,
      )

      // Load persisted auth tokens BEFORE initializing OAuth provider system
      // This ensures main access token is available for provider token refresh
      await this.authService.loadPersistedAuthTokens()

      // Initialize OAuthService for provider authentication
      this.oauthService = new OAuthService(
        this.windowManager,
        this.showNotification.bind(this),
        () => this.executorWSClient,
        () => this.githubService,
        () => this.getActiveEncryptionKey(),
        () => this.authService.getValidAccessToken('provider'),
        this.OAUTH_PORT,
        this.SKIP_AUTH,
      )

      // Initialize the OAuth provider system (this will trigger provider token refresh)
      await this.oauthService.initializeOAuthProviderSystem()

      // Set up SSE event handlers if service exists
      // (service may be created during token loading/refresh)
      this.setupSSEEventHandlers()
    }
    catch (error) {
      console.error('❌ Failed to initialize OAuth services:', error)
      throw error
    }
  }

  private initializeAIProviders(): void {
    try {
      initializeAIProviders()
    }
    catch (error) {
      console.error('❌ Failed to initialize AI providers:', error)
    }
  }

  private async initializeGithubService(): Promise<void> {
    this.githubService = await new GithubService()
    this.githubCodespacesService = new GitHubCodespacesService(this.githubService)
  }

  /**
   * Connect to executor WebSocket server with GitHub token
   */
  private async connectToExecutorWithToken(): Promise<void> {
    try {
      // Try to get onboarding GitHub token
      const onboardingToken = await this.oauthService.getValidProviderAccessToken('onboarding')

      if (onboardingToken && this.executorWSClient) {
        this.executorWSClient.setGitHubToken(onboardingToken)
      }
    }
    catch (error) {
      console.error('❌ Error connecting to executor:', error)
    }
  }

  /**
   * Setup SSE Background Service event handlers
   * Called after SSE service is initialized by AuthService
   */
  private setupSSEEventHandlers(): void {
    const sseService = this.sseBackgroundService
    if (!sseService) {
      return
    }

    // Handle SSE connection confirmation
    sseService.on('connected', () => {
      console.log('Connected to SSE')
    })

    // Handle codespace coming online - auto-connect to it
    sseService.on('codespace-online', async (data: CodespaceData) => {
      console.log('Codespace online:', data)
      await this.authService.getValidAccessToken()
      await this.connectToExecutorWithToken()
      await this.executorWSClient?.autoConnect()
    })
  }

  /**
   * Handle messages received from the executor WebSocket server
   */
  private handleExecutorMessage(message: { type: string, message?: Message, data?: unknown, id?: string, providerId?: string, requestId?: string }): void {
    try {
      switch (message.type) {
        case 'websocket-message':
          // Forward to existing message handling
          if (message.message) {
            this.handleIncomingMessage(message.message)
          }
          break

        case 'collection-share-request':
          // Handle collection share requests
          this.handleCollectionShareRequest(message as never)
          break

        case 'prompter-request':
          // Handle prompter requests
          this.handlePrompterRequest(message as never)
          break

        case 'prompt-response':
          // Handle prompt responses
          this.handlePromptResponse(message as never)
          break

        case 'request-provider-token':
          // Handle provider token requests from executor - delegate to OAuthService
          this.oauthService.handleExecutorProviderTokenRequest(message)
          break

        case 'request-provider-status':
          // Handle provider status requests from executor - delegate to OAuthService
          this.oauthService.handleExecutorProviderStatusRequest(message)
          break

        case 'request-token':
          // Handle legacy OAuth token requests from executor - delegate to AuthService
          this.handleExecutorTokenRequest(message)
          break

        default:
      }
    }
    catch (error) {
      console.error('❌ Error handling executor message:', error)
    }
  }

  /**
   * Handle legacy OAuth token request from executor WebSocket
   */
  private async handleExecutorTokenRequest(message: { requestId?: string }): Promise<void> {
    const token = await this.authService.getValidAccessToken()
    const authTokens = this.authService.getAuthTokens()

    const tokenResponse = {
      type: 'auth-token',
      token: token || (this.SKIP_AUTH ? 'test-token' : null),
      timestamp: Date.now(),
      requestId: message.requestId, // Echo back request ID if provided
      authenticated: !!token || this.SKIP_AUTH,
      user: token ? authTokens?.user : (this.SKIP_AUTH ? { email: 'test@example.com', firstName: 'Test' } : null),
    }

    // Send response back through executor client
    if (this.executorWSClient) {
      this.executorWSClient.send(tokenResponse)
    }
  }

  private async initializeStorageDir(): Promise<void> {
    if (!fs.existsSync(this.STORAGE_DIR)) {
      fs.mkdirSync(this.STORAGE_DIR, { mode: 0o700 })
    }
  }

  private async initializeWebSocketKey(): Promise<void> {
    try {
      // Try to load existing key
      if (fs.existsSync(this.WS_KEY_FILE)) {
        const keyData = fs.readFileSync(this.WS_KEY_FILE, 'utf8')
        const parsedData = JSON.parse(keyData)

        // Validate key format and age (regenerate if older than 30 days)
        if (parsedData.key && parsedData.createdAt) {
          const keyAge = Date.now() - parsedData.createdAt
          const maxAge = 30 * 24 * 60 * 60 * 1000 // 30 days

          if (keyAge < maxAge) {
            this.wsConnectionKey = parsedData.key
            return
          }
        }
      }

      // Generate new key if none exists or is expired
      await this.generateNewWebSocketKey()
    }
    catch (error) {
      console.error('❌ Error initializing WebSocket key:', error)
      // Fallback: generate new key
      await this.generateNewWebSocketKey()
    }
  }

  private async generateNewWebSocketKey(): Promise<void> {
    try {
      // Generate a secure random key
      this.wsConnectionKey = crypto.randomBytes(32).toString('hex')

      // Store key with metadata
      const keyData = {
        key: this.wsConnectionKey,
        createdAt: Date.now(),
        version: '1.0',
      }

      // Write to file with restricted permissions
      fs.writeFileSync(this.WS_KEY_FILE, JSON.stringify(keyData, null, 2), { mode: 0o600 })

      // Notify UI if window exists
      this.windowManager.sendMessage('ws-key-generated', {
        key: this.wsConnectionKey,
        createdAt: keyData.createdAt,
      })
    }
    catch (error) {
      console.error('❌ Error generating WebSocket key:', error)
      throw error
    }
  }

  private getWebSocketConnectionUrl(): string {
    if (!this.wsConnectionKey) {
      throw new Error('WebSocket connection key not initialized')
    }
    return `ws://127.0.0.1:${this.WS_PORT}?key=${this.wsConnectionKey}`
  }

  private validateWebSocketKey(providedKey: string): boolean {
    return this.wsConnectionKey === providedKey
  }

  // Encryption Key Management Methods
  private async initializeEncryptionKey(): Promise<void> {
    try {
      // Priority 1: Check if environment variable is set
      if (process.env.ENCRYPTION_KEY) {
        const envKey = Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
        if (envKey.length === 32) {
          this.encryptionKey = process.env.ENCRYPTION_KEY
          return
        }
      }

      // Priority 2: Try to load existing generated key
      if (fs.existsSync(this.ENCRYPTION_KEY_FILE)) {
        const keyData = fs.readFileSync(this.ENCRYPTION_KEY_FILE, 'utf8')
        const parsedData = JSON.parse(keyData)

        // Validate key format and age (regenerate if older than 365 days)
        if (parsedData.key && parsedData.createdAt) {
          const keyAge = Date.now() - parsedData.createdAt
          const maxAge = 365 * 24 * 60 * 60 * 1000 // 365 days

          if (keyAge < maxAge) {
            this.encryptionKey = parsedData.key
            return
          }
        }
      }

      // Priority 3: Generate new key if none exists or is expired
      await this.generateNewEncryptionKey()
    }
    catch (error) {
      console.error('❌ Error initializing encryption key:', error)
      // Fallback: generate new key
      await this.generateNewEncryptionKey()
    }
  }

  private async generateNewEncryptionKey(): Promise<void> {
    try {
      // Generate a secure random key
      this.encryptionKey = crypto.randomBytes(32).toString('hex')

      // Store key with metadata
      const keyData = {
        key: this.encryptionKey,
        createdAt: Date.now(),
        version: '1.0',
        source: 'generated',
      }

      // Write to file with restricted permissions
      fs.writeFileSync(this.ENCRYPTION_KEY_FILE, JSON.stringify(keyData, null, 2), { mode: 0o600 })

      // Notify UI if window exists
      this.windowManager.sendMessage('encryption-key-generated', {
        key: this.encryptionKey,
        createdAt: keyData.createdAt,
        source: keyData.source,
      })
    }
    catch (error) {
      console.error('❌ Error generating encryption key:', error)
      throw error
    }
  }

  private getEncryptionKeyInfo(): { key: string | null, createdAt: number | null, keyFile: string, source: 'environment' | 'generated' | null } {
    let createdAt: number | null = null
    let source: 'environment' | 'generated' | null = null

    // Check if using environment variable
    if (process.env.ENCRYPTION_KEY && this.encryptionKey === process.env.ENCRYPTION_KEY) {
      source = 'environment'
    }
    else {
      source = 'generated'
      try {
        if (fs.existsSync(this.ENCRYPTION_KEY_FILE)) {
          const keyData = fs.readFileSync(this.ENCRYPTION_KEY_FILE, 'utf8')
          const parsedData = JSON.parse(keyData)
          createdAt = parsedData.createdAt
        }
      }
      catch (error) {
        console.error('Error reading encryption key file:', error)
      }
    }

    return {
      key: this.encryptionKey,
      createdAt,
      keyFile: this.ENCRYPTION_KEY_FILE,
      source,
    }
  }

  public getActiveEncryptionKey(): string | null {
    return this.encryptionKey
  }

  // Settings Management Methods
  private async initializeSettings(): Promise<void> {
    try {
      // Try to load existing settings
      if (fs.existsSync(this.SETTINGS_FILE)) {
        const settingsData = fs.readFileSync(this.SETTINGS_FILE, 'utf8')
        const parsedData = JSON.parse(settingsData)

        // Apply loaded settings
        if (typeof parsedData.showNotifications === 'boolean') {
          this.showNotifications = parsedData.showNotifications
        }
        if (typeof parsedData.automaticCodeApproval === 'string'
          && CODE_APPROVAL_ORDER.includes(parsedData.automaticCodeApproval as CodeApprovalLevel)) {
          this.automaticCodeApproval = parsedData.automaticCodeApproval
        }

        // boolean check for backward compatibility
        if (typeof parsedData.automaticResponseApproval === 'boolean') {
          if (parsedData.automaticResponseApproval) {
            this.automaticResponseApproval = 'success only'
          }
          else {
            this.automaticResponseApproval = 'never'
          }
        }
        else if (typeof parsedData.automaticResponseApproval === 'string'
          && RESPONSE_APPROVAL_ORDER.includes(parsedData.automaticResponseApproval as ResponseApprovalLevel)) {
          this.automaticResponseApproval = parsedData.automaticResponseApproval
        }
        if (typeof parsedData.fullCodeExecution === 'boolean') {
          this.fullCodeExecution = parsedData.fullCodeExecution
        }
      }
    }
    catch (error) {
      console.error('❌ Error initializing settings:', error)
      // Use defaults if settings file is corrupted
      this.showNotifications = true
      this.automaticResponseApproval = 'never'
      this.fullCodeExecution = false
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      const settingsData = {
        showNotifications: this.showNotifications,
        automaticCodeApproval: this.automaticCodeApproval,
        automaticResponseApproval: this.automaticResponseApproval,
        fullCodeExecution: this.fullCodeExecution,
        version: '1.0',
        updatedAt: Date.now(),
      }

      // Write to file with restricted permissions
      fs.writeFileSync(this.SETTINGS_FILE, JSON.stringify(settingsData, null, 2), { mode: 0o600 })
    }
    catch (error) {
      console.error('❌ Error saving settings:', error)
      throw error
    }
  }

  private getSettingsInfo(): { showNotifications: boolean, automaticCodeApproval: CodeApprovalLevel, automaticResponseApproval: ResponseApprovalLevel, fullCodeExecution: boolean, settingsFile: string, updatedAt: number | null } {
    let updatedAt: number | null = null

    try {
      if (fs.existsSync(this.SETTINGS_FILE)) {
        const settingsData = fs.readFileSync(this.SETTINGS_FILE, 'utf8')
        const parsedData = JSON.parse(settingsData)
        updatedAt = parsedData.updatedAt
      }
    }
    catch (error) {
      console.error('Error reading settings file:', error)
    }

    return {
      showNotifications: this.showNotifications,
      automaticCodeApproval: this.automaticCodeApproval,
      automaticResponseApproval: this.automaticResponseApproval,
      fullCodeExecution: this.fullCodeExecution,
      settingsFile: this.SETTINGS_FILE,
      updatedAt,
    }
  }

  private checkForUpdates(): void {
    if (process.platform === 'darwin' || process.platform === 'win32') {
      autoUpdater.checkForUpdates()
      // Show a notification that we're checking
      const notification = new Notification({
        title: 'Checking for Updates',
        body: `Looking for new versions... current version: ${app.getVersion()}`,
      })
      notification.show()
    }
    else {
      const notification = new Notification({
        title: 'Updates Not Supported',
        body: 'Automatic updates are only available on macOS and Windows.',
      })
      notification.show()
    }
  }

  private installUpdate(): void {
    autoUpdater.quitAndInstall()
  }

  private setupApplicationMenu(): void {
    const template: Electron.MenuItemConstructorOptions[] = []

    // macOS has a different menu structure
    if (process.platform === 'darwin') {
      template.push({
        label: app.getName(),
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          {
            label: 'Check for Updates...',
            click: () => this.checkForUpdates(),
          },
          {
            label: 'Install Update',
            click: () => this.installUpdate(),
          },
          { type: 'separator' },
          { role: 'services', submenu: [] },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      })
    }

    // Edit menu
    template.push({
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' },
      ],
    })

    // View menu
    template.push({
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    })

    // Window menu
    template.push({
      role: 'window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
        ...(process.platform === 'darwin'
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
              { type: 'separator' as const },
              { role: 'window' as const },
            ]
          : []),
      ],
    })

    // Help menu
    template.push({
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            await shell.openExternal('https://keyboard.dev')
          },
        },
        ...(process.platform !== 'darwin'
          ? [
              { type: 'separator' as const },
              {
                label: 'Check for Updates...',
                click: () => this.checkForUpdates(),
              },
            ]
          : []),
      ],
    })

    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
  }

  private async getVersionInstallTimestamp(): Promise<number | null> {
    try {
      const currentVersion = app.getVersion()

      if (fs.existsSync(this.VERSION_TIMESTAMP_FILE)) {
        const data = JSON.parse(fs.readFileSync(this.VERSION_TIMESTAMP_FILE, 'utf8'))

        if (data.version === currentVersion && data.timestamp) {
          return data.timestamp
        }
      }

      // If no timestamp exists for current version, create one
      const timestamp = Date.now()
      fs.writeFileSync(this.VERSION_TIMESTAMP_FILE, JSON.stringify({
        version: currentVersion,
        timestamp: timestamp,
        // Also store human-readable date for debugging
        date: new Date(timestamp).toISOString(),
      }, null, 2))

      return timestamp
    }
    catch (error) {
      console.error('Failed to get version install timestamp:', error)
      return null
    }
  }

  public async getCurrentVersionInstallDate(): Promise<Date | null> {
    const timestamp = await this.getVersionInstallTimestamp()
    return timestamp ? new Date(timestamp) : null
  }

  private async checkOnboardingCompleted(): Promise<boolean> {
    try {
      return fs.existsSync(this.ONBOARDING_COMPLETED_FILE)
    }
    catch (error) {
      console.error('Failed to check onboarding completion:', error)
      return false
    }
  }

  private async markOnboardingCompleted(): Promise<void> {
    try {
      // Ensure storage directory exists
      if (!fs.existsSync(this.STORAGE_DIR)) {
        fs.mkdirSync(this.STORAGE_DIR, { recursive: true })
      }

      // Create completion file with timestamp
      const completionData = {
        completed: true,
        timestamp: Date.now(),
      }

      fs.writeFileSync(this.ONBOARDING_COMPLETED_FILE, JSON.stringify(completionData, null, 2), { mode: 0o600 })
    }
    catch (error) {
      console.error('Failed to mark onboarding as completed:', error)
      throw error
    }
  }

  private async getScripts(): Promise<Script[]> {
    const accessToken = await this.authService.getValidAccessToken()
    const response = await fetch(`${this.OAUTH_SERVER_URL}/api/scripts`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to get scripts')
    }
    // todo proper type checking using zod
    const scriptsResponse = await response.json() as { scripts: Script[] }
    const scripts = scriptsResponse?.scripts || []
    return scripts
  }

  private setupWebSocketServer(): void {
    this.wsServer = new WebSocket.Server({
      port: this.WS_PORT,
      host: '127.0.0.1', // Localhost only for security
      verifyClient: (info: WebSocketVerifyInfo) => {
        try {
          // Extract key from query parameters
          const url = new URL(info.req.url!, `ws://127.0.0.1:${this.WS_PORT}`)
          const providedKey = url.searchParams.get('key')

          // Validate connection is from localhost
          const remoteAddress = info.req.connection.remoteAddress
          const isLocalhost = remoteAddress === '127.0.0.1'
            || remoteAddress === '::1'
            || remoteAddress === '::ffff:127.0.0.1'

          if (!isLocalhost) {
            return false
          }

          // Validate key
          if (!providedKey || !this.validateWebSocketKey(providedKey)) {
            return false
          }

          return true
        }
        catch (error) {
          console.error('❌ Error validating WebSocket connection:', error)
          return false
        }
      },
    })

    this.wsServer.on('connection', (ws: WebSocket) => {
      ws.on('message', async (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString())

          // Handle token request (legacy OAuth) - delegate to AuthService
          if (message.type === 'request-token') {
            const token = await this.authService.getValidAccessToken()
            const authTokens = this.authService.getAuthTokens()

            const tokenResponse = {
              type: 'auth-token',
              token: token || (this.SKIP_AUTH ? 'test-token' : null),
              timestamp: Date.now(),
              requestId: message.requestId, // Echo back request ID if provided
              authenticated: !!token || this.SKIP_AUTH,
              user: token ? authTokens?.user : (this.SKIP_AUTH ? { email: 'test@example.com', firstName: 'Test' } : null),
            }

            ws.send(JSON.stringify(tokenResponse))
            return
          }

          // Handle provider token request - delegate to OAuthService
          if (message.type === 'request-provider-token') {
            const tokenResponse = await this.oauthService.handleWebSocketProviderTokenRequest(message.providerId)
            tokenResponse.requestId = message.requestId
            ws.send(JSON.stringify(tokenResponse))
            return
          }

          // Handle provider status request - delegate to OAuthService
          if (message.type === 'request-provider-status') {
            const statusResponse = await this.oauthService.handleWebSocketProviderStatusRequest()
            statusResponse.requestId = message.requestId
            ws.send(JSON.stringify(statusResponse))
            return
          }

          // Handle collection share request
          if (message.type === 'collection-share-request') {
            this.handleCollectionShareRequest(message)
            return
          }

          if (message.type === 'prompter-request') {
            this.handlePrompterRequest(message)
            return
          }

          // Handle prompt response from WebSocket client
          if (message.type === 'prompt-response') {
            this.handlePromptResponse(message)
            return
          }

          // Handle regular messages
          this.handleIncomingMessage(message)
        }
        catch (error) {
          console.error('Error parsing message:', error)
        }
      })

      ws.on('close', () => {
      })
    })
  }

  private handleCollectionShareRequest(message: WebSocketMessage): void {
    const collectionRequest = message.data as CollectionRequest
    // Create a share message for the request
    const shareMessage: ShareMessage = {
      id: message.id || crypto.randomBytes(16).toString('hex'),
      type: 'collection-share',
      title: 'Collection Share Request',
      body: `share request for "${collectionRequest.title}"`,
      timestamp: Date.now(),
      priority: 'high',
      status: 'pending',
      requiresResponse: true,
      collectionRequest: collectionRequest,
    }

    // Show desktop notification
    this.showShareNotification(shareMessage)

    // Send to renderer for storage in IndexedDB and display
    this.windowManager.sendMessage('collection-share-request', shareMessage)

    // Auto-show window for share requests
    this.windowManager.showWindow()
  }

  private handlePrompterRequest(message: WebSocketMessage): void {
    this.windowManager.sendMessage('websocket-message', message)
    this.windowManager.showWindow()
  }

  private handlePromptResponse(message: WebSocketMessage): void {
    // Send the prompt response to the renderer
    this.windowManager.sendMessage('prompt-response', message)
  }

  private handleIncomingMessage(message: Message): void {
    // Add timestamp if not provided
    if (!message.timestamp) {
      message.timestamp = Date.now()
    }

    // Set default status if not provided
    if (!message.status) {
      message.status = 'pending'
    }

    // Show desktop notification
    this.showNotification(message)

    switch (message.title) {
      case 'Security Evaluation Request': {
        const { risk_level } = message
        if (!risk_level) break

        const riskLevelIndex = CODE_APPROVAL_ORDER.indexOf(risk_level)
        const automaticCodeApprovalIndex = CODE_APPROVAL_ORDER.indexOf(this.automaticCodeApproval)
        if (riskLevelIndex <= automaticCodeApprovalIndex) {
          message.status = 'approved'
        }

        break
      }

      case 'code response approval': {
        const { codespaceResponse } = message
        if (!codespaceResponse) break

        const { data: codespaceResponseData } = codespaceResponse
        if (!codespaceResponseData) break
        const { stderr } = codespaceResponseData

        switch (this.automaticResponseApproval) {
          case 'always':
            message.status = 'approved'
            break
          case 'success only':
            if (!stderr) {
              message.status = 'approved'
            }
            break
          default:
            break
        }

        break
      }
    }

    if (message.status === 'approved') {
      this.handleApproveMessage(message)
    }
    else {
      this.windowManager.showWindow()
    }

    // Send to renderer for storage in IndexedDB and display

    this.windowManager.sendMessage('websocket-message', message)

    // Auto-show window for high priority messages
    // this.windowManager.showWindow()
    // if (message.priority === 'high') {
    //   this.windowManager.showWindow()
    // }
  }

  private showNotification(message: Message): void {
    if (!Notification.isSupported() || !this.showNotifications) {
      return
    }

    try {
      const notification = new Notification({
        title: message.title,
        body: message.body,
        urgency: message.priority === 'high' ? 'critical' : 'normal',
      })

      notification.on('click', () => {
        this.openMessageWindow(message)
      })

      notification.show()
    }
    catch (error) {
      console.error('❌ Error showing notification:', error)
    }
  }

  private showShareNotification(shareMessage: ShareMessage): void {
    if (!Notification.isSupported() || !this.showNotifications) {
      return
    }

    try {
      const notification = new Notification({
        title: shareMessage.title,
        body: shareMessage.body,
        urgency: shareMessage.priority === 'high' ? 'critical' : 'normal',
      })

      notification.on('click', () => {
        this.windowManager.showWindow()
        // Send share message data to renderer
        this.windowManager.sendMessage('show-share-message', shareMessage)
      })

      notification.show()
    }
    catch (error) {
      console.error('❌ Error showing share notification:', error)
    }
  }

  private async requestNotificationPermissions(): Promise<void> {
    // try {
    //   // On macOS, we can use the system notification request
    //   if (Notification.isSupported()) {
    //   }
    //   else {
    //   }
    // }
    // catch (error) {
    //   console.error('❌ Error requesting notification permissions:', error)
    // }
  }

  private openMessageWindow(message?: Message): void {
    this.windowManager.showWindow()

    // Send message data to renderer if specific message was clicked
    if (message) {
      this.windowManager.showMessage(message)
    }
  }

  private clearAllMessages(): void {
    this.pendingCount = 0
    this.trayManager.updateTrayIcon()

    // Notify renderer to clear IndexedDB
    this.windowManager.sendMessage('messages-cleared')
  }

  private setupIPC(): void {
    // OAuth-related IPC handlers (Legacy) - delegate to AuthService
    ipcMain.handle('start-oauth', async (): Promise<void> => {
      await this.authService.startOAuthFlow()
    })

    ipcMain.handle('get-auth-status', (): { authenticated: boolean, user?: AuthUser } => {
      return this.authService.getAuthStatus()
    })

    ipcMain.handle('get-version-install-date', async (): Promise<Date | null> => {
      return await this.getCurrentVersionInstallDate()
    })

    ipcMain.handle('logout', (): void => {
      this.authService.logout()
    })

    ipcMain.handle('get-access-token', async (): Promise<string | null> => {
      return await this.authService.getValidAccessToken()
    })

    ipcMain.handle('get-scripts', async (): Promise<Script[]> => {
      return await this.getScripts()
    })

    ipcMain.handle('delete-script', async (_event, scriptId: string): Promise<void> => {
      const accessToken = await this.authService.getValidAccessToken()
      if (!accessToken) {
        throw new Error('No access token available')
      }
      const result = await deleteScriptTemplate(scriptId, accessToken)
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete script')
      }
    })

    // OAuth Provider IPC handlers - delegate to OAuthService
    ipcMain.handle('get-available-providers', async (): Promise<OAuthProvider[]> => {
      return await this.oauthService.getAvailableProviders()
    })

    ipcMain.handle('start-provider-oauth', async (_event, providerId: string): Promise<void> => {
      await this.oauthService.startProviderOAuthFlow(providerId)
    })

    ipcMain.handle('get-provider-auth-status', async (): Promise<Record<string, unknown>> => {
      return await this.oauthService.getProviderAuthStatus()
    })

    ipcMain.handle('get-provider-access-token', async (_event, providerId: string): Promise<string | null> => {
      return await this.oauthService.getValidProviderAccessToken(providerId)
    })

    ipcMain.handle('logout-provider', async (_event, providerId: string): Promise<void> => {
      await this.oauthService.logoutProvider(providerId)
    })

    ipcMain.handle('get-provider-tokens', async (_event, providerId: string): Promise<StoredProviderTokens | null> => {
      return await this.oauthService.getProviderTokens(providerId)
    })

    ipcMain.handle('refresh-provider-tokens', async (_event, providerId: string): Promise<boolean> => {
      try {
        const tokens = await this.oauthService.getProviderTokens(providerId)
        if (!tokens?.refresh_token) {
          return false
        }

        await this.oauthService.refreshProviderTokens(providerId, tokens.refresh_token)
        return true
      }
      catch {
        // console.error(`Failed to refresh tokens for ${providerId}:`, error)
        return false
      }
    })

    ipcMain.handle('clear-all-provider-tokens', async (): Promise<void> => {
      await this.oauthService.clearAllProviderTokens()
    })

    ipcMain.handle('expire-all-tokens-for-testing', async (): Promise<number> => {
      return await this.oauthService.expireAllTokensForTesting()
    })

    ipcMain.handle('get-oauth-storage-info', (): Record<string, unknown> => {
      return this.oauthService.getOAuthStorageInfo()
    })

    // Manual Provider Management IPC handlers - delegate to OAuthService
    ipcMain.handle('get-all-provider-configs', async (): Promise<OAuthProviderConfig[]> => {
      return await this.oauthService.getAllProviderConfigs()
    })

    ipcMain.handle('save-provider-config', async (_event, config: Omit<OAuthProviderConfig, 'createdAt' | 'updatedAt'>): Promise<void> => {
      await this.oauthService.saveProviderConfig(config)
    })

    ipcMain.handle('remove-provider-config', async (_event, providerId: string): Promise<void> => {
      await this.oauthService.removeProviderConfig(providerId)
    })

    ipcMain.handle('get-provider-config', async (_event, providerId: string): Promise<OAuthProviderConfig | null> => {
      return await this.oauthService.getProviderConfig(providerId)
    })

    // Server Provider IPC handlers - delegate to OAuthService
    ipcMain.handle('add-server-provider', async (_event, server: ServerProvider): Promise<void> => {
      await this.oauthService.addServerProvider(server)
    })

    ipcMain.handle('remove-server-provider', async (_event, serverId: string): Promise<void> => {
      await this.oauthService.removeServerProvider(serverId)
    })

    ipcMain.handle('get-server-providers', async (): Promise<ServerProvider[]> => {
      return await this.oauthService.getServerProviders()
    })

    ipcMain.handle('start-server-provider-oauth', async (_event, serverId: string, provider: string): Promise<void> => {
      await this.oauthService.startServerProviderOAuthFlow(serverId, provider)
    })

    ipcMain.handle('fetch-onboarding-github-provider', async (): Promise<void> => {
      await this.oauthService.fetchOnboardingGithubProvider()
    })

    ipcMain.handle('check-onboarding-github-token', async (): Promise<boolean> => {
      return await this.oauthService.checkOnboardingTokenExists()
    })

    ipcMain.handle('clear-onboarding-github-token', async (): Promise<void> => {
      await this.oauthService.clearOnboardingToken()
    })

    ipcMain.handle('check-onboarding-completed', async (): Promise<boolean> => {
      return await this.checkOnboardingCompleted()
    })

    ipcMain.handle('mark-onboarding-completed', async (): Promise<void> => {
      await this.markOnboardingCompleted()
    })

    ipcMain.handle('fetch-server-providers', async (_event, serverId: string): Promise<ServerProviderInfo[]> => {
      return await this.oauthService.fetchServerProviders(serverId)
    })

    // Handle requests for all messages (now stored in renderer IndexedDB)

    // Handle unified message response (approve/reject)
    // Database update happens in renderer, this just forwards to WebSocket
    ipcMain.handle('send-message-response', async (_event, message: Message, feedback?: string): Promise<void> => {
      // Send response back through WebSocket if needed
      this.sendWebSocketResponse(message)

      // Send to executor based on status
      if (this.executorWSClient) {
        if (message.status === 'approved') {
          this.executorWSClient.sendApproval(message.id, feedback)
        }
        else if (message.status === 'rejected') {
          this.executorWSClient.sendRejection(message.id, feedback)
        }
      }
    })

    // Handle approve collection share
    ipcMain.handle('approve-collection-share', async (_event, messageId: string, updatedRequest: CollectionRequest): Promise<void> => {
      // Only send WebSocket response, database update happens in renderer
      this.handleApproveCollectionShare(messageId, updatedRequest)
    })

    // Handle reject collection share
    ipcMain.handle('reject-collection-share', async (_event, messageId: string): Promise<void> => {
      // Only send WebSocket response, database update happens in renderer
      this.handleRejectCollectionShare(messageId)
    })

    // Handle send prompt collection request
    ipcMain.handle('send-prompt-collection-request', (_event, context: { scripts: Script[], prompt: string, images: string[] }): void => {
      if (this.wsServer) {
        const scripts = context.scripts
        const prompt = context.prompt
        const images = context.images
        const requestId = crypto.randomBytes(16).toString('hex')
        const promptRequest = {
          type: 'prompt-response',
          id: requestId,
          requestId: requestId,
          scripts: scripts,
          prompt: prompt,
          images: images,
          timestamp: Date.now(),
        }

        // Store the request ID so we can match the response
        // Send to all connected WebSocket clients
        this.wsServer.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(promptRequest))
          }
        })
      }
    })

    // Handle show all messages
    ipcMain.on('show-messages', (): void => {
      this.windowManager.showWindow()
    })

    // WebSocket key management
    ipcMain.handle('get-ws-connection-key', (): string | null => {
      return this.wsConnectionKey
    })

    ipcMain.handle('get-ws-connection-url', (): string => {
      return this.getWebSocketConnectionUrl()
    })

    ipcMain.handle('regenerate-ws-key', async (): Promise<{ key: string, createdAt: number }> => {
      await this.generateNewWebSocketKey()
      return {
        key: this.wsConnectionKey!,
        createdAt: Date.now(),
      }
    })

    ipcMain.handle('get-ws-key-info', (): { key: string | null, createdAt: number | null, keyFile: string } => {
      let createdAt: number | null = null
      let key: string | null = null
      try {
        if (fs.existsSync(this.WS_KEY_FILE)) {
          const keyData = fs.readFileSync(this.WS_KEY_FILE, 'utf8')
          const parsedData = JSON.parse(keyData)
          createdAt = parsedData.createdAt
          key = parsedData.key
        }
      }
      catch (error) {
        console.error('Error reading key file:', error)
      }

      return {
        key: key,
        createdAt,
        keyFile: this.WS_KEY_FILE,
      }
    })

    // Encryption key management
    ipcMain.handle('get-encryption-key', (): string | null => {
      return this.encryptionKey
    })

    ipcMain.handle('regenerate-encryption-key', async (): Promise<{ key: string, createdAt: number, source: 'environment' | 'generated' | null }> => {
      // Only allow regeneration if not using environment variable
      if (process.env.ENCRYPTION_KEY && this.encryptionKey === process.env.ENCRYPTION_KEY) {
        throw new Error('Cannot regenerate encryption key when using environment variable')
      }

      await this.generateNewEncryptionKey()
      return {
        key: this.encryptionKey!,
        createdAt: Date.now(),
        source: 'generated',
      }
    })

    ipcMain.handle('get-encryption-key-info', (): { key: string | null, createdAt: number | null, keyFile: string, source: 'environment' | 'generated' | null } => {
      return this.getEncryptionKeyInfo()
    })

    // External URL handling
    ipcMain.handle('open-external-url', async (_event, url: string): Promise<void> => {
      await shell.openExternal(url)
    })

    // Settings management
    ipcMain.handle('get-settings', (): { showNotifications: boolean, automaticCodeApproval: CodeApprovalLevel, automaticResponseApproval: ResponseApprovalLevel, fullCodeExecution: boolean, settingsFile: string, updatedAt: number | null } => {
      return this.getSettingsInfo()
    })

    ipcMain.handle('set-show-notifications', async (_event, show: boolean): Promise<void> => {
      this.showNotifications = show
      await this.saveSettings()
    })

    ipcMain.handle('get-show-notifications', (): boolean => {
      return this.showNotifications
    })

    ipcMain.handle('set-automatic-code-approval', async (_event, level: CodeApprovalLevel): Promise<void> => {
      this.automaticCodeApproval = level
      await this.saveSettings()
    })

    ipcMain.handle('get-automatic-code-approval', (): CodeApprovalLevel => {
      return this.automaticCodeApproval
    })

    ipcMain.handle('set-automatic-response-approval', async (_event, level: ResponseApprovalLevel): Promise<void> => {
      this.automaticResponseApproval = level
      await this.saveSettings()
    })

    ipcMain.handle('get-automatic-response-approval', (): ResponseApprovalLevel => {
      return this.automaticResponseApproval
    })

    ipcMain.handle('set-full-code-execution', async (_event, enabled: boolean): Promise<void> => {
      this.fullCodeExecution = enabled
      await this.saveSettings()

      // Create or remove the .keyboard-mcp/full-code-execution file
      if (enabled) {
        // Ensure .keyboard-mcp directory exists
        if (!fs.existsSync(this.STORAGE_DIR)) {
          fs.mkdirSync(this.STORAGE_DIR, { recursive: true, mode: 0o700 })
        }
        // Create the file with enabled: true
        fs.writeFileSync(this.FULL_CODE_EXECUTION_FILE, JSON.stringify({ enabled: true }, null, 2), { mode: 0o600 })
      }
      else {
        // Remove the file if it exists
        if (fs.existsSync(this.FULL_CODE_EXECUTION_FILE)) {
          fs.unlinkSync(this.FULL_CODE_EXECUTION_FILE)
        }
      }
    })

    ipcMain.handle('get-full-code-execution', (): boolean => {
      return this.fullCodeExecution
    })

    ipcMain.handle('get-assets-path', (): string => {
      return getAssetsPath()
    })

    // Database operations - handle pending count updates from renderer
    ipcMain.handle('db:pending-count-updated', (_event, count: number): void => {
      this.pendingCount = count
      this.trayManager.updateTrayIcon()
    })

    // Database operations - get pending count (for REST API)
    ipcMain.handle('db:get-pending-count', async (): Promise<number> => {
      return this.pendingCount
    })

    // Database operations - clear all messages
    ipcMain.handle('db:clear-all-messages', async (): Promise<void> => {
      this.clearAllMessages()
    })

    // Executor WebSocket client IPC handlers
    ipcMain.handle('get-executor-connection-status', async () => {
      if (!this.executorWSClient) {
        return { connected: false }
      }
      return await this.executorWSClient.getEnhancedConnectionInfo()
    })

    ipcMain.handle('reconnect-to-executor', async (): Promise<boolean> => {
      if (this.executorWSClient) {
        return await this.executorWSClient.reconnect()
      }
      return false
    })

    ipcMain.handle('disconnect-from-executor', (): void => {
      if (this.executorWSClient) {
        this.executorWSClient.disconnect()
      }

      // Disconnect from SSE when executor disconnects
      if (this.sseBackgroundService) {
        this.sseBackgroundService.disconnect()
      }
    })

    // Codespace discovery and management IPC handlers
    ipcMain.handle('discover-codespaces', async () => {
      if (!this.executorWSClient) {
        return []
      }
      return await this.executorWSClient.discoverCodespaces()
    })

    ipcMain.handle('connect-to-codespace', async (_event, codespaceName: string): Promise<boolean> => {
      if (!this.executorWSClient) {
        return false
      }
      return await this.executorWSClient.connectToSpecificCodespace(codespaceName)
    })

    ipcMain.handle('connect-to-best-codespace', async (): Promise<boolean> => {
      if (!this.executorWSClient) {
        return false
      }
      return await this.executorWSClient.autoConnect()
    })

    ipcMain.handle('connect-to-localhost', (): void => {
      if (this.executorWSClient) {
        this.executorWSClient.connectToLocalhost()
      }
    })

    ipcMain.handle('get-last-known-codespaces', () => {
      if (!this.executorWSClient) {
        return []
      }
      return this.executorWSClient.getLastKnownCodespaces()
    })

    ipcMain.handle('send-manual-ping', async () => {
      if (!this.executorWSClient) {
        return {
          success: false,
          error: 'WebSocket client not available',
          connectionHealth: {
            isAlive: false,
            lastActivity: 0,
            lastPong: 0,
            timeSinceLastActivity: 0,
            timeSinceLastPong: 0,
            connected: false,
          },
        }
      }
      return await this.executorWSClient.sendManualPing()
    })

    // Auto-updater IPC handlers (only available on macOS and Windows)
    ipcMain.handle('check-for-updates', async (): Promise<void> => {
      if (process.platform === 'darwin' || process.platform === 'win32') {
        autoUpdater.checkForUpdates()
      }
      else {
        throw new Error('Auto-updater not supported on this platform')
      }
    })

    ipcMain.handle('download-update', async (): Promise<void> => {
      if (process.platform === 'darwin' || process.platform === 'win32') {
        // On macOS and Windows, updates are downloaded automatically
        throw new Error('Manual update download not supported')
      }
      else {
        throw new Error('Auto-updater not supported on this platform')
      }
    })

    ipcMain.handle('quit-and-install', async (): Promise<void> => {
      if (process.platform === 'darwin' || process.platform === 'win32') {
        autoUpdater.quitAndInstall()
      }
      else {
        throw new Error('Auto-updater not supported on this platform')
      }
    })

    // Test methods for development
    ipcMain.handle('test-update-available', async (): Promise<void> => {
      this.windowManager.sendMessage('update-available', {
        version: '1.0.1',
        releaseDate: new Date().toISOString(),
        releaseName: 'Test Update',
        releaseNotes: 'This is a test update notification',
      })
    })

    ipcMain.handle('test-download-update', async (): Promise<void> => {
      // Simulate download progress
      for (let i = 0; i <= 100; i += 10) {
        this.windowManager.sendMessage('download-progress', {
          percent: i,
          transferred: i * 1024 * 1024,
          total: 100 * 1024 * 1024,
          bytesPerSecond: 1024 * 1024,
        })
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    })

    ipcMain.handle('test-update-downloaded', async (): Promise<void> => {
      this.windowManager.sendMessage('update-downloaded', {
        version: '1.0.1',
        releaseDate: new Date().toISOString(),
        releaseName: 'Test Update',
        releaseNotes: 'This is a test update notification',
      })
    })

    // AI Provider management IPC handlers
    ipcMain.handle('set-ai-provider-key', async (_event, provider: string, apiKey: string): Promise<void> => {
      try {
        aiRuntime.setApiKey(provider, apiKey)
      }
      catch (error) {
        throw new Error(`Failed to save API key for ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    })

    ipcMain.handle('get-ai-provider-keys', async (): Promise<Array<{ provider: string, hasKey: boolean, configured: boolean }>> => {
      const providers = ['openai', 'anthropic', 'gemini']
      return providers.map(provider => ({
        provider,
        hasKey: aiRuntime.hasApiKey(provider),
        configured: aiRuntime.hasApiKey(provider) && aiRuntime.hasProvider(provider),
      }))
    })

    ipcMain.handle('remove-ai-provider-key', async (_event, provider: string): Promise<void> => {
      try {
        aiRuntime.removeApiKey(provider)
      }
      catch (error) {
        throw new Error(`Failed to remove API key for ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    })

    ipcMain.handle('test-ai-provider-connection', async (_event, provider: string): Promise<{ success: boolean, error?: string }> => {
      try {
        if (!aiRuntime.hasApiKey(provider)) {
          return { success: false, error: 'No API key configured' }
        }

        // Test with a simple message
        const testMessages = [{ role: 'user' as const, content: 'Hello' }]
        await aiRuntime.sendMessage(provider, testMessages, {})
        return { success: true }
      }
      catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Connection test failed',
        }
      }
    })

    ipcMain.handle('send-ai-message', async (_event, provider: string, messages: Array<{ role: 'user' | 'assistant' | 'system', content: string }>, config?: { model?: string }): Promise<string> => {
      try {
        const authTokens = this.authService.getAuthTokens()

        const response = await aiRuntime.sendMessage(provider, messages, config || {}, authTokens || undefined)

        return response.content
      }
      catch (error) {
        console.error('🚨 Main IPC send-ai-message error:', error)
        throw new Error(`Failed to send message to ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    })

    ipcMain.handle('send-ai-message-stream', async (event, provider: string, messages: Array<{ role: 'user' | 'assistant' | 'system', content: string }>, config?: { model?: string }): Promise<string> => {
      try {
        const authTokens = this.authService.getAuthTokens()

        // Start streaming in background
        const streamProcess = async () => {
          try {
            const generator = aiRuntime.streamMessage(provider, messages, config || {}, authTokens || undefined)

            for await (const chunk of generator) {
              event.sender.send('ai-stream-chunk', chunk)
            }

            event.sender.send('ai-stream-end')
          }
          catch (error) {
            console.error('🚨 Streaming error:', error)
            event.sender.send('ai-stream-error', error instanceof Error ? error.message : 'Unknown error')
          }
        }

        // Start streaming process
        streamProcess()

        return 'Stream started'
      }
      catch (error) {
        console.error('🚨 Main IPC send-ai-message-stream error:', error)
        throw new Error(`Failed to stream message to ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    })

    ipcMain.handle('web-search', async (_event, provider: string, query: string, company: string) => {
      try {
        const authTokens = this.authService.getAuthTokens()
        const accessToken = authTokens?.access_token || ''
        const response = await webSearch({ accessToken, query, company })
        return response
      }
      catch (error) {
        throw new Error(`Failed to perform web search with ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    })

    // Get user tokens from current WebSocket session
    ipcMain.handle('get-user-tokens', async (): Promise<{ tokensAvailable?: string[], error?: string }> => {
      try {
        // Use existing provider status logic from line 1917
        const providerStatus = await this.oauthService.getProviderAuthStatus()
        console.log('providerStatus', providerStatus)
        // Check ALL stored provider tokens (both direct and server provider tokens)
        const tokensAvailable = Object.entries(providerStatus)
          .filter(([, status]) => status?.authenticated)
          .map(([providerId]) => `KEYBOARD_PROVIDER_USER_TOKEN_FOR_${providerId.toUpperCase()}`)

        return { tokensAvailable }
      }
      catch (error) {
        console.error('❌ Failed to get user tokens:', error)
        return { error: error instanceof Error ? error.message : 'Unknown error' }
      }
    })

    // Get codespace information using GitHub PAT token
    ipcMain.handle('get-codespace-info', async (): Promise<CodespaceInfo> => {
      try {
        // For localhost connections, return basic info

        // For codespace connections, use the GitHubCodespacesService

        // Use the GitHubCodespacesService to fetch resources

        const result = await this.githubCodespacesService.fetchKeyNameAndResources()

        // Return the result directly since it already has the right shape
        if (!result.success) {
          return {
            success: false,
            error: result.error,
            status: result.status,
          }
        }

        return {
          success: true,
          data: result.data,
          status: result.status,
        }
      }
      catch (error) {
        console.error('❌ Failed to get codespace info:', error)
        return {
          success: false,
          error: { message: error instanceof Error ? error.message : 'Unknown error' },
        }
      }
    })
  }

  private handleApproveMessage(message: Message, feedback?: string): Message {
    // Update message status
    const updatedMessage = { ...message, status: 'approved' as const, feedback }

    // Send response back through WebSocket if needed
    this.sendWebSocketResponse(updatedMessage)
    // Send approval to executor
    if (this.executorWSClient) {
      this.executorWSClient.sendApproval(message.id, feedback)
    }

    return updatedMessage
  }

  private handleRejectMessage(messageId: string, feedback?: string): Partial<Message> {
    // Create message object for WebSocket response
    const message: Partial<Message> = {
      id: messageId,
      status: 'rejected',
      feedback,
      requiresResponse: true,
    }

    // Send response back through WebSocket if needed
    this.sendWebSocketResponse(message as Message)

    return message
  }

  private handleApproveCollectionShare(messageId: string, updatedRequest: CollectionRequest): Partial<ShareMessage> {
    // Create share message object for WebSocket response
    const shareMessage: Partial<ShareMessage> = {
      id: messageId,
      status: 'approved',
      collectionRequest: updatedRequest,
      type: 'collection-share',
    }

    // Send response back through WebSocket
    this.sendCollectionShareResponse(shareMessage as ShareMessage, 'approved', updatedRequest)

    return shareMessage
  }

  private handleRejectCollectionShare(messageId: string): Partial<ShareMessage> {
    // Create share message object for WebSocket response
    const shareMessage: Partial<ShareMessage> = {
      id: messageId,
      status: 'rejected',
      type: 'collection-share',
    }

    // Send response back through WebSocket
    this.sendCollectionShareResponse(shareMessage as ShareMessage, 'rejected')

    return shareMessage
  }

  private sendWebSocketResponse(message: Message): void {
    if (this.wsServer && message.requiresResponse) {
      // Send response to all connected WebSocket clients
      this.wsServer.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message))
        }
      })
    }
  }

  private sendCollectionShareResponse(shareMessage: ShareMessage, status: 'approved' | 'rejected', updatedRequest?: CollectionRequest): void {
    if (this.wsServer) {
      const response = {
        type: 'collection-share-response',
        id: shareMessage.id,
        status: status,
        timestamp: Date.now(),
        data: status === 'approved' ? updatedRequest : null,
      }

      // Send response to all connected WebSocket clients
      this.wsServer.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(response))
        }
      })
    }
  }

  private setupRestAPI(): void {
    this.restApiServer = createRestAPIServer({
      getMessages: () => [], // Messages now stored in renderer IndexedDB
      getAuthTokens: () => this.authService.getAuthTokens(),
      getWebSocketServerStatus: () => !!this.wsServer,
      updateMessageStatus: (messageId: string, status: 'approved' | 'rejected', feedback?: string) => {
        // Use helper method to handle message status update
        const message = status === 'rejected'
          ? this.handleRejectMessage(messageId, feedback)
          : this.handleApproveMessage({ id: messageId, requiresResponse: true } as Message, feedback)

        // Notify all renderer processes to update IndexedDB
        BrowserWindow.getAllWindows().forEach((win) => {
          win.webContents.send('message-status-updated', message)
        })

        return true
      },
    })

    this.restApiServer.start().catch((error: Error) => {
      console.error('Failed to start REST API server:', error)
    })
  }

  private cleanup(): void {
    if (this.restApiServer) {
      this.restApiServer.stop().catch((error: Error) => {
        console.error('Error stopping REST API server:', error)
      })
    }

    if (this.wsServer) {
      this.wsServer.close()
    }

    // Stop OAuth HTTP server - delegate to OAuthService
    if (this.oauthService) {
      this.oauthService.stopOAuthHttpServer()
    }

    // Disconnect from executor
    if (this.executorWSClient) {
      this.executorWSClient.disconnect()
    }

    // Disconnect from SSE when app is shutting down
    if (this.sseBackgroundService) {
      this.sseBackgroundService.disconnect()
    }

    this.trayManager.destroy()
    this.windowManager.destroy()
  }
}

// Create the app instance
new MenuBarNotificationApp()
