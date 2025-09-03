/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from 'react'

import githubLogoIconUrl from '../../../../../../assets/icon-logo-github.svg'
import googleLogoIconUrl from '../../../../../../assets/icon-logo-google.svg'
import microsoftLogoIconUrl from '../../../../../../assets/icon-logo-microsoft.svg'
import xLogoIconUrl from '../../../../../../assets/icon-logo-x.svg'
import { ServerProviderInfo } from '../../../../../oauth-providers'
import { useAuth } from '../../../../hooks/useAuth'

const PROVIDER_NAME_TO_ICON_URL: Record<string, string> = {
  github: githubLogoIconUrl,
  google: googleLogoIconUrl,
  microsoft: microsoftLogoIconUrl,
  x: xLogoIconUrl,
}

interface ServerProvider {
  id: string
  name: string
  url: string
}

interface ServerProviderManagerProps {
  className?: string
}

interface ProviderAuthData {
  providerId: string
  message?: string
  user?: {
    name?: string
    email?: string
  }
}

interface ProviderStatus {
  authenticated: boolean
  user?: {
    name?: string
    email?: string
  }
  expired?: boolean
}

export const ServerProviderManager: React.FC<ServerProviderManagerProps> = ({ className }) => {
  const [servers, setServers] = useState<ServerProvider[]>([])
  const [serverProviders, setServerProviders] = useState<Record<string, ServerProviderInfo[]>>({})
  const [providerStatus, setProviderStatus] = useState<Record<string, ProviderStatus>>({})
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newServer, setNewServer] = useState({
    name: '',
    url: '',
  })

  const {
    isAuthenticated,
  } = useAuth()

  useEffect(() => {
    if (!isAuthenticated) {
      return
    }

    loadServerProviders()
    loadProviderStatus()

    // Listen for OAuth completion events
    const handleProviderAuthSuccess = (_event: unknown, data: ProviderAuthData) => {
      // Clear loading state for the completed OAuth flow
      setIsLoading((prev) => {
        const updated = { ...prev }
        // Clear loading for any server-provider combinations
        Object.keys(updated).forEach((key) => {
          if (key.includes('-') && key.endsWith(data.providerId)) {
            updated[key] = false
          }
        })
        return updated
      })
      // Refresh provider status to show new authentication
      loadProviderStatus()
      setError(null)
    }

    const handleProviderAuthError = (_event: unknown, data: ProviderAuthData) => {
      console.error('Server provider auth error:', data)
      setError(`Authentication failed: ${data.message}`)
      // Clear all loading states
      setIsLoading({})
      // Refresh provider status in case of partial success
      loadProviderStatus()
    }

    // Add event listeners if available
    if (window.electronAPI) {
      window.electronAPI.onProviderAuthSuccess?.(handleProviderAuthSuccess)
      window.electronAPI.onProviderAuthError?.(handleProviderAuthError)
    }

    return () => {
      // Cleanup - no specific cleanup needed for Electron IPC
    }
  }, [isAuthenticated])

  const loadServerProviders = async () => {
    try {
      const serverProviders = await window.electronAPI.getServerProviders()
      setServers(serverProviders)

      // Fetch providers for each server
      for (const server of serverProviders) {
        await fetchProvidersForServer(server.id)
      }
    }
    catch (error) {
      console.error('Failed to load server providers:', error)
      setError('Failed to load server providers')
    }
  }

  const fetchProvidersForServer = async (serverId: string) => {
    const loadingKey = `fetch-${serverId}`
    setIsLoading(prev => ({ ...prev, [loadingKey]: true }))

    try {
      const providers = await window.electronAPI.fetchServerProviders(serverId)
      setServerProviders(prev => ({
        ...prev,
        [serverId]: providers,
      }))
    }
    catch (error) {
      console.error(`Failed to fetch providers for server ${serverId}:`, error)
      // Set empty array on error so UI doesn't break
      setServerProviders(prev => ({
        ...prev,
        [serverId]: [],
      }))
    }
    finally {
      setIsLoading(prev => ({ ...prev, [loadingKey]: false }))
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

  const handleAddServer = async () => {
    setIsLoading(prev => ({ ...prev, add: true }))
    setError(null)

    try {
      const serverId = `server-${Date.now()}`

      const serverConfig = {
        id: serverId,
        name: newServer.name,
        url: newServer.url,
      }

      await window.electronAPI.addServerProvider(serverConfig)

      await loadServerProviders()
      // Fetch providers for the newly added server
      await fetchProvidersForServer(serverId)
      setShowAddForm(false)
      setNewServer({
        name: '',
        url: '',
      })
    }
    catch (error) {
      console.error('Failed to add server provider:', error)
      setError(`Failed to add server: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
    finally {
      setIsLoading(prev => ({ ...prev, add: false }))
    }
  }

  const handleRemoveServer = async (serverId: string) => {
    setIsLoading(prev => ({ ...prev, [serverId]: true }))

    try {
      await window.electronAPI.removeServerProvider(serverId)
      await loadServerProviders()
    }
    catch (error) {
      console.error(`Failed to remove server ${serverId}:`, error)
      setError(`Failed to remove server: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
    finally {
      setIsLoading(prev => ({ ...prev, [serverId]: false }))
    }
  }

  const handleStartOAuth = async (serverId: string, provider: string) => {
    const loadingKey = `${serverId}-${provider}`
    setIsLoading(prev => ({ ...prev, [loadingKey]: true }))
    setError(null)

    try {
      await window.electronAPI.startServerProviderOAuth(serverId, provider)
      // Don't clear loading state here - it will be cleared by the auth success/error handlers
    }
    catch (error) {
      console.error(`Failed to start OAuth for ${serverId}/${provider}:`, error)
      setError(`Failed to start OAuth: ${error instanceof Error ? error.message : 'Unknown error'}`)
      // Only clear loading state on immediate error (not OAuth callback errors)
      setIsLoading(prev => ({ ...prev, [loadingKey]: false }))
    }
  }

  const handleGetToken = async (providerId: string) => {
    try {
      const token = await window.electronAPI.getProviderAccessToken(providerId)
      if (token) {
        // Copy to clipboard
        navigator.clipboard.writeText(token)
        alert(`Access token copied to clipboard!\n\nToken preview: ${token.substring(0, 20)}...`)
      }
      else {
        alert('No valid token available. Please reconnect.')
      }
    }
    catch (error) {
      console.error(`Failed to get token for ${providerId}:`, error)
      setError(`Failed to get token for ${providerId}`)
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

  const handleRefresh = async (providerId: string) => {
    const loadingKey = `refresh-${providerId}`
    setIsLoading(prev => ({ ...prev, [loadingKey]: true }))

    try {
      const success = await window.electronAPI.refreshProviderTokens(providerId)
      if (success) {
        await loadProviderStatus()
        setError(null)
      }
      else {
        setError(`Failed to refresh tokens for ${providerId}`)
      }
    }
    catch (error) {
      console.error(`Failed to refresh tokens for ${providerId}:`, error)
      setError(`Failed to refresh tokens for ${providerId}`)
    }
    finally {
      setIsLoading(prev => ({ ...prev, [loadingKey]: false }))
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setNewServer(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  return (
    <>
      <div
        className="flex flex-col gap-[0.5rem]"
      >
        <div
          className="text-[1rem]"
        >
          Shared connectors
        </div>

        <div
          className="text-[#737373]"
        >
          A shared integration hub where available connectors are controlled by someone else — such as your organization, team admin, or another service.
        </div>
      </div>

      <div
        className="flex flex-col gap-[1rem]"
      >
        {servers.map(server => (
          <div
            key={`settings-shared-connectors-server-${server.id}`}
            className="flex flex-col gap-[0.63rem]"
          >
            <div
              className="text-[1rem]"
            >
              {server.name}
            </div>
            <div>
              Available connectors
            </div>
            <div
              className="flex flex-col gap-[0.63rem]"
            >
              {serverProviders[server.id]?.map((provider, index) => (
                <React.Fragment key={`settings-shared-connectors-server-${server.id}-provider-${provider.name}`}>
                  <div
                    className="flex items-center justify-between"
                  >
                    <div
                      className="flex items-center gap-[0.63rem]"
                    >
                      <div
                        className="p-[0.31rem] border border-[#E5E5E5] rounded-[0.25rem]"
                      >
                        {PROVIDER_NAME_TO_ICON_URL[provider.name.toLowerCase()]
                          ? (
                              <img
                                src={PROVIDER_NAME_TO_ICON_URL[provider.name]}
                                alt={provider.name}
                                className="w-[1.5rem] h-[1.5rem]"
                              />
                            )
                          : (
                              <div
                                className="w-[1.5rem] h-[1.5rem] bg-green-300 rounded-full"
                              />
                            )}
                      </div>

                      <div
                        className="uppercase"
                      >
                        {provider.name}
                      </div>
                    </div>

                    <div>
                      connected?
                    </div>

                  </div>
                  {index < serverProviders[server.id]?.length - 1 && (
                    <div className="w-full h-px bg-[#E5E5E5]" />
                  )}
                </React.Fragment>
              ))}
            </div>

          </div>
        ))}
      </div>
    </>
  )
}

export default ServerProviderManager
