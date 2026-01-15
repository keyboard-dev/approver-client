import { BrowserWindow, desktopCapturer, ipcMain, screen, systemPreferences } from 'electron'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

export interface OverlayWindowOptions {
  onOverlayClosed: () => void
  onScreenshotCaptured: (filePath: string) => void
}

const SCREENSHOTS_DIR = path.join(os.homedir(), 'keyboard-screenshots')

export class OverlayWindow {
  private overlayWindow: BrowserWindow | null = null
  private options: OverlayWindowOptions
  private isCapturing: boolean = false

  constructor(options: OverlayWindowOptions) {
    this.options = options
    this.ensureScreenshotsDir()
    this.setupIPC()
  }

  private ensureScreenshotsDir(): void {
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
    }
  }

  private setupIPC(): void {
    // Toggle mouse events for click-through
    ipcMain.on('overlay:set-ignore-mouse', (_event, ignore: boolean, options?: { forward: boolean }) => {
      if (this.overlayWindow) {
        this.overlayWindow.setIgnoreMouseEvents(ignore, options)
      }
    })

    // Capture screenshot
    ipcMain.handle('overlay:capture-screenshot', async (_event, clickX: number, clickY: number) => {
      return this.captureScreenshot(clickX, clickY)
    })

    // Close overlay
    ipcMain.on('overlay:close', () => {
      this.hide()
    })

    // Get screen recording permission status (macOS)
    ipcMain.handle('overlay:check-screen-permission', async () => {
      return this.checkScreenRecordingPermission()
    })

    // Request screen recording permission (macOS)
    ipcMain.handle('overlay:request-screen-permission', async () => {
      return this.requestScreenRecordingPermission()
    })

    // Get screenshots directory
    ipcMain.handle('overlay:get-screenshots-dir', () => {
      return SCREENSHOTS_DIR
    })
  }

  private checkScreenRecordingPermission(): boolean {
    if (process.platform === 'darwin') {
      return systemPreferences.getMediaAccessStatus('screen') === 'granted'
    }
    return true // No permission needed on other platforms
  }

  private async requestScreenRecordingPermission(): Promise<boolean> {
    if (process.platform === 'darwin') {
      // On macOS, we can't directly request screen recording permission
      // We need to trigger it by attempting to capture
      try {
        const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } })
        return sources.length > 0
      }
      catch {
        return false
      }
    }
    return true
  }

  public async captureScreenshot(clickX: number, clickY: number): Promise<string | null> {
    if (this.isCapturing) return null
    this.isCapturing = true

    try {
      // Temporarily hide overlay to capture clean screenshot
      const wasVisible = this.overlayWindow?.isVisible()
      if (wasVisible && this.overlayWindow) {
        this.overlayWindow.hide()
      }

      // Small delay to ensure overlay is hidden
      await new Promise(resolve => setTimeout(resolve, 50))

      // Get primary display
      const primaryDisplay = screen.getPrimaryDisplay()
      const { width, height } = primaryDisplay.size
      const scaleFactor = primaryDisplay.scaleFactor

      // Get screen sources
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: Math.floor(width * scaleFactor),
          height: Math.floor(height * scaleFactor),
        },
      })

      if (sources.length === 0) {
        throw new Error('No screen sources available')
      }

      // Get the primary screen source
      const primarySource = sources[0]
      const thumbnail = primarySource.thumbnail

      // Generate filename with timestamp and coordinates
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `screenshot_${timestamp}_x${Math.round(clickX)}_y${Math.round(clickY)}.png`
      const filePath = path.join(SCREENSHOTS_DIR, filename)

      // Save screenshot as PNG
      const pngBuffer = thumbnail.toPNG()
      fs.writeFileSync(filePath, pngBuffer)

      // Show overlay again
      if (wasVisible && this.overlayWindow) {
        this.overlayWindow.show()
      }

      this.options.onScreenshotCaptured(filePath)
      return filePath
    }
    catch (error) {
      console.error('Screenshot capture failed:', error)
      // Ensure overlay is shown again even on error
      if (this.overlayWindow && !this.overlayWindow.isVisible()) {
        this.overlayWindow.show()
      }
      return null
    }
    finally {
      this.isCapturing = false
    }
  }

  public create(): void {
    if (this.overlayWindow) {
      this.overlayWindow.focus()
      return
    }

    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.workAreaSize
    const { x, y } = primaryDisplay.workArea

    this.overlayWindow = new BrowserWindow({
      x,
      y,
      width,
      height,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      closable: true,
      focusable: true,
      fullscreenable: false,
      webPreferences: {
        preload: path.join(__dirname, 'overlay-preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: true,
      },
    })

    // Set to be visible on all workspaces (macOS Spaces)
    this.overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    // Start with click-through enabled
    this.overlayWindow.setIgnoreMouseEvents(true, { forward: true })

    // Set window level to be above everything (macOS)
    if (process.platform === 'darwin') {
      this.overlayWindow.setAlwaysOnTop(true, 'screen-saver')
    }

    // Load the overlay HTML
    this.overlayWindow.loadFile(path.join(__dirname, '../public/overlay.html'))

    this.overlayWindow.on('closed', () => {
      this.overlayWindow = null
      this.options.onOverlayClosed()
    })
  }

  public show(): void {
    if (!this.overlayWindow) {
      this.create()
    }
    else {
      this.overlayWindow.show()
      this.overlayWindow.focus()
    }
  }

  public hide(): void {
    if (this.overlayWindow) {
      this.overlayWindow.hide()
    }
  }

  public toggle(): void {
    if (this.overlayWindow?.isVisible()) {
      this.hide()
    }
    else {
      this.show()
    }
  }

  public isVisible(): boolean {
    return this.overlayWindow?.isVisible() ?? false
  }

  public destroy(): void {
    if (this.overlayWindow) {
      this.overlayWindow.close()
      this.overlayWindow = null
    }
  }

  public sendMessage(channel: string, ...args: unknown[]): void {
    if (this.overlayWindow) {
      this.overlayWindow.webContents.send(channel, ...args)
    }
  }
}
