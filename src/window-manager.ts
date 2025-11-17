import { BrowserWindow, screen, session } from 'electron'
import * as path from 'path'
import { Message } from './types'

export interface WindowManagerOptions {
  onWindowClosed: () => void
  onMessageShow: (message: Message) => void
}

const DEFAULT_WINDOW_WIDTH = 800
const DEFAULT_WINDOW_HEIGHT = 800

export class WindowManager {
  private mainWindow: BrowserWindow | null = null
  private options: WindowManagerOptions

  constructor(options: WindowManagerOptions) {
    this.options = options
  }

  private getIconPath(): string {
    // Use platform-specific icon format
    if (process.platform === 'win32') {
      // Try .ico first for Windows, fallback to .png
      const icoPath = path.join(__dirname, '../assets/keyboard-dock.ico')
      const pngPath = path.join(__dirname, '../assets/keyboard-dock.png')
      // TODO: Check if .ico exists when available
      return icoPath // Will use .ico when generated
    }
    else if (process.platform === 'darwin') {
      return path.join(__dirname, '../assets/keyboard-dock.icns')
    }
    else {
      // Linux and others use PNG
      return path.join(__dirname, '../assets/keyboard-dock.png')
    }
  }

  public createMainWindow(): void {
    // Use platform-specific icon format
    const iconPath = this.getIconPath()

    // Get or create a persistent session explicitly
    const persistentSession = session.fromPartition('persist:main', { cache: true })

    this.mainWindow = new BrowserWindow({
      frame: false,
      height: DEFAULT_WINDOW_HEIGHT,
      icon: iconPath,
      transparent: true,
      width: DEFAULT_WINDOW_WIDTH,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        session: persistentSession, // Use explicit session instead of partition string
        nodeIntegration: false, // Required for partition to work properly
        contextIsolation: true, // Required for partition to work properly
        webSecurity: true,
      },
      ...(process.platform === 'darwin' && {
        alwaysOnTop: false,
        titleBarStyle: 'hidden',
        type: 'panel',
        vibrancy: 'under-window',
        visualEffectState: 'active',
      }),
      ...(process.platform === 'win32' && {
        alwaysOnTop: false,
        titleBarStyle: 'hidden',
        backgroundColor: '#00000000', // Transparent background for Windows
        skipTaskbar: false, // Show in taskbar on Windows
      }),
    })

    // Verify session is persistent
    const windowSession = this.mainWindow.webContents.session
    if (!windowSession.isPersistent()) {
      console.error('⚠️  Session is NOT persistent!')
    }
    else {
      console.log('✓ Session is persistent')
    }

    this.mainWindow.loadFile(path.join(__dirname, '../public/index.html'))

    this.mainWindow.on('closed', () => {
      this.mainWindow = null
      this.options.onWindowClosed()
    })
  }

  public toggleWindow(bounds?: Electron.Rectangle): void {
    if (this.mainWindow?.isVisible()) {
      this.mainWindow.hide()
    }
    else {
      this.showWindow(bounds)
    }
  }

  public showWindow(bounds?: Electron.Rectangle): void {
    if (!this.mainWindow) {
      this.createMainWindow()
    }

    if (!this.mainWindow) return

    if (bounds) {
      this.positionWindowNearTray(bounds)
    }
    // else {
    //   // Force the window to be on the current screen before showing
    //   const currentDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    //   this.mainWindow.setBounds({
    //     x: currentDisplay.bounds.x + 100,
    //     y: currentDisplay.bounds.y + 100,
    //     width: DEFAULT_WINDOW_WIDTH,
    //     height: DEFAULT_WINDOW_HEIGHT,
    //   })
    // }

    this.mainWindow.setVisibleOnAllWorkspaces(true)

    // Explicitly set alwaysOnTop to false to follow normal window hierarchy
    // while still maintaining panel behavior for fullscreen apps
    this.mainWindow.setAlwaysOnTop(false)

    // this.mainWindow.showInactive() // Show without focusing
    this.mainWindow.show()
    this.mainWindow.focus()
  }

  private positionWindowNearTray(trayBounds: Electron.Rectangle): void {
    if (!this.mainWindow) return

    const windowBounds = this.mainWindow.getBounds()

    // Find the display that contains the tray icon
    const trayCenter = {
      x: trayBounds.x + trayBounds.width / 2,
      y: trayBounds.y + trayBounds.height / 2,
    }
    const targetDisplay = screen.getDisplayNearestPoint(trayCenter)

    let x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2))
    let y = Math.round(trayBounds.y + trayBounds.height + 5)

    // Make sure window stays on the correct screen
    const { width: screenWidth, height: screenHeight } = targetDisplay.workAreaSize
    const { x: screenX, y: screenY } = targetDisplay.workArea

    // Constrain to the target display's work area
    x = Math.max(screenX, Math.min(x, screenX + screenWidth - windowBounds.width))
    y = Math.max(screenY, Math.min(y, screenY + screenHeight - windowBounds.height))

    this.mainWindow.setPosition(x, y)
  }

  public hideWindow(): void {
    if (this.mainWindow) {
      this.mainWindow.hide()
    }
  }

  public isVisible(): boolean {
    return this.mainWindow?.isVisible() ?? false
  }

  public sendMessage(channel: string, ...args: unknown[]): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send(channel, ...args)
    }
  }

  public showMessage(message: Message): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('show-message', message)
    }
  }

  public destroy(): void {
    if (this.mainWindow) {
      this.mainWindow.close()
      this.mainWindow = null
    }
  }

  public setTaskbarBadge(count: number): void {
    if (!this.mainWindow) return

    if (process.platform === 'win32') {
      // Windows taskbar overlay icon
      if (count > 0) {
        // Create a small overlay icon with the count
        // For now, we'll use a simple overlay indicating pending items
        // In production, you'd want to generate a proper badge icon
        const overlayIconPath = path.join(__dirname, '../assets/notification.png')
        this.mainWindow.setOverlayIcon(overlayIconPath, `${count} pending notifications`)
      }
      else {
        this.mainWindow.setOverlayIcon(null, '')
      }
    }
  }
}
