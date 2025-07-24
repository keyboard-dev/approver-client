import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'

interface ServerProvider {
  id: string
  name: string
  url: string
}

interface ServerProviderManagerProps {
  className?: string
}

interface ServerProviderInfo {
  name: string
  scopes: string[]
  configured: boolean
}

export const ServerProviderManager: React.FC<ServerProviderManagerProps> = ({ className }) => {
  const [servers, setServers] = useState<ServerProvider[]>([])
  const [serverProviders, setServerProviders] = useState<Record<string, ServerProviderInfo[]>>({})
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newServer, setNewServer] = useState({
    name: '',
    url: '',
  })

  useEffect(() => {
    loadServerProviders()
  }, [])

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
      console.log(`✅ Fetched ${providers.length} providers for server ${serverId}`)
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
      console.log(`✅ Successfully added server provider: ${newServer.name}`)

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
      console.log(`🗑️ Removed server provider: ${serverId}`)
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
      console.log(`🔐 Started OAuth flow: ${serverId} → ${provider}`)
    }
    catch (error) {
      console.error(`Failed to start OAuth for ${serverId}/${provider}:`, error)
      setError(`Failed to start OAuth: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Server Providers</h2>
          <p className="text-muted-foreground">
            Add OAuth servers to fetch authorization URLs from custom endpoints.
            All requests are authenticated using your main OAuth access token.
          </p>
        </div>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {showAddForm ? 'Cancel' : 'Add Server'}
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {showAddForm && (
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle>Add Server Provider</CardTitle>
            <CardDescription>
              Add a server that provides OAuth authorization URLs via API endpoints.
              Server authentication uses your main OAuth access token automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Server Name</label>
              <input
                type="text"
                value={newServer.name}
                onChange={e => handleInputChange('name', e.target.value)}
                placeholder="My OAuth Server"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Server URL</label>
              <input
                type="url"
                value={newServer.url}
                onChange={e => handleInputChange('url', e.target.value)}
                placeholder="http://localhost:4000"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Will be used to call:
                {' '}
                {newServer.url}
                /api/oauth/authorize/google
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleAddServer}
                disabled={!newServer.name || !newServer.url || isLoading['add']}
                className="bg-green-600 hover:bg-green-700"
              >
                {isLoading['add'] ? 'Adding...' : 'Add Server'}
              </Button>
              <Button
                onClick={() => setShowAddForm(false)}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {servers.length === 0
          ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-gray-500">
                    <p>No server providers configured.</p>
                    <p className="text-sm mt-1">Add a server to get started.</p>
                  </div>
                </CardContent>
              </Card>
            )
          : (
              servers.map(server => (
                <Card key={server.id} className="border-gray-200">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{server.name}</CardTitle>
                        <CardDescription>{server.url}</CardDescription>
                      </div>
                      <Button
                        onClick={() => handleRemoveServer(server.id)}
                        disabled={isLoading[server.id]}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Remove
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-gray-700">Available OAuth Providers:</p>
                          <Button
                            onClick={() => fetchProvidersForServer(server.id)}
                            disabled={isLoading[`fetch-${server.id}`]}
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                          >
                            {isLoading[`fetch-${server.id}`] ? 'Refreshing...' : 'Refresh'}
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {isLoading[`fetch-${server.id}`]
                            ? (
                                <div className="col-span-3 text-center text-gray-500 py-4">
                                  <p>Loading providers...</p>
                                </div>
                              )
                            : serverProviders[server.id]?.length > 0
                              ? (
                                  serverProviders[server.id].map(provider => (
                                    <Button
                                      key={provider.name}
                                      onClick={() => handleStartOAuth(server.id, provider.name)}
                                      disabled={!provider.configured || isLoading[`${server.id}-${provider.name}`]}
                                      variant="outline"
                                      size="sm"
                                      className={`justify-start ${!provider.configured ? 'opacity-50' : ''}`}
                                      title={provider.configured
                                        ? `Scopes: ${provider.scopes.join(', ')}`
                                        : 'Not configured on server'}
                                    >
                                      {isLoading[`${server.id}-${provider.name}`]
                                        ? (
                                            'Starting...'
                                          )
                                        : (
                                            <>
                                              {provider.configured ? '🟢' : '🔴'}
                                              {' '}
                                              {provider.name.charAt(0).toUpperCase() + provider.name.slice(1)}
                                            </>
                                          )}
                                    </Button>
                                  ))
                                )
                              : (
                                  <div className="col-span-3 text-center text-gray-500 py-4">
                                    <p>No providers available</p>
                                    <p className="text-xs">Check server configuration</p>
                                  </div>
                                )}
                        </div>
                      </div>

                      <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                        <p>
                          <strong>Providers endpoint:</strong>
                          {' '}
                          {server.url}
                          /api/oauth/providers
                        </p>
                        <p>
                          <strong>Authorize endpoint:</strong>
                          {' '}
                          {server.url}
                          /api/oauth/authorize/
                          {`{provider}`}
                        </p>
                        <p>
                          <strong>Callback URL:</strong>
                          {' '}
                          http://localhost:8082/callback
                        </p>
                        <p>
                          <strong>Authentication:</strong>
                          {' '}
                          Bearer token (main OAuth access token)
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
      </div>
    </div>
  )
}

export default ServerProviderManager
