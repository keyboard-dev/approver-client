/**
 * useConnectionRequirements Hook
 *
 * React hook that detects required connections from a user message,
 * checks if those connections exist, and provides functions to
 * initiate the connection flow.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  connectionDetectionService,
  getServiceInfo,
  ServiceInfo,
} from '../services/connection-detection-service'
import { MissingConnection } from '../components/assistant-ui/MissingConnectionsPrompt'

// =============================================================================
// Types
// =============================================================================

export interface ConnectionRequirementsState {
  /** Whether we're currently detecting required connections */
  isDetecting: boolean
  /** List of missing connections that need to be established */
  missingConnections: MissingConnection[]
  /** Whether all required connections are present */
  hasAllConnections: boolean
  /** The services detected from the message */
  detectedServices: ServiceInfo[]
  /** Error message if detection failed */
  error: string | null
  /** Whether the prompt should be shown */
  showConnectionPrompt: boolean
}

export interface ConnectionRequirementsActions {
  /** Detect required connections from a message */
  detectConnections: (message: string) => Promise<void>
  /** Connect to a specific service */
  connectService: (connection: MissingConnection) => Promise<void>
  /** Clear the connection prompt */
  clearPrompt: () => void
  /** Refresh connection status */
  refreshConnectionStatus: () => Promise<void>
}

export type UseConnectionRequirementsReturn = ConnectionRequirementsState & ConnectionRequirementsActions

// =============================================================================
// Helper Types
// =============================================================================

interface PipedreamAccount {
  id: string
  name: string
  app: {
    nameSlug: string
    name: string
    logoUrl?: string
  }
}

interface ComposioAccount {
  id: string
  appName?: string
  status: string
  toolkit?: {
    slug: string
  }
}

interface LocalProviderStatus {
  authenticated: boolean
  user?: {
    name?: string
    email?: string
  }
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useConnectionRequirements(): UseConnectionRequirementsReturn {
  // State
  const [isDetecting, setIsDetecting] = useState(false)
  const [missingConnections, setMissingConnections] = useState<MissingConnection[]>([])
  const [hasAllConnections, setHasAllConnections] = useState(true)
  const [detectedServices, setDetectedServices] = useState<ServiceInfo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showConnectionPrompt, setShowConnectionPrompt] = useState(false)

  // Connection state for tracking connect operations
  const [connectingServiceId, setConnectingServiceId] = useState<string | null>(null)

  // Cache for connection status
  const pipedreamAccountsRef = useRef<PipedreamAccount[]>([])
  const composioAccountsRef = useRef<ComposioAccount[]>([])
  const localProviderStatusRef = useRef<Record<string, LocalProviderStatus>>({})

  // ==========================================================================
  // Fetch Connection Status
  // ==========================================================================

  const fetchConnectionStatus = useCallback(async () => {
    try {
      // Fetch Pipedream accounts
      const pipedreamResponse = await window.electronAPI?.fetchPipedreamAccountsDetailed?.()
      if (pipedreamResponse?.success && pipedreamResponse?.data) {
        const data = pipedreamResponse.data as { accounts?: PipedreamAccount[] }
        pipedreamAccountsRef.current = data.accounts || []
      }

      // Fetch Composio accounts
      const composioResponse = await window.electronAPI?.listComposioConnectedAccounts?.()
      if (composioResponse?.success && composioResponse?.data) {
        const data = composioResponse.data as { items?: ComposioAccount[] }
        composioAccountsRef.current = data.items || []
      }

      // Fetch local provider status
      const localStatus = await window.electronAPI?.getProviderAuthStatus?.()
      if (localStatus) {
        localProviderStatusRef.current = localStatus
      }
    }
    catch (err) {
      console.error('Failed to fetch connection status:', err)
    }
  }, [])

  // ==========================================================================
  // Check if a service is connected
  // ==========================================================================

  const isServiceConnected = useCallback((serviceInfo: ServiceInfo): { connected: boolean, source: 'pipedream' | 'composio' | 'local' } => {
    // Check local providers first (highest priority)
    if (serviceInfo.localProviderId) {
      const localStatus = localProviderStatusRef.current[serviceInfo.localProviderId]
      if (localStatus?.authenticated) {
        return { connected: true, source: 'local' }
      }
    }

    // Check Pipedream accounts
    if (serviceInfo.pipedreamSlug) {
      const pipedreamAccount = pipedreamAccountsRef.current.find(
        acc => acc.app.nameSlug.toLowerCase() === serviceInfo.pipedreamSlug?.toLowerCase(),
      )
      if (pipedreamAccount) {
        return { connected: true, source: 'pipedream' }
      }
    }

    // Check Composio accounts
    if (serviceInfo.composioSlug) {
      const composioAccount = composioAccountsRef.current.find((acc) => {
        const appName = acc.appName?.toLowerCase() || ''
        const toolkitSlug = acc.toolkit?.slug?.toLowerCase() || ''
        const targetSlug = serviceInfo.composioSlug?.toLowerCase() || ''
        return (appName === targetSlug || toolkitSlug === targetSlug) && acc.status === 'ACTIVE'
      })
      if (composioAccount) {
        return { connected: true, source: 'composio' }
      }
    }

    // Determine preferred source for connection (prioritize Pipedream for most apps)
    const preferredSource: 'pipedream' | 'composio' | 'local' = serviceInfo.localProviderId
      ? 'local'
      : serviceInfo.pipedreamSlug
        ? 'pipedream'
        : 'composio'

    return { connected: false, source: preferredSource }
  }, [])

  // ==========================================================================
  // Detect Required Connections
  // ==========================================================================

  const detectConnections = useCallback(async (message: string) => {
    setIsDetecting(true)
    setError(null)

    try {
      // First, refresh connection status
      await fetchConnectionStatus()

      // Detect required services using AI classification - now returns ServiceInfo[]
      const services = await connectionDetectionService.detectRequiredServices(message, true)
      setDetectedServices(services)

      if (services.length === 0) {
        // No connections needed
        setMissingConnections([])
        setHasAllConnections(true)
        setShowConnectionPrompt(false)
        return
      }

      // Check which services are missing
      const missing: MissingConnection[] = []

      for (const serviceInfo of services) {
        const { connected, source } = isServiceConnected(serviceInfo)

        if (!connected) {
          missing.push({
            id: serviceInfo.id,
            name: serviceInfo.name,
            icon: serviceInfo.icon,
            source,
            isConnecting: connectingServiceId === serviceInfo.id,
          })
        }
      }

      setMissingConnections(missing)
      setHasAllConnections(missing.length === 0)
      setShowConnectionPrompt(missing.length > 0)
    }
    catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect required connections')
      setMissingConnections([])
      setHasAllConnections(true)
      setShowConnectionPrompt(false)
    }
    finally {
      setIsDetecting(false)
    }
  }, [fetchConnectionStatus, isServiceConnected, connectingServiceId])

  // ==========================================================================
  // Connect to a Service
  // ==========================================================================

  const connectService = useCallback(async (connection: MissingConnection) => {
    // Find the service info from detected services
    const serviceInfo = detectedServices.find(s => s.id === connection.id)
      || await getServiceInfo(connection.id)

    if (!serviceInfo) {
      throw new Error(`Unknown service: ${connection.id}`)
    }

    setConnectingServiceId(connection.id)

    // Update the missingConnections to show connecting state
    setMissingConnections(prev =>
      prev.map(c => (c.id === connection.id ? { ...c, isConnecting: true } : c)),
    )

    try {
      switch (connection.source) {
        case 'local':
          if (serviceInfo.localProviderId) {
            await window.electronAPI.startServerProviderOAuth('keyboard-api', serviceInfo.localProviderId)
          }
          break

        case 'pipedream':
          if (serviceInfo.pipedreamSlug) {
            // Use the Pipedream service to open the connect link
            const { pipedreamService } = await import('../services/pipedream-service')
            await pipedreamService.openConnectLink(serviceInfo.pipedreamSlug)
          }
          break

        case 'composio':
          if (serviceInfo.composioSlug) {
            // Use the Composio service to open the connection URL
            const { openConnectionUrl } = await import('../services/composio-service')
            await openConnectionUrl(serviceInfo.composioSlug)
          }
          break
      }

      // Start polling to detect when connection is established
      const pollInterval = setInterval(async () => {
        await fetchConnectionStatus()
        const { connected } = isServiceConnected(serviceInfo)

        if (connected) {
          clearInterval(pollInterval)
          setConnectingServiceId(null)

          // Update missing connections
          setMissingConnections((prev) => {
            const updated = prev.filter(c => c.id !== connection.id)
            if (updated.length === 0) {
              setShowConnectionPrompt(false)
              setHasAllConnections(true)
            }
            return updated
          })
        }
      }, 3000) // Poll every 3 seconds

      // Stop polling after 2 minutes
      setTimeout(() => {
        clearInterval(pollInterval)
        setConnectingServiceId(null)
        setMissingConnections(prev =>
          prev.map(c => (c.id === connection.id ? { ...c, isConnecting: false } : c)),
        )
      }, 120000)
    }
    catch (err) {
      setConnectingServiceId(null)
      setMissingConnections(prev =>
        prev.map(c => (c.id === connection.id ? { ...c, isConnecting: false } : c)),
      )
      throw err
    }
  }, [fetchConnectionStatus, isServiceConnected, detectedServices])

  // ==========================================================================
  // Clear Prompt
  // ==========================================================================

  const clearPrompt = useCallback(() => {
    setShowConnectionPrompt(false)
    setMissingConnections([])
    setDetectedServices([])
    setError(null)
  }, [])

  // ==========================================================================
  // Refresh Connection Status
  // ==========================================================================

  const refreshConnectionStatus = useCallback(async () => {
    await fetchConnectionStatus()

    // Re-check missing connections with updated status
    if (detectedServices.length > 0) {
      const missing: MissingConnection[] = []

      for (const serviceInfo of detectedServices) {
        const { connected, source } = isServiceConnected(serviceInfo)

        if (!connected) {
          missing.push({
            id: serviceInfo.id,
            name: serviceInfo.name,
            icon: serviceInfo.icon,
            source,
            isConnecting: connectingServiceId === serviceInfo.id,
          })
        }
      }

      setMissingConnections(missing)
      setHasAllConnections(missing.length === 0)
      setShowConnectionPrompt(missing.length > 0)
    }
  }, [fetchConnectionStatus, isServiceConnected, detectedServices, connectingServiceId])

  // ==========================================================================
  // Initial fetch on mount
  // ==========================================================================

  useEffect(() => {
    fetchConnectionStatus()
  }, [fetchConnectionStatus])

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    // State
    isDetecting,
    missingConnections,
    hasAllConnections,
    detectedServices,
    error,
    showConnectionPrompt,

    // Actions
    detectConnections,
    connectService,
    clearPrompt,
    refreshConnectionStatus,
  }
}

export default useConnectionRequirements
