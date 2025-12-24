/**
 * useCustomIntegrations Hook
 *
 * React hook for managing custom/additional integrations.
 * Fetches integrations from main process via IPC and provides search filtering.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

// =============================================================================
// Types
// =============================================================================

export interface CustomIntegration {
  id: string
  name: string
  description?: string
  icon: string
  scopes?: string[]
  source?: 'local' | 'pipedream' | 'custom'
  metadata?: Record<string, unknown>
}

interface UseCustomIntegrationsState {
  integrations: CustomIntegration[]
  loading: boolean
  error: string | null
  connectingIntegrationId: string | null
}

interface UseCustomIntegrationsReturn extends UseCustomIntegrationsState {
  filteredIntegrations: CustomIntegration[]
  refreshIntegrations: () => Promise<void>
  connectIntegration: (integrationId: string) => Promise<void>
}

// =============================================================================
// Hook
// =============================================================================

export const useCustomIntegrations = (searchQuery: string): UseCustomIntegrationsReturn => {
  const [state, setState] = useState<UseCustomIntegrationsState>({
    integrations: [],
    loading: false,
    error: null,
    connectingIntegrationId: null,
  })

  // Fetch integrations from main process
  const fetchIntegrations = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const integrations = await window.electronAPI.fetchAdditionalConnectors()
      setState(prev => ({
        ...prev,
        integrations,
        loading: false,
      }))
    }
    catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to fetch integrations',
        loading: false,
      }))
    }
  }, [])

  // Filter integrations based on search query
  const filteredIntegrations = useMemo(() => {
    if (!searchQuery.trim()) {
      return state.integrations
    }
    const query = searchQuery.toLowerCase()
    return state.integrations.filter(integration =>
      integration.name.toLowerCase().includes(query)
      || integration.description?.toLowerCase().includes(query),
    )
  }, [state.integrations, searchQuery])

  // Connect to an integration
  const connectIntegration = useCallback(async (integrationId: string) => {
    setState(prev => ({ ...prev, connectingIntegrationId: integrationId }))
    try {
      const integration = state.integrations.find(i => i.id === integrationId)
      if (!integration) {
        throw new Error('Integration not found')
      }

      // Route to appropriate connection method based on source
      if (integration.source === 'pipedream') {
        // Handle Pipedream connection
        // Note: This would require exposing Pipedream connection via IPC
        // For now, throw an error indicating this needs to be implemented
        throw new Error('Pipedream connections from custom integrations not yet supported. Please use the Pipedream section.')
      }
      else if (integration.source === 'local') {
        // Handle local OAuth provider connection
        // This would use the existing OAuth provider flow
        await window.electronAPI.startProviderOAuth(integrationId)
      }
      else {
        // Handle custom connection via connected accounts service
        const result = await window.electronAPI.initiateConnectedAccount(
          integrationId,
          integration.scopes || ['repository'],
        )

        if (result.success && result.connect_uri) {
          // Open the connect URI in external browser
          await window.electronAPI.openExternalUrl(result.connect_uri)
        }
        else {
          throw new Error(result.error || 'Failed to initiate connection')
        }
      }
    }
    catch (error) {
      console.error('Failed to connect integration:', error)
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to connect',
      }))
    }
    finally {
      setState(prev => ({ ...prev, connectingIntegrationId: null }))
    }
  }, [state.integrations])

  // Initial fetch
  useEffect(() => {
    fetchIntegrations()
  }, [fetchIntegrations])

  return {
    ...state,
    filteredIntegrations,
    refreshIntegrations: fetchIntegrations,
    connectIntegration,
  }
}
