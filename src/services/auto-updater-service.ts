/* eslint-disable custom/no-console */
import { app, ipcMain, Notification } from 'electron'
import { autoUpdater, ProgressInfo, UpdateInfo } from 'electron-updater'
import { WindowManager } from '../window-manager'

/**
 * TODO: REVERT BEFORE MERGE
 * - Delete the test release v0.2.2-test from GitHub after testing
 * - Delete the test tag: git tag -d v0.2.2-test && git push origin :refs/tags/v0.2.2-test
 * - Remove this comment block
 */

/**
 * AutoUpdaterService handles application updates via electron-updater
 * Responsibilities:
 * - Configure and initialize auto-updater for GitHub releases
 * - Handle update lifecycle events (checking, available, downloading, downloaded)
 * - Communicate update status to renderer process
 * - Provide IPC handlers for manual update checks and installation
 * - Support testing/simulation of update events in development
 */
export class AutoUpdaterService {
  private initialized = false

  constructor(private windowManager: WindowManager) {}

  /**
   * Initialize auto-updater with event handlers
   * Should be called once during app startup (non-dev mode only)
   */
  initialize(): void {
    if (this.initialized) {
      return
    }

    // Configure GitHub feed URL
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'keyboard-dev',
      repo: 'approver-client',
    })

    // Configure auto-updater
    autoUpdater.autoDownload = false // Let user decide to download
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.allowPrerelease = true // Allow pre-releases since current releases are marked as such

    // Set up event handlers
    this.setupEventHandlers()

    // Check for updates on startup
    autoUpdater.checkForUpdates()

    this.initialized = true
  }

  /**
   * Set up auto-updater event handlers
   */
  private setupEventHandlers(): void {
    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for update...')
    })

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      console.log('Update available:', info.version)
      this.windowManager.sendMessage('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseName: info.releaseName,
        releaseNotes: info.releaseNotes,
      })
    })

    autoUpdater.on('update-not-available', () => {
      console.log('No update available')
    })

    autoUpdater.on('download-progress', (progressObj: ProgressInfo) => {
      this.windowManager.sendMessage('download-progress', progressObj)
    })

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.windowManager.sendMessage('update-downloaded', {
        version: info.version,
        releaseDate: info.releaseDate,
      })

      // Also show system notification
      const notification = new Notification({
        title: 'Update Ready',
        body: `Version ${info.version} downloaded. Restart to apply.`,
      })
      notification.show()
      notification.on('click', () => {
        autoUpdater.quitAndInstall()
      })
    })

    autoUpdater.on('error', (err: Error) => {
      console.error('Auto-updater error:', err)
    })
  }

  /**
   * Check for updates and show notification
   */
  checkForUpdates(): void {
    autoUpdater.checkForUpdates()

    // Show a notification that we're checking
    const notification = new Notification({
      title: 'Checking for Updates',
      body: `Looking for new versions... current version: ${app.getVersion()}`,
    })
    notification.show()
  }

  /**
   * Trigger update download
   */
  async downloadUpdate(): Promise<void> {
    await autoUpdater.downloadUpdate()
  }

  /**
   * Quit app and install downloaded update
   */
  quitAndInstall(): void {
    autoUpdater.quitAndInstall()
  }

  /**
   * Register IPC handlers for renderer communication
   */
  setupIPCHandlers(): void {
    ipcMain.handle('check-for-updates', async (): Promise<void> => {
      await autoUpdater.checkForUpdates()
    })

    ipcMain.handle('download-update', async (): Promise<void> => {
      await autoUpdater.downloadUpdate()
    })

    ipcMain.handle('quit-and-install', async (): Promise<void> => {
      autoUpdater.quitAndInstall()
    })

    // Test methods for development
    ipcMain.handle('test-update-available', async (): Promise<void> => {
      await this.simulateUpdateAvailable()
    })

    ipcMain.handle('test-download-update', async (): Promise<void> => {
      await this.simulateDownloadProgress()
    })

    ipcMain.handle('test-update-downloaded', async (): Promise<void> => {
      await this.simulateUpdateDownloaded()
    })
  }

  /**
   * Simulate update available event for testing
   */
  async simulateUpdateAvailable(): Promise<void> {
    this.windowManager.sendMessage('update-available', {
      version: '1.0.1',
      releaseDate: new Date().toISOString(),
      releaseName: 'Test Update',
      releaseNotes: 'This is a test update notification',
    })
  }

  /**
   * Simulate download progress for testing
   */
  async simulateDownloadProgress(): Promise<void> {
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
  }

  /**
   * Simulate update downloaded event for testing
   */
  async simulateUpdateDownloaded(): Promise<void> {
    this.windowManager.sendMessage('update-downloaded', {
      version: '1.0.1',
      releaseDate: new Date().toISOString(),
    })
  }
}
