/**
 * Pipedream Service
 *
 * API service for communicating with Pipedream Connect endpoints
 * on the remote-oauth-server (api.keyboard.dev)
 */

import { API_URL } from '../web/config'

const API_BASE = `${API_URL}/api/pipedream`

// =============================================================================
// Types
// =============================================================================

export interface PipedreamApp {
  id: string
  nameSlug: string
  name: string
  description?: string
  logoUrl?: string
  categories?: string[]
  authType?: 'oauth' | 'keys' | 'none'
  featuredWeight?: number
}

export interface PipedreamAccount {
  id: string
  name: string
  app: PipedreamApp
  externalId?: string
  healthy: boolean
  dead: boolean
  createdAt: string
  updatedAt: string
}

export interface ConnectTokenResponse {
  success: boolean
  token: string
  expiresAt: string
  connectLinkUrl: string
}

export interface AccountsResponse {
  success: boolean
  accounts: PipedreamAccount[]
  totalCount: number
  hasMore: boolean
}

export interface AppsResponse {
  success: boolean
  apps: PipedreamApp[]
  totalCount: number
  hasMore: boolean
}

export interface DeleteAccountResponse {
  success: boolean
  message: string
}

export interface CategoriesResponse {
  success: boolean
  categories: string[]
}

// =============================================================================
// Helper Functions
// =============================================================================

async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await window.electronAPI.getAccessToken()
  if (!token) {
    throw new Error('No access token available. Please sign in.')
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage = `HTTP ${response.status}`
    try {
      const errorJson = JSON.parse(errorText)
      errorMessage = errorJson.message || errorJson.error || errorMessage
    }
    catch {
      errorMessage = errorText || errorMessage
    }
    throw new Error(errorMessage)
  }
  return response.json()
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Generate a Connect token for initiating account connection.
 * Returns a token and a connectLinkUrl that can be opened in a browser.
 */
export async function getConnectToken(app?: string): Promise<ConnectTokenResponse> {
  const headers = await getAuthHeaders()
  const body: Record<string, string> = {}
  if (app) {
    body.app = app
  }

  const response = await fetch(`${API_BASE}/connect-token`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  return handleResponse<ConnectTokenResponse>(response)
}

/**
 * List all connected accounts for the current user.
 */
export async function listAccounts(): Promise<AccountsResponse> {
  const headers = await getAuthHeaders()

  const response = await fetch(`${API_BASE}/accounts`, {
    method: 'GET',
    headers,
  })

  return handleResponse<AccountsResponse>(response)
}

/**
 * List available apps with optional search query and category filter.
 * By default, returns the most popular apps sorted by featured_weight descending.
 */
export async function listApps(
  query?: string,
  limit = 50,
  category?: string,
  sortKey: 'name' | 'name_slug' | 'featured_weight' = 'featured_weight',
  sortDirection: 'asc' | 'desc' = 'desc',
): Promise<AppsResponse> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams()
  if (query) {
    params.set('q', query)
  }
  if (category) {
    params.set('category', category)
  }
  params.set('limit', limit.toString())
  params.set('sort_key', sortKey)
  params.set('sort_direction', sortDirection)

  const url = `${API_BASE}/apps${params.toString() ? `?${params.toString()}` : ''}`

  const response = await fetch(url, {
    method: 'GET',
    headers,
  })

  return handleResponse<AppsResponse>(response)
}

/**
 * List available app categories.
 */
export async function listCategories(): Promise<CategoriesResponse> {
  const headers = await getAuthHeaders()

  const response = await fetch(`${API_BASE}/apps/categories`, {
    method: 'GET',
    headers,
  })

  return handleResponse<CategoriesResponse>(response)
}

/**
 * Delete/disconnect a connected account.
 */
export async function deleteAccount(accountId: string): Promise<DeleteAccountResponse> {
  const headers = await getAuthHeaders()

  const response = await fetch(`${API_BASE}/accounts/${accountId}`, {
    method: 'DELETE',
    headers,
  })

  return handleResponse<DeleteAccountResponse>(response)
}

/**
 * Open the Pipedream Connect Link URL in the system browser.
 * This initiates the OAuth flow for the specified app.
 */
export async function openConnectLink(app: string): Promise<void> {
  const { connectLinkUrl } = await getConnectToken(app)
  window.electronAPI.openExternalUrl(connectLinkUrl)
}

// =============================================================================
// Export Service Object
// =============================================================================

export const pipedreamService = {
  getConnectToken,
  listAccounts,
  listApps,
  listCategories,
  deleteAccount,
  openConnectLink,
}

export default pipedreamService
