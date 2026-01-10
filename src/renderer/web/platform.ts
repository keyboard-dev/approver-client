/**
 * Platform Detection Utilities
 *
 * Provides functions to detect the current runtime environment
 * and conditionally execute platform-specific code.
 */

import { IS_WEB } from './config'

/**
 * Check if running in Electron environment
 */
export function isElectron(): boolean {
  // Check for electronAPI exposed by preload script
  if (typeof window !== 'undefined' && window.electronAPI) {
    return true
  }

  // Additional checks for Electron environment
  if (typeof process !== 'undefined' && process.versions?.electron) {
    return true
  }

  // Check for Electron-specific user agent
  if (typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron')) {
    return true
  }

  return false
}

/**
 * Check if running in web browser environment
 */
export function isWeb(): boolean {
  return IS_WEB || !isElectron()
}

/**
 * Get the current platform identifier
 */
export function getPlatform(): 'electron' | 'web' {
  return isElectron() ? 'electron' : 'web'
}

/**
 * Execute platform-specific code
 */
export function platformSelect<T>(options: {
  electron: () => T
  web: () => T
}): T {
  if (isElectron()) {
    return options.electron()
  }
  return options.web()
}

/**
 * Execute code only in Electron environment
 */
export function electronOnly<T>(fn: () => T): T | undefined {
  if (isElectron()) {
    return fn()
  }
  return undefined
}

/**
 * Execute code only in web environment
 */
export function webOnly<T>(fn: () => T): T | undefined {
  if (isWeb()) {
    return fn()
  }
  return undefined
}

/**
 * Assert that we're running in a specific platform
 * Throws an error if the assertion fails
 */
export function assertPlatform(expected: 'electron' | 'web'): void {
  const current = getPlatform()
  if (current !== expected) {
    throw new Error(`Expected platform '${expected}' but running in '${current}'`)
  }
}

/**
 * Log platform information (useful for debugging)
 */
export function logPlatformInfo(): void {
  console.log('[Platform]', {
    platform: getPlatform(),
    isElectron: isElectron(),
    isWeb: isWeb(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
    hasElectronAPI: typeof window !== 'undefined' && !!window.electronAPI,
  })
}
