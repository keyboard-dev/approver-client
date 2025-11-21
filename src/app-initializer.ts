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
      console.log('Squirrel event detected, quitting app')
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
    console.log('Another instance is already running')
    return false
  }

  // If we got the lock, set up the second-instance handler
  app.on('second-instance', (_event, commandLine) => {
    console.log('=== SECOND INSTANCE DETECTED ===')
    console.log('Platform:', process.platform)
    console.log('Raw command line array length:', commandLine.length)
    console.log('Command line arguments:')
    commandLine.forEach((arg, index) => {
      console.log(`  [${index}]: "${arg}"`)
    })

    // Extract protocol URL from command line
    console.log('Attempting to extract protocol URL...')
    const url = extractProtocolUrlFromCommandLine(commandLine, options.customProtocol)

    if (url) {
      console.log('✓ Found protocol URL in second instance:', url)
      console.log('  Protocol URL length:', url.length)
      console.log('  Contains code param:', url.includes('code='))
      console.log('  Contains state param:', url.includes('state='))

      // Check if auth service is ready
      const authService = options.getAuthService()
      if (authService) {
        // Auth service is ready, process immediately
        try {
          console.log('Auth service is ready, processing URL immediately...')
          authService.handleOAuthCallback(url)
          console.log('✓ Successfully delegated URL to AuthService')
        }
        catch (error) {
          console.error('❌ Error processing second instance URL:', error)
          console.error('Error details:', error instanceof Error ? error.message : String(error))
        }
      }
      else {
        // Auth service not ready yet, queue the URL for processing after initialization
        console.log('⚠️  Auth service not ready yet, queueing URL for later processing')
        protocolUrlQueue.push(url)
        console.log(`✓ URL queued (${protocolUrlQueue.length} URLs in queue)`)
      }
    }
    else {
      console.log('❌ No protocol URL found in second instance')
      console.log('This means the URL extraction failed - check the command line args above')
    }

    // Show the window if it exists
    console.log('Showing window...')
    options.windowManager.showWindow()
    console.log('=== END SECOND INSTANCE HANDLING ===')
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
        console.log('macOS open-url event received:', url)

        // Check if auth service is ready
        const authService = options.getAuthService()
        if (authService) {
          // Auth service is ready, process immediately
          console.log('Auth service is ready, processing URL immediately...')
          authService.handleOAuthCallback(url)
        }
        else {
          // Auth service not ready yet, queue the URL for processing after initialization
          console.log('⚠️  Auth service not ready yet, queueing URL for later processing')
          protocolUrlQueue.push(url)
          console.log(`✓ URL queued (${protocolUrlQueue.length} URLs in queue)`)
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
    console.log('=== PROTOCOL REGISTRATION ===')
    console.log('Platform:', process.platform)
    console.log('Packaged:', app.isPackaged)
    console.log('Protocol:', customProtocol)

    const isAlreadyRegistered = app.isDefaultProtocolClient(customProtocol)
    console.log(`Registration status:`, isAlreadyRegistered ? 'Already registered' : 'Not registered')

    // On Windows in dev mode, ALWAYS re-register to ensure latest command format is used
    // This is critical because if the protocol was registered with an old format, it won't work
    const shouldRegister = !isAlreadyRegistered || (process.platform === 'win32' && !app.isPackaged)

    if (shouldRegister) {
      if (process.platform === 'win32' && !app.isPackaged && isAlreadyRegistered) {
        console.log('⚠️  Force re-registering protocol on Windows dev mode to ensure latest command format')
      }

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

        console.log(`Registering protocol (Windows dev mode):`)
        console.log(`  - Electron path: ${electronPath}`)
        console.log(`  - Script path: ${mainScriptPath}`)
        console.log(`  - Arguments:`, args)
        console.log(`  - Full command will be: "${electronPath}" ${args.join(' ')} "<protocol-url>"`)
        console.log(`  - Note: The '--' separator prevents protocol URLs from being treated as files`)

        registrationSuccess = app.setAsDefaultProtocolClient(
          customProtocol,
          electronPath,
          args,
        )

        // Verify registration
        if (registrationSuccess) {
          const verified = app.isDefaultProtocolClient(customProtocol)
          console.log(`  - Verification check: ${verified ? 'PASSED' : 'FAILED'}`)

          if (!verified) {
            console.warn(`  - WARNING: Registration succeeded but verification failed`)
            console.warn(`  - This may indicate a Windows registry issue`)
          }
        }
      }
      else {
        // In production or on other platforms, simple registration works
        console.log(`Registering protocol (${process.platform} ${app.isPackaged ? 'production' : 'development'} mode)`)
        registrationSuccess = app.setAsDefaultProtocolClient(customProtocol)
      }

      if (registrationSuccess) {
        console.log(`✓ Successfully registered protocol "${customProtocol}"`)
      }
      else {
        console.error(`✗ Failed to register protocol "${customProtocol}"`)
        console.error('  This may cause OAuth callbacks to fail')
      }
    }
    else {
      console.log('✓ Protocol already registered, skipping registration')
    }
    console.log('=== END PROTOCOL REGISTRATION ===')
  }
  catch (error) {
    console.error(`❌ Error during protocol registration:`, error)
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
    console.log('Found protocol URL directly in command line:', directUrl)
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
        console.log('Reconstructed protocol URL from Windows command line:', url)
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
        console.log('Found bare query parameters in command line:', queryArg)
        // Reconstruct the full protocol URL
        const url = `${customProtocol}://callback${queryArg}`
        console.log('Reconstructed protocol URL:', url)
        return url
      }

      // Check if query params are split across multiple arguments
      const codeArg = commandLine.find(arg => arg.includes('code='))
      const stateArg = commandLine.find(arg => arg.includes('state='))

      if (codeArg || stateArg) {
        console.log('Found query param fragments:', { codeArg, stateArg })

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
        console.log('Reconstructed protocol URL from fragments:', url)
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
  console.log('Checking for protocol URL in command line arguments:', process.argv)

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
      console.log(`Found protocol URL in argv[${i}]:`, arg)
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
      console.log('Reconstructed protocol URL from command line:', url)
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
      console.log(`Found bare query parameters in argv[${i}]:`, arg)
      // Reconstruct the full protocol URL
      const url = `${customProtocol}://callback${arg}`
      console.log('Reconstructed protocol URL:', url)
      return url
    }
  }

  // Check if query params are split across multiple arguments
  const codeArg = process.argv.find(arg => arg.includes('code='))
  const stateArg = process.argv.find(arg => arg.includes('state='))

  if (codeArg || stateArg) {
    console.log('Found query param fragments:', { codeArg, stateArg })

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
    console.log('Reconstructed protocol URL from fragments:', url)
    return url
  }

  return null
}
