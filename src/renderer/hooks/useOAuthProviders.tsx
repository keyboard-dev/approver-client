import { IpcRendererEvent } from 'electron'
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { ProviderAuthErrorData, ProviderAuthEventData, ProviderStatus } from '../../preload'

// Provider IDs to exclude from OAuth provider management
const EXCLUDED_PROVIDER_IDS = ['onboarding']

// Grouped provider status by authentication state
export interface GroupedProviderStatus {
  authenticated: Array<{ providerId: string } & ProviderStatus>
  expired: Array<{ providerId: string } & ProviderStatus>
  disconnected: string[] // Provider IDs that have no tokens
}

interface OAuthProvidersContextType {
  providers: Record<string, ProviderStatus>
  isLoading: boolean
  error: string | null
  lastChecked: number | null
  refreshProvider: (providerId: string) => Promise<boolean>
  reconnectProvider: (providerId: string) => Promise<boolean>
  checkAllProviders: () => Promise<void>
  getGroupedProviders: () => GroupedProviderStatus
  refreshAllExpiredProviders: () => Promise<{ success: number, failed: number }>
  getProviderId: (providerName: string) => string | undefined
}

const OAuthProvidersContext = createContext<OAuthProvidersContextType | undefined>(undefined)

interface OAuthProvidersProviderProps {
  children: React.ReactNode
}

export const OAuthProvidersProvider: React.FC<OAuthProvidersProviderProps> = ({ children }) => {
  const [providers, setProviders] = useState<Record<string, ProviderStatus>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastChecked, setLastChecked] = useState<number | null>(null)

  // Track available provider IDs (those that are configured, even if not authenticated)
  const availableProviderIds = useRef<Set<string>>(new Set())

  // Track if initialization has already happened to prevent duplicate calls
  const isInitialized = useRef(false)

  /**
   * Fetch all provider statuses from main process
   */
  const checkAllProviders = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const status = await window.electronAPI.getProviderAuthStatus()

      // Filter out excluded providers
      const filteredStatus = Object.fromEntries(
        Object.entries(status).filter(([id]) => !EXCLUDED_PROVIDER_IDS.includes(id)),
      )

      setProviders(filteredStatus)
      setLastChecked(Date.now())

      // Track which providers exist (excluding excluded ones)
      Object.keys(filteredStatus).forEach(id => availableProviderIds.current.add(id))
    }
    catch (error) {
      setError('Failed to load OAuth provider statuses')
    }
    finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Refresh tokens for a specific provider
   */
  const refreshProvider = useCallback(async (providerId: string): Promise<boolean> => {
    try {
      setError(null)
      const success = await window.electronAPI.refreshProviderTokens(providerId)

      if (success) {
        // Re-fetch the status for this provider after successful refresh
        await checkAllProviders()
      }

      return success
    }
    catch (error) {
      setError(`Failed to refresh ${providerId}`)
      return false
    }
  }, [checkAllProviders])

  /**
   * Reconnect a provider by restarting the OAuth flow
   * Note: We don't log out first so that if the OAuth flow fails,
   * the user still has their old (expired) tokens and can retry
   */
  const reconnectProvider = useCallback(async (providerId: string): Promise<boolean> => {
    try {
      setError(null)
      // Start the OAuth flow - it will overwrite existing tokens on success
      await window.electronAPI.startServerProviderOAuth('keyboard-api', providerId)
      return true
    }
    catch (error) {
      setError(`Failed to reconnect ${providerId}`)
      return false
    }
  }, [])

  /**
   * Get providers grouped by authentication status
   */
  const getGroupedProviders = useCallback((): GroupedProviderStatus => {
    const authenticated: Array<{ providerId: string } & ProviderStatus> = []
    const expired: Array<{ providerId: string } & ProviderStatus> = []
    const disconnected: string[] = []

    // Get all provider IDs we know about
    const allProviderIds = new Set([
      ...Object.keys(providers),
      ...Array.from(availableProviderIds.current),
    ])

    // Filter out excluded providers
    allProviderIds.forEach((providerId) => {
      if (EXCLUDED_PROVIDER_IDS.includes(providerId)) {
        return
      }

      const status = providers[providerId]

      if (!status || !status.authenticated) {
        // No tokens or not authenticated
        disconnected.push(providerId)
      }
      else if (status.expired) {
        // Has tokens but expired
        expired.push({ providerId, ...status })
      }
      else {
        // Authenticated and not expired
        authenticated.push({ providerId, ...status })
      }
    })

    return { authenticated, expired, disconnected }
  }, [providers])

  /**
   * Refresh all expired providers in the background
   * This is a manual function for UI components to use
   */
  const refreshAllExpiredProviders = useCallback(async (): Promise<{ success: number, failed: number }> => {
    const grouped = getGroupedProviders()
    const expiredProviders = grouped.expired

    if (expiredProviders.length === 0) {
      return { success: 0, failed: 0 }
    }

    let successCount = 0
    let failedCount = 0

    // Refresh all expired providers in parallel
    const refreshPromises = expiredProviders.map(async (provider) => {
      try {
        const success = await refreshProvider(provider.providerId)
        if (success) {
          successCount++
        }
        else {
          failedCount++
        }
      }
      catch (error) {
        failedCount++
      }
    })

    await Promise.all(refreshPromises)

    return { success: successCount, failed: failedCount }
  }, [getGroupedProviders, refreshProvider])

  /**
   * Get provider ID from provider name (case-insensitive)
   * Returns the provider ID if it exists in the current providers state
   */
  const getProviderId = useCallback((providerName: string): string | undefined => {
    const normalizedName = providerName.toLowerCase()
    const foundId = Object.keys(providers).find(
      id => id.toLowerCase() === normalizedName && !EXCLUDED_PROVIDER_IDS.includes(id),
    )
    return foundId
  }, [providers])

  /**
   * Handle provider authentication success event
   */
  const handleProviderAuthSuccess = useCallback((
    _event: IpcRendererEvent,
    data: ProviderAuthEventData,
  ) => {
    // Skip excluded providers
    if (EXCLUDED_PROVIDER_IDS.includes(data.providerId)) {
      return
    }

    setProviders(prev => ({
      ...prev,
      [data.providerId]: data.status,
    }))
    availableProviderIds.current.add(data.providerId)
    setLastChecked(Date.now())
  }, [])

  /**
   * Handle provider authentication error event
   */
  const handleProviderAuthError = useCallback((
    _event: IpcRendererEvent,
    data: ProviderAuthErrorData,
  ) => {
    setError(`Authentication error for ${data.providerId}: ${data.error}`)
  }, [])

  /**
   * Handle provider logout event
   */
  const handleProviderAuthLogout = useCallback((
    _event: IpcRendererEvent,
    data: ProviderAuthEventData,
  ) => {
    // Skip excluded providers
    if (EXCLUDED_PROVIDER_IDS.includes(data.providerId)) {
      return
    }

    setProviders((prev) => {
      const updated = { ...prev }
      delete updated[data.providerId]
      return updated
    })
    setLastChecked(Date.now())
  }, [])

  /**
   * Handle visibility change - re-check providers when app becomes visible
   */
  // useEffect(() => {
  //   const handleVisibilityChange = () => {
  //     if (document.visibilityState === 'visible') {
  //       console.log('App became visible, re-checking OAuth provider statuses...')
  //       checkAllProviders()
  //     }
  //   }

  //   document.addEventListener('visibilitychange', handleVisibilityChange)

  //   return () => {
  //     document.removeEventListener('visibilitychange', handleVisibilityChange)
  //   }
  // }, [checkAllProviders])

  /**
   * Initialize: Load provider statuses and set up event listeners
   * This only runs once on mount, not on every dependency change
   */
  useEffect(() => {
    // Prevent duplicate initialization
    if (isInitialized.current) {
      return
    }
    isInitialized.current = true

    // Initial load - automatic refresh happens in main process on startup
    const initializeProviders = async () => {
      await checkAllProviders()
    }

    initializeProviders()

    // Set up IPC event listeners
    window.electronAPI.onProviderAuthSuccess(handleProviderAuthSuccess)
    window.electronAPI.onProviderAuthError(handleProviderAuthError)
    window.electronAPI.onProviderAuthLogout(handleProviderAuthLogout)

    // Cleanup event listeners
    return () => {
      window.electronAPI.removeAllListeners('provider-auth-success')
      window.electronAPI.removeAllListeners('provider-auth-error')
      window.electronAPI.removeAllListeners('provider-auth-logout')
    }
  }, [checkAllProviders, handleProviderAuthSuccess, handleProviderAuthError, handleProviderAuthLogout])

  const contextValue: OAuthProvidersContextType = {
    providers,
    isLoading,
    error,
    lastChecked,
    refreshProvider,
    reconnectProvider,
    checkAllProviders,
    getGroupedProviders,
    refreshAllExpiredProviders,
    getProviderId,
  }

  return (
    <OAuthProvidersContext.Provider value={contextValue}>
      {children}
    </OAuthProvidersContext.Provider>
  )
}

/**
 * Hook to access OAuth providers context
 */
export const useOAuthProviders = () => {
  const context = useContext(OAuthProvidersContext)
  if (context === undefined) {
    throw new Error('useOAuthProviders must be used within an OAuthProvidersProvider')
  }
  return context
}
