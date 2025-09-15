import * as crypto from 'crypto'
import { app, autoUpdater, ipcMain, Menu, Notification, shell } from 'electron'
import * as fs from 'fs'
import _ from 'lodash'
import * as os from 'os'
import * as path from 'path'
import * as WebSocket from 'ws'
import { setEncryptionKeyProvider } from './encryption'
import { GithubService } from './Github'
import { OAuthCallbackData, OAuthHttpServer } from './oauth-http-server'
import { PKCEParams as NewPKCEParams, OAuthProvider, OAuthProviderManager, ProviderTokens, ServerProvider, ServerProviderInfo } from './oauth-providers'
import { OAuthTokenStorage, StoredProviderTokens } from './oauth-token-storage'
import { PerProviderTokenStorage } from './per-provider-token-storage'
import { OAuthProviderConfig } from './provider-storage'
import { createRestAPIServer } from './rest-api'
import { TrayManager } from './tray-manager'
import { AuthorizeResponse, AuthTokens, CollectionRequest, ErrorResponse, Message, PKCEParams, ShareMessage, TokenResponse } from './types'
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
interface AuthUser {
  id?: string
  email?: string
  firstName?: string
  lastName?: string
  name?: string
  profile_picture?: string
}

// Types for auto-updater info
interface UpdateInfo {
  version?: string
  files?: unknown[]
  path?: string
  sha512?: string
  releaseDate?: string
}

// Types for onboarding GitHub provider response
interface OnboardingGitHubResponse {
  session_id: string
  authorization_url: string
  state: string
}

// Types for WebSocket message with collection request
interface WebSocketMessage {
  type: string
  id?: string
  data?: CollectionRequest
  requestId?: string
}

class MenuBarNotificationApp {
  private trayManager: TrayManager
  private windowManager: WindowManager
  private wsServer: WebSocket.Server | null = null
  private restApiServer: RestAPIServerInterface | null = null
  private messages: Message[] = []
  private shareMessages: ShareMessage[] = []
  private pendingCount: number = 0
  private readonly WS_PORT = 8080
  private readonly OAUTH_PORT = 8082
  private readonly OAUTH_SERVER_URL = process.env.OAUTH_SERVER_URL || 'https://api.keyboard.dev'
  private readonly SKIP_AUTH = process.env.SKIP_AUTH === 'true'
  private readonly CUSTOM_PROTOCOL = 'mcpauth'
  private currentPKCE: PKCEParams | null = null
  private authTokens: AuthTokens | null = null
  // New OAuth provider system (initialized later after encryption is ready)
  private oauthProviderManager!: OAuthProviderManager
  private githubService!: GithubService
  private oauthTokenStorage!: OAuthTokenStorage
  private perProviderTokenStorage!: PerProviderTokenStorage
  private currentProviderPKCE: NewPKCEParams | null = null
  private oauthHttpServer: OAuthHttpServer
  // WebSocket security
  private wsConnectionKey: string | null = null
  private readonly STORAGE_DIR = path.join(os.homedir(), '.keyboard-mcp')
  private readonly WS_KEY_FILE = path.join(os.homedir(), '.keyboard-mcp', '.keyboard-mcp-ws-key')
  private readonly ONBOARDING_COMPLETED_FILE = path.join(os.homedir(), '.keyboard-mcp', 'completed-onboarding')

  // Encryption key management
  private encryptionKey: string | null = null
  private readonly ENCRYPTION_KEY_FILE = path.join(os.homedir(), '.keyboard-mcp-encryption-key')
  private readonly VERSION_TIMESTAMP_FILE = path.join(os.homedir(), '.keyboard-mcp-version-timestamp.json')

  // Settings management
  private showNotifications: boolean = true
  private automaticCodeApproval: 'never' | 'low' | 'medium' | 'high' = 'never'
  private CODE_APPROVAL_ORDER = ['never', 'low', 'medium', 'high'] as const
  private automaticResponseApproval: boolean = false
  private readonly SETTINGS_FILE = path.join(os.homedir(), '.keyboard-mcp-settings')

  constructor() {
    // Initialize HTTP server (doesn't need encryption)
    this.oauthHttpServer = new OAuthHttpServer(this.OAUTH_PORT)

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
      getMessages: () => this.messages,
      getPendingCount: () => this.pendingCount,
    })

    // Set up encryption key provider
    setEncryptionKeyProvider({
      getActiveEncryptionKey: () => this.getActiveEncryptionKey(),
    })

    this.initializeApp()
  }

  private initializeApp(): void {
    // STEP 1: Handle single instance FIRST
    const gotTheLock = app.requestSingleInstanceLock()

    if (!gotTheLock) {
      app.quit()
      return
    }

    // STEP 2: Set up event listeners BEFORE app.whenReady()
    // Platform-specific protocol handling
    if (process.platform === 'darwin') {
      // Handle macOS open-url events (MUST be before app.whenReady())
      app.on('open-url', (event, url) => {
        event.preventDefault()

        // Only handle our custom protocol URLs, ignore HTTP URLs
        if (url.startsWith(`${this.CUSTOM_PROTOCOL}://`)) {
          // Custom protocol URLs should only go to legacy OAuth handler
          this.handleOAuthCallback(url)
        }
        // else {
        // }
      })
    }

    // Handle second instance (protocol callbacks for all platforms)
    app.on('second-instance', (_event, commandLine) => {
      // Find protocol URL in command line arguments
      const url = commandLine.find(arg => arg.startsWith(`${this.CUSTOM_PROTOCOL}://`))
      if (url) {
        // Custom protocol URLs should only go to legacy OAuth handler
        this.handleOAuthCallback(url)
      }

      // Show the window if it exists
      this.windowManager.showWindow()
    })

    // STEP 3: Register as default protocol client
    if (!app.isDefaultProtocolClient(this.CUSTOM_PROTOCOL)) {
      app.setAsDefaultProtocolClient(this.CUSTOM_PROTOCOL)
    }

    // STEP 4: App ready event
    app.whenReady().then(async () => {
      // Set application icon for notifications (especially important for macOS)
      const assetsPath = getAssetsPath()
      const iconPath = path.join(assetsPath, 'keyboard-dock.png')

      if (process.platform === 'darwin' && fs.existsSync(iconPath)) {
        // On macOS, set the dock icon which is used for notifications
        try {
          app.dock.setIcon(iconPath)
        }
        catch (error) {
          console.warn('Failed to set dock icon:', error)
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

      // NOW initialize OAuth provider system (after encryption is ready)
      await this.initializeOAuthProviderSystem()

      // Initialize GitHub service
      await this.initializeGithubService()

      // Configure auto-updater (only on macOS and Windows)
      if (process.platform === 'darwin' || process.platform === 'win32') {
        const feedURL = `https://api.keyboard.dev/update/${process.platform}/${app.getVersion()}`
        autoUpdater.setFeedURL({
          url: feedURL,
        })

        // Auto-updater event handlers
        autoUpdater.on('checking-for-update', () => {
          console.log('Checking for update...')
        })

        autoUpdater.on('update-available', (info: UpdateInfo) => {
          console.log('Update available:', info)
          // notify user
        })

        autoUpdater.on('update-not-available', () => {
          console.log('No update available')
        })

        autoUpdater.on('update-downloaded', () => {
          console.log('Update downloaded')
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
      this.setupIPC()

      // Request notification permissions on all platforms
      await this.requestNotificationPermissions()

      app.on('activate', () => {
        // On macOS, show window when app is activated
        this.windowManager.showWindow()
      })
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

  // OAuth Provider System Initialization
  /**
   * Initialize OAuth provider system after encryption is ready
   */
  private async initializeOAuthProviderSystem(): Promise<void> {
    try {
      // Initialize OAuth provider system
      this.oauthProviderManager = new OAuthProviderManager(this.CUSTOM_PROTOCOL)
      this.oauthTokenStorage = new OAuthTokenStorage() // Keep for migration
      this.perProviderTokenStorage = new PerProviderTokenStorage()

      // Inject main access token getter for server provider refresh
      this.oauthProviderManager.setMainAccessTokenGetter(() => this.getValidAccessToken())

      // Migrate from old storage format
      await this.migrateTokenStorage()
    }
    catch (error) {
      console.error('❌ Failed to initialize OAuth provider system:', error)
      throw error
    }
  }

  private async initializeGithubService(): Promise<void> {
    this.githubService = await new GithubService()
  }

  /**
   * Migrate tokens from old single-file storage to new per-provider storage
   */
  private async migrateTokenStorage(): Promise<void> {
    try {
      const oldTokens = await this.oauthTokenStorage.getAllTokens()
      if (Object.keys(oldTokens).length > 0) {
        await this.perProviderTokenStorage.migrateFromOldStorage(oldTokens)

        // After successful migration, optionally clear old storage
        // Uncomment the next line if you want to remove the old file after migration
        // await this.oauthTokenStorage.clearAllTokens();
      }
    }
    catch (error) {
      console.error('❌ Error during token storage migration:', error)
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
        else {
          console.warn('⚠️ ENCRYPTION_KEY environment variable is not 32 bytes, falling back to generated key')
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
          && ['never', 'low', 'medium', 'high'].includes(parsedData.automaticCodeApproval)) {
          this.automaticCodeApproval = parsedData.automaticCodeApproval as 'never' | 'low' | 'medium' | 'high'
        }
        if (typeof parsedData.automaticResponseApproval === 'boolean') {
          this.automaticResponseApproval = parsedData.automaticResponseApproval
        }
      }
    }
    catch (error) {
      console.error('❌ Error initializing settings:', error)
      // Use defaults if settings file is corrupted
      this.showNotifications = true
      this.automaticCodeApproval = 'never'
      this.automaticResponseApproval = false
    }
  }

  private async saveSettings(): Promise<void> {
    try {
      const settingsData = {
        showNotifications: this.showNotifications,
        automaticCodeApproval: this.automaticCodeApproval,
        automaticResponseApproval: this.automaticResponseApproval,
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

  private getSettingsInfo(): { showNotifications: boolean, automaticCodeApproval: 'never' | 'low' | 'medium' | 'high', automaticResponseApproval: boolean, settingsFile: string, updatedAt: number | null } {
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

  private generatePKCE(): PKCEParams {
    const codeVerifier = crypto.randomBytes(32).toString('base64url')
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url')
    const state = crypto.randomBytes(16).toString('hex')

    return { codeVerifier, codeChallenge, state }
  }

  // New OAuth provider methods
  private async startProviderOAuthFlow(providerId: string): Promise<void> {
    try {
      const provider = await this.oauthProviderManager.getProvider(providerId)
      if (!provider) {
        throw new Error(`Provider ${providerId} not found`)
      }

      if (!provider.clientId) {
        throw new Error(`Provider ${providerId} is not configured (missing client ID)`)
      }

      // Generate PKCE parameters
      this.currentProviderPKCE = this.oauthProviderManager.generatePKCE(providerId)

      // Start HTTP server to handle OAuth callback
      await this.oauthHttpServer.startServer((callbackData: OAuthCallbackData) => {
        this.handleOAuthHttpCallback(callbackData)
      })

      // Build authorization URL
      const authUrl = await this.oauthProviderManager.buildAuthorizationUrl(providerId, this.currentProviderPKCE)

      // Open browser for user authentication
      await shell.openExternal(authUrl)
    }
    catch (error) {
      console.error(`❌ OAuth flow error for ${providerId}:`, error)
      await this.notifyProviderAuthError(providerId, 'Failed to start authentication')
      this.oauthHttpServer.stopServer() // Clean up on error
      throw error
    }
  }

  private async handleProviderOAuthCallback(url: string): Promise<void> {
    try {
      const urlObj = new URL(url)
      const code = urlObj.searchParams.get('code')
      const state = urlObj.searchParams.get('state')
      const error = urlObj.searchParams.get('error')

      if (error) {
        throw new Error(`OAuth error: ${error} - ${urlObj.searchParams.get('error_description')}`)
      }

      if (!code || !state) {
        throw new Error('Missing authorization code or state')
      }

      if (!this.currentProviderPKCE || state !== this.currentProviderPKCE.state) {
        throw new Error('State mismatch - potential CSRF attack')
      }

      // Exchange code for tokens
      await this.exchangeProviderCodeForTokens(this.currentProviderPKCE.providerId, code, this.currentProviderPKCE)
    }
    catch (error) {
      console.error('❌ Provider OAuth callback error:', error)
      const providerId = this.currentProviderPKCE?.providerId || 'unknown'
      await this.notifyProviderAuthError(providerId, `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  // Server provider OAuth flow
  private async startServerProviderOAuthFlow(serverId: string, provider: string): Promise<void> {
    try {
      const server = await this.oauthProviderManager.getServerProvider(serverId)
      if (!server) {
        throw new Error(`Server provider ${serverId} not found`)
      }

      // Generate state for the flow
      const state = crypto.randomBytes(16).toString('hex')

      // Start HTTP server to handle OAuth callback
      await this.oauthHttpServer.startServer((callbackData: OAuthCallbackData) => {
        this.handleServerOAuthHttpCallback(callbackData, serverId, provider)
      })

      // Fetch authorization URL from server
      const accessToken = await this.getValidAccessToken()
      const { authUrl, sessionId } = await this.oauthProviderManager.fetchServerAuthorizationUrl(
        serverId,
        provider,
        state,
        accessToken || undefined,
      )

      // Store session info for callback
      this.currentProviderPKCE = {
        codeVerifier: '',
        codeChallenge: '',
        state: state,
        providerId: provider, // Use just the provider name (e.g., "google")
        sessionId: sessionId,
      }

      // Open browser for user authentication
      await shell.openExternal(authUrl)
    }
    catch (error) {
      console.error(`❌ Server OAuth flow error for ${serverId}/${provider}:`, error)
      this.notifyProviderAuthError(provider, 'Failed to start authentication')
      this.oauthHttpServer.stopServer() // Clean up on error
    }
  }

  private async fetchOnboardingGithubProvider(): Promise<void> {
    const provider = 'onboarding'

    const response = await fetch(`https://api.keyboard.dev/auth/keyboard_github/onboarding`)
    const data = await response.json() as OnboardingGitHubResponse
    const sessionId = data.session_id
    const authUrl = data.authorization_url
    const state = data.state
    this.currentProviderPKCE = {
      codeVerifier: '',
      codeChallenge: '',
      state: state,
      providerId: provider, // Use just the provider name (e.g., "google")
      sessionId: sessionId,
    }
    await this.oauthHttpServer.startServer((callbackData: OAuthCallbackData) => {
      this.handleServerOAuthHttpCallback(callbackData, 'onboarding', provider)
    })
    if (!authUrl) throw new Error('No authorization URL found')
    await shell.openExternal(authUrl)
  }

  private async handleServerOAuthHttpCallback(
    callbackData: OAuthCallbackData,
    serverId: string,
    provider: string,
  ): Promise<void> {
    try {
      console.log('handleServerOAuthHttpCallback', callbackData, serverId, provider)
      if (callbackData.error) {
        throw new Error(`OAuth error: ${callbackData.error} - ${callbackData.error_description || ''}`)
      }

      if (!callbackData.code || !callbackData.state) {
        throw new Error('Missing authorization code or state')
      }

      if (!this.currentProviderPKCE) {
        throw new Error('No session data stored - possible callback timeout')
      }

      if (callbackData.state !== this.currentProviderPKCE.state) {
        console.error('❌ State mismatch:', {
          received: callbackData.state,
          expected: this.currentProviderPKCE.state,
        })
        throw new Error('State mismatch - potential security issue')
      }

      // Exchange code for tokens using server
      const accessToken = await this.getValidAccessToken()
      const tokens = await this.oauthProviderManager.exchangeServerCodeForTokens(
        serverId,
        provider,
        callbackData.code,
        callbackData.state,
        this.currentProviderPKCE.sessionId!,
        accessToken || undefined,
      )
      // Store tokens securely
      await this.perProviderTokenStorage.storeTokens(tokens)
      if (provider === 'onboarding') {
        await this.perProviderTokenStorage.saveOnboardingTokens(tokens)
        await this.githubService.initializeToken()
        await this.githubService.createFork('keyboard-dev', 'codespace-executor')
        await this.githubService.createFork('keyboard-dev', 'app-creator')
      }

      this.currentProviderPKCE = null

      // Notify the renderer process
      const providerConfig = await this.oauthProviderManager.getProvider(provider)
      this.windowManager.sendMessage('provider-auth-success', {
        providerId: tokens.providerId,
        providerName: providerConfig?.name || provider,
        user: tokens.user,
        authenticated: true,
      })

      // Show the window after successful authentication
      this.windowManager.showWindow()

      // Show success notification
      this.showNotification({
        id: `auth-success-${tokens.providerId}`,
        title: `Server OAuth Authentication Successful`,
        body: `Successfully connected to ${serverId} (${provider})${tokens.user ? ` as ${tokens.user.name || tokens.user.email}` : ''}`,
        timestamp: Date.now(),
        priority: 'normal',
      })
    }
    catch (error) {
      console.error(`❌ Server OAuth callback error for ${serverId}/${provider}:`, error)
      this.notifyProviderAuthError(provider, `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async handleOAuthHttpCallback(callbackData: OAuthCallbackData): Promise<void> {
    try {
      if (callbackData.error) {
        throw new Error(`OAuth error: ${callbackData.error} - ${callbackData.error_description || ''}`)
      }

      if (!callbackData.code || !callbackData.state) {
        throw new Error('Missing authorization code or state')
      }

      if (!this.currentProviderPKCE) {
        throw new Error('No PKCE parameters stored - possible callback timeout or duplicate callback')
      }

      if (callbackData.state !== this.currentProviderPKCE.state) {
        console.error('❌ State mismatch details:', {
          received: callbackData.state,
          expected: this.currentProviderPKCE.state,
          providerId: this.currentProviderPKCE.providerId,
        })
        throw new Error('State mismatch - potential CSRF attack')
      }

      // Exchange code for tokens
      await this.exchangeProviderCodeForTokens(this.currentProviderPKCE.providerId, callbackData.code, this.currentProviderPKCE)
    }
    catch (error) {
      console.error('❌ OAuth HTTP callback error:', error)
      const providerId = this.currentProviderPKCE?.providerId || 'unknown'
      this.notifyProviderAuthError(providerId, `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async exchangeProviderCodeForTokens(providerId: string, code: string, pkceParams: NewPKCEParams): Promise<void> {
    try {
      // Exchange code for tokens using provider manager
      const tokens = await this.oauthProviderManager.exchangeCodeForTokens(providerId, code, pkceParams)

      // Store tokens securely
      await this.perProviderTokenStorage.storeTokens(tokens)

      // Clear PKCE data
      this.currentProviderPKCE = null

      // Get provider info for notifications
      const provider = await this.oauthProviderManager.getProvider(providerId)
      const providerName = provider?.name || providerId

      // Notify the renderer process
      this.windowManager.sendMessage('provider-auth-success', {
        providerId: providerId,
        providerName: providerName,
        user: tokens.user,
        authenticated: true,
      })

      // Show the window after successful authentication
      this.windowManager.showWindow()

      // Show success notification
      this.showNotification({
        id: `auth-success-${providerId}`,
        title: `${providerName} Authentication Successful`,
        body: `Successfully connected to ${providerName}${tokens.user ? ` as ${tokens.user.name || tokens.user.email}` : ''}`,
        timestamp: Date.now(),
        priority: 'normal',
      })
    }
    catch (error) {
      console.error(`❌ Token exchange error for ${providerId}:`, error)
      await this.notifyProviderAuthError(providerId, `Token exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async refreshProviderTokens(providerId: string, refreshToken: string): Promise<ProviderTokens> {
    return await this.oauthProviderManager.refreshTokens(providerId, refreshToken)
  }

  private async getValidProviderAccessToken(providerId: string): Promise<string | null> {
    return await this.perProviderTokenStorage.getValidAccessToken(
      providerId,
      this.refreshProviderTokens.bind(this),
    )
  }

  private async notifyProviderAuthError(providerId: string, message: string): Promise<void> {
    console.error(`🔐 Auth Error for ${providerId}:`, message)

    this.windowManager.sendMessage('provider-auth-error', {
      providerId,
      message,
    })

    const provider = await this.oauthProviderManager.getProvider(providerId)
    const providerName = provider?.name || providerId

    this.showNotification({
      id: `auth-error-${providerId}`,
      title: `${providerName} Authentication Error`,
      body: message,
      timestamp: Date.now(),
      priority: 'high',
    })
  }

  private async logoutProvider(providerId: string): Promise<void> {
    await this.perProviderTokenStorage.removeTokens(providerId)
    this.windowManager.sendMessage('provider-auth-logout', { providerId })
  }

  private async startOAuthFlow(): Promise<void> {
    try {
      // Generate PKCE parameters
      this.currentPKCE = this.generatePKCE()

      // Get authorization URL from server
      const params = new URLSearchParams({
        redirect_uri: `${this.CUSTOM_PROTOCOL}://callback`,
        state: this.currentPKCE.state,
        code_challenge: this.currentPKCE.codeChallenge,
        code_challenge_method: 'S256',
      })

      const response = await fetch(`${this.OAUTH_SERVER_URL}/oauth/authorize?${params}`)

      if (!response.ok) {
        throw new Error(`Failed to get authorization URL: ${response.statusText}`)
      }

      const data = await response.json() as AuthorizeResponse

      // Open browser for user authentication
      await shell.openExternal(data.authorization_url)
    }
    catch (error) {
      console.error('❌ OAuth flow error:', error)
      this.notifyAuthError('Failed to start authentication')
    }
  }

  private async handleOAuthCallback(url: string): Promise<void> {
    try {
      const urlObj = new URL(url)
      const code = urlObj.searchParams.get('code')
      const state = urlObj.searchParams.get('state')
      const error = urlObj.searchParams.get('error')

      if (error) {
        throw new Error(`OAuth error: ${error} - ${urlObj.searchParams.get('error_description')}`)
      }

      if (!code || !state) {
        throw new Error('Missing authorization code or state')
      }

      if (!this.currentPKCE || state !== this.currentPKCE.state) {
        throw new Error('State mismatch - potential CSRF attack')
      }

      // Exchange code for tokens
      await this.exchangeCodeForTokens(code)
    }
    catch (error) {
      console.error('❌ OAuth callback error:', error)
      this.notifyAuthError(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async exchangeCodeForTokens(code: string): Promise<void> {
    try {
      if (!this.currentPKCE) {
        throw new Error('No PKCE parameters available')
      }

      const response = await fetch(`${this.OAUTH_SERVER_URL}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code,
          redirect_uri: `${this.CUSTOM_PROTOCOL}://callback`,
          code_verifier: this.currentPKCE.codeVerifier,
          grant_type: 'authorization_code',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as ErrorResponse
        throw new Error(`Token exchange failed: ${errorData.error_description || response.statusText}`)
      }

      const tokens = await response.json() as TokenResponse
      // Calculate expiration time and create AuthTokens object
      const authTokens: AuthTokens = {
        ...tokens,
        expires_at: Date.now() + (tokens.expires_in * 1000),
      }

      this.authTokens = authTokens
      this.currentPKCE = null // Clear PKCE data

      // Notify the renderer process
      this.windowManager.sendMessage('auth-success', {
        user: tokens.user,
        authenticated: true,
      })

      // Show the window after successful authentication
      this.windowManager.showWindow()

      // Show success notification
      this.showNotification({
        id: 'auth-success',
        title: 'Authentication Successful',
        body: `Welcome back, ${tokens.user.firstName || tokens.user.email}!`,
        timestamp: Date.now(),
        priority: 'normal',
      })
    }
    catch (error) {
      console.error('❌ Token exchange error:', error)
      this.notifyAuthError(`Token exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async refreshTokens(): Promise<boolean> {
    try {
      if (!this.authTokens?.refresh_token) {
        return false
      }

      const response = await fetch(`${this.OAUTH_SERVER_URL}/oauth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: this.authTokens.refresh_token,
          grant_type: 'refresh_token',
        }),
      })

      if (!response.ok) {
        console.error('❌ Token refresh failed:', response.statusText)
        return false
      }

      const tokens = await response.json() as TokenResponse

      // Update tokens
      this.authTokens = {
        ...this.authTokens,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        expires_at: Date.now() + (tokens.expires_in * 1000),
      }

      return true
    }
    catch (error) {
      console.error('❌ Token refresh error:', error)
      return false
    }
  }

  private async getValidAccessToken(): Promise<string | null> {
    if (!this.authTokens) {
      return null
    }

    // Check if token is expired (with 5 minute buffer)
    const bufferTime = 5 * 60 * 1000 // 5 minutes
    if (Date.now() >= (this.authTokens.expires_at - bufferTime)) {
      const refreshed = await this.refreshTokens()
      if (!refreshed) {
        this.authTokens = null
        return null
      }
    }

    return this.authTokens.access_token
  }

  private async getScripts(): Promise<any[]> {
    const accessToken = await this.getValidAccessToken()
    const response = await fetch(`${this.OAUTH_SERVER_URL}/api/scripts`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to get scripts')
    }
    const scriptsResponse: any = await response.json()
    const scripts = scriptsResponse?.scripts || []
    return scripts
  }

  private notifyAuthError(message: string): void {
    console.error('🔐 Auth Error:', message)

    this.windowManager.sendMessage('auth-error', { message })

    this.showNotification({
      id: 'auth-error',
      title: 'Authentication Error',
      body: message,
      timestamp: Date.now(),
      priority: 'high',
    })
  }

  private logout(): void {
    this.authTokens = null
    this.currentPKCE = null

    this.windowManager.sendMessage('auth-logout')
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

          // Handle token request (legacy OAuth)
          if (message.type === 'request-token') {
            const token = await this.getValidAccessToken()

            const tokenResponse = {
              type: 'auth-token',
              token: token || (this.SKIP_AUTH ? 'test-token' : null),
              timestamp: Date.now(),
              requestId: message.requestId, // Echo back request ID if provided
              authenticated: !!token || this.SKIP_AUTH,
              user: token ? this.authTokens?.user : (this.SKIP_AUTH ? { email: 'test@example.com', firstName: 'Test' } : null),
            }

            ws.send(JSON.stringify(tokenResponse))
            return
          }

          // Handle provider token request (new OAuth provider system)
          if (message.type === 'request-provider-token') {
            const { providerId } = message

            if (!providerId) {
              ws.send(JSON.stringify({
                type: 'provider-auth-token',
                error: 'Provider ID is required',
                timestamp: Date.now(),
                requestId: message.requestId,
              }))
              return
            }

            try {
              const token = await this.getValidProviderAccessToken(providerId.toLowerCase())
              const providerStatus = await this.perProviderTokenStorage.getProviderStatus()
              const providerInfo = providerStatus[providerId]
              const provider = await this.oauthProviderManager.getProvider(providerId)

              const tokenResponse = {
                type: 'provider-auth-token',
                providerId: providerId,
                token: token,
                timestamp: Date.now(),
                requestId: message.requestId,
                authenticated: !!token || this.SKIP_AUTH,
                user: providerInfo?.user || (this.SKIP_AUTH ? { email: 'test@example.com', firstName: 'Test Provider' } : null),
                providerName: provider?.name || providerId,
              }

              ws.send(JSON.stringify(tokenResponse))
            }
            catch (error) {
              ws.send(JSON.stringify({
                type: 'provider-auth-token',
                providerId: providerId,
                error: `Failed to get token: ${error instanceof Error ? error.message : 'Unknown error'}`,
                timestamp: Date.now(),
                requestId: message.requestId,
              }))
            }
            return
          }

          // Handle provider status request
          if (message.type === 'request-provider-status') {
            try {
              const providerStatus = await this.perProviderTokenStorage.getProviderStatus()

              // Check ALL stored provider tokens (both direct and server provider tokens)
              const tokensAvailable = Object.entries(providerStatus)
                .filter(([, status]) => status?.authenticated)
                .map(([providerId]) => `KEYBOARD_PROVIDER_USER_TOKEN_FOR_${providerId.toUpperCase()}`)

              const statusResponse = {
                type: 'user-tokens-available',
                tokensAvailable: tokensAvailable,
                timestamp: Date.now(),
                requestId: message.requestId,
              }

              ws.send(JSON.stringify(statusResponse))
            }
            catch (error) {
              ws.send(JSON.stringify({
                type: 'user-tokens-available',
                error: `Failed to get provider status: ${error instanceof Error ? error.message : 'Unknown error'}`,
                timestamp: Date.now(),
                requestId: message.requestId,
              }))
            }
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

    // Store the share message
    this.shareMessages.push(shareMessage)

    // Update pending count (include share messages)
    this.pendingCount = this.messages.filter(m => m.status === 'pending' || !m.status).length
      + this.shareMessages.filter(m => m.status === 'pending' || !m.status).length
    this.trayManager.updateTrayIcon()

    // Send to renderer via collection-share-request event
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

    // Store the message
    this.messages.push(message)

    switch (message.title) {
      case 'Security Evaluation Request': {
        const { risk_level } = message
        if (!risk_level) break

        const riskLevelIndex = this.CODE_APPROVAL_ORDER.indexOf(risk_level)
        const automaticCodeApprovalIndex = this.CODE_APPROVAL_ORDER.indexOf(this.automaticCodeApproval)
        if (riskLevelIndex <= automaticCodeApprovalIndex) {
          message.status = 'approved'
        }

        break
      }

      case 'code response approval': {
        const { codespaceResponse } = message
        if (!codespaceResponse) break

        const { data: codespaceResponseData } = codespaceResponse
        const { stderr } = codespaceResponseData
        if (!stderr && this.automaticResponseApproval) {
          message.status = 'approved'
        }

        break
      }
    }

    if (message.status === 'approved') {
      this.handleApproveMessage(message)
    }

    // Update pending count
    this.pendingCount = this.messages.filter(m => m.status === 'pending' || !m.status).length
    this.trayManager.updateTrayIcon()

    // Send to renderer via websocket-message event
    this.windowManager.sendMessage('websocket-message', message)

    // Auto-show window for high priority messages
    this.windowManager.showWindow()
    // if (message.priority === 'high') {
    //   this.windowManager.showWindow()
    // }
  }

  private showNotification(message: Message): void {
    if (!Notification.isSupported() || !this.showNotifications) {
      return
    }

    try {
      const assetsPath = getAssetsPath()
      const iconPath = path.join(assetsPath, 'keyboard-dock.png')

      const notification = new Notification({
        title: message.title,
        body: message.body,
        urgency: message.priority === 'high' ? 'critical' : 'normal',
        icon: iconPath,
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
    this.messages = []
    this.pendingCount = 0
    this.trayManager.updateTrayIcon()

    // Notify renderer
    this.windowManager.sendMessage('messages-cleared')
  }

  private setupIPC(): void {
    // OAuth-related IPC handlers (Legacy)
    ipcMain.handle('start-oauth', async (): Promise<void> => {
      await this.startOAuthFlow()
    })

    ipcMain.handle('get-auth-status', (): { authenticated: boolean, user?: AuthUser } => {
      return {
        authenticated: !!this.authTokens,
        user: this.authTokens?.user,
      }
    })

    ipcMain.handle('get-version-install-date', async (): Promise<Date | null> => {
      return await this.getCurrentVersionInstallDate()
    })

    ipcMain.handle('logout', (): void => {
      this.logout()
    })

    ipcMain.handle('get-access-token', async (): Promise<string | null> => {
      return await this.getValidAccessToken()
    })

    ipcMain.handle('get-scripts', async (): Promise<any[]> => {
      return await this.getScripts()
    })

    // New OAuth Provider IPC handlers
    ipcMain.handle('get-available-providers', async (): Promise<OAuthProvider[]> => {
      return await this.oauthProviderManager.getAvailableProviders()
    })

    ipcMain.handle('start-provider-oauth', async (_event, providerId: string): Promise<void> => {
      await this.startProviderOAuthFlow(providerId)
    })

    ipcMain.handle('get-provider-auth-status', async (): Promise<Record<string, unknown>> => {
      return await this.perProviderTokenStorage.getProviderStatus()
    })

    ipcMain.handle('get-provider-access-token', async (_event, providerId: string): Promise<string | null> => {
      return await this.getValidProviderAccessToken(providerId)
    })

    ipcMain.handle('logout-provider', async (_event, providerId: string): Promise<void> => {
      await this.logoutProvider(providerId)
    })

    ipcMain.handle('get-provider-tokens', async (_event, providerId: string): Promise<StoredProviderTokens | null> => {
      return await this.perProviderTokenStorage.getTokens(providerId)
    })

    ipcMain.handle('refresh-provider-tokens', async (_event, providerId: string): Promise<boolean> => {
      try {
        const tokens = await this.perProviderTokenStorage.getTokens(providerId)
        if (!tokens?.refresh_token) {
          return false
        }

        const refreshedTokens = await this.refreshProviderTokens(providerId, tokens.refresh_token)
        await this.perProviderTokenStorage.storeTokens(refreshedTokens)
        return true
      }
      catch (error) {
        console.error(`Failed to refresh tokens for ${providerId}:`, error)
        return false
      }
    })

    ipcMain.handle('clear-all-provider-tokens', async (): Promise<void> => {
      await this.perProviderTokenStorage.clearAllTokens()
    })

    ipcMain.handle('get-oauth-storage-info', (): Record<string, unknown> => {
      return {
        ...this.perProviderTokenStorage.getStorageInfo(),
        providerStorage: this.oauthProviderManager.getProviderStorageInfo(),
      }
    })

    // Manual Provider Management IPC handlers
    ipcMain.handle('get-all-provider-configs', async (): Promise<OAuthProviderConfig[]> => {
      return await this.oauthProviderManager.getAllProviderConfigs()
    })

    ipcMain.handle('save-provider-config', async (_event, config: Omit<OAuthProviderConfig, 'createdAt' | 'updatedAt'>): Promise<void> => {
      await this.oauthProviderManager.saveProviderConfig(config)
    })

    ipcMain.handle('remove-provider-config', async (_event, providerId: string): Promise<void> => {
      await this.oauthProviderManager.removeProviderConfig(providerId)
    })

    ipcMain.handle('get-provider-config', async (_event, providerId: string): Promise<OAuthProviderConfig | null> => {
      const provider = await this.oauthProviderManager.getProvider(providerId)
      if (!provider) return null

      // Get full config including metadata
      const configs = await this.oauthProviderManager.getAllProviderConfigs()
      return configs.find(c => c.id === providerId) || null
    })

    // Server Provider IPC handlers
    ipcMain.handle('add-server-provider', async (_event, server: ServerProvider): Promise<void> => {
      await this.oauthProviderManager.addServerProvider(server)
    })

    ipcMain.handle('remove-server-provider', async (_event, serverId: string): Promise<void> => {
      await this.oauthProviderManager.removeServerProvider(serverId)
    })

    ipcMain.handle('get-server-providers', async (): Promise<ServerProvider[]> => {
      return await this.oauthProviderManager.getServerProviders()
    })

    ipcMain.handle('start-server-provider-oauth', async (_event, serverId: string, provider: string): Promise<void> => {
      await this.startServerProviderOAuthFlow(serverId, provider)
    })

    ipcMain.handle('fetch-onboarding-github-provider', async (): Promise<void> => {
      await this.fetchOnboardingGithubProvider()
    })

    ipcMain.handle('check-onboarding-github-token', async (): Promise<boolean> => {
      return await this.perProviderTokenStorage.checkOnboardingTokenExists()
    })

    ipcMain.handle('clear-onboarding-github-token', async (): Promise<void> => {
      await this.perProviderTokenStorage.clearOnboardingToken()
    })

    ipcMain.handle('check-onboarding-completed', async (): Promise<boolean> => {
      return await this.checkOnboardingCompleted()
    })

    ipcMain.handle('mark-onboarding-completed', async (): Promise<void> => {
      await this.markOnboardingCompleted()
    })

    ipcMain.handle('fetch-server-providers', async (event, serverId: string): Promise<ServerProviderInfo[]> => {
      const accessToken = await this.getValidAccessToken()
      const serverProviders = await this.oauthProviderManager.fetchServerProviders(serverId, accessToken || undefined)
      return serverProviders
    })

    // Handle requests for all messages
    ipcMain.handle('get-messages', (): Message[] => {
      return this.messages
    })

    // Handle requests for share messages
    ipcMain.handle('get-share-messages', (): ShareMessage[] => {
      return this.shareMessages
    })

    // Handle mark as read
    ipcMain.handle('mark-message-read', (_event, messageId: string): void => {
      const message = this.messages.find(msg => msg.id === messageId)
      if (message) {
        message.read = true
      }
    })

    // Handle delete message
    ipcMain.handle('delete-message', (_event, messageId: string): void => {
      this.messages = this.messages.filter(msg => msg.id !== messageId)
      this.pendingCount = this.messages.filter(m => m.status === 'pending' || !m.status).length
      this.trayManager.updateTrayIcon()
    })

    // Handle approve message
    ipcMain.handle('approve-message', (_event, message: Message, feedback?: string): void => {
      return this.handleApproveMessage(message, feedback)
    })

    // Handle approve collection share
    ipcMain.handle('approve-collection-share', (event, messageId: string, updatedRequest: CollectionRequest): void => {
      const shareMessage = this.shareMessages.find(msg => msg.id === messageId)
      if (shareMessage) {
        shareMessage.status = 'approved'
        shareMessage.collectionRequest = updatedRequest

        // Update pending count
        this.pendingCount = this.messages.filter(m => m.status === 'pending' || !m.status).length + this.shareMessages.filter(m => m.status === 'pending' || !m.status).length
        this.trayManager.updateTrayIcon()

        // Send response back through WebSocket
        this.sendCollectionShareResponse(shareMessage, 'approved', updatedRequest)
      }
    })

    // Handle reject collection share
    ipcMain.handle('reject-collection-share', (event, messageId: string): void => {
      const shareMessage = this.shareMessages.find(msg => msg.id === messageId)
      if (shareMessage) {
        shareMessage.status = 'rejected'

        // Update pending count
        this.pendingCount = this.messages.filter(m => m.status === 'pending' || !m.status).length + this.shareMessages.filter(m => m.status === 'pending' || !m.status).length
        this.trayManager.updateTrayIcon()

        // Send response back through WebSocket
        this.sendCollectionShareResponse(shareMessage, 'rejected')
      }
    })

    // Handle send prompt collection request
    ipcMain.handle('send-prompt-collection-request', (_event, context: any): void => {
        if (this.wsServer) {
          let scripts = context.scripts
          let prompt = context.prompt
          let images = context.images
          const requestId = crypto.randomBytes(16).toString('hex')
          const promptRequest = {
            type: 'prompt-response',
            id: requestId,
            requestId: requestId,
            scripts: scripts,
            prompt: prompt,
            images: images,
            timestamp: Date.now()
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

    // Handle reject message
    ipcMain.handle('reject-message', (_event, messageId: string, feedback?: string): void => {
      const message = this.messages.find(msg => msg.id === messageId)
      if (message) {
        message.status = 'rejected'
        message.feedback = feedback

        // Update pending count
        this.pendingCount = this.messages.filter(m => m.status === 'pending' || !m.status).length
        this.trayManager.updateTrayIcon()

        // Send response back through WebSocket if needed
        this.sendWebSocketResponse(message)
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
    ipcMain.handle('get-settings', (): { showNotifications: boolean, automaticCodeApproval: 'never' | 'low' | 'medium' | 'high', automaticResponseApproval: boolean, settingsFile: string, updatedAt: number | null } => {
      return this.getSettingsInfo()
    })

    ipcMain.handle('set-show-notifications', async (_event, show: boolean): Promise<void> => {
      this.showNotifications = show
      await this.saveSettings()
    })

    ipcMain.handle('get-show-notifications', (): boolean => {
      return this.showNotifications
    })

    ipcMain.handle('set-automatic-code-approval', async (_event, level: 'never' | 'low' | 'medium' | 'high'): Promise<void> => {
      this.automaticCodeApproval = level
      await this.saveSettings()
    })

    ipcMain.handle('get-automatic-code-approval', (): 'never' | 'low' | 'medium' | 'high' => {
      return this.automaticCodeApproval
    })

    ipcMain.handle('set-automatic-response-approval', async (_event, enabled: boolean): Promise<void> => {
      this.automaticResponseApproval = enabled
      await this.saveSettings()
    })

    ipcMain.handle('get-automatic-response-approval', (): boolean => {
      return this.automaticResponseApproval
    })

    ipcMain.handle('get-assets-path', (): string => {
      return getAssetsPath()
    })
  }

  private handleApproveMessage(message: Message, feedback?: string): void {
    const existingMessage = this.messages.find(msg => msg.id === message.id)

    if (!existingMessage) return

    // Update the existing message with the passed message data
    _.assign(existingMessage, message)
    existingMessage.status = 'approved'
    existingMessage.feedback = feedback

    // Update pending count
    this.pendingCount = this.messages.filter(m => m.status === 'pending' || !m.status).length
    this.trayManager.updateTrayIcon()

    // Send response back through WebSocket if needed
    this.sendWebSocketResponse(existingMessage)

    
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
      getMessages: () => this.messages,
      getAuthTokens: () => this.authTokens,
      getWebSocketServerStatus: () => !!this.wsServer,
      updateMessageStatus: (messageId: string, status: 'approved' | 'rejected', feedback?: string) => {
        const message = this.messages.find(msg => msg.id === messageId)
        if (message) {
          message.status = status
          message.feedback = feedback

          // Update pending count
          this.pendingCount = this.messages.filter(m => m.status === 'pending' || !m.status).length
          this.trayManager.updateTrayIcon()

          // Send response through WebSocket if needed
          this.sendWebSocketResponse(message)

          return true
        }
        return false
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

    // Stop OAuth HTTP server
    if (this.oauthHttpServer) {
      this.oauthHttpServer.stopServer()
    }

    this.trayManager.destroy()
    this.windowManager.destroy()
  }
}

// Create the app instance
new MenuBarNotificationApp()
