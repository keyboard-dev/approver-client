/**
 * Auto-Updater Service
 *
 * Centralizes all auto-update functionality for the application.
 * Supports both Squirrel (macOS) and NSIS (Windows) update formats
 * via electron-updater.
 *
 * Features:
 * - Cross-platform auto-updates (macOS, Windows)
 * - Progress reporting during downloads
 * - Native notifications for update events
 * - Development mode simulation for testing
 * - IPC handlers for renderer communication
 */

import { app, BrowserWindow, ipcMain, Notification } from 'electron'
import { autoUpdater, type UpdateInfo } from 'electron-updater'

// ============================================================================
// Types
// ============================================================================

interface ProgressInfo {
  bytesPerSecond: number
  percent: number
  transferred: number
  total: number
}

interface UpdateEventInfo {
  version: string
  releaseDate: string
  releaseName?: string
  releaseNotes?: string
}

type SendMessageFn = (channel: string, data: unknown) => void

// ============================================================================
// Configuration
// ============================================================================

const UPDATE_SERVER_URL = 'https://api.keyboard.dev/update'
const SUPPORTED_PLATFORMS = ['darwin', 'win32'] as const

// ============================================================================
// Auto-Updater Service
// ============================================================================

export class AutoUpdaterService {
  private window: BrowserWindow | null = null
  private sendMessage: SendMessageFn | null = null
  private isDevMode: boolean = false
  private isInitialized: boolean = false

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------

  /**
   * Initialize the auto-updater service.
   * Must be called after the app is ready and the main window is created.
   *
   * @param sendMessageFn - Function to send messages to renderer process
   */
  initialize(sendMessageFn: SendMessageFn): void {
    if (this.isInitialized) {
      console.warn('[AutoUpdater] Service already initialized')
      return
    }

    this.sendMessage = sendMessageFn
    this.isDevMode = this.detectDevMode()

    if (!this.isPlatformSupported()) {
      console.log('[AutoUpdater] Platform not supported for auto-updates')
      return
    }

    if (this.isDevMode) {
      console.log('[AutoUpdater] Running in development mode - auto-updates disabled')
      console.log('[AutoUpdater] Use test methods to simulate update events')
      return
    }

    this.configureUpdater()
    this.setupEventHandlers()
    this.isInitialized = true

    console.log('[AutoUpdater] Service initialized successfully')
  }

  /**
   * Set the main window reference for native notifications.
   * Called separately since window may be created after initialization.
   */
  setWindow(window: BrowserWindow): void {
    this.window = window
  }

  /**
   * Register IPC handlers for renderer communication.
   * Should be called once during app setup.
   */
  setupIpcHandlers(): void {
    // Update check handler
    ipcMain.handle('check-for-updates', async (): Promise<void> => {
      this.checkForUpdates()
    })

    // Download handler (electron-updater auto-downloads, so this is a no-op)
    ipcMain.handle('download-update', async (): Promise<void> => {
      if (!this.isPlatformSupported()) {
        throw new Error('Auto-updater not supported on this platform')
      }
      // electron-updater downloads automatically when update is available
      // This handler exists for API compatibility
      console.log('[AutoUpdater] Download requested - updates download automatically')
    })

    // Install handler
    ipcMain.handle('quit-and-install', async (): Promise<void> => {
      this.quitAndInstall()
    })

    // Test/simulation handlers for development
    this.setupTestHandlers()
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Check for available updates.
   * Emits 'checking-for-update' event immediately.
   * Results in 'update-available' or 'update-not-available' event.
   */
  checkForUpdates(): void {
    if (!this.isPlatformSupported()) {
      this.showNotification(
        'Updates Not Supported',
        'Automatic updates are only available on macOS and Windows.',
      )
      return
    }

    if (this.isDevMode) {
      this.showNotification(
        'Development Mode',
        'Auto-updates are disabled in development. Use test controls to simulate.',
      )
      return
    }

    this.showNotification(
      'Checking for Updates',
      `Looking for new versions... current version: ${app.getVersion()}`,
    )

    autoUpdater.checkForUpdates()
  }

  /**
   * Quit the application and install the downloaded update.
   * Only call this after 'update-downloaded' event.
   */
  quitAndInstall(): void {
    if (!this.isPlatformSupported()) {
      throw new Error('Auto-updater not supported on this platform')
    }

    if (this.isDevMode) {
      console.log('[AutoUpdater] Dev mode: quitAndInstall simulated')
      return
    }

    autoUpdater.quitAndInstall()
  }

  // --------------------------------------------------------------------------
  // Test/Simulation Methods (Development Only)
  // --------------------------------------------------------------------------

  /**
   * Simulate an update-available event for testing the UI.
   */
  simulateUpdateAvailable(): void {
    const fakeUpdateInfo: UpdateEventInfo = {
      version: '99.0.0',
      releaseDate: new Date().toISOString(),
      releaseName: 'Test Release v99.0.0',
      releaseNotes: 'This is a simulated update for testing the UI',
    }

    this.emitToRenderer('update-available', fakeUpdateInfo)
  }

  /**
   * Simulate download progress for testing the UI.
   * Emits progress events from 0% to 100% over ~2 seconds.
   */
  async simulateDownloadProgress(): Promise<void> {
    const totalBytes = 50 * 1024 * 1024 // 50MB

    for (let percent = 0; percent <= 100; percent += 10) {
      const progressInfo: ProgressInfo = {
        bytesPerSecond: 2 * 1024 * 1024, // 2 MB/s
        percent,
        transferred: (percent / 100) * totalBytes,
        total: totalBytes,
      }

      this.emitToRenderer('download-progress', progressInfo)
      await this.delay(200)
    }

    // Auto-trigger download complete after progress finishes
    await this.delay(300)
    this.simulateUpdateDownloaded()
  }

  /**
   * Simulate an update-downloaded event for testing the UI.
   */
  simulateUpdateDownloaded(): void {
    const fakeUpdateInfo: UpdateEventInfo = {
      version: '99.0.0',
      releaseDate: new Date().toISOString(),
      releaseName: 'Test Release v99.0.0',
      releaseNotes: 'Update has been downloaded and is ready to install',
    }

    this.emitToRenderer('update-downloaded', fakeUpdateInfo)
  }

  // --------------------------------------------------------------------------
  // Private: Configuration
  // --------------------------------------------------------------------------

  private configureUpdater(): void {
    // Configure the update feed URL
    // electron-updater uses a different format than Electron's built-in autoUpdater
    const feedUrl = `${UPDATE_SERVER_URL}/${process.platform}/${app.getVersion()}`

    autoUpdater.setFeedURL({
      provider: 'generic',
      url: feedUrl,
    })

    // Configure updater behavior
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    console.log(`[AutoUpdater] Feed URL configured: ${feedUrl}`)
  }

  private setupEventHandlers(): void {
    autoUpdater.on('checking-for-update', () => {
      console.log('[AutoUpdater] Checking for update...')
    })

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      console.log('[AutoUpdater] Update available:', info.version)
      this.emitToRenderer('update-available', this.formatUpdateInfo(info))
    })

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      console.log('[AutoUpdater] No update available. Current version:', info.version)
    })

    autoUpdater.on('download-progress', (progress) => {
      const progressInfo: ProgressInfo = {
        bytesPerSecond: progress.bytesPerSecond,
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
      }
      this.emitToRenderer('download-progress', progressInfo)
    })

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      console.log('[AutoUpdater] Update downloaded:', info.version)
      this.emitToRenderer('update-downloaded', this.formatUpdateInfo(info))
      this.showUpdateReadyNotification(info)
    })

    autoUpdater.on('error', (error) => {
      console.error('[AutoUpdater] Error:', error.message)
    })
  }

  private setupTestHandlers(): void {
    ipcMain.handle('test-update-available', async (): Promise<void> => {
      this.simulateUpdateAvailable()
    })

    ipcMain.handle('test-download-update', async (): Promise<void> => {
      await this.simulateDownloadProgress()
    })

    ipcMain.handle('test-update-downloaded', async (): Promise<void> => {
      this.simulateUpdateDownloaded()
    })
  }

  // --------------------------------------------------------------------------
  // Private: Helpers
  // --------------------------------------------------------------------------

  private detectDevMode(): boolean {
    return process.argv.includes('--dev') || !app.isPackaged
  }

  private isPlatformSupported(): boolean {
    return SUPPORTED_PLATFORMS.includes(process.platform as typeof SUPPORTED_PLATFORMS[number])
  }

  private emitToRenderer(channel: string, data: unknown): void {
    if (this.sendMessage) {
      this.sendMessage(channel, data)
    }
    else {
      console.warn(`[AutoUpdater] Cannot emit '${channel}' - sendMessage not configured`)
    }
  }

  private formatUpdateInfo(info: UpdateInfo): UpdateEventInfo {
    return {
      version: info.version,
      releaseDate: info.releaseDate?.toString() ?? new Date().toISOString(),
      releaseName: info.releaseName ?? `Version ${info.version}`,
      releaseNotes: typeof info.releaseNotes === 'string'
        ? info.releaseNotes
        : Array.isArray(info.releaseNotes)
          ? info.releaseNotes.map(n => n.note).join('\n')
          : undefined,
    }
  }

  private showNotification(title: string, body: string): void {
    const notification = new Notification({ title, body })
    notification.show()
  }

  private showUpdateReadyNotification(info: UpdateInfo): void {
    const notification = new Notification({
      title: 'Update Ready',
      body: `Version ${info.version} has been downloaded. Click to restart and install.`,
    })

    notification.show()
    notification.on('click', () => {
      this.quitAndInstall()
    })
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const autoUpdaterService = new AutoUpdaterService()
