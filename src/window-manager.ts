import { BrowserWindow, ipcMain, screen } from 'electron'
import * as path from 'path'
import { Message } from './types'

export interface WindowManagerOptions {
  onWindowClosed: () => void
  onMessageShow: (message: Message) => void
}

export class WindowManager {
  private mainWindow: BrowserWindow | null = null
  private options: WindowManagerOptions

  constructor(options: WindowManagerOptions) {
    this.options = options
  }

  public createMainWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 600, // Larger for reading code
      height: 800, // Taller for explanations
      show: false, // Don't show/focus the window when created
      transparent: true,
      frame: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      },
      ...(process.platform === 'darwin' && {
        titleBarStyle: 'hidden',
        type: 'panel',
        vibrancy: 'under-window',
        visualEffectState: 'active',
      }),
    })

    this.mainWindow.loadFile(path.join(__dirname, '../public/index.html'))

    // Hide window when it loses focus
    this.mainWindow.on('blur', () => {
      if (this.mainWindow?.isVisible()) {
        setTimeout(() => {
          if (this.mainWindow?.isVisible() && !this.mainWindow?.isFocused()) {
            this.mainWindow.hide()
          }
        }, 100)
      }
    })

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
    else {
      // Force the window to be on the current screen before showing
      const currentDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
      this.mainWindow.setBounds({
        x: currentDisplay.bounds.x + 100,
        y: currentDisplay.bounds.y + 100,
        width: 600,
        height: 700,
      })
    }

    this.mainWindow.setVisibleOnAllWorkspaces(true)

    this.mainWindow.showInactive() // Show without focusing
    // this.mainWindow.show();
    // this.mainWindow.focus();
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

  private setupWindowControls(): void {
    // Handle window close
    ipcMain.handle('window-close', () => {
      this.hideWindow()
    })

    // Handle window hide/show toggle
    ipcMain.handle('window-toggle-visibility', () => {
      if (this.mainWindow) {
        if (this.mainWindow.isVisible()) {
          this.mainWindow.hide()
        }
        else {
          this.mainWindow.show()
        }
      }
    })

    // Handle window opacity change
    ipcMain.handle('window-set-opacity', (event, opacity: number) => {
      if (this.mainWindow) {
        this.mainWindow.setOpacity(Math.max(0.1, Math.min(1.0, opacity)))
      }
    })

    // Handle window resize
    ipcMain.handle('window-resize', (event, { width, height }) => {
      if (this.mainWindow) {
        this.mainWindow.setSize(width, height)
      }
    })
  }

  public destroy(): void {
    if (this.mainWindow) {
      this.mainWindow.close()
      this.mainWindow = null
    }
  }
}
