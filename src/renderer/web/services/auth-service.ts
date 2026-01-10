/**
 * Web Auth Service
 *
 * Handles JWT-based authentication for the web app.
 * - Token storage in localStorage
 * - Automatic token refresh
 * - OAuth redirect flow initiation
 */

import type { AuthStatus } from '../../../preload'
import {
  API_ENDPOINTS,
  API_URL,
  AUTHKIT_DOMAIN,
  STORAGE_KEYS,
  TOKEN_REFRESH_BUFFER_MS,
  WORKOS_CLIENT_ID,
  WORKOS_REDIRECT_URI,
} from '../config'

// Event emitter for auth state changes
type AuthEventCallback = (data: AuthStatus) => void
type AuthErrorCallback = (error: { message: string }) => void
type AuthLogoutCallback = () => void

const authEventListeners: {
  success: AuthEventCallback[]
  error: AuthErrorCallback[]
  logout: AuthLogoutCallback[]
} = {
  success: [],
  error: [],
  logout: [],
}

// Token refresh timer
let refreshTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Store user info in localStorage
 */
interface StoredUserInfo {
  id: string
  email: string
  firstName: string
  lastName: string
  profilePictureUrl?: string
}

/**
 * Get the access token from localStorage
 */
export function getAccessToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)
}

/**
 * Get the refresh token from localStorage
 */
export function getRefreshToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)
}

/**
 * Get the token expiration time
 */
export function getTokenExpiresAt(): number | null {
  const expiresAt = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRES_AT)
  return expiresAt ? parseInt(expiresAt, 10) : null
}

/**
 * Get stored user info
 */
export function getStoredUserInfo(): StoredUserInfo | null {
  const userInfo = localStorage.getItem(STORAGE_KEYS.USER_INFO)
  if (!userInfo) return null

  try {
    return JSON.parse(userInfo)
  }
  catch {
    return null
  }
}

/**
 * Store tokens and user info
 */
export function storeTokens(data: {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
  user?: StoredUserInfo
}): void {
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.accessToken)

  if (data.refreshToken) {
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refreshToken)
  }

  if (data.expiresIn) {
    const expiresAt = Date.now() + (data.expiresIn * 1000)
    localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, expiresAt.toString())
    scheduleTokenRefresh(expiresAt)
  }

  if (data.user) {
    localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(data.user))
  }
}

/**
 * Clear all stored tokens and user info
 */
export function clearTokens(): void {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN)
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN)
  localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRES_AT)
  localStorage.removeItem(STORAGE_KEYS.USER_INFO)

  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
}

/**
 * Check if the access token is expired or about to expire
 */
export function isTokenExpired(): boolean {
  const expiresAt = getTokenExpiresAt()
  if (!expiresAt) return true

  // Consider expired if within the refresh buffer
  return Date.now() >= (expiresAt - TOKEN_REFRESH_BUFFER_MS)
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  const token = getAccessToken()
  if (!token) return false

  // If token exists but is expired, we might still be able to refresh
  return !isTokenExpired() || !!getRefreshToken()
}

/**
 * Schedule automatic token refresh
 */
function scheduleTokenRefresh(expiresAt: number): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
  }

  const refreshTime = expiresAt - TOKEN_REFRESH_BUFFER_MS - Date.now()

  if (refreshTime > 0) {
    refreshTimer = setTimeout(async () => {
      try {
        await refreshAccessToken()
      }
      catch (error) {
        console.error('[WebAuth] Auto-refresh failed:', error)
        // Emit logout event if refresh fails
        emitAuthLogout()
      }
    }, refreshTime)
  }
}

/**
 * Refresh the access token using the refresh token
 */
export async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    return false
  }

  try {
    const response = await fetch(`${API_URL}${API_ENDPOINTS.AUTH_WEB_REFRESH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!response.ok) {
      throw new Error('Token refresh failed')
    }

    const data = await response.json()

    storeTokens({
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn: data.expires_in,
    })

    return true
  }
  catch (error) {
    console.error('[WebAuth] Refresh token failed:', error)
    clearTokens()
    return false
  }
}

/**
 * Get the current auth status
 */
export async function getAuthStatus(): Promise<AuthStatus> {
  const accessToken = getAccessToken()
  const userInfo = getStoredUserInfo()

  if (!accessToken) {
    return { authenticated: false }
  }

  // If token is expired, try to refresh
  if (isTokenExpired()) {
    const refreshed = await refreshAccessToken()
    if (!refreshed) {
      return { authenticated: false }
    }
  }

  // Verify token with server (optional - can be skipped for performance)
  try {
    const response = await fetch(`${API_URL}${API_ENDPOINTS.AUTH_VERIFY}`, {
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
      },
    })

    if (!response.ok) {
      clearTokens()
      return { authenticated: false }
    }

    const data = await response.json()

    // Update stored user info if server returns new data
    if (data.user) {
      const updatedUser: StoredUserInfo = {
        id: data.user.sub || data.user.id,
        email: data.user.email,
        firstName: data.user.first_name || data.user.given_name || '',
        lastName: data.user.last_name || data.user.family_name || '',
        profilePictureUrl: data.user.profile_picture_url || data.user.picture,
      }
      localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(updatedUser))

      return {
        authenticated: true,
        user: updatedUser,
      }
    }
  }
  catch (error) {
    console.error('[WebAuth] Verify token failed:', error)
    // Fall back to stored user info on network error
  }

  if (userInfo) {
    return {
      authenticated: true,
      user: userInfo,
    }
  }

  return { authenticated: false }
}

/**
 * Generate PKCE code verifier and challenge
 */
async function generatePKCE(): Promise<{ codeVerifier: string, codeChallenge: string }> {
  // Generate random code verifier
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  const codeVerifier = btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')

  // Generate code challenge (SHA-256 hash of verifier)
  const encoder = new TextEncoder()
  const data = encoder.encode(codeVerifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')

  return { codeVerifier, codeChallenge }
}

/**
 * Start the OAuth flow by redirecting to WorkOS
 */
export async function startOAuth(): Promise<void> {
  const { codeVerifier, codeChallenge } = await generatePKCE()

  // Store code verifier for later use in callback
  sessionStorage.setItem('oauth_code_verifier', codeVerifier)

  // Generate state for CSRF protection
  const state = crypto.randomUUID()
  sessionStorage.setItem('oauth_state', state)

  // Generate nonce
  const nonce = crypto.randomUUID()
  sessionStorage.setItem('oauth_nonce', nonce)

  // Build authorization URL
  const authUrl = new URL(`https://${AUTHKIT_DOMAIN}/oauth2/authorize`)
  authUrl.searchParams.set('client_id', WORKOS_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', WORKOS_REDIRECT_URI)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', 'openid profile email offline_access')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('nonce', nonce)
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')

  // Redirect to authorization URL
  window.location.href = authUrl.toString()
}

/**
 * Handle OAuth callback (call this from your callback route)
 */
export async function handleOAuthCallback(code: string, state: string): Promise<AuthStatus> {
  // Verify state
  const savedState = sessionStorage.getItem('oauth_state')

  if (state !== savedState) {
    throw new Error('Invalid state parameter')
  }

  // Get code verifier
  const codeVerifier = sessionStorage.getItem('oauth_code_verifier')

  if (!codeVerifier) {
    throw new Error('Code verifier not found')
  }

  // Clean up session storage
  sessionStorage.removeItem('oauth_state')
  sessionStorage.removeItem('oauth_code_verifier')
  sessionStorage.removeItem('oauth_nonce')

  // Exchange code for tokens
  const response = await fetch(`${API_URL}${API_ENDPOINTS.AUTH_WEB_CALLBACK}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      code,
      state,
      code_verifier: codeVerifier,
      redirect_uri: WORKOS_REDIRECT_URI,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Token exchange failed' }))
    throw new Error(error.error || 'Token exchange failed')
  }

  const data = await response.json()

  // Store tokens
  const user: StoredUserInfo = {
    id: data.user.id,
    email: data.user.email,
    firstName: data.user.firstName || data.user.first_name || '',
    lastName: data.user.lastName || data.user.last_name || '',
    profilePictureUrl: data.user.profile_picture || data.user.profilePictureUrl,
  }

  storeTokens({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    user,
  })

  const authStatus: AuthStatus = {
    authenticated: true,
    user,
  }

  // Emit success event
  emitAuthSuccess(authStatus)

  return authStatus
}

/**
 * Logout - clear tokens and notify listeners
 */
export async function logout(): Promise<void> {
  // Optionally notify server
  const accessToken = getAccessToken()
  if (accessToken) {
    try {
      await fetch(`${API_URL}${API_ENDPOINTS.AUTH_LOGOUT}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
    }
    catch {
      // Ignore logout errors
    }
  }

  clearTokens()
  emitAuthLogout()
}

// Event emitter functions
export function onAuthSuccess(callback: AuthEventCallback): void {
  authEventListeners.success.push(callback)
}

export function onAuthError(callback: AuthErrorCallback): void {
  authEventListeners.error.push(callback)
}

export function onAuthLogout(callback: AuthLogoutCallback): void {
  authEventListeners.logout.push(callback)
}

export function removeAuthListener(event: 'success' | 'error' | 'logout', callback: unknown): void {
  const listeners = authEventListeners[event]
  const index = listeners.indexOf(callback as never)
  if (index > -1) {
    listeners.splice(index, 1)
  }
}

export function removeAllAuthListeners(event: 'success' | 'error' | 'logout'): void {
  authEventListeners[event] = []
}

function emitAuthSuccess(data: AuthStatus): void {
  authEventListeners.success.forEach(callback => callback(data))
}

export function emitAuthError(error: { message: string }): void {
  authEventListeners.error.forEach(callback => callback(error))
}

function emitAuthLogout(): void {
  authEventListeners.logout.forEach(callback => callback())
}

// Initialize token refresh on load
export function initializeAuth(): void {
  const expiresAt = getTokenExpiresAt()
  if (expiresAt && !isTokenExpired()) {
    scheduleTokenRefresh(expiresAt)
  }
  else if (getRefreshToken()) {
    // Token is expired but we have a refresh token - try to refresh
    refreshAccessToken().catch(console.error)
  }
}
