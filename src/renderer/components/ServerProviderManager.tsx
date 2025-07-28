import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';

interface ServerProvider {
  id: string;
  name: string;
  url: string;
}

interface ServerProviderManagerProps {
  className?: string;
}

interface ServerProviderInfo {
  name: string;
  scopes: string[];
  configured: boolean;
}

export const ServerProviderManager: React.FC<ServerProviderManagerProps> = ({ className }) => {
  const [servers, setServers] = useState<ServerProvider[]>([]);
  const [serverProviders, setServerProviders] = useState<Record<string, ServerProviderInfo[]>>({});
  const [providerStatus, setProviderStatus] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newServer, setNewServer] = useState({
    name: '',
    url: ''
  });

  useEffect(() => {
    loadServerProviders();
    loadProviderStatus();

    // Listen for OAuth completion events
    const handleProviderAuthSuccess = (event: any, data: any) => {
      console.log('Server provider auth success:', data);
      // Clear loading state for the completed OAuth flow
      setIsLoading(prev => {
        const updated = { ...prev };
        // Clear loading for any server-provider combinations
        Object.keys(updated).forEach(key => {
          if (key.includes('-') && key.endsWith(data.providerId)) {
            updated[key] = false;
          }
        });
        return updated;
      });
      // Refresh provider status to show new authentication
      loadProviderStatus();
      setError(null);
    };

    const handleProviderAuthError = (event: any, data: any) => {
      console.error('Server provider auth error:', data);
      setError(`Authentication failed: ${data.message}`);
      // Clear all loading states
      setIsLoading({});
      // Refresh provider status in case of partial success
      loadProviderStatus();
    };

    // Add event listeners if available
    if (window.electronAPI) {
      window.electronAPI.onProviderAuthSuccess?.(handleProviderAuthSuccess);
      window.electronAPI.onProviderAuthError?.(handleProviderAuthError);
    }

    return () => {
      // Cleanup - no specific cleanup needed for Electron IPC
    };
  }, []);

  const loadServerProviders = async () => {
    try {
      const serverProviders = await window.electronAPI.getServerProviders();
      setServers(serverProviders);
      
      // Fetch providers for each server
      for (const server of serverProviders) {
        await fetchProvidersForServer(server.id);
      }
    } catch (error) {
      console.error('Failed to load server providers:', error);
      setError('Failed to load server providers');
    }
  };

  const fetchProvidersForServer = async (serverId: string) => {
    const loadingKey = `fetch-${serverId}`;
    setIsLoading(prev => ({ ...prev, [loadingKey]: true }));

    try {
      const providers = await window.electronAPI.fetchServerProviders(serverId);
      setServerProviders(prev => ({
        ...prev,
        [serverId]: providers
      }));
      console.log(`✅ Fetched ${providers.length} providers for server ${serverId}`);
    } catch (error) {
      console.error(`Failed to fetch providers for server ${serverId}:`, error);
      // Set empty array on error so UI doesn't break
      setServerProviders(prev => ({
        ...prev,
        [serverId]: []
      }));
    } finally {
      setIsLoading(prev => ({ ...prev, [loadingKey]: false }));
    }
  };

  const loadProviderStatus = async () => {
    try {
      const status = await window.electronAPI.getProviderAuthStatus();
      setProviderStatus(status);
    } catch (error) {
      console.error('Failed to load provider status:', error);
    }
  };

  const handleAddServer = async () => {
    setIsLoading(prev => ({ ...prev, 'add': true }));
    setError(null);

    try {
      const serverId = `server-${Date.now()}`;
      
      const serverConfig = {
        id: serverId,
        name: newServer.name,
        url: newServer.url
      };

      await window.electronAPI.addServerProvider(serverConfig);
      console.log(`✅ Successfully added server provider: ${newServer.name}`);
      
      await loadServerProviders();
      // Fetch providers for the newly added server
      await fetchProvidersForServer(serverId);
      setShowAddForm(false);
      setNewServer({
        name: '',
        url: ''
      });
    } catch (error) {
      console.error('Failed to add server provider:', error);
      setError(`Failed to add server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(prev => ({ ...prev, 'add': false }));
    }
  };

  const handleRemoveServer = async (serverId: string) => {
    setIsLoading(prev => ({ ...prev, [serverId]: true }));

    try {
      await window.electronAPI.removeServerProvider(serverId);
      console.log(`🗑️ Removed server provider: ${serverId}`);
      await loadServerProviders();
    } catch (error) {
      console.error(`Failed to remove server ${serverId}:`, error);
      setError(`Failed to remove server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(prev => ({ ...prev, [serverId]: false }));
    }
  };

  const handleStartOAuth = async (serverId: string, provider: string) => {
    const loadingKey = `${serverId}-${provider}`;
    setIsLoading(prev => ({ ...prev, [loadingKey]: true }));
    setError(null);

    try {
      await window.electronAPI.startServerProviderOAuth(serverId, provider);
      console.log(`🔐 Started OAuth flow: ${serverId} → ${provider}`);
      // Don't clear loading state here - it will be cleared by the auth success/error handlers
    } catch (error) {
      console.error(`Failed to start OAuth for ${serverId}/${provider}:`, error);
      setError(`Failed to start OAuth: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Only clear loading state on immediate error (not OAuth callback errors)
      setIsLoading(prev => ({ ...prev, [loadingKey]: false }));
    }
  };

  const handleGetToken = async (providerId: string) => {
    try {
      const token = await window.electronAPI.getProviderAccessToken(providerId);
      if (token) {
        // Copy to clipboard
        navigator.clipboard.writeText(token);
        alert(`Access token copied to clipboard!\n\nToken preview: ${token.substring(0, 20)}...`);
      } else {
        alert('No valid token available. Please reconnect.');
      }
    } catch (error) {
      console.error(`Failed to get token for ${providerId}:`, error);
      setError(`Failed to get token for ${providerId}`);
    }
  };

  const handleDisconnect = async (providerId: string) => {
    try {
      await window.electronAPI.logoutProvider(providerId);
      await loadProviderStatus();
      setError(null);
    } catch (error) {
      console.error(`Failed to disconnect ${providerId}:`, error);
      setError(`Failed to disconnect from ${providerId}`);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setNewServer(prev => ({
      ...prev,
      [field]: value
    }));
  };

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
        <div className="flex gap-2">
          <Button 
            onClick={() => {
              loadServerProviders();
              loadProviderStatus();
            }}
            variant="outline"
            size="sm"
          >
            🔄 Refresh
          </Button>
          <Button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {showAddForm ? 'Cancel' : 'Add Server'}
          </Button>
        </div>
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
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="My OAuth Server"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Server URL</label>
              <input
                type="url"
                value={newServer.url}
                onChange={(e) => handleInputChange('url', e.target.value)}
                placeholder="http://localhost:4000"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Will be used to call: {newServer.url}/api/oauth/authorize/google
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
        {servers.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-gray-500">
                <p>No server providers configured.</p>
                <p className="text-sm mt-1">Add a server to get started.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          servers.map((server) => (
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
                    <div className="space-y-3">
                      {isLoading[`fetch-${server.id}`] ? (
                        <div className="text-center text-gray-500 py-4">
                          <p>Loading providers...</p>
                        </div>
                      ) : serverProviders[server.id]?.length > 0 ? (
                        serverProviders[server.id].map((provider) => {
                          const isAuthenticated = providerStatus[provider.name]?.authenticated;
                          const user = providerStatus[provider.name]?.user;
                          const isExpired = providerStatus[provider.name]?.expired;
                          
                          return (
                            <div key={provider.name} className="space-y-2">
                              <div className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                                <div className="flex items-center space-x-2">
                                  <span className="text-lg">
                                    {provider.configured ? '🟢' : '🔴'}
                                  </span>
                                  <div>
                                    <div className="font-medium">
                                      {provider.name.charAt(0).toUpperCase() + provider.name.slice(1)}
                                    </div>
                                    {isAuthenticated && user && (
                                      <div className="text-xs text-gray-600">
                                        👤 {user.name || user.email}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  {isAuthenticated ? (
                                    <>
                                      <span className={`text-xs px-2 py-1 rounded ${isExpired ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                        {isExpired ? 'Expired' : 'Connected'}
                                      </span>
                                      <Button
                                        onClick={() => handleGetToken(provider.name)}
                                        variant="outline"
                                        size="sm"
                                        className="text-xs"
                                      >
                                        📋 Token
                                      </Button>
                                      <Button
                                        onClick={() => handleDisconnect(provider.name)}
                                        variant="outline"
                                        size="sm"
                                        className="text-xs text-red-600 hover:text-red-700"
                                      >
                                        ❌ Disconnect
                                      </Button>
                                    </>
                                  ) : (
                                    <Button
                                      onClick={() => handleStartOAuth(server.id, provider.name)}
                                      disabled={!provider.configured || isLoading[`${server.id}-${provider.name}`]}
                                      variant="outline"
                                      size="sm"
                                      className={`${!provider.configured ? 'opacity-50' : ''}`}
                                      title={provider.configured ? 
                                        `Scopes: ${provider.scopes.join(', ')}` : 
                                        'Not configured on server'
                                      }
                                    >
                                      {isLoading[`${server.id}-${provider.name}`] ? (
                                        'Starting...'
                                      ) : (
                                        '🔗 Connect'
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                                              ) : (
                        <div className="text-center text-gray-500 py-4">
                          <p>No providers available</p>
                          <p className="text-xs">Check server configuration</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                    <p><strong>Providers endpoint:</strong> {server.url}/api/oauth/providers</p>
                    <p><strong>Authorize endpoint:</strong> {server.url}/api/oauth/authorize/{`{provider}`}</p>
                    <p><strong>Callback URL:</strong> http://localhost:8082/callback</p>
                    <p><strong>Authentication:</strong> Bearer token (main OAuth access token)</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default ServerProviderManager; 