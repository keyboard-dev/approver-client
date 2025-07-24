import { Tray, Menu, nativeImage, BrowserWindow, screen, app } from 'electron'
import { Message } from './types'
import * as path from 'path'
import * as fs from 'fs'

// Helper function to find assets directory reliably
function getAssetsPath(): string {
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
  if (fs.existsSync(prodAssetsPath)) {
    return prodAssetsPath
  }

  // Fallback to project root assets (for Electron Forge)
  const rootAssetsPath = path.join(process.cwd(), 'assets')
  if (fs.existsSync(rootAssetsPath)) {
    return rootAssetsPath
  }

  console.warn('Assets directory not found, using default path')
  return devAssetsPath // Return something even if not found
}

export interface TrayManagerOptions {
  onToggleWindow: (bounds?: Electron.Rectangle) => void
  onShowWindow: () => void
  onClearAllMessages: () => void
  onQuit: () => void
  getMessages: () => Message[]
  getPendingCount: () => number
}

export class TrayManager {
  private tray: Tray | null = null
  private options: TrayManagerOptions

  constructor(options: TrayManagerOptions) {
    this.options = options
  }

  public createTray(): void {
    // Create tray icon
    const icon = this.createTrayIcon()
    this.tray = new Tray(icon)

    this.tray.setToolTip('Message Approver')

    // Click to toggle window
    this.tray.on('click', (event, bounds) => {
      this.options.onToggleWindow(bounds)
    })

    // Right-click for context menu
    this.tray.on('right-click', () => {
      this.showContextMenu()
    })

    this.updateTrayIcon()
  }

  private createTrayIcon(): Electron.NativeImage {
    // Fix: Use helper function for reliable asset path resolution
    const assetsPath = getAssetsPath()
    const logoPath = path.join(assetsPath, 'keyboard512px.png')

    // Check if logo file exists
    if (fs.existsSync(logoPath)) {
      try {
        // Load the logo and resize it for tray usage
        const logo = nativeImage.createFromPath(logoPath)

        // Resize to appropriate tray icon size
        const traySize = process.platform === 'darwin' ? 16 : 16 // 16x16 for most platforms
        const resizedLogo = logo.resize({ width: traySize, height: traySize })

        // Apply visual modifications based on pending state
        const pendingCount = this.options.getPendingCount()
        if (pendingCount > 0) {
          // Add a red notification badge for pending messages
          return this.addNotificationBadge(resizedLogo, pendingCount)
        }

        // On macOS, set as template image for automatic theme adaptation
        if (process.platform === 'darwin') {
          resizedLogo.setTemplateImage(true)
        }

        return resizedLogo
      }
      catch (error) {
        console.error('Error loading logo for tray:', error)
        return this.createFallbackIcon()
      }
    }

    // Fallback to programmatic icon if logo doesn't exist
    return this.createFallbackIcon()
  }

  private addNotificationBadge(baseIcon: Electron.NativeImage, count: number): Electron.NativeImage {
    // For now, we'll create a simple overlay effect
    // In a more advanced implementation, you could draw a red badge with the count
    const size = baseIcon.getSize()

    // Create a copy of the base icon
    const canvas = Buffer.alloc(size.width * size.height * 4)
    const iconBuffer = baseIcon.toPNG()

    // For simplicity, we'll just add a red tint to indicate pending messages
    // You could enhance this to draw an actual badge with canvas or use image composition
    try {
      // Simple approach: create a version with modified appearance
      const badgedIcon = nativeImage.createFromBuffer(iconBuffer)

      // On macOS, don't set as template when showing notifications
      if (process.platform === 'darwin') {
        badgedIcon.setTemplateImage(false)
      }

      return badgedIcon
    }
    catch (error) {
      console.error('Error creating notification badge:', error)
      return baseIcon
    }
  }

  private createFallbackIcon(): Electron.NativeImage {
    // Create a simple 16x16 icon as fallback
    const size = 16

    const canvas = Buffer.alloc(size * size * 4)
    const pendingCount = this.options.getPendingCount()
    const color = pendingCount > 0 ? [255, 59, 48, 255] : [0, 122, 255, 255]

    // Fill the buffer with the color
    for (let i = 0; i < canvas.length; i += 4) {
      canvas[i] = color[0] // R
      canvas[i + 1] = color[1] // G
      canvas[i + 2] = color[2] // B
      canvas[i + 3] = color[3] // A
    }

    return nativeImage.createFromBuffer(canvas, { width: size, height: size })
  }

  private showContextMenu(): void {
    const pendingCount = this.options.getPendingCount()
    const messages = this.options.getMessages()

    const contextMenu = Menu.buildFromTemplate([
      {
        label: `Messages (${pendingCount} pending)`,
        enabled: false,
      },
      { type: 'separator' },
      {
        label: 'Show Messages',
        click: () => this.options.onShowWindow(),
      },
      {
        label: 'Clear All',
        click: () => this.options.onClearAllMessages(),
        enabled: messages.length > 0,
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => this.options.onQuit(),
      },
    ])

    this.tray?.popUpContextMenu(contextMenu)
  }

  public updateTrayIcon(): void {
    if (this.tray) {
      const icon = this.createTrayIcon()
      this.tray.setImage(icon)

      // Update tooltip with pending count
      const pendingCount = this.options.getPendingCount()
      const tooltip = pendingCount > 0
        ? `Message Approver (${pendingCount} pending)`
        : 'Message Approver'
      this.tray.setToolTip(tooltip)
    }
  }

  public getBounds(): Electron.Rectangle | undefined {
    return this.tray?.getBounds()
  }

  public destroy(): void {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }
}
