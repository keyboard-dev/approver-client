import { app } from 'electron'
import * as path from 'path'
import type { AuthService } from './services/auth-service'
import type { WindowManager } from './window-manager'

/**
 * Options for app initialization
 */
export interface AppInitializerOptions {
  customProtocol: string
  getAuthService: () => AuthService | null
  windowManager: WindowManager
}

/**
 * Result of app initialization
 */
export interface AppInitializerResult {
  shouldContinue: boolean
  startupProtocolUrl: string | null
}

/**
 * Queue for protocol URLs that arrive before auth service is ready
 * This is critical on Windows where second-instance events can fire
 * before app initialization completes
 */
const protocolUrlQueue: string[] = []

/**
 * Get and clear all queued protocol URLs
 * Should be called after auth service is initialized
 */
export function getQueuedProtocolUrls(): string[] {
  const urls = [...protocolUrlQueue]
  protocolUrlQueue.length = 0
  return urls
}

/**
 * Initialize the Electron app with platform-specific handlers
 * Returns initialization result with continuation flag and any startup protocol URL
 */
export function initializeApp(options: AppInitializerOptions): AppInitializerResult {
  // STEP 0: Handle Squirrel events on Windows FIRST (before anything else)
  if (!handleSquirrelEvents()) {
    return { shouldContinue: false, startupProtocolUrl: null } // App should quit
  }

  // STEP 1: Handle single instance lock
  if (!handleSingleInstanceLock(options)) {
    return { shouldContinue: false, startupProtocolUrl: null } // App should quit
  }

  // STEP 2: Set up protocol event handlers
  setupProtocolHandlers(options)

  // STEP 3: Register as default protocol client
  registerProtocolClient(options.customProtocol)

  // STEP 4: Check for protocol URL at startup (Windows only)
  const startupProtocolUrl = checkForProtocolUrl(options.customProtocol)

  return { shouldContinue: true, startupProtocolUrl } // App should continue
}

/**
 * Handle Squirrel installer events on Windows
 * Returns true if app should continue, false if app should quit
 */
function handleSquirrelEvents(): boolean {
  if (process.platform === 'win32') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const squirrelStartup = require('electron-squirrel-startup')
    if (squirrelStartup) {
      return false
    }
  }
  return true
}

/**
 * Handle single instance lock to ensure only one app instance runs
 * Returns true if this instance got the lock, false if another instance is already running
 */
function handleSingleInstanceLock(options: AppInitializerOptions): boolean {
  const gotTheLock = app.requestSingleInstanceLock()

  if (!gotTheLock) {
    return false
  }

  // If we got the lock, set up the second-instance handler
  app.on('second-instance', (_event, commandLine) => {
    // Extract protocol URL from command line
    const url = extractProtocolUrlFromCommandLine(commandLine, options.customProtocol)

    if (url) {
      // Check if auth service is ready
      const authService = options.getAuthService()
      if (authService) {
        // Auth service is ready, process immediately
        try {
          authService.handleOAuthCallback(url)
        }
        catch (error) {
        }
      }
      else {
        // Auth service not ready yet, queue the URL for processing after initialization
        protocolUrlQueue.push(url)
      }
    }

    // Show the window if it exists
    options.windowManager.showWindow()
  })

  return true
}

/**
 * Setup platform-specific protocol handlers for OAuth callbacks
 */
export function setupProtocolHandlers(options: AppInitializerOptions): void {
  // Platform-specific protocol handling
  if (process.platform === 'darwin') {
    // Handle macOS open-url events (MUST be before app.whenReady())
    app.on('open-url', (event, url) => {
      event.preventDefault()

      // Only handle our custom protocol URLs, ignore HTTP URLs
      if (url.startsWith(`${options.customProtocol}://`)) {
        // Check if auth service is ready
        const authService = options.getAuthService()
        if (authService) {
          // Auth service is ready, process immediately
          authService.handleOAuthCallback(url)
        }
        else {
          // Auth service not ready yet, queue the URL for processing after initialization
          protocolUrlQueue.push(url)
        }
      }
    })
  }
}

/**
 * Register the app as the default protocol client for OAuth callbacks
 */
export function registerProtocolClient(customProtocol: string): void {
  try {
    const isAlreadyRegistered = app.isDefaultProtocolClient(customProtocol)

    // On Windows in dev mode, ALWAYS re-register to ensure latest command format is used
    // This is critical because if the protocol was registered with an old format, it won't work
    const shouldRegister = !isAlreadyRegistered || (process.platform === 'win32' && !app.isPackaged)

    if (shouldRegister) {
      let registrationSuccess = false

      // On Windows in development, we need to provide the path to electron and the main script
      if (process.platform === 'win32' && !app.isPackaged) {
        // In development, pass electron executable and the main script path
        // IMPORTANT: Add '--' separator to tell Electron to stop processing arguments as files
        // This prevents protocol URLs from being treated as module paths
        const electronPath = process.execPath
        const mainScriptPath = path.resolve(process.argv[1])

        // The protocol URL will be appended by Windows AFTER these args
        // Format: electron.exe mainScriptPath -- <protocol-url>
        // The '--' tells Electron to stop treating subsequent args as module paths
        const args = [mainScriptPath, '--']

        registrationSuccess = app.setAsDefaultProtocolClient(
          customProtocol,
          electronPath,
          args,
        )
      }
      else {
        // In production or on other platforms, simple registration works
        registrationSuccess = app.setAsDefaultProtocolClient(customProtocol)
      }

      if (!registrationSuccess) {
      }
    }
  }
  catch (error) {
  }
}

/**
 * Extract protocol URL from command line arguments
 * Handles various Windows command-line formats for protocol URLs
 * @param commandLine - Array of command line arguments
 * @param customProtocol - The protocol to search for (e.g., 'mcpauth')
 * @returns The extracted URL or null if not found
 */
function extractProtocolUrlFromCommandLine(commandLine: string[], customProtocol: string): string | null {
  // Find protocol URL in command line arguments
  // Windows may pass URLs in different formats:
  // 1. Direct: mcpauth://callback?code=...
  // 2. Quoted: "mcpauth://callback?code=..."
  // 3. Split across arguments
  // 4. Just query params: ?code=...&state=...
  // 5. URL-encoded variations

  // First, try to find it directly in one of the arguments
  const directUrl = commandLine.find(arg => arg.startsWith(`${customProtocol}://`))
  if (directUrl) {
    // Decode URL-encoded characters if present
    try {
      return decodeURIComponent(directUrl)
    }
    catch {
      return directUrl
    }
  }

  // If not found directly, try to reconstruct from multiple arguments
  if (process.platform === 'win32') {
    // Join all arguments and look for the protocol URL
    const joinedArgs = commandLine.join(' ')
    const protocolIndex = joinedArgs.indexOf(`${customProtocol}://`)

    if (protocolIndex !== -1) {
      // Extract URL from joined string
      const urlStart = joinedArgs.substring(protocolIndex)
      // Use regex to extract the complete URL including query parameters
      // This captures everything from protocol:// until the next space (or end of string)
      const urlMatch = urlStart.match(/^[^\s]+/)
      if (urlMatch) {
        const url = urlMatch[0]
        // Decode URL-encoded characters
        try {
          return decodeURIComponent(url)
        }
        catch {
          return url
        }
      }
    }
    else {
      // Check for bare query parameters (Windows may pass just "?code=...&state=...")
      const queryParamPattern = /\?(.*code=.*state=|.*state=.*code=)/
      const queryArg = commandLine.find(arg => queryParamPattern.test(arg))

      if (queryArg) {
        // Reconstruct the full protocol URL
        const url = `${customProtocol}://callback${queryArg}`
        return url
      }

      // Check if query params are split across multiple arguments
      const codeArg = commandLine.find(arg => arg.includes('code='))
      const stateArg = commandLine.find(arg => arg.includes('state='))

      if (codeArg || stateArg) {
        // Reconstruct query string from fragments
        const fragments = commandLine.filter(arg =>
          arg.includes('code=') || arg.includes('state=') || arg.startsWith('?') || arg.startsWith('&'),
        )

        let queryString = fragments.join('').replace(/^[?&]+/, '?').replace(/&&+/g, '&')

        // Ensure it starts with ?
        if (!queryString.startsWith('?')) {
          queryString = '?' + queryString
        }

        const url = `${customProtocol}://callback${queryString}`
        return url
      }
    }
  }

  return null
}

/**
 * Check if a protocol URL was passed as a command-line argument at startup
 * This is needed on Windows where protocol URLs are passed as arguments
 * Returns the protocol URL if found, null otherwise
 */
export function checkForProtocolUrl(customProtocol: string): string | null {
  // On macOS, protocol URLs are handled via 'open-url' event, not argv
  if (process.platform === 'darwin') {
    return null
  }

  // On Windows, protocol URLs can be passed in various formats:
  // 1. Direct: mcpauth://callback?code=...
  // 2. Quoted: "mcpauth://callback?code=..."
  // 3. Split across arguments due to special characters
  // 4. Just query params: ?code=...&state=...
  // 5. URL-encoded variations

  // Look for protocol URL in arguments
  for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i]

    // Check if this argument starts with our protocol
    if (arg.startsWith(`${customProtocol}://`)) {
      // Decode URL-encoded characters
      try {
        return decodeURIComponent(arg)
      }
      catch {
        return arg
      }
    }
  }

  // Try to reconstruct URL from multiple arguments
  // Join all arguments and look for the protocol URL
  const joinedArgs = process.argv.join(' ')
  const protocolIndex = joinedArgs.indexOf(`${customProtocol}://`)

  if (protocolIndex !== -1) {
    // Extract URL from joined string
    const urlStart = joinedArgs.substring(protocolIndex)
    // Find end of URL (space or end of string, but not spaces in query params)
    // Look for the callback path and extract everything after the protocol
    const urlMatch = urlStart.match(/^[^\s]+/)
    if (urlMatch) {
      const url = urlMatch[0]
      // Decode URL-encoded characters
      try {
        return decodeURIComponent(url)
      }
      catch {
        return url
      }
    }
  }

  // Check for bare query parameters (Windows may pass just "?code=...&state=...")
  const queryParamPattern = /\?(.*code=.*state=|.*state=.*code=)/
  for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i]
    if (queryParamPattern.test(arg)) {
      // Reconstruct the full protocol URL
      const url = `${customProtocol}://callback${arg}`
      return url
    }
  }

  // Check if query params are split across multiple arguments
  const codeArg = process.argv.find(arg => arg.includes('code='))
  const stateArg = process.argv.find(arg => arg.includes('state='))

  if (codeArg || stateArg) {
    // Reconstruct query string from fragments
    const fragments = process.argv.filter(arg =>
      arg.includes('code=') || arg.includes('state=') || arg.startsWith('?') || arg.startsWith('&'),
    )

    let queryString = fragments.join('').replace(/^[?&]+/, '?').replace(/&&+/g, '&')

    // Ensure it starts with ?
    if (!queryString.startsWith('?')) {
      queryString = '?' + queryString
    }

    const url = `${customProtocol}://callback${queryString}`
    return url
  }

  return null
}
