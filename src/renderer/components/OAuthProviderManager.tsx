import React, { useState, useEffect } from 'react'
import { Card } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { ManualProviderForm } from './ManualProviderForm'
import type { OAuthProvider, ProviderStatus } from '../../preload'

interface OAuthProviderManagerProps {
  className?: string
}

interface OAuthProviderConfig extends OAuthProvider {
  isCustom?: boolean
  createdAt?: number
  updatedAt?: number
}

interface StorageInfo {
  filePath: string
  providersCount: number
  size?: number
  permissions?: string
}

interface ProviderAuthEvent {
  providerId: string
  message?: string
}

export const OAuthProviderManager: React.FC<OAuthProviderManagerProps> = ({ className }) => {
  const [providers, setProviders] = useState<OAuthProvider[]>([])
  const [allProviderConfigs, setAllProviderConfigs] = useState<OAuthProviderConfig[]>([])
  const [providerStatus, setProviderStatus] = useState<Record<string, ProviderStatus>>({})
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingProvider, setEditingProvider] = useState<OAuthProviderConfig | null>(null)

  useEffect(() => {
    loadProviders()
    loadAllProviderConfigs()
    loadProviderStatus()
    loadStorageInfo()

    // Listen for OAuth events
    const handleProviderAuthSuccess = (_event: any, data: ProviderAuthEvent) => {
      console.log('Provider auth success:', data)
      // Refresh all provider data to show the new authentication status
      loadProviders()
      loadAllProviderConfigs()
      loadProviderStatus()
      loadStorageInfo()
      setIsLoading(prev => ({ ...prev, [data.providerId]: false }))
      setError(null)
    }

    const handleProviderAuthError = (_event: any, data: ProviderAuthEvent) => {
      console.error('Provider auth error:', data)
      setError(`${data.providerId}: ${data.message}`)
      setIsLoading(prev => ({ ...prev, [data.providerId]: false }))
    }

    const handleProviderAuthLogout = (_event: any, data: ProviderAuthEvent) => {
      console.log('Provider auth logout:', data)
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
  }, [])

  const loadProviders = async () => {
    try {
      const availableProviders = await window.electronAPI.getAvailableProviders()
      setProviders(availableProviders)
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

  const handleRefresh = async (providerId: string) => {
    setIsLoading(prev => ({ ...prev, [providerId]: true }))

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
      setIsLoading(prev => ({ ...prev, [providerId]: false }))
    }
  }

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to disconnect from all providers? This action cannot be undone.')) {
      return
    }

    try {
      await window.electronAPI.clearAllProviderTokens()
      await loadProviderStatus()
      await loadStorageInfo()
      setError(null)
    }
    catch (error) {
      console.error('Failed to clear all tokens:', error)
      setError('Failed to clear all tokens')
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

  const handleSaveProvider = async (config: OAuthProviderConfig) => {
    try {
      await window.electronAPI.saveProviderConfig(config)
      await loadProviders()
      await loadAllProviderConfigs()
      setShowAddForm(false)
      setEditingProvider(null)
      setError(null)
    }
    catch (error) {
      console.error('Failed to save provider:', error)
      setError('Failed to save provider configuration')
      throw error // Re-throw to let the form handle it
    }
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

  const handleEditProvider = async (providerId: string) => {
    try {
      const config = await window.electronAPI.getProviderConfig(providerId)
      if (config) {
        setEditingProvider(config)
        setShowAddForm(true)
      }
    }
    catch (error) {
      console.error(`Failed to load provider config ${providerId}:`, error)
      setError(`Failed to load provider configuration`)
    }
  }

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'N/A'
    return new Date(timestamp).toLocaleString()
  }

  const getStatusBadge = (status: ProviderStatus) => {
    if (!status.authenticated) {
      return <Badge variant="secondary">Not Connected</Badge>
    }
    if (status.expired) {
      return <Badge variant="destructive">Expired</Badge>
    }
    return <Badge variant="default">Connected</Badge>
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">OAuth Providers</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(true)}
          >
            ➕ Add Provider
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadProviders()
              loadAllProviderConfigs()
              loadProviderStatus()
              loadStorageInfo()
            }}
          >
            🔄 Refresh
          </Button>
          {Object.keys(providerStatus).length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearAll}
            >
              🗑️ Clear All
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {showAddForm && (
        <ManualProviderForm
          onSave={handleSaveProvider}
          onCancel={() => {
            setShowAddForm(false)
            setEditingProvider(null)
          }}
          initialConfig={editingProvider}
          isEditing={!!editingProvider}
        />
      )}

      {allProviderConfigs.length === 0 ? (
        <Card className="p-6">
          <div className="text-center text-gray-500">
            <p>No OAuth providers configured.</p>
            <p className="text-sm mt-2">
              Configure providers by setting environment variables like GOOGLE_CLIENT_ID, GITHUB_CLIENT_ID, etc.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {allProviderConfigs.map((config) => {
            const status = providerStatus[config.id]
            const loading = isLoading[config.id]
            const isAvailable = config.clientId && config.clientId.trim() !== ''
            const hasTokens = status?.authenticated

            return (
              <Card key={config.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{config.icon || '🔗'}</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">{config.name}</h3>
                        {!isAvailable && !hasTokens && (
                          <Badge variant="secondary" className="text-xs">No Client ID</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        Scopes:
                        {' '}
                        {config.scopes?.join(', ') || 'None specified'}
                      </p>
                      {status?.user && (
                        <div className="text-sm text-gray-600 mt-1">
                          <div>
                            👤
                            {status.user.name || status.user.email}
                          </div>
                          {status.storedAt && (
                            <div>
                              📅 Connected:
                              {formatDate(status.storedAt)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(status || { authenticated: false, expired: false })}
                    {config.isCustom && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditProvider(config.id)}
                        >
                          ✏️ Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteProvider(config.id)}
                        >
                          🗑️ Delete
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Show token management buttons if authenticated OR if provider is available for direct connect */}
                {(hasTokens || isAvailable) && (
                  <div className="mt-4 flex items-center flex-wrap gap-2">
                    {!status?.authenticated
                      ? (
                          isAvailable && (
                            <Button
                              onClick={() => handleConnect(config.id)}
                              disabled={loading}
                              size="sm"
                            >
                              {loading ? '⏳ Connecting...' : '🔗 Connect'}
                            </Button>
                          )
                        )
                      : (
                          <>
                            <Button
                              onClick={() => handleGetToken(config.id)}
                              variant="outline"
                              size="sm"
                            >
                              📋 Copy Token
                            </Button>
                            {status.expired && (
                              <Button
                                onClick={() => handleRefresh(config.id)}
                                disabled={loading}
                                variant="outline"
                                size="sm"
                              >
                                {loading ? '⏳ Refreshing...' : '🔄 Refresh'}
                              </Button>
                            )}
                            <Button
                              onClick={() => handleDisconnect(config.id)}
                              disabled={loading}
                              variant="destructive"
                              size="sm"
                            >
                              {loading ? '⏳ Disconnecting...' : '❌ Disconnect'}
                            </Button>
                          </>
                        )}
                  </div>
                )}

                {/* Only show the warning if no tokens exist AND no client ID is configured */}
                {!hasTokens && !isAvailable && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-700">
                      ⚠️ This provider needs a Client ID to be configured before it can be used for direct authentication.
                      {config.isCustom && ' Click "Edit" to add your Client ID.'}
                      {' '}
                      Alternatively, you can authenticate via Server Providers.
                    </p>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {storageInfo && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-2">Storage Info</h3>
          <div className="text-xs text-gray-600 space-y-1">
            <div>
              📁 File:
              {storageInfo.filePath}
            </div>
            <div>
              📊 Providers:
              {storageInfo.providersCount}
            </div>
            <div>
              💾 Size:
              {storageInfo.size ? `${storageInfo.size} bytes` : 'N/A'}
            </div>
            <div>
              🔒 Permissions:
              {storageInfo.permissions || 'N/A'}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
