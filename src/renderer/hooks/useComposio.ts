/**
 * useComposio Hook
 *
 * React hook for managing Composio connected apps and triggers state.
 * Handles fetching accounts, apps, connecting, deploying triggers, and task management.
 */

import { useCallback, useEffect, useState } from 'react'

import {
  ComposioApp,
  ComposioConnectedAccount,
  ComposioTrigger,
  deleteConnectedAccount,
  deleteTrigger,
  getTriggerConfig,
  listApps,
  listAvailableTriggers,
  listConnectedAccounts,
  listTriggers,
  openConnectionUrl,
  pauseTrigger,
  resumeTrigger,
  syncConnectedAccounts,
  type ComposioAvailableTrigger,
} from '../services/composio-service'

// =============================================================================
// Types
// =============================================================================

interface UseComposioState {
  // Connected accounts
  accounts: ComposioConnectedAccount[]
  accountsLoading: boolean
  accountsError: string | null

  // Available apps (search results)
  apps: ComposioApp[]
  appsLoading: boolean
  appsError: string | null

  // Deployed triggers
  triggers: ComposioTrigger[]
  triggersLoading: boolean
  triggersError: string | null

  // Available triggers for an app
  availableTriggers: ComposioAvailableTrigger[]
  availableTriggersLoading: boolean
  availableTriggersError: string | null

  // Trigger configuration
  triggerConfig: Record<string, unknown> | null
  triggerConfigLoading: boolean
  triggerConfigError: string | null

  // Search state
  searchQuery: string

  // Connection state
  connectingApp: string | null
  disconnectingAccountId: string | null

  // Trigger management state
  pausingTriggerId: string | null
  resumingTriggerId: string | null
  deletingTriggerId: string | null
}

interface UseComposioActions {
  // Fetch data
  refreshAccounts: () => Promise<void>
  searchApps: (query: string, supportsTriggers?: boolean) => Promise<void>
  refreshTriggers: () => Promise<void>
  fetchAvailableTriggers: (appName: string) => Promise<void>
  fetchAppsWithTriggers: () => Promise<void>
  fetchTriggerConfig: (triggerName: string) => Promise<void>

  // Connect/Disconnect accounts
  connectApp: (appName: string) => Promise<void>
  disconnectAccount: (accountId: string) => Promise<void>
  syncAccounts: () => Promise<void>

  // Trigger management
  pauseTriggerAction: (triggerId: string) => Promise<void>
  resumeTriggerAction: (triggerId: string) => Promise<void>
  deleteTriggerAction: (triggerId: string) => Promise<void>

  // Search
  setSearchQuery: (query: string) => void
  clearSearch: () => void
  clearAvailableTriggers: () => void
  clearTriggerConfig: () => void
}

export type UseComposioReturn = UseComposioState & UseComposioActions

// =============================================================================
// Hook Implementation
// =============================================================================

export function useComposio(): UseComposioReturn {
  // Connected accounts state
  const [accounts, setAccounts] = useState<ComposioConnectedAccount[]>([])
  const [accountsLoading, setAccountsLoading] = useState(false)
  const [accountsError, setAccountsError] = useState<string | null>(null)

  // Available apps state (search results)
  const [apps, setApps] = useState<ComposioApp[]>([])
  const [appsLoading, setAppsLoading] = useState(false)
  const [appsError, setAppsError] = useState<string | null>(null)

  // Deployed triggers state
  const [triggers, setTriggers] = useState<ComposioTrigger[]>([])
  const [triggersLoading, setTriggersLoading] = useState(false)
  const [triggersError, setTriggersError] = useState<string | null>(null)

  // Available triggers state
  const [availableTriggers, setAvailableTriggers] = useState<ComposioAvailableTrigger[]>([])
  const [availableTriggersLoading, setAvailableTriggersLoading] = useState(false)
  const [availableTriggersError, setAvailableTriggersError] = useState<string | null>(null)

  // Trigger configuration state
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown> | null>(null)
  const [triggerConfigLoading, setTriggerConfigLoading] = useState(false)
  const [triggerConfigError, setTriggerConfigError] = useState<string | null>(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')

  // Connection state
  const [connectingApp, setConnectingApp] = useState<string | null>(null)
  const [disconnectingAccountId, setDisconnectingAccountId] = useState<string | null>(null)

  // Trigger management state
  const [pausingTriggerId, setPausingTriggerId] = useState<string | null>(null)
  const [resumingTriggerId, setResumingTriggerId] = useState<string | null>(null)
  const [deletingTriggerId, setDeletingTriggerId] = useState<string | null>(null)

  // ==========================================================================
  // Fetch Functions
  // ==========================================================================

  const refreshAccounts = useCallback(async () => {
    setAccountsLoading(true)
    setAccountsError(null)

    try {
      const response = await listConnectedAccounts()
      setAccounts(response.data?.items || [])
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load accounts'
      setAccountsError(message)
    }
    finally {
      setAccountsLoading(false)
    }
  }, [])

  const searchApps = useCallback(async (query: string, supportsTriggers?: boolean) => {
    setAppsLoading(true)
    setAppsError(null)

    try {
      const response = await listApps({
        search: query,
        limit: 100,
        supportsTriggers,
      })
      setApps(response.data?.items || [])
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to search apps'
      setAppsError(message)
    }
    finally {
      setAppsLoading(false)
    }
  }, [])

  const refreshTriggers = useCallback(async () => {
    setTriggersLoading(true)
    setTriggersError(null)

    try {
      const response = await listTriggers()
      setTriggers(response.data?.items || [])
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load triggers'
      setTriggersError(message)
    }
    finally {
      setTriggersLoading(false)
    }
  }, [])

  const fetchAvailableTriggers = useCallback(async (appName: string) => {
    setAvailableTriggersLoading(true)
    setAvailableTriggersError(null)

    try {
      const response = await listAvailableTriggers(appName)
      setAvailableTriggers(response.data || [])
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch available triggers'
      setAvailableTriggersError(message)
    }
    finally {
      setAvailableTriggersLoading(false)
    }
  }, [])

  const fetchAppsWithTriggers = useCallback(async () => {
    setAppsLoading(true)
    setAppsError(null)

    try {
      const response = await listApps({ supportsTriggers: true, limit: 100 })
      setApps(response.data?.items || [])
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load apps'
      setAppsError(message)
    }
    finally {
      setAppsLoading(false)
    }
  }, [])

  const fetchTriggerConfig = useCallback(async (triggerName: string) => {
    setTriggerConfigLoading(true)
    setTriggerConfigError(null)

    try {
      const response = await getTriggerConfig(triggerName)
      setTriggerConfig(response.data?.config || null)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch trigger config'
      setTriggerConfigError(message)
    }
    finally {
      setTriggerConfigLoading(false)
    }
  }, [])

  // ==========================================================================
  // Connect/Disconnect Functions
  // ==========================================================================

  const connectApp = useCallback(async (appName: string) => {
    setConnectingApp(appName)

    try {
      await openConnectionUrl(appName)
    }
    catch (error) {
      setConnectingApp(null)
      throw error
    }
    finally {
      setConnectingApp(null)
    }
  }, [])

  const disconnectAccount = useCallback(async (accountId: string) => {
    setDisconnectingAccountId(accountId)

    try {
      await deleteConnectedAccount(accountId)
      setAccounts(prev => prev.filter(acc => acc.id !== accountId))
    }
    finally {
      setDisconnectingAccountId(null)
    }
  }, [])

  const syncAccounts = useCallback(async () => {
    setAccountsLoading(true)
    setAccountsError(null)

    try {
      await syncConnectedAccounts()
      await refreshAccounts()
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sync accounts'
      setAccountsError(message)
      throw error
    }
    finally {
      setAccountsLoading(false)
    }
  }, [refreshAccounts])

  // ==========================================================================
  // Trigger Management Functions
  // ==========================================================================

  const pauseTriggerAction = useCallback(async (triggerId: string) => {
    setPausingTriggerId(triggerId)

    try {
      await pauseTrigger(triggerId)
      setTriggers(prev =>
        prev.map(t => (t.id === triggerId ? { ...t, status: 'paused' as const } : t)),
      )
    }
    finally {
      setPausingTriggerId(null)
    }
  }, [])

  const resumeTriggerAction = useCallback(async (triggerId: string) => {
    setResumingTriggerId(triggerId)

    try {
      await resumeTrigger(triggerId)
      setTriggers(prev =>
        prev.map(t => (t.id === triggerId ? { ...t, status: 'active' as const } : t)),
      )
    }
    finally {
      setResumingTriggerId(null)
    }
  }, [])

  const deleteTriggerAction = useCallback(async (triggerId: string) => {
    setDeletingTriggerId(triggerId)

    try {
      await deleteTrigger(triggerId)
      setTriggers(prev => prev.filter(t => t.id !== triggerId))
    }
    finally {
      setDeletingTriggerId(null)
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

  const clearAvailableTriggers = useCallback(() => {
    setAvailableTriggers([])
    setAvailableTriggersError(null)
  }, [])

  const clearTriggerConfig = useCallback(() => {
    setTriggerConfig(null)
    setTriggerConfigError(null)
  }, [])

  // ==========================================================================
  // Effects
  // ==========================================================================

  // Load accounts and triggers on mount
  useEffect(() => {
    refreshAccounts()
    refreshTriggers()
  }, [refreshAccounts, refreshTriggers])

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      fetchAppsWithTriggers()
      return
    }

    const timeoutId = setTimeout(() => {
      searchApps(searchQuery, true)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery, searchApps, fetchAppsWithTriggers])

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
    triggers,
    triggersLoading,
    triggersError,
    availableTriggers,
    availableTriggersLoading,
    availableTriggersError,
    triggerConfig,
    triggerConfigLoading,
    triggerConfigError,
    searchQuery,
    connectingApp,
    disconnectingAccountId,
    pausingTriggerId,
    resumingTriggerId,
    deletingTriggerId,

    // Actions
    refreshAccounts,
    searchApps,
    refreshTriggers,
    fetchAvailableTriggers,
    fetchAppsWithTriggers,
    fetchTriggerConfig,
    connectApp,
    disconnectAccount,
    syncAccounts,
    pauseTriggerAction,
    resumeTriggerAction,
    deleteTriggerAction,
    setSearchQuery: handleSetSearchQuery,
    clearSearch,
    clearAvailableTriggers,
    clearTriggerConfig,
  }
}

export default useComposio
