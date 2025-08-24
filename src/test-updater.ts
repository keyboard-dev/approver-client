/**
 * Test helper for auto-updater in development mode
 * This simulates update events for testing the UI without needing actual releases
 */

import { BrowserWindow } from 'electron'

export class TestUpdater {
  private window: BrowserWindow | null = null

  setWindow(window: BrowserWindow) {
    this.window = window
  }

  // Simulate update available
  simulateUpdateAvailable() {
    if (!this.window) return

    const fakeUpdateInfo = {
      version: '0.0.2',
      releaseDate: new Date().toISOString(),
      releaseName: 'Test Release v0.0.2',
      releaseNotes: 'This is a test update for development mode'
    }

    console.log('🧪 TEST MODE: Simulating update available', fakeUpdateInfo)
    this.window.webContents.send('update-available', fakeUpdateInfo)
  }

  // Simulate download progress
  simulateDownloadProgress() {
    if (!this.window) return

    let progress = 0
    const interval = setInterval(() => {
      progress += 10
      const progressInfo = {
        bytesPerSecond: 1024 * 1024 * 2, // 2 MB/s
        percent: progress,
        transferred: (progress / 100) * 50 * 1024 * 1024, // 50MB total
        total: 50 * 1024 * 1024
      }

      console.log(`🧪 TEST MODE: Download progress ${progress}%`)
      this.window!.webContents.send('download-progress', progressInfo)

      if (progress >= 100) {
        clearInterval(interval)
        // Simulate download completed
        setTimeout(() => {
          this.simulateUpdateDownloaded()
        }, 500)
      }
    }, 1000)
  }

  // Simulate update downloaded
  simulateUpdateDownloaded() {
    if (!this.window) return

    const fakeUpdateInfo = {
      version: '0.0.2',
      releaseDate: new Date().toISOString(),
      releaseName: 'Test Release v0.0.2',
      releaseNotes: 'Update has been downloaded and is ready to install'
    }

    console.log('🧪 TEST MODE: Simulating update downloaded', fakeUpdateInfo)
    this.window.webContents.send('update-downloaded', fakeUpdateInfo)
  }
}

export const testUpdater = new TestUpdater()