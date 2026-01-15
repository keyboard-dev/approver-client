import { contextBridge, ipcRenderer } from 'electron'

export interface OverlayAPI {
  // Mouse event control
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void

  // Screenshot capture
  captureScreenshot: (clickX: number, clickY: number) => Promise<string | null>

  // Overlay control
  closeOverlay: () => void

  // Permission handling
  checkScreenPermission: () => Promise<boolean>
  requestScreenPermission: () => Promise<boolean>

  // Screenshots directory
  getScreenshotsDir: () => Promise<string>

  // Event listeners
  onOverlayToggle: (callback: () => void) => void
  removeAllListeners: (channel: string) => void
}

contextBridge.exposeInMainWorld('overlayAPI', {
  // Toggle click-through mode
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }): void => {
    ipcRenderer.send('overlay:set-ignore-mouse', ignore, options)
  },

  // Capture screenshot at click coordinates
  captureScreenshot: (clickX: number, clickY: number): Promise<string | null> => {
    return ipcRenderer.invoke('overlay:capture-screenshot', clickX, clickY)
  },

  // Close the overlay
  closeOverlay: (): void => {
    ipcRenderer.send('overlay:close')
  },

  // Check if screen recording permission is granted (macOS)
  checkScreenPermission: (): Promise<boolean> => {
    return ipcRenderer.invoke('overlay:check-screen-permission')
  },

  // Request screen recording permission (macOS)
  requestScreenPermission: (): Promise<boolean> => {
    return ipcRenderer.invoke('overlay:request-screen-permission')
  },

  // Get screenshots directory path
  getScreenshotsDir: (): Promise<string> => {
    return ipcRenderer.invoke('overlay:get-screenshots-dir')
  },

  // Listen for overlay toggle events from main process
  onOverlayToggle: (callback: () => void): void => {
    ipcRenderer.on('overlay:toggle', callback)
  },

  // Remove all listeners for a channel
  removeAllListeners: (channel: string): void => {
    ipcRenderer.removeAllListeners(channel)
  },
} as OverlayAPI)

// Extend the global Window interface
declare global {
  interface Window {
    overlayAPI: OverlayAPI
  }
}
