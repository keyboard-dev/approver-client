/**
 * usePipedream Hook
 *
 * React hook for managing Pipedream connected apps state.
 * Handles fetching accounts, apps, connecting, and disconnecting.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  deleteAccount,
  listAccounts,
  listApps,
  openConnectLink,
  PipedreamAccount,
  PipedreamApp,
} from '../services/pipedream-service'

// =============================================================================
// Constants
// =============================================================================

const POLL_INTERVAL_MS = 3000 // 3 seconds - standard for OAuth callback detection
const POLL_TIMEOUT_MS = 120000 // 120 seconds (2 minutes) - typical OAuth flow completion time

// =============================================================================
// Types
// =============================================================================

interface UsePipedreamState {
  // Connected accounts
  accounts: PipedreamAccount[]
  accountsLoading: boolean
  accountsError: string | null

  // Available apps (search results)
  apps: PipedreamApp[]
  appsLoading: boolean
  appsError: string | null

  // Default apps (top 5 most popular apps)
  defaultApps: PipedreamApp[]
  defaultAppsLoading: boolean

  // Search state
  searchQuery: string

  // Connection state
  connectingApp: string | null
  disconnectingAccountId: string | null
}

interface UsePipedreamActions {
  // Fetch data
  refreshAccounts: () => Promise<void>
  searchApps: (query: string) => Promise<void>

  // Connect/Disconnect
  connectApp: (appSlug: string) => Promise<void>
  disconnectAccount: (accountId: string) => Promise<void>

  // Search
  setSearchQuery: (query: string) => void
  clearSearch: () => void
}

export type UsePipedreamReturn = UsePipedreamState & UsePipedreamActions

// =============================================================================
// Hook Implementation
// =============================================================================

export function usePipedream(): UsePipedreamReturn {
  // Connected accounts state
  const [accounts, setAccounts] = useState<PipedreamAccount[]>([])
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [accountsError, setAccountsError] = useState<string | null>(null)

  // Available apps state (search results)
  const [apps, setApps] = useState<PipedreamApp[]>([])
  const [appsLoading, setAppsLoading] = useState(false)
  const [appsError, setAppsError] = useState<string | null>(null)

  // Default apps state (top 5 most popular apps)
  const [defaultApps, setDefaultApps] = useState<PipedreamApp[]>([])
  const [defaultAppsLoading, setDefaultAppsLoading] = useState(false)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')

  // Connection state
  const [connectingApp, setConnectingApp] = useState<string | null>(null)
  const [disconnectingAccountId, setDisconnectingAccountId] = useState<string | null>(null)

  // Polling state (using refs to avoid dependency issues in effects)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pollingAppSlugRef = useRef<string | null>(null)
  const accountsBeforePollingRef = useRef<PipedreamAccount[]>([])

  // ==========================================================================
  // Polling Functions
  // ==========================================================================

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current)
      pollingTimeoutRef.current = null
    }
    pollingAppSlugRef.current = null
    setConnectingApp(null)
    console.log('[usePipedream] Stopped polling for new connections')
  }, [])

  const checkForNewAccount = useCallback((newAccounts: PipedreamAccount[]) => {
    const expectedAppSlug = pollingAppSlugRef.current
    if (!expectedAppSlug) {
      return false
    }

    // Check if there's a new account for the app we're trying to connect
    const previousAccounts = accountsBeforePollingRef.current
    const newAccount = newAccounts.find(
      acc => acc.app.nameSlug === expectedAppSlug
        && !previousAccounts.some(prev => prev.id === acc.id),
    )

    if (newAccount) {
      console.log(`[usePipedream] Detected new connection for ${expectedAppSlug}:`, newAccount)
      return true
    }

    return false
  }, [])

  const startPolling = useCallback((appSlug: string) => {
    // Store the app we're waiting for and current accounts
    pollingAppSlugRef.current = appSlug
    accountsBeforePollingRef.current = accounts

    console.log(`[usePipedream] Starting polling for ${appSlug}...`)

    // Set up polling interval
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await listAccounts()
        const newAccounts = response.accounts || []

        // Update accounts state
        setAccounts(newAccounts)

        // Check if we found the new account
        if (checkForNewAccount(newAccounts)) {
          stopPolling()
        }
      }
      catch (error) {
        console.error('[usePipedream] Error during polling:', error)
      }
    }, POLL_INTERVAL_MS)

    // Set up timeout to stop polling after max time
    pollingTimeoutRef.current = setTimeout(() => {
      console.log(`[usePipedream] Polling timeout reached for ${appSlug}`)
      stopPolling()
    }, POLL_TIMEOUT_MS)
  }, [accounts, checkForNewAccount, stopPolling])

  // ==========================================================================
  // Fetch Functions
  // ==========================================================================

  const refreshAccounts = useCallback(async () => {
    setAccountsLoading(true)
    setAccountsError(null)

    try {
      const response = await listAccounts()
      setAccounts(response.accounts || [])
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load accounts'
      setAccountsError(message)
      console.error('[usePipedream] Failed to fetch accounts:', error)
    }
    finally {
      setAccountsLoading(false)
    }
  }, [])

  const searchApps = useCallback(async (query: string) => {
    setAppsLoading(true)
    setAppsError(null)

    try {
      const response = await listApps(query, 100)
      setApps(response.apps || [])
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to search apps'
      setAppsError(message)
      console.error('[usePipedream] Failed to search apps:', error)
    }
    finally {
      setAppsLoading(false)
    }
  }, [])

  const fetchDefaultApps = useCallback(async () => {
    setDefaultAppsLoading(true)

    try {
      const response = await listApps(undefined, 5)
      setDefaultApps(response.apps || [])
    }
    catch (error) {
      console.error('[usePipedream] Failed to fetch default apps:', error)
    }
    finally {
      setDefaultAppsLoading(false)
    }
  }, [])

  // ==========================================================================
  // Connect/Disconnect Functions
  // ==========================================================================

  const connectApp = useCallback(async (appSlug: string) => {
    setConnectingApp(appSlug)

    try {
      await openConnectLink(appSlug)
      // Start polling to detect when the OAuth flow completes
      startPolling(appSlug)
    }
    catch (error) {
      console.error('[usePipedream] Failed to connect app:', error)
      setConnectingApp(null)
      throw error
    }
  }, [startPolling])

  const disconnectAccount = useCallback(async (accountId: string) => {
    setDisconnectingAccountId(accountId)

    try {
      await deleteAccount(accountId)
      // Remove from local state
      setAccounts(prev => prev.filter(acc => acc.id !== accountId))
    }
    catch (error) {
      console.error('[usePipedream] Failed to disconnect account:', error)
      throw error
    }
    finally {
      setDisconnectingAccountId(null)
    }
  }, [])

  // ==========================================================================
  // Search Functions
  // ==========================================================================

  const handleSetSearchQuery = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    setApps([])
  }, [])

  // ==========================================================================
  // Effects
  // ==========================================================================

  // Load accounts and default apps on mount
  useEffect(() => {
    refreshAccounts()
    fetchDefaultApps()
  }, [refreshAccounts, fetchDefaultApps])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      stopPolling()
    }
  }, [stopPolling])

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setApps([])
      return
    }

    const timeoutId = setTimeout(() => {
      searchApps(searchQuery)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery, searchApps])

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    // State
    accounts,
    accountsLoading,
    accountsError,
    apps,
    appsLoading,
    appsError,
    defaultApps,
    defaultAppsLoading,
    searchQuery,
    connectingApp,
    disconnectingAccountId,

    // Actions
    refreshAccounts,
    searchApps,
    connectApp,
    disconnectAccount,
    setSearchQuery: handleSetSearchQuery,
    clearSearch,
  }
}

export default usePipedream
