/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from 'react'
import githubLogoIconUrl from '../../../../../../assets/icon-logo-github.svg'
import googleLogoIconUrl from '../../../../../../assets/icon-logo-google.svg'
import microsoftLogoIconUrl from '../../../../../../assets/icon-logo-microsoft.svg'
import { OAuthStorageInfo, ProviderStatus } from '../../../../../preload'
import { OAuthProviderConfig } from '../../../../../provider-storage'
import { useAuth } from '../../../../hooks/useAuth'
import { ButtonDesigned } from '../../../ui/ButtonDesigned'
import { AddConnectorPopup } from './AddConnectorPopup'

interface ProviderAuthEvent {
  providerId: string
  message?: string
}

export const MyConnectors: React.FC = () => {
  const {
    isAuthenticated,
    isSkippingAuth,
  } = useAuth()

  const [allProviderConfigs, setAllProviderConfigs] = useState<OAuthProviderConfig[]>([])
  const [providerStatus, setProviderStatus] = useState<Record<string, ProviderStatus>>({})
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [storageInfo, setStorageInfo] = useState<OAuthStorageInfo | null>(null)
  const [isAddPopupOpen, setIsAddPopupOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<OAuthProviderConfig | null>(null)

  useEffect(() => {
    if (!isAuthenticated || isSkippingAuth) {
      return
    }

    loadProviders()
    loadAllProviderConfigs()
    loadProviderStatus()
    loadStorageInfo()

    // Listen for OAuth events
    const handleProviderAuthSuccess = (_event: Electron.IpcRendererEvent, data: ProviderAuthEvent) => {
      // Refresh all provider data to show the new authentication status
      loadProviders()
      loadAllProviderConfigs()
      loadProviderStatus()
      loadStorageInfo()
      setIsLoading(prev => ({ ...prev, [data.providerId]: false }))
      setError(null)
    }

    const handleProviderAuthError = (_event: Electron.IpcRendererEvent, data: ProviderAuthEvent) => {
      console.error('Provider auth error:', data)
      setError(`${data.providerId}: ${data.message}`)
      setIsLoading(prev => ({ ...prev, [data.providerId]: false }))
    }

    const handleProviderAuthLogout = (_event: Electron.IpcRendererEvent, data: ProviderAuthEvent) => {
      loadProviderStatus()
    }

    // Add event listeners if available
    if (window.electronAPI) {
      window.electronAPI.onProviderAuthSuccess?.(handleProviderAuthSuccess)
      window.electronAPI.onProviderAuthError?.(handleProviderAuthError)
      window.electronAPI.onProviderAuthLogout?.(handleProviderAuthLogout)
    }

    return () => {
      // Cleanup listeners
      if (window.electronAPI) {
        window.electronAPI.removeAllListeners('provider-auth-success')
        window.electronAPI.removeAllListeners('provider-auth-error')
        window.electronAPI.removeAllListeners('provider-auth-logout')
      }
    }
  }, [isAuthenticated, isSkippingAuth])

  const loadProviders = async () => {
    try {
      await window.electronAPI.getAvailableProviders()
    }
    catch (error) {
      console.error('Failed to load providers:', error)
      setError('Failed to load available providers')
    }
  }

  const loadAllProviderConfigs = async () => {
    try {
      const allConfigs = await window.electronAPI.getAllProviderConfigs()
      setAllProviderConfigs(allConfigs)
    }
    catch (error) {
      console.error('Failed to load all provider configs:', error)
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

  const loadStorageInfo = async () => {
    try {
      const info = await window.electronAPI.getOAuthStorageInfo()
      setStorageInfo(info)
    }
    catch (error) {
      console.error('Failed to load storage info:', error)
    }
  }

  const handleConnect = async (providerId: string) => {
    setIsLoading(prev => ({ ...prev, [providerId]: true }))
    setError(null)

    try {
      await window.electronAPI.startProviderOAuth(providerId)
      // The actual connection will be handled by the OAuth flow
      // and the provider-auth-success event will be triggered
    }
    catch (error) {
      console.error(`Failed to start OAuth for ${providerId}:`, error)
      setError(`Failed to connect to ${providerId}`)
      setIsLoading(prev => ({ ...prev, [providerId]: false }))
    }
  }

  const handleDisconnect = async (providerId: string) => {
    setIsLoading(prev => ({ ...prev, [providerId]: true }))

    try {
      await window.electronAPI.logoutProvider(providerId)
      await loadProviderStatus()
    }
    catch (error) {
      console.error(`Failed to disconnect ${providerId}:`, error)
      setError(`Failed to disconnect from ${providerId}`)
    }
    finally {
      setIsLoading(prev => ({ ...prev, [providerId]: false }))
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

  const handleSaveProvider = async (config: Omit<OAuthProviderConfig, 'createdAt' | 'updatedAt'>) => {
    await window.electronAPI.saveProviderConfig(config)
    await loadProviders()
    await loadAllProviderConfigs()
    setIsAddPopupOpen(false)
    setEditingProvider(null)
    setError(null)
  }

  const handleDeleteProvider = async (providerId: string) => {
    if (!confirm(`Are you sure you want to delete the provider "${providerId}"? This action cannot be undone.`)) {
      return
    }

    try {
      await window.electronAPI.removeProviderConfig(providerId)
      await loadProviders()
      await loadAllProviderConfigs()
      setError(null)
    }
    catch (error) {
      console.error(`Failed to delete provider ${providerId}:`, error)
      setError(`Failed to delete provider ${providerId}`)
    }
  }

  const getIconUrl = (providerId: string) => {
    switch (providerId) {
      case 'google':
        return googleLogoIconUrl
      case 'github':
        return githubLogoIconUrl
      case 'microsoft':
        return microsoftLogoIconUrl
      default:
        return null
    }
  }

  const getIcon = (providerId: string) => {
    const iconUrl = getIconUrl(providerId)
    if (!iconUrl) return null

    console.log('iconUrl', iconUrl)

    return (
      <div
        key={`connector-panel-provider-${providerId}-icon`}
        className="w-[2.13rem] h-[2.13rem] p-[0.31rem] grow-0 shrink-0"
      >
        <img
          src={iconUrl}
          alt={providerId}
          className="w-full h-full"
        />
      </div>
    )
  }

  const getDescriptionText = (providerId: string) => {
    switch (providerId) {
      case 'google':
        return 'Includes Drive, Mail, Sheets, Slides'
      default:
        return null
    }
  }

  const getDescription = (providerId: string) => {
    const text = getDescriptionText(providerId)
    if (!text) return null
    return (
      <div
        className="text-[#737373]"
      >
        {text}
      </div>
    )
  }

  return (
    <div
      className="w-full p-[0.94rem] flex flex-col gap-[0.63rem] border border-[#E5E5E5] rounded-[0.38rem]"
    >
      <div
        className="text-[1rem]"
      >
        Connectors
      </div>
      <div
        className="text-[#737373]"
      >
        Connect to your favorite apps
      </div>

      <div
        className="flex flex-col gap-[0.63rem]"
      >
        {allProviderConfigs.map((provider, index) => {
          const {
            authenticated,
            user,
          } = providerStatus[provider.id] || {
            authenticated: false,
            user: null,
          }

          const { email } = user || {}

          return (
            <React.Fragment key={`connector-panel-provider-${provider.id}`}>
              <div
                className="w-full flex justify-between items-start"
              >
                <div
                  style={{
                    opacity: authenticated ? 1 : 0.5,
                  }}
                >
                  <div
                    className="flex items-center gap-[0.63rem]"
                  >
                    {getIcon(provider.id)}
                    <div>
                      {provider.name}
                      {/* {JSON.stringify(providerStatus[provider.id])} */}
                    </div>
                  </div>
                  {Boolean(email) && (
                    <div
                      className="text-[#737373] text-[0.75rem]"
                    >
                      Account:
                      {' '}
                      {email}
                    </div>
                  )}
                </div>
                <ButtonDesigned
                  className="px-[1rem] py-[0.5rem]"
                  onClick={() => {
                    setEditingProvider(provider)
                    setIsAddPopupOpen(true)
                  }}
                  variant="clear"
                  hasBorder
                >
                  Connect
                </ButtonDesigned>
              </div>
              {index < allProviderConfigs.length - 1 && (
                <div className="w-full h-px bg-[#E5E5E5]" />
              )}
            </React.Fragment>
          )
        })}

        <ButtonDesigned
          className="px-[1rem] py-[0.5rem] self-start"
          onClick={() => setIsAddPopupOpen(true)}
          variant="secondary"
          hasBorder
        >
          Add Connector
        </ButtonDesigned>
        {isAddPopupOpen && (
          <AddConnectorPopup
            onSave={handleSaveProvider}
            onCancel={() => {
              setIsAddPopupOpen(false)
              setEditingProvider(null)
            }}
            initialConfig={editingProvider}
          />
        )}
      </div>

    </div>
  )
}
