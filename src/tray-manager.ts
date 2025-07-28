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
  private normalIconPath: string
  private badgedIconPath: string

  constructor(options: TrayManagerOptions) {
    this.options = options

    // Set up icon paths
    const assetsPath = getAssetsPath()
    this.normalIconPath = path.join(assetsPath, 'keyboard-tray.png')
    this.badgedIconPath = path.join(assetsPath, 'keyboard-tray-notification.png') // Using notification.png for badged state
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
    try {
      // Safe pending count retrieval with fallback
      const pendingCount = this.options?.getPendingCount?.() || 0

      // Choose icon based on pending messages, but with fallback to ensure consistency
      const primaryIconPath = pendingCount > 0 ? this.badgedIconPath : this.normalIconPath
      const fallbackIconPath = this.normalIconPath // Always fallback to normal icon

      // Try primary icon first, then fallback with safe file checks
      let iconPath = primaryIconPath
      try {
        if (!fs.existsSync(primaryIconPath)) {
          console.warn('Primary icon not found, using fallback:', primaryIconPath)
          iconPath = fallbackIconPath
        }
      }
      catch (fsError) {
        console.error('File system error checking primary icon:', fsError)
        iconPath = fallbackIconPath
      }

      // Check if the selected icon file exists with additional safety
      try {
        if (fs.existsSync(iconPath)) {
          // Load the appropriate icon with error handling
          const icon = nativeImage.createFromPath(iconPath)

          // Validate the icon was loaded successfully
          if (!icon || icon.isEmpty()) {
            console.warn('Icon loaded but is empty, using fallback')
            return this.createFallbackIcon()
          }

          // CONSISTENT sizing for all states - force exact same dimensions
          const traySize = process.platform === 'darwin' ? 22 : 16

          // Get original size with safety check
          let originalSize
          try {
            originalSize = icon.getSize()
            if (!originalSize || originalSize.width <= 0 || originalSize.height <= 0) {
              console.warn('Invalid icon dimensions, using fallback')
              return this.createFallbackIcon()
            }
            console.log(`Original icon size: ${originalSize.width}x${originalSize.height}`)
          }
          catch (sizeError) {
            console.error('Error getting icon size:', sizeError)
            return this.createFallbackIcon()
          }

          // Force resize to exact dimensions with error handling
          let resizedIcon
          try {
            resizedIcon = icon.resize({
              width: traySize,
              height: traySize,
              quality: 'good',
            })

            // Validate resize worked
            if (!resizedIcon || resizedIcon.isEmpty()) {
              console.warn('Icon resize failed, using fallback')
              return this.createFallbackIcon()
            }
          }
          catch (resizeError) {
            console.error('Error resizing icon:', resizeError)
            return this.createFallbackIcon()
          }

          // Verify final size with safety
          try {
            const finalSize = resizedIcon.getSize()
            console.log(`Final icon size: ${finalSize.width}x${finalSize.height}`)
          }
          catch (finalSizeError) {
            console.error('Error getting final icon size:', finalSizeError)
            // Continue anyway, resize probably worked
          }

          // Template image handling with error protection
          if (process.platform === 'darwin') {
            try {
              if (pendingCount > 0) {
                // Don't use template mode for notification icon to preserve red badge color
                resizedIcon.setTemplateImage(false)
              }
              else {
                // Use template mode for normal icon to adapt to system theme
                resizedIcon.setTemplateImage(true)
              }
            }
            catch (templateError) {
              console.error('Error setting template mode:', templateError)
              // Continue anyway, icon should still work
            }
          }

          console.log(`Using ${pendingCount > 0 ? 'badged' : 'normal'} icon:`, iconPath)
          console.log(`Icon size: ${traySize}x${traySize}, Template mode: ${process.platform === 'darwin'}`)
          return resizedIcon
        }
        else {
          console.warn('Icon file not found:', iconPath)
          return this.createFallbackIcon()
        }
      }
      catch (fileError) {
        console.error('Error checking/loading icon file:', fileError)
        return this.createFallbackIcon()
      }
    }
    catch (generalError) {
      console.error('General error in createTrayIcon:', generalError)
      return this.createFallbackIcon()
    }
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
    try {
      // Create a simple 16x16 icon as fallback
      const size = 16

      // Safe pending count retrieval
      const pendingCount = this.options?.getPendingCount?.() || 0
      const color = pendingCount > 0 ? [255, 59, 48, 255] : [0, 122, 255, 255]

      // Validate size is reasonable
      if (size <= 0 || size > 256) {
        console.error('Invalid fallback icon size, using default')
        return nativeImage.createEmpty()
      }

      const canvas = Buffer.alloc(size * size * 4)

      // Fill the buffer with the color safely
      for (let i = 0; i < canvas.length; i += 4) {
        canvas[i] = color[0] // R
        canvas[i + 1] = color[1] // G
        canvas[i + 2] = color[2] // B
        canvas[i + 3] = color[3] // A
      }

      const fallbackIcon = nativeImage.createFromBuffer(canvas, { width: size, height: size })

      // Validate fallback icon was created
      if (!fallbackIcon || fallbackIcon.isEmpty()) {
        console.error('Fallback icon creation failed, using empty icon')
        return nativeImage.createEmpty()
      }

      return fallbackIcon
    }
    catch (fallbackError) {
      console.error('Error creating fallback icon:', fallbackError)
      // Last resort - return empty icon
      try {
        return nativeImage.createEmpty()
      }
      catch (emptyError) {
        console.error('Even empty icon creation failed:', emptyError)
        // This should never happen, but just in case...
        throw new Error('Complete icon system failure')
      }
    }
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
    try {
      // Validate tray exists before doing anything
      if (!this.tray) {
        console.warn('Tray not initialized, skipping icon update')
        return
      }

      // Safely create icon with full error handling
      let icon
      try {
        icon = this.createTrayIcon()
        if (!icon || icon.isEmpty()) {
          console.error('Created icon is empty, attempting fallback')
          icon = this.createFallbackIcon()
        }
      }
      catch (iconError) {
        console.error('Error creating tray icon:', iconError)
        try {
          icon = this.createFallbackIcon()
        }
        catch (fallbackError) {
          console.error('Fallback icon creation also failed:', fallbackError)
          return // Give up rather than crash
        }
      }

      // Safely set the tray image
      try {
        this.tray.setImage(icon)
      }
      catch (setImageError) {
        console.error('Error setting tray image:', setImageError)
        // Continue to try other operations
      }

      // Update tooltip with pending count safely
      try {
        const pendingCount = this.options?.getPendingCount?.() || 0
        const tooltip = pendingCount > 0
          ? `Message Approver (${pendingCount} pending)`
          : 'Message Approver'

        if (this.tray && typeof this.tray.setToolTip === 'function') {
          this.tray.setToolTip(tooltip)
        }
      }
      catch (tooltipError) {
        console.error('Error setting tooltip:', tooltipError)
        // Continue to dock badge
      }

      // Update dock badge on macOS for additional visibility (with safety)
      try {
        if (process.platform === 'darwin' && app && typeof app.dock?.setBadge === 'function') {
          const pendingCount = this.options?.getPendingCount?.() || 0
          if (pendingCount > 0) {
            app.dock.setBadge(pendingCount.toString())
          }
          else {
            app.dock.setBadge('')
          }
        }
      }
      catch (dockError) {
        console.error('Error setting dock badge:', dockError)
        // Don't crash if dock operations fail
      }
    }
    catch (generalError) {
      console.error('General error in updateTrayIcon:', generalError)
      // Log but don't crash - the app should continue running
    }
  }

  public getBounds(): Electron.Rectangle | undefined {
    try {
      return this.tray?.getBounds()
    }
    catch (error) {
      console.error('Error getting tray bounds:', error)
      return undefined
    }
  }

  public destroy(): void {
    try {
      if (this.tray) {
        try {
          this.tray.destroy()
        }
        catch (destroyError) {
          console.error('Error destroying tray:', destroyError)
        }
        this.tray = null
      }
    }
    catch (generalError) {
      console.error('Error in tray destroy:', generalError)
      // Ensure tray is nulled even if destroy fails
      this.tray = null
    }
  }
}
