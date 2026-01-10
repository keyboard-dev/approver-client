/**
 * Web Mode Initialization
 *
 * Bootstraps the web app by setting up window.electronAPI with web implementations.
 * This file must be imported before React mounts.
 */

import { webAPIBridge } from './api-bridge'
import { IS_WEB } from './config'
import { isElectron, logPlatformInfo } from './platform'
import { handleOAuthCallback, initializeAuth } from './services/auth-service'

/**
 * Initialize web mode
 *
 * Sets up window.electronAPI with web implementations if not running in Electron.
 * Should be called before React mounts.
 */
export function initializeWebMode(): void {
  // Log platform info for debugging
  if (import.meta.env.DEV) {
    logPlatformInfo()
  }

  // Skip if already in Electron (electronAPI is set by preload)
  if (isElectron()) {
    console.log('[WebInit] Running in Electron mode - using native IPC')
    return
  }

  // Set up web API bridge
  console.log('[WebInit] Running in web mode - initializing web API bridge')

  // Assign the web bridge to window.electronAPI
  // This allows all existing code to work without changes
  ;(window as Window & { electronAPI?: typeof webAPIBridge }).electronAPI = webAPIBridge

  // Initialize auth (set up token refresh timers, etc.)
  initializeAuth()

  // Handle OAuth callback if on callback route
  handleOAuthCallbackRoute()
}

/**
 * Check if current URL is an OAuth callback and handle it
 */
async function handleOAuthCallbackRoute(): Promise<void> {
  const url = new URL(window.location.href)

  // If we're on localhost during a callback, redirect to 127.0.0.1
  // This bridges GitHub's localhost requirement with WorkOS's 127.0.0.1 requirement
  // GitHub only allows one callback URI (configured as localhost:8082/callback)
  // WorkOS requires 127.0.0.1 for HTTP in production
  // By redirecting, we preserve sessionStorage access on 127.0.0.1
  if (window.location.hostname === 'localhost' && url.pathname === '/callback') {
    const redirectUrl = new URL(window.location.href)
    redirectUrl.hostname = '127.0.0.1'
    window.location.replace(redirectUrl.toString())
    return
  }

  // Check for main OAuth callback path (WorkOS login)
  if (url.pathname === '/auth/callback') {
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    if (error) {
      console.error('[WebInit] OAuth error:', error)
      // Redirect to login with error
      window.location.href = `/?error=${encodeURIComponent(error)}`
      return
    }

    if (code && state) {
      try {
        await handleOAuthCallback(code, state)

        // Redirect to main app after successful auth
        window.location.href = '/'
      }
      catch (error) {
        console.error('[WebInit] OAuth callback failed:', error)
        window.location.href = `/?error=${encodeURIComponent(String(error))}`
      }
    }
  }

  // Check for unified callback path (used by Electron and now web for GitHub OAuth)
  // This routes to either WorkOS or GitHub based on sessionStorage
  if (url.pathname === '/callback') {
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    // Check if this is a GitHub OAuth callback by looking for github_oauth_state
    const hasGitHubState = sessionStorage.getItem('github_oauth_state')

    if (hasGitHubState) {
      // This is a GitHub OAuth callback - handle it
      if (error) {
        console.error('[WebInit] GitHub OAuth error:', error)
        window.location.href = `/?github_error=${encodeURIComponent(error)}`
        return
      }

      if (code && state) {
        const storedState = sessionStorage.getItem('github_oauth_state')
        const sessionId = sessionStorage.getItem('github_oauth_session_id')

        if (!storedState || state !== storedState) {
          console.error('[WebInit] GitHub OAuth state mismatch')
          window.location.href = '/?github_error=state_mismatch'
          return
        }

        if (!sessionId) {
          console.error('[WebInit] Missing GitHub OAuth session ID')
          window.location.href = '/?github_error=missing_session'
          return
        }

        try {
          const response = await webAPIBridge.exchangeGitHubCodeForToken(code, sessionId, state)

          sessionStorage.removeItem('github_oauth_state')
          sessionStorage.removeItem('github_oauth_session_id')

          window.location.href = '/?github_connected=true'
        }
        catch (error) {
          console.error('[WebInit] GitHub token exchange failed:', error)
          sessionStorage.removeItem('github_oauth_state')
          sessionStorage.removeItem('github_oauth_session_id')
          window.location.href = `/?github_error=${encodeURIComponent(String(error))}`
        }
      }
      return
    }
    // If no GitHub state, it might be another OAuth callback - let it fall through
  }

  // Check for GitHub OAuth callback path
  if (url.pathname === '/github/callback') {
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    if (error) {
      console.error('[WebInit] GitHub OAuth error:', error)
      window.location.href = `/?github_error=${encodeURIComponent(error)}`
      return
    }

    if (code && state) {
      // Retrieve session data
      const storedState = sessionStorage.getItem('github_oauth_state')
      const sessionId = sessionStorage.getItem('github_oauth_session_id')

      if (!storedState || state !== storedState) {
        console.error('[WebInit] GitHub OAuth state mismatch')
        window.location.href = '/?github_error=state_mismatch'
        return
      }

      if (!sessionId) {
        console.error('[WebInit] Missing GitHub OAuth session ID')
        window.location.href = '/?github_error=missing_session'
        return
      }

      // Exchange code for token via server
      try {
        const response = await webAPIBridge.exchangeGitHubCodeForToken(code, sessionId, state)

        // Clear session storage
        sessionStorage.removeItem('github_oauth_state')
        sessionStorage.removeItem('github_oauth_session_id')

        // Redirect to main app with success parameter
        window.location.href = '/?github_connected=true'
      }
      catch (error) {
        console.error('[WebInit] GitHub token exchange failed:', error)

        // Clear session storage
        sessionStorage.removeItem('github_oauth_state')
        sessionStorage.removeItem('github_oauth_session_id')

        window.location.href = `/?github_error=${encodeURIComponent(String(error))}`
      }
    }
    return
  }

  // Check for GitHub connection success parameter
  // Note: GitHub redirects to http://localhost:8082/callback (server callback)
  // But for web apps, we poll for completion status instead
  if (url.searchParams.get('github_connected') === 'true') {
    // Clear the URL parameter
    window.history.replaceState({}, document.title, '/')
  }
}

/**
 * Check if web mode is properly initialized
 */
export function isWebModeInitialized(): boolean {
  return IS_WEB && typeof window !== 'undefined' && !!window.electronAPI
}

// Auto-initialize if this module is imported
// This ensures web mode is set up before any components try to use window.electronAPI
if (typeof window !== 'undefined' && !isElectron()) {
  initializeWebMode()
}

export default initializeWebMode
