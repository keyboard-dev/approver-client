import React, { useEffect, useState } from 'react'
import { ServerProviderInfo } from '../../../oauth-providers'
import { getProviderIcon } from '../../utils/providerUtils'
import { ButtonDesigned } from './ButtonDesigned'

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

interface KeyboardApiConnectorsProps {
  title?: string
  description?: string
  showSkipButton?: boolean
  onComplete?: () => void
  className?: string
}

export const KeyboardApiConnectors: React.FC<KeyboardApiConnectorsProps> = ({
  title = 'Keyboard API Connectors',
  description = 'Connect to available providers from the Keyboard API.',
  showSkipButton = false,
  onComplete,
  className = '',
}) => {
  const [providers, setProviders] = useState<IntegrationProvider[]>([])
  const [providerStatus, setProviderStatus] = useState<Record<string, { authenticated: boolean, user?: unknown }>>({})
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [isLoadingProviders, setIsLoadingProviders] = useState(true)

  useEffect(() => {
    fetchProviders()
    loadProviderStatus()

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

    if (window.electronAPI) {
      window.electronAPI.onProviderAuthSuccess?.(handleProviderAuthSuccess)
      window.electronAPI.onProviderAuthError?.(handleProviderAuthError)
    }

    return () => {
      // Cleanup
    }
  }, [])

  const fetchProviders = async () => {
    setIsLoadingProviders(true)
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

      const providers = await window.electronAPI.fetchServerProviders('keyboard-api')

      if (providers && providers.length > 0) {
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
        throw new Error('No providers returned from server')
      }
    }
    catch (error) {
      console.error('Failed to fetch providers:', error)
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

  const handleConnect = async (providerId: string) => {
    setIsLoading(prev => ({ ...prev, [providerId]: true }))
    setError(null)

    try {
      const serverId = 'keyboard-api'
      await window.electronAPI.startServerProviderOAuth(serverId, providerId)
    }
    catch (error) {
      console.error(`Failed to start OAuth for ${providerId}:`, error)
      setError(`Failed to start OAuth: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setIsLoading(prev => ({ ...prev, [providerId]: false }))
    }
  }

  const handleDisconnect = async (providerId: string) => {
    try {
      await window.electronAPI.logoutProvider(providerId)
      await loadProviderStatus()
      setError(null)
    }
    catch (error) {
      console.error(`Failed to disconnect ${providerId}:`, error)
      setError(`Failed to disconnect from ${providerId}`)
    }
  }

  return (
    <div className={`flex flex-col gap-[0.94rem] ${className}`}>
      <div className="flex flex-col gap-[0.5rem]">
        <div className="text-[1rem] font-medium">{title}</div>
        <div className="text-[#737373] text-[14px]">{description}</div>
      </div>

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

                        <div className="flex gap-[8px]">
                          {isAuthenticated
                            ? (
                                <ButtonDesigned
                                  variant="clear"
                                  onClick={() => handleDisconnect(provider.id)}
                                  className="px-[16px] py-[8px] text-[14px] text-[#D23535]"
                                >
                                  Disconnect
                                </ButtonDesigned>
                              )
                            : (
                                <ButtonDesigned
                                  variant="clear"
                                  onClick={() => handleConnect(provider.id)}
                                  disabled={isLoading[provider.id] || !provider.configured}
                                  className="px-[16px] py-[8px] text-[14px]"
                                  hasBorder
                                >
                                  {isLoading[provider.id] ? 'Connecting...' : 'Connect'}
                                </ButtonDesigned>
                              )}
                        </div>
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

      {showSkipButton && onComplete && (
        <div className="flex gap-[5px] justify-end w-full">
          <ButtonDesigned
            variant="clear"
            onClick={onComplete}
            className="px-[16px] py-[8px] text-[14px]"
          >
            Skip
          </ButtonDesigned>
          <ButtonDesigned
            variant="clear"
            onClick={onComplete}
            className="px-[16px] py-[8px] text-[14px]"
            hasBorder
          >
            Complete
          </ButtonDesigned>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}
    </div>
  )
}

export default KeyboardApiConnectors
