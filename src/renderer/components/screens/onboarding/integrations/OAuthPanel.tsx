/**
 * OAuthPanel
 *
 * OAuth providers panel for the integrations onboarding step.
 * Displays available OAuth providers (Google, GitHub, Microsoft, etc.)
 * and allows users to connect their accounts.
 */

import React, { useEffect, useState } from 'react'

import { ServerProviderInfo } from '../../../../../oauth-providers'
import { getProviderIcon } from '../../../../utils/providerUtils'
import { ButtonDesigned } from '../../../ui/ButtonDesigned'

// =============================================================================
// Types
// =============================================================================

interface IntegrationProvider {
  id: string
  name: string
  icon: string
  configured: boolean
  scopes: string[]
}

interface ExtendedServerProviderInfo extends ServerProviderInfo {
  logoUrl?: string
}

// =============================================================================
// Component
// =============================================================================

export const OAuthPanel: React.FC = () => {
  const [providers, setProviders] = useState<IntegrationProvider[]>([])
  const [providerStatus, setProviderStatus] = useState<Record<string, { authenticated: boolean, user?: unknown }>>({})
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [isLoadingProviders, setIsLoadingProviders] = useState(true)

  // ===========================================================================
  // Effects
  // ===========================================================================

  useEffect(() => {
    fetchProviders()
    loadProviderStatus()

    // Listen for OAuth completion events
    const handleProviderAuthSuccess = (_event: unknown, data: { providerId: string }) => {
      setIsLoading(prev => ({ ...prev, [data.providerId]: false }))
      loadProviderStatus()
      setError(null)
    }

    const handleProviderAuthError = (_event: unknown, data: { providerId: string, message?: string }) => {
      console.error('Provider auth error:', data)
      setError(`Authentication failed: ${data.message || 'Unknown error'}`)
      setIsLoading(prev => ({ ...prev, [data.providerId]: false }))
    }

    // Add event listeners if available
    if (window.electronAPI) {
      window.electronAPI.onProviderAuthSuccess?.(handleProviderAuthSuccess)
      window.electronAPI.onProviderAuthError?.(handleProviderAuthError)
    }

    return () => {
      // Cleanup
    }
  }, [])

  // ===========================================================================
  // Data Fetching
  // ===========================================================================

  const fetchProviders = async () => {
    setIsLoadingProviders(true)
    try {
      // First, ensure the keyboard-api server provider exists
      const serverProviders = await window.electronAPI.getServerProviders()
      let keyboardApiServer = serverProviders.find(s => s.id === 'keyboard-api')

      if (!keyboardApiServer) {
        // Add the keyboard API server provider if it doesn't exist
        const newServer = {
          id: 'keyboard-api',
          name: 'Keyboard API',
          url: 'https://api.keyboard.dev',
        }
        await window.electronAPI.addServerProvider(newServer)
        keyboardApiServer = newServer
      }

      // Fetch providers using the electron API to avoid CORS
      const providers = await window.electronAPI.fetchServerProviders('keyboard-api')

      if (providers && providers.length > 0) {
        // Transform the server response to our format, filtering for the ones we want to show
        const transformedProviders = providers.map((p: ExtendedServerProviderInfo) => ({
          id: p.name,
          name: p.name.charAt(0).toUpperCase() + p.name.slice(1),
          icon: getProviderIcon(p.logoUrl, p.name),
          configured: p.configured,
          scopes: p.scopes,
        })).filter(p => p.name.toLowerCase() !== 'onboarding')

        setProviders(transformedProviders)
      }
      else {
        // Use fallback providers if none returned
        throw new Error('No providers returned from server')
      }
    }
    catch (error) {
      console.error('Failed to fetch providers:', error)
      // Fallback to default providers
      setProviders([
        { id: 'google', name: 'Google', icon: getProviderIcon(undefined, 'google'), configured: true, scopes: [] },
        { id: 'github', name: 'GitHub', icon: getProviderIcon(undefined, 'github'), configured: true, scopes: [] },
        { id: 'microsoft', name: 'Microsoft', icon: getProviderIcon(undefined, 'microsoft'), configured: true, scopes: [] },
      ])
    }
    finally {
      setIsLoadingProviders(false)
    }
  }

  const loadProviderStatus = async () => {
    try {
      const status = await window.electronAPI.getProviderAuthStatus()
      setProviderStatus(status)
    }
    catch (error) {
      console.error('Failed to load provider status:', error)
    }
  }

  // ===========================================================================
  // Handlers
  // ===========================================================================

  const handleConnect = async (providerId: string) => {
    setIsLoading(prev => ({ ...prev, [providerId]: true }))
    setError(null)

    try {
      // Use the keyboard.dev server as the server provider
      const serverId = 'keyboard-api'
      await window.electronAPI.startServerProviderOAuth(serverId, providerId)
    }
    catch (error) {
      console.error(`Failed to start OAuth for ${providerId}:`, error)
      setError(`Failed to start OAuth: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setIsLoading(prev => ({ ...prev, [providerId]: false }))
    }
  }

  // ===========================================================================
  // Render
  // ===========================================================================

  return (
    <div className="flex flex-col items-start gap-[0.94rem] w-full">
      {/* OAuth providers box */}
      <div className="border border-neutral-200 rounded-[6px] p-[15px] w-full">
        {isLoadingProviders
          ? (
              <div className="text-center text-gray-500 py-4">
                <p>Loading providers...</p>
              </div>
            )
          : (
              <div className="flex flex-col gap-[10px]">
                {providers.map((provider, index) => {
                  const isAuthenticated = providerStatus[provider.id]?.authenticated

                  return (
                    <React.Fragment key={provider.id}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-[10px]">
                          <div className="bg-white border border-neutral-200 rounded-[4px] p-[5px]">
                            <img
                              src={provider.icon}
                              alt={provider.name}
                              className="w-[24px] h-[24px] object-cover"
                            />
                          </div>
                          <div className="text-[14px] text-neutral-900 font-medium">
                            {provider.name}
                          </div>
                        </div>

                        <ButtonDesigned
                          variant="clear"
                          onClick={() => handleConnect(provider.id)}
                          disabled={isAuthenticated || isLoading[provider.id] || !provider.configured}
                          className="px-[16px] py-[8px] text-[14px]"
                          hasBorder
                        >
                          {isLoading[provider.id] ? 'Connecting...' : (isAuthenticated ? 'Connected' : 'Connect')}
                        </ButtonDesigned>
                      </div>

                      {index < providers.length - 1 && (
                        <div className="h-[1px] bg-neutral-200 w-full" />
                      )}
                    </React.Fragment>
                  )
                })}
              </div>
            )}
      </div>

      <div className="text-[14px] text-[#a5a5a5]">
        See our
        {' '}
        <span
          className="font-semibold text-neutral-900 cursor-pointer hover:underline"
          onClick={() => window.electronAPI.openExternalUrl('https://docs.keyboard.dev')}
        >
          docs
        </span>
        {' '}
        to learn how to connect any app.
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg w-full">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}
    </div>
  )
}

export default OAuthPanel
