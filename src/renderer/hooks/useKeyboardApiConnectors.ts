/**
 * useKeyboardApiConnectors Hook
 *
 * React hook for managing Keyboard API connector state.
 * Handles fetching providers, authentication status, connecting, and disconnecting.
 */

import { useCallback, useEffect, useState } from 'react'

import { ServerProviderInfo } from '../../oauth-providers'
import { getProviderIcon } from '../utils/providerUtils'
import { isWeb } from '../web/platform'

// =============================================================================
// Types
// =============================================================================

export interface KeyboardApiProvider {
  id: string
  name: string
  icon: string
  configured: boolean
  scopes: string[]
}

interface ExtendedServerProviderInfo extends ServerProviderInfo {
  logoUrl?: string
}

export interface ProviderStatus {
  authenticated: boolean
  user?: {
    name?: string
    email?: string
  }
}

interface UseKeyboardApiConnectorsState {
  // Available providers
  providers: KeyboardApiProvider[]
  providersLoading: boolean
  providersError: string | null

  // Provider authentication status
  providerStatus: Record<string, ProviderStatus>

  // Connection state
  connectingProviderId: string | null
  disconnectingProviderId: string | null
}

interface UseKeyboardApiConnectorsActions {
  // Fetch data
  refreshProviders: () => Promise<void>
  refreshStatus: () => Promise<void>

  // Connect/Disconnect
  connectProvider: (providerId: string) => Promise<void>
  disconnectProvider: (providerId: string) => Promise<void>
}

export type UseKeyboardApiConnectorsReturn = UseKeyboardApiConnectorsState & UseKeyboardApiConnectorsActions

// =============================================================================
// Hook Implementation
// =============================================================================

export function useKeyboardApiConnectors(): UseKeyboardApiConnectorsReturn {
  // In web mode, local connectors are not supported (they require Electron IPC)
  const isWebMode = isWeb()

  // Providers state
  const [providers, setProviders] = useState<KeyboardApiProvider[]>([])
  const [providersLoading, setProvidersLoading] = useState(true)
  const [providersError, setProvidersError] = useState<string | null>(null)

  // Provider status state
  const [providerStatus, setProviderStatus] = useState<Record<string, ProviderStatus>>({})

  // Connection state
  const [connectingProviderId, setConnectingProviderId] = useState<string | null>(null)
  const [disconnectingProviderId, setDisconnectingProviderId] = useState<string | null>(null)

  // ==========================================================================
  // Fetch Functions
  // ==========================================================================

  const refreshProviders = useCallback(async () => {
    // Skip in web mode - local connectors require Electron IPC
    if (isWebMode) {
      setProvidersLoading(false)
      setProviders([])
      return
    }

    setProvidersLoading(true)
    setProvidersError(null)

    try {
      const serverProviders = await window.electronAPI.getServerProviders()
      let keyboardApiServer = serverProviders.find(s => s.id === 'keyboard-api')

      if (!keyboardApiServer) {
        const newServer = {
          id: 'keyboard-api',
          name: 'Keyboard API',
          url: 'https://api.keyboard.dev',
        }
        await window.electronAPI.addServerProvider(newServer)
        keyboardApiServer = newServer
      }

      const fetchedProviders = await window.electronAPI.fetchServerProviders('keyboard-api')

      if (fetchedProviders && fetchedProviders.length > 0) {
        const transformedProviders = fetchedProviders
          .map((p: ExtendedServerProviderInfo) => ({
            id: p.name,
            name: p.name.charAt(0).toUpperCase() + p.name.slice(1),
            icon: getProviderIcon(p.logoUrl, p.name),
            configured: p.configured,
            scopes: p.scopes,
          }))
          .filter(p => p.name.toLowerCase() !== 'onboarding')

        setProviders(transformedProviders)
      }
      else {
        throw new Error('No providers returned from server')
      }
    }
    catch (error) {
      console.error('[useKeyboardApiConnectors] Failed to fetch providers:', error)
      setProvidersError(error instanceof Error ? error.message : 'Failed to load providers')
      // Fallback to default providers
      setProviders([
        { id: 'google', name: 'Google', icon: getProviderIcon(undefined, 'google'), configured: true, scopes: [] },
        { id: 'github', name: 'GitHub', icon: getProviderIcon(undefined, 'github'), configured: true, scopes: [] },
        { id: 'microsoft', name: 'Microsoft', icon: getProviderIcon(undefined, 'microsoft'), configured: true, scopes: [] },
      ])
    }
    finally {
      setProvidersLoading(false)
    }
  }, [isWebMode])

  const refreshStatus = useCallback(async () => {
    // Skip in web mode - local connectors require Electron IPC
    if (isWebMode) {
      return
    }

    try {
      const status = await window.electronAPI.getProviderAuthStatus()
      setProviderStatus(status)
    }
    catch (error) {
      console.error('[useKeyboardApiConnectors] Failed to load provider status:', error)
    }
  }, [isWebMode])

  // ==========================================================================
  // Connect/Disconnect Functions
  // ==========================================================================

  const connectProvider = useCallback(async (providerId: string) => {
    // Skip in web mode - local connectors require Electron IPC
    if (isWebMode) {
      console.warn('[useKeyboardApiConnectors] Cannot connect local provider in web mode')
      setProvidersError('Local connectors are not supported in web mode')
      return
    }

    setConnectingProviderId(providerId)
    setProvidersError(null)

    try {
      await window.electronAPI.startServerProviderOAuth('keyboard-api', providerId)
      // Note: Auth success/error will be handled by the event listeners
    }
    catch (error) {
      console.error(`[useKeyboardApiConnectors] Failed to start OAuth for ${providerId}:`, error)
      setProvidersError(`Failed to start OAuth: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setConnectingProviderId(null)
    }
  }, [isWebMode])

  const disconnectProvider = useCallback(async (providerId: string) => {
    // Skip in web mode - local connectors require Electron IPC
    if (isWebMode) {
      console.warn('[useKeyboardApiConnectors] Cannot disconnect local provider in web mode')
      return
    }

    setDisconnectingProviderId(providerId)
    setProvidersError(null)

    try {
      await window.electronAPI.logoutProvider(providerId)
      await refreshStatus()
    }
    catch (error) {
      console.error(`[useKeyboardApiConnectors] Failed to disconnect ${providerId}:`, error)
      setProvidersError(`Failed to disconnect from ${providerId}`)
    }
    finally {
      setDisconnectingProviderId(null)
    }
  }, [isWebMode, refreshStatus])

  // ==========================================================================
  // Effects
  // ==========================================================================

  // Load providers and status on mount
  useEffect(() => {
    refreshProviders()
    refreshStatus()
  }, [refreshProviders, refreshStatus])

  // Listen for OAuth events
  useEffect(() => {
    const handleProviderAuthSuccess = (_event: unknown, data: { providerId: string }) => {
      setConnectingProviderId(null)
      refreshStatus()
      setProvidersError(null)
    }

    const handleProviderAuthError = (_event: unknown, data: { providerId: string, message?: string }) => {
      console.error('[useKeyboardApiConnectors] Provider auth error:', data)
      setProvidersError(`Authentication failed: ${data.message || 'Unknown error'}`)
      setConnectingProviderId(null)
    }

    if (window.electronAPI) {
      window.electronAPI.onProviderAuthSuccess?.(handleProviderAuthSuccess)
      window.electronAPI.onProviderAuthError?.(handleProviderAuthError)
    }

    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeAllListeners?.('provider-auth-success')
        window.electronAPI.removeAllListeners?.('provider-auth-error')
      }
    }
  }, [refreshStatus])

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    // State
    providers,
    providersLoading,
    providersError,
    providerStatus,
    connectingProviderId,
    disconnectingProviderId,

    // Actions
    refreshProviders,
    refreshStatus,
    connectProvider,
    disconnectProvider,
  }
}

export default useKeyboardApiConnectors
