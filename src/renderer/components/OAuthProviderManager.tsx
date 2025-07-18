import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface OAuthProvider {
  id: string;
  name: string;
  icon?: string;
  clientId: string;
  clientSecret?: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl?: string;
  scopes: string[];
  usePKCE: boolean;
  redirectUri: string;
  additionalParams?: Record<string, string>;
}

interface ProviderStatus {
  authenticated: boolean;
  expired: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    firstName?: string;
    lastName?: string;
    picture?: string;
    [key: string]: any;
  };
  storedAt?: number;
  updatedAt?: number;
}

interface OAuthProviderManagerProps {
  className?: string;
}

declare global {
  interface Window {
    electronAPI: {
      getAvailableProviders: () => Promise<OAuthProvider[]>;
      startProviderOAuth: (providerId: string) => Promise<void>;
      getProviderAuthStatus: () => Promise<Record<string, ProviderStatus>>;
      getProviderAccessToken: (providerId: string) => Promise<string | null>;
      logoutProvider: (providerId: string) => Promise<void>;
      refreshProviderTokens: (providerId: string) => Promise<boolean>;
      clearAllProviderTokens: () => Promise<void>;
      getOAuthStorageInfo: () => Promise<any>;
    };
  }
}

export const OAuthProviderManager: React.FC<OAuthProviderManagerProps> = ({ className }) => {
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const [providerStatus, setProviderStatus] = useState<Record<string, ProviderStatus>>({});
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<any>(null);

  useEffect(() => {
    loadProviders();
    loadProviderStatus();
    loadStorageInfo();

    // Listen for OAuth events
    const handleProviderAuthSuccess = (event: any, data: any) => {
      console.log('Provider auth success:', data);
      loadProviderStatus();
      setIsLoading(prev => ({ ...prev, [data.providerId]: false }));
      setError(null);
    };

    const handleProviderAuthError = (event: any, data: any) => {
      console.error('Provider auth error:', data);
      setError(`${data.providerId}: ${data.message}`);
      setIsLoading(prev => ({ ...prev, [data.providerId]: false }));
    };

    const handleProviderAuthLogout = (event: any, data: any) => {
      console.log('Provider auth logout:', data);
      loadProviderStatus();
    };

    // Add event listeners if available
    if (window.electronAPI) {
      // Note: These would need to be implemented in the preload script
      // window.electronAPI.on?.('provider-auth-success', handleProviderAuthSuccess);
      // window.electronAPI.on?.('provider-auth-error', handleProviderAuthError);
      // window.electronAPI.on?.('provider-auth-logout', handleProviderAuthLogout);
    }

    return () => {
      // Cleanup listeners
    };
  }, []);

  const loadProviders = async () => {
    try {
      const availableProviders = await window.electronAPI.getAvailableProviders();
      setProviders(availableProviders);
    } catch (error) {
      console.error('Failed to load providers:', error);
      setError('Failed to load available providers');
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

  const loadStorageInfo = async () => {
    try {
      const info = await window.electronAPI.getOAuthStorageInfo();
      setStorageInfo(info);
    } catch (error) {
      console.error('Failed to load storage info:', error);
    }
  };

  const handleConnect = async (providerId: string) => {
    setIsLoading(prev => ({ ...prev, [providerId]: true }));
    setError(null);

    try {
      await window.electronAPI.startProviderOAuth(providerId);
      // The actual connection will be handled by the OAuth flow
      // and the provider-auth-success event will be triggered
    } catch (error) {
      console.error(`Failed to start OAuth for ${providerId}:`, error);
      setError(`Failed to connect to ${providerId}`);
      setIsLoading(prev => ({ ...prev, [providerId]: false }));
    }
  };

  const handleDisconnect = async (providerId: string) => {
    setIsLoading(prev => ({ ...prev, [providerId]: true }));

    try {
      await window.electronAPI.logoutProvider(providerId);
      await loadProviderStatus();
    } catch (error) {
      console.error(`Failed to disconnect ${providerId}:`, error);
      setError(`Failed to disconnect from ${providerId}`);
    } finally {
      setIsLoading(prev => ({ ...prev, [providerId]: false }));
    }
  };

  const handleRefresh = async (providerId: string) => {
    setIsLoading(prev => ({ ...prev, [providerId]: true }));

    try {
      const success = await window.electronAPI.refreshProviderTokens(providerId);
      if (success) {
        await loadProviderStatus();
        setError(null);
      } else {
        setError(`Failed to refresh tokens for ${providerId}`);
      }
    } catch (error) {
      console.error(`Failed to refresh tokens for ${providerId}:`, error);
      setError(`Failed to refresh tokens for ${providerId}`);
    } finally {
      setIsLoading(prev => ({ ...prev, [providerId]: false }));
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Are you sure you want to disconnect from all providers? This action cannot be undone.')) {
      return;
    }

    try {
      await window.electronAPI.clearAllProviderTokens();
      await loadProviderStatus();
      await loadStorageInfo();
      setError(null);
    } catch (error) {
      console.error('Failed to clear all tokens:', error);
      setError('Failed to clear all tokens');
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

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  const getStatusBadge = (status: ProviderStatus) => {
    if (!status.authenticated) {
      return <Badge variant="secondary">Not Connected</Badge>;
    }
    if (status.expired) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    return <Badge variant="default">Connected</Badge>;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">OAuth Providers</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadProviders();
              loadProviderStatus();
              loadStorageInfo();
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

      {providers.length === 0 ? (
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
          {providers.map((provider) => {
            const status = providerStatus[provider.id];
            const loading = isLoading[provider.id];

            return (
              <Card key={provider.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{provider.icon || '🔗'}</div>
                    <div>
                      <h3 className="text-lg font-semibold">{provider.name}</h3>
                      <p className="text-sm text-gray-500">
                        Scopes: {provider.scopes.join(', ')}
                      </p>
                      {status?.user && (
                        <div className="text-sm text-gray-600 mt-1">
                          <div>👤 {status.user.name || status.user.email}</div>
                          {status.storedAt && (
                            <div>📅 Connected: {formatDate(status.storedAt)}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(status || { authenticated: false, expired: false })}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {!status?.authenticated ? (
                    <Button
                      onClick={() => handleConnect(provider.id)}
                      disabled={loading}
                      size="sm"
                    >
                      {loading ? '⏳ Connecting...' : '🔗 Connect'}
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={() => handleGetToken(provider.id)}
                        variant="outline"
                        size="sm"
                      >
                        📋 Copy Token
                      </Button>
                      {status.expired && (
                        <Button
                          onClick={() => handleRefresh(provider.id)}
                          disabled={loading}
                          variant="outline"
                          size="sm"
                        >
                          {loading ? '⏳ Refreshing...' : '🔄 Refresh'}
                        </Button>
                      )}
                      <Button
                        onClick={() => handleDisconnect(provider.id)}
                        disabled={loading}
                        variant="destructive"
                        size="sm"
                      >
                        {loading ? '⏳ Disconnecting...' : '❌ Disconnect'}
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {storageInfo && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-2">Storage Info</h3>
          <div className="text-xs text-gray-600 space-y-1">
            <div>📁 File: {storageInfo.filePath}</div>
            <div>📊 Providers: {storageInfo.providersCount}</div>
            <div>💾 Size: {storageInfo.size ? `${storageInfo.size} bytes` : 'N/A'}</div>
            <div>🔒 Permissions: {storageInfo.permissions || 'N/A'}</div>
          </div>
        </Card>
      )}
    </div>
  );
}; 