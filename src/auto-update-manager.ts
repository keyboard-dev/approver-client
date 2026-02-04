/* eslint-disable custom/no-console */
import { app, ipcMain, Notification } from 'electron'
import type { AppUpdater, ProgressInfo, UpdateInfo } from 'electron-updater'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Get the actual app version from package.json.
 * In development, app.getVersion() returns the Electron framework version,
 * so we always read from package.json to be consistent.
 */
function getAppVersion(): string {
  const packagePath = join(__dirname, '..', 'package.json')
  const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'))
  return pkg.version
}

// Module-level variable to hold the dynamically imported autoUpdater
let autoUpdater: AppUpdater

/**
 * Initialize the autoUpdater with correct version handling.
 * Uses dynamic import to ensure app.getVersion() is overridden before
 * electron-updater creates its singleton.
 */
async function initAutoUpdater(): Promise<AppUpdater> {
  // Override app.getVersion() in dev mode BEFORE importing electron-updater
  if (!app.isPackaged) {
    const realVersion = getAppVersion()
    app.getVersion = () => realVersion
  }

  // Dynamic import ensures the override is applied first
  const electronUpdater = await import('electron-updater')
  return electronUpdater.autoUpdater
}

export interface AutoUpdateManagerOptions {
  // Callback to send messages to renderer (for update-available, download-progress, etc.)
  sendToRenderer: (channel: string, data: unknown) => void
}

/**
 * AutoUpdateManager handles all auto-update functionality for the application.
 * This includes:
 * - Configuring the update feed URL
 * - Handling update lifecycle events (checking, available, downloaded, error)
 * - Providing methods for manual update checks and installation
 * - Registering IPC handlers for renderer communication
 * - Test methods for development
 */
export class AutoUpdateManager {
  private options: AutoUpdateManagerOptions
  private isSupported: boolean

  constructor(options: AutoUpdateManagerOptions) {
    this.options = options
    // Auto-updater only works on macOS and Windows
    this.isSupported = process.platform === 'darwin' || process.platform === 'win32'
  }

  /**
   * Helper method to log with consistent prefix
   */
  private log(...args: unknown[]): void {
    console.log('[AutoUpdater]', ...args)
  }

  /**
   * Initialize the auto-updater. Should be called during app initialization.
   * Sets up the feed URL, registers event handlers, and checks for updates.
   */
  public async initialize(): Promise<void> {
    if (!this.isSupported) {
      this.log('Auto-updater not initialized - unsupported platform')
      this.log('  Platform:', process.platform)
      this.log('  isSupported:', this.isSupported)
      return
    }

    // Initialize autoUpdater with proper version handling (dynamic import)
    autoUpdater = await initAutoUpdater()

    const baseURL = process.env.OAUTH_SERVER_URL || 'https://api.keyboard.dev'
    const feedURL = `${baseURL}/update`

    this.log('Initializing auto-updater')
    this.log('  Platform:', process.platform)
    this.log('  Current version:', getAppVersion())
    this.log('  Feed URL:', feedURL)
    this.log('  isPackaged:', app.isPackaged)

    // Configure electron-updater to use custom server
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: feedURL,
    })

    // Disable auto-download to have more control
    autoUpdater.autoDownload = false

    // Force update checks in development mode
    if (!app.isPackaged) {
      autoUpdater.forceDevUpdateConfig = true
    }

    // Auto-updater event handlers
    autoUpdater.on('checking-for-update', () => {
      this.log('Checking for update...')
      this.log('  Fetching from:', feedURL)
    })

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.log('Update available!')
      this.log('  Version:', info.version)
      this.log('  Release date:', info.releaseDate)
      this.log('  Release notes:', info.releaseNotes)

      // Send to renderer
      this.options.sendToRenderer('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
      })

      // Show notification
      const notification = new Notification({
        title: 'Update Available',
        body: `Version ${info.version} is available. Click to download.`,
      })
      notification.show()
      notification.on('click', () => {
        this.log('User clicked notification - downloading update')
        autoUpdater.downloadUpdate()
      })
    })

    autoUpdater.on('update-not-available', (info: UpdateInfo) => {
      this.log('No update available - current version is the latest')
      this.log('  Current version:', getAppVersion())
      this.log('  Latest version:', info.version)

      // Send to renderer
      this.options.sendToRenderer('update-not-available', {
        version: info.version,
      })
    })

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      this.log('Download progress:', `${progress.percent.toFixed(2)}%`)

      // Send to renderer
      this.options.sendToRenderer('download-progress', {
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond,
      })
    })

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.log('Update downloaded!')
      this.log('  Version:', info.version)
      this.log('  Release date:', info.releaseDate)

      // Send to renderer
      this.options.sendToRenderer('update-downloaded', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
      })

      // Notify user and ask if they want to restart
      const notification = new Notification({
        title: 'Update Ready',
        body: 'A new version has been downloaded. Restart now to apply the update?',
      })
      notification.show()
      notification.on('click', () => {
        this.log('User clicked notification - installing update')
        autoUpdater.quitAndInstall()
      })
    })

    autoUpdater.on('error', (error) => {
      this.log('ERROR:', error.message)
      this.log('  Error details:', error)
      this.log('  Stack:', error.stack)

      // Send to renderer
      this.options.sendToRenderer('update-error', {
        message: error.message,
      })
    })

    // Check for updates on startup
    this.log('Checking for updates on startup...')
    // Delay update check to give renderer time to set up listeners
    setTimeout(async () => {
      try {
        await autoUpdater.checkForUpdates()
      }
      catch (error) {
        this.log('ERROR during startup update check:', error)
      }
    }, 3000) // Wait 3 seconds for renderer to initialize
  }

  /**
   * Manually check for updates and show a notification.
   * Called from menu items and other manual triggers.
   */
  public checkForUpdates(): void {
    this.log('='.repeat(50))
    this.log('Manual update check triggered')
    this.log('  Current version:', getAppVersion())
    this.log('  Platform:', process.platform)

    if (!this.isSupported) {
      this.log('Updates not supported on this platform')
      const notification = new Notification({
        title: 'Updates Not Supported',
        body: 'Automatic updates are only available on macOS and Windows.',
      })
      notification.show()
      return
    }

    this.log('Triggering update check...')
    autoUpdater.checkForUpdates().catch((error) => {
      this.log('ERROR during manual update check:', error)
    })

    // Show a notification that we're checking
    const notification = new Notification({
      title: 'Checking for Updates',
      body: `Looking for new versions... current version: ${getAppVersion()}`,
    })
    notification.show()
  }

  /**
   * Quit the application and install the downloaded update.
   * Called from menu items or after user confirms installation.
   */
  public quitAndInstall(): void {
    if (!this.isSupported) {
      this.log('quitAndInstall called but platform not supported')
      return
    }

    this.log('Quitting and installing update...')
    autoUpdater.quitAndInstall()
  }

  /**
   * Register IPC handlers for renderer process communication.
   * Should be called during IPC setup in the main process.
   */
  public setupIPCHandlers(): void {
    this.log('Setting up IPC handlers')

    // Auto-updater IPC handlers (only available on macOS and Windows)
    ipcMain.handle('check-for-updates', async (): Promise<void> => {
      this.log('IPC: check-for-updates called')
      if (this.isSupported) {
        autoUpdater.checkForUpdates()
      }
      else {
        this.log('IPC: check-for-updates failed - platform not supported')
        throw new Error('Auto-updater not supported on this platform')
      }
    })

    ipcMain.handle('download-update', async (): Promise<void> => {
      if (this.isSupported) {
        autoUpdater.downloadUpdate()
      }
      else {
        throw new Error('Auto-updater not supported on this platform')
      }
    })

    ipcMain.handle('quit-and-install', async (): Promise<void> => {
      if (this.isSupported) {
        autoUpdater.quitAndInstall()
      }
      else {
        throw new Error('Auto-updater not supported on this platform')
      }
    })

    // Test methods for development
    ipcMain.handle('test-update-available', async (): Promise<void> => {
      this.options.sendToRenderer('update-available', {
        version: '1.0.1',
        releaseDate: new Date().toISOString(),
        releaseName: 'Test Update',
        releaseNotes: 'This is a test update notification',
      })
    })

    ipcMain.handle('test-download-update', async (): Promise<void> => {
      // Simulate download progress
      for (let i = 0; i <= 100; i += 10) {
        this.options.sendToRenderer('download-progress', {
          percent: i,
          transferred: i * 1024 * 1024,
          total: 100 * 1024 * 1024,
          bytesPerSecond: 1024 * 1024,
        })
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    })

    ipcMain.handle('test-update-downloaded', async (): Promise<void> => {
      this.options.sendToRenderer('update-downloaded', {
        version: '1.0.1',
        releaseDate: new Date().toISOString(),
        releaseName: 'Test Update',
        releaseNotes: 'This is a test update notification',
      })
    })
  }
}
