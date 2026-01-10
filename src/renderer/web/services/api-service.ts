/**
 * Web API Service
 *
 * HTTP client with automatic JWT injection for making authenticated
 * API calls to the remote-oauth-server.
 */

import { API_URL } from '../config'
import { emitAuthError, getAccessToken, isTokenExpired, logout, refreshAccessToken } from './auth-service'

export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  status: number
  ok: boolean
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  skipAuth?: boolean
  retryOnUnauthorized?: boolean
}

/**
 * Make an authenticated API request
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const {
    skipAuth = false,
    retryOnUnauthorized = true,
    body,
    headers: customHeaders,
    ...fetchOptions
  } = options

  // Build headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...customHeaders,
  }

  // Add authorization header if not skipping auth
  if (!skipAuth) {
    // Check if token needs refresh
    if (isTokenExpired()) {
      const refreshed = await refreshAccessToken()
      if (!refreshed) {
        return {
          error: 'Authentication required',
          status: 401,
          ok: false,
        }
      }
    }

    const token = getAccessToken()
    if (token) {
      ;(headers as Record<string, string>).Authorization = `Bearer ${token}`
    }
  }

  // Build request URL
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    // Handle 401 responses
    if (response.status === 401 && retryOnUnauthorized && !skipAuth) {
      // Try to refresh token and retry
      const refreshed = await refreshAccessToken()
      if (refreshed) {
        // Retry with new token
        return apiRequest<T>(endpoint, { ...options, retryOnUnauthorized: false })
      }
      else {
        // Refresh failed - logout
        emitAuthError({ message: 'Session expired' })
        await logout()
        return {
          error: 'Session expired',
          status: 401,
          ok: false,
        }
      }
    }

    // Parse response
    let data: T | undefined
    const contentType = response.headers.get('content-type')

    if (contentType?.includes('application/json')) {
      try {
        data = await response.json()
      }
      catch {
        // JSON parse failed
      }
    }

    if (!response.ok) {
      const errorMessage = (data as { error?: string })?.error
        || (data as { message?: string })?.message
        || `Request failed with status ${response.status}`

      return {
        error: errorMessage,
        status: response.status,
        ok: false,
        data,
      }
    }

    return {
      data,
      status: response.status,
      ok: true,
    }
  }
  catch (error) {
    console.error('[WebAPI] Request failed:', error)
    return {
      error: error instanceof Error ? error.message : 'Network error',
      status: 0,
      ok: false,
    }
  }
}

/**
 * Convenience methods for common HTTP methods
 */
export const api = {
  get: <T = unknown>(endpoint: string, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'PUT', body }),

  patch: <T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'PATCH', body }),

  delete: <T = unknown>(endpoint: string, options?: RequestOptions) => {
    return apiRequest<T>(endpoint, { ...options, method: 'DELETE' })
  },
}

/**
 * Create a Server-Sent Events connection with authentication
 */
export function createSSEConnection(
  endpoint: string,
  handlers: {
    onMessage?: (event: MessageEvent) => void
    onError?: (event: Event) => void
    onOpen?: () => void
  },
): EventSource | null {
  const token = getAccessToken()
  if (!token) {
    console.error('[WebAPI] Cannot create SSE connection without auth token')
    return null
  }

  // Build URL with auth token (since EventSource doesn't support custom headers)
  const url = new URL(endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`)
  url.searchParams.set('token', token)

  const eventSource = new EventSource(url.toString())

  if (handlers.onOpen) {
    eventSource.onopen = handlers.onOpen
  }

  if (handlers.onMessage) {
    eventSource.onmessage = handlers.onMessage
  }

  if (handlers.onError) {
    eventSource.onerror = handlers.onError
  }

  return eventSource
}

/**
 * Create a WebSocket connection with authentication
 */
export function createWebSocketConnection(
  endpoint: string,
  handlers: {
    onMessage?: (event: MessageEvent) => void
    onError?: (event: Event) => void
    onOpen?: () => void
    onClose?: (event: CloseEvent) => void
  },
): WebSocket | null {
  const token = getAccessToken()
  if (!token) {
    console.error('[WebAPI] Cannot create WebSocket connection without auth token')
    return null
  }

  // Build URL with auth token
  const baseUrl = API_URL.replace('https://', 'wss://').replace('http://', 'ws://')
  const url = new URL(endpoint.startsWith('ws') ? endpoint : `${baseUrl}${endpoint}`)
  url.searchParams.set('token', token)

  const ws = new WebSocket(url.toString())

  if (handlers.onOpen) {
    ws.onopen = handlers.onOpen
  }

  if (handlers.onMessage) {
    ws.onmessage = handlers.onMessage
  }

  if (handlers.onError) {
    ws.onerror = handlers.onError
  }

  if (handlers.onClose) {
    ws.onclose = handlers.onClose
  }

  return ws
}
