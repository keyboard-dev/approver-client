/**
 * ConnectorsContent
 *
 * Core reusable component for managing connectors (local + Pipedream).
 * Contains search, connector listings, and connected accounts.
 * Used by ConnectorsPanel (settings) and Integrations (onboarding).
 */

import { RefreshCw, Search, Trash2, X } from 'lucide-react'
import React, { useMemo, useState } from 'react'

import squaresIconUrl from '../../../../assets/icon-squares.svg'
import { AdditionalConnectedAccount, useAdditionalConnectedAccounts } from '../../hooks/useAdditionalConnectedAccounts'
import { useCustomIntegrations } from '../../hooks/useCustomIntegrations'
import { KeyboardApiProvider, useKeyboardApiConnectors } from '../../hooks/useKeyboardApiConnectors'
import { usePipedream } from '../../hooks/usePipedream'
import { usePopup } from '../../hooks/usePopup'
import { PipedreamAccount, PipedreamApp } from '../../services/pipedream-service'
import { ButtonDesigned } from './ButtonDesigned'

// =============================================================================
// Types
// =============================================================================

export interface ConnectorsContentProps {
  /** Max height for the available connectors list */
  maxConnectorsHeight?: string
  /** Additional className for the container */
  className?: string
}

// =============================================================================
// Tag Component
// =============================================================================

type SourceType = 'local' | 'pipedream' | 'cloud'

interface SourceTagProps {
  source: SourceType
}

export const SourceTag: React.FC<SourceTagProps> = ({ source }) => {
  const styles = source === 'local'
    ? 'bg-[#E5EFF4] text-[#5093B7] border-[#5093B7]'
    : source === 'pipedream'
      ? 'bg-[#F3E8FF] text-[#9333EA] border-[#9333EA]'
      : 'bg-[#FFF4E5] text-[#D97706] border-[#D97706]'

  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${styles}`}>
      {source}
    </span>
  )
}

// =============================================================================
// Local Connector Card
// =============================================================================

interface LocalConnectorCardProps {
  provider: KeyboardApiProvider
  isAuthenticated: boolean
  isConnecting: boolean
  isDisconnecting: boolean
  onConnect: () => void
  onDisconnect: () => void
}

const LocalConnectorCard: React.FC<LocalConnectorCardProps> = ({
  provider,
  isAuthenticated,
  isConnecting,
  isDisconnecting,
  onConnect,
  onDisconnect,
}) => {
  return (
    <div className="flex items-center justify-between p-3 border border-[#E5E5E5] rounded-lg hover:border-[#CCC] transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg border border-[#E5E5E5] flex items-center justify-center overflow-hidden bg-white">
          <img
            src={provider.icon}
            alt={provider.name}
            className="w-6 h-6 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = squaresIconUrl
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="font-medium text-[#171717]">{provider.name}</div>
          <SourceTag source="local" />
        </div>
      </div>
      {isAuthenticated
        ? (
            <ButtonDesigned
              variant="clear"
              className="px-3 py-2 text-[#D23535] hover:bg-[#FEE] shrink-0"
              disabled={isDisconnecting}
              onClick={onDisconnect}
            >
              {isDisconnecting
                ? <RefreshCw className="w-4 h-4 animate-spin" />
                : <Trash2 className="w-4 h-4" />}
            </ButtonDesigned>
          )
        : (
            <ButtonDesigned
              variant="clear"
              hasBorder
              className="px-4 py-2 shrink-0"
              disabled={isConnecting || !provider.configured}
              onClick={onConnect}
            >
              {isConnecting ? 'Connecting...' : 'Connect'}
            </ButtonDesigned>
          )}
    </div>
  )
}

// =============================================================================
// Pipedream App Card
// =============================================================================

interface PipedreamAppCardProps {
  app: PipedreamApp
  isConnecting: boolean
  onConnect: () => void
}

const PipedreamAppCard: React.FC<PipedreamAppCardProps> = ({ app, isConnecting, onConnect }) => {
  return (
    <div className="flex items-center justify-between p-3 border border-[#E5E5E5] rounded-lg hover:border-[#CCC] transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg border border-[#E5E5E5] flex items-center justify-center overflow-hidden bg-white">
          {app.logoUrl
            ? (
                <img
                  src={app.logoUrl}
                  alt={app.name}
                  className="w-6 h-6 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = squaresIconUrl
                  }}
                />
              )
            : (
                <img src={squaresIconUrl} alt={app.name} className="w-6 h-6" />
              )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <div className="font-medium text-[#171717]">{app.name}</div>
            <SourceTag source="pipedream" />
          </div>
          {app.description && (
            <div className="text-sm text-[#737373] line-clamp-1 max-w-[300px]">
              {app.description}
            </div>
          )}
        </div>
      </div>
      <ButtonDesigned
        variant="clear"
        hasBorder
        className="px-4 py-2 shrink-0"
        disabled={isConnecting}
        onClick={onConnect}
      >
        {isConnecting ? 'Connecting...' : 'Connect'}
      </ButtonDesigned>
    </div>
  )
}

// =============================================================================
// Custom Integration Card
// =============================================================================

interface CustomIntegrationCardProps {
  integration: {
    id: string
    name: string
    description?: string
    icon: string
    source?: 'local' | 'pipedream' | 'custom'
  }
  isConnecting: boolean
  onConnect: () => void
}

const CustomIntegrationCard: React.FC<CustomIntegrationCardProps> = ({
  integration,
  isConnecting,
  onConnect,
}) => {
  return (
    <div className="flex items-center justify-between p-3 border border-[#E5E5E5] rounded-lg hover:border-[#CCC] transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg border border-[#E5E5E5] flex items-center justify-center overflow-hidden bg-white">
          <img
            src={integration.icon}
            alt={integration.name}
            className="w-6 h-6 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = squaresIconUrl
            }}
          />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <div className="font-medium text-[#171717]">{integration.name}</div>
            <SourceTag source={integration.source || 'custom'} />
          </div>
          {integration.description && (
            <div className="text-sm text-[#737373] line-clamp-1 max-w-[300px]">
              {integration.description}
            </div>
          )}
        </div>
      </div>
      <ButtonDesigned
        variant="clear"
        hasBorder
        className="px-4 py-2 shrink-0"
        disabled={isConnecting}
        onClick={onConnect}
      >
        {isConnecting ? 'Connecting...' : 'Connect'}
      </ButtonDesigned>
    </div>
  )
}

// =============================================================================
// Connected Local Account Card
// =============================================================================

interface ConnectedLocalAccountCardProps {
  provider: KeyboardApiProvider
  email?: string
  isDisconnecting: boolean
  onDisconnect: () => void
}

const ConnectedLocalAccountCard: React.FC<ConnectedLocalAccountCardProps> = ({
  provider,
  email,
  isDisconnecting,
  onDisconnect,
}) => {
  return (
    <div className="flex items-center justify-between p-3 border border-[#E5E5E5] rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg border border-[#E5E5E5] flex items-center justify-center overflow-hidden bg-white">
          <img
            src={provider.icon}
            alt={provider.name}
            className="w-6 h-6 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = squaresIconUrl
            }}
          />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <div className="font-medium text-[#171717]">{provider.name}</div>
            <SourceTag source="local" />
          </div>
          {email && (
            <div className="text-sm text-[#737373]">{email}</div>
          )}
        </div>
      </div>
      <ButtonDesigned
        variant="clear"
        className="px-3 py-2 text-[#D23535] hover:bg-[#FEE] shrink-0"
        disabled={isDisconnecting}
        onClick={onDisconnect}
      >
        {isDisconnecting
          ? <RefreshCw className="w-4 h-4 animate-spin" />
          : <Trash2 className="w-4 h-4" />}
      </ButtonDesigned>
    </div>
  )
}

// =============================================================================
// Connected Pipedream Account Card
// =============================================================================

interface ConnectedPipedreamAccountCardProps {
  account: PipedreamAccount
  isDisconnecting: boolean
  onDisconnect: () => void
}

const ConnectedPipedreamAccountCard: React.FC<ConnectedPipedreamAccountCardProps> = ({
  account,
  isDisconnecting,
  onDisconnect,
}) => {
  return (
    <div className="flex items-center justify-between p-3 border border-[#E5E5E5] rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg border border-[#E5E5E5] flex items-center justify-center overflow-hidden bg-white">
          {account.app.logoUrl
            ? (
                <img
                  src={account.app.logoUrl}
                  alt={account.app.name}
                  className="w-6 h-6 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = squaresIconUrl
                  }}
                />
              )
            : (
                <img src={squaresIconUrl} alt={account.app.name} className="w-6 h-6" />
              )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <div className="font-medium text-[#171717]">{account.app.name}</div>
            <SourceTag source="pipedream" />
          </div>
          <div className="text-sm text-[#737373]">
            {account.name}
            {!account.healthy && (
              <span className="ml-2 text-[#D23535]">• Needs reconnection</span>
            )}
          </div>
        </div>
      </div>
      <ButtonDesigned
        variant="clear"
        className="px-3 py-2 text-[#D23535] hover:bg-[#FEE] shrink-0"
        disabled={isDisconnecting}
        onClick={onDisconnect}
      >
        {isDisconnecting
          ? <RefreshCw className="w-4 h-4 animate-spin" />
          : <Trash2 className="w-4 h-4" />}
      </ButtonDesigned>
    </div>
  )
}

// =============================================================================
// Additional Connected Account Card
// =============================================================================

interface ConnectedAdditionalAccountCardProps {
  account: AdditionalConnectedAccount
  isDisconnecting: boolean
  onDisconnect: () => void
}

const ConnectedAdditionalAccountCard: React.FC<ConnectedAdditionalAccountCardProps> = ({
  account,
  isDisconnecting,
  onDisconnect,
}) => {
  return (
    <div className="flex items-center justify-between p-3 border border-[#E5E5E5] rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg border border-[#E5E5E5] flex items-center justify-center overflow-hidden bg-white">
          {account.icon
            ? (
                <img
                  src={account.icon}
                  alt={account.displayName}
                  className="w-6 h-6 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = squaresIconUrl
                  }}
                />
              )
            : (
                <img src={squaresIconUrl} alt={account.displayName} className="w-6 h-6" />
              )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <div className="font-medium text-[#171717]">{account.displayName}</div>
            <SourceTag source="cloud" />
          </div>
          <div className="text-sm text-[#737373]">
            {account.access_type}
          </div>
        </div>
      </div>
      <ButtonDesigned
        variant="clear"
        className="px-3 py-2 text-[#D23535] hover:bg-[#FEE] shrink-0"
        disabled={isDisconnecting}
        onClick={onDisconnect}
      >
        {isDisconnecting
          ? <RefreshCw className="w-4 h-4 animate-spin" />
          : <Trash2 className="w-4 h-4" />}
      </ButtonDesigned>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export const ConnectorsContent: React.FC<ConnectorsContentProps> = ({
  maxConnectorsHeight = '400px',
  className = '',
}) => {
  const { showPopup, hidePopup } = usePopup()

  // Local (Keyboard API) connectors
  const {
    providers: localProviders,
    providersLoading: localLoading,
    providersError: localError,
    providerStatus,
    connectingProviderId,
    disconnectingProviderId,
    connectProvider,
    disconnectProvider,
    refreshStatus: refreshLocalStatus,
  } = useKeyboardApiConnectors()

  // Pipedream connectors
  const {
    accounts: pipedreamAccounts,
    accountsLoading: pipedreamAccountsLoading,
    accountsError: pipedreamAccountsError,
    apps: pipedreamApps,
    appsLoading: pipedreamAppsLoading,
    appsError: pipedreamAppsError,
    defaultApps: pipedreamDefaultApps,
    defaultAppsLoading: pipedreamDefaultAppsLoading,
    connectingApp,
    disconnectingAccountId,
    refreshAccounts: refreshPipedreamAccounts,
    connectApp,
    disconnectAccount,
    setSearchQuery: setPipedreamSearchQuery,
    clearSearch: clearPipedreamSearch,
  } = usePipedream()

  const [searchQuery, setSearchQuery] = useState('')
  const [connectError, setConnectError] = useState<string | null>(null)

  // Custom integrations
  const {
    filteredIntegrations: customIntegrations,
    loading: customIntegrationsLoading,
    error: customIntegrationsError,
    connectingIntegrationId,
    connectIntegration,
  } = useCustomIntegrations(searchQuery)

  // Additional connected accounts (from Token Vault)
  const {
    accounts: additionalAccounts,
    accountsLoading: additionalAccountsLoading,
    accountsError: additionalAccountsError,
    disconnectingAccountId: disconnectingAdditionalAccountId,
    refreshAccounts: refreshAdditionalAccounts,
    disconnectAccount: disconnectAdditionalAccount,
  } = useAdditionalConnectedAccounts()

  // ==========================================================================
  // Computed Values
  // ==========================================================================

  // Filter local providers based on search
  const filteredLocalProviders = useMemo(() => {
    if (!searchQuery.trim()) {
      return localProviders
    }
    const query = searchQuery.toLowerCase()
    return localProviders.filter(provider =>
      provider.name.toLowerCase().includes(query),
    )
  }, [localProviders, searchQuery])

  // Get connected local accounts (providers with authenticated status)
  const connectedLocalAccounts = useMemo(() => {
    return localProviders.filter(provider => providerStatus[provider.id]?.authenticated)
  }, [localProviders, providerStatus])

  // Total connected accounts count
  const totalConnectedCount = connectedLocalAccounts.length + pipedreamAccounts.length + additionalAccounts.length

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    // Also update Pipedream search
    setPipedreamSearchQuery(value)
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    clearPipedreamSearch()
  }

  const handleConnectLocal = async (providerId: string) => {
    setConnectError(null)
    try {
      await connectProvider(providerId)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect'
      setConnectError(message)
    }
  }

  const handleDisconnectLocal = (provider: KeyboardApiProvider) => {
    showPopup({
      description: `Are you sure you want to disconnect ${provider.name}? You'll need to reconnect to use this connector.`,
      onConfirm: async () => {
        hidePopup()
        try {
          await disconnectProvider(provider.id)
        }
        catch (error) {
          console.error('Failed to disconnect:', error)
        }
      },
      onCancel: hidePopup,
    })
  }

  const handleConnectPipedream = async (appSlug: string) => {
    setConnectError(null)
    try {
      await connectApp(appSlug)
      handleClearSearch()
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect'
      setConnectError(message)
    }
  }

  const handleDisconnectPipedream = (account: PipedreamAccount) => {
    showPopup({
      description: `Are you sure you want to disconnect ${account.app.name}? You'll need to reconnect to use this app.`,
      onConfirm: async () => {
        hidePopup()
        try {
          await disconnectAccount(account.id)
        }
        catch (error) {
          console.error('Failed to disconnect:', error)
        }
      },
      onCancel: hidePopup,
    })
  }

  const handleDisconnectAdditional = (account: AdditionalConnectedAccount) => {
    showPopup({
      description: `Are you sure you want to disconnect ${account.displayName}? You'll need to reconnect to use this account.`,
      onConfirm: async () => {
        hidePopup()
        try {
          await disconnectAdditionalAccount(account.id)
        }
        catch (error) {
          console.error('Failed to disconnect:', error)
        }
      },
      onCancel: hidePopup,
    })
  }

  const handleRefreshAll = () => {
    refreshLocalStatus()
    refreshPipedreamAccounts()
    refreshAdditionalAccounts()
  }

  // ==========================================================================
  // Handlers - Custom Integrations
  // ==========================================================================

  const handleConnectCustom = async (integrationId: string) => {
    setConnectError(null)
    try {
      await connectIntegration(integrationId)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect'
      setConnectError(message)
    }
  }

  // ==========================================================================
  // Render
  // ==========================================================================

  const isSearching = searchQuery.trim().length > 0
  const showPipedreamResults = isSearching && pipedreamApps.length > 0
  const showPipedreamDefaults = !isSearching && pipedreamDefaultApps.length > 0
  const totalAvailableCount = filteredLocalProviders.length + pipedreamApps.length + customIntegrations.length

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Search Section */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
        <input
          type="text"
          placeholder="Search connectors (Google, Slack, Notion...)"
          value={searchQuery}
          onChange={e => handleSearchChange(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 border border-[#E5E5E5] rounded-lg focus:outline-none focus:border-[#5093B7] focus:ring-1 focus:ring-[#5093B7] text-sm"
        />
        {searchQuery && (
          <button
            onClick={handleClearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#171717]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Error Display */}
      {(connectError || localError || pipedreamAppsError || customIntegrationsError) && (
        <div className="p-3 bg-[#FEE] border border-[#D23535] rounded-lg text-[#D23535] text-sm">
          {connectError || localError || pipedreamAppsError || customIntegrationsError}
        </div>
      )}

      {/* Available Connectors Section */}
      <div>
        <div className="text-sm font-medium mb-2 text-[#737373]">
          {localLoading || customIntegrationsLoading
            ? 'Loading connectors...'
            : isSearching
              ? `${totalAvailableCount} connector${totalAvailableCount !== 1 ? 's' : ''} found`
              : 'Available Connectors'}
        </div>

        <div
          className="flex flex-col gap-2 overflow-y-auto"
          style={{ maxHeight: maxConnectorsHeight }}
        >
          {/* Local Connectors (always show first) */}
          {filteredLocalProviders.map((provider) => {
            const isAuthenticated = providerStatus[provider.id]?.authenticated
            return (
              <LocalConnectorCard
                key={`local-${provider.id}`}
                provider={provider}
                isAuthenticated={isAuthenticated || false}
                isConnecting={connectingProviderId === provider.id}
                isDisconnecting={disconnectingProviderId === provider.id}
                onConnect={() => handleConnectLocal(provider.id)}
                onDisconnect={() => handleDisconnectLocal(provider)}
              />
            )
          })}

          {/* Custom Integrations (always show after local providers) */}
          {customIntegrations.map(integration => (
            <CustomIntegrationCard
              key={`custom-${integration.id}`}
              integration={integration}
              isConnecting={connectingIntegrationId === integration.id}
              onConnect={() => handleConnectCustom(integration.id)}
            />
          ))}

          {/* Pipedream Apps (search results or defaults) */}
          {isSearching
            ? (
                <>
                  {pipedreamAppsLoading && (
                    <div className="text-center py-4 text-[#737373]">
                      Searching Pipedream apps...
                    </div>
                  )}
                  {showPipedreamResults && pipedreamApps.map(app => (
                    <PipedreamAppCard
                      key={`pipedream-${app.id}`}
                      app={app}
                      isConnecting={connectingApp === app.nameSlug}
                      onConnect={() => handleConnectPipedream(app.nameSlug)}
                    />
                  ))}
                  {!pipedreamAppsLoading && pipedreamApps.length === 0 && filteredLocalProviders.length === 0 && customIntegrations.length === 0 && (
                    <div className="text-center py-6 text-[#737373]">
                      No connectors found for "
                      {searchQuery}
                      "
                    </div>
                  )}
                </>
              )
            : (
                <>
                  {/* Show Pipedream default apps when not searching */}
                  {pipedreamDefaultAppsLoading && (
                    <div className="text-center py-4 text-[#737373]">
                      Loading more apps...
                    </div>
                  )}
                  {showPipedreamDefaults && (
                    <>
                      <div className="text-xs text-[#A3A3A3] mt-2 mb-1">More apps via Pipedream</div>
                      {pipedreamDefaultApps.map(app => (
                        <PipedreamAppCard
                          key={`pipedream-default-${app.id}`}
                          app={app}
                          isConnecting={connectingApp === app.nameSlug}
                          onConnect={() => handleConnectPipedream(app.nameSlug)}
                        />
                      ))}
                    </>
                  )}
                </>
              )}
        </div>
      </div>

      {/* Divider */}
      {totalConnectedCount > 0 && (
        <div className="h-px bg-[#E5E5E5]" />
      )}

      {/* Connected Accounts Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-[#737373]">
            Connected Accounts (
            {totalConnectedCount}
            )
          </div>
          <button
            onClick={handleRefreshAll}
            disabled={localLoading || pipedreamAccountsLoading || additionalAccountsLoading}
            className="text-[#737373] hover:text-[#171717] disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${(localLoading || pipedreamAccountsLoading || additionalAccountsLoading) ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {(pipedreamAccountsError || additionalAccountsError) && (
          <div className="p-3 bg-[#FEE] border border-[#D23535] rounded-lg text-[#D23535] text-sm mb-2">
            {pipedreamAccountsError || additionalAccountsError}
          </div>
        )}

        {(localLoading || pipedreamAccountsLoading || additionalAccountsLoading) && totalConnectedCount === 0
          ? (
              <div className="text-center py-8 text-[#737373]">
                Loading connected accounts...
              </div>
            )
          : totalConnectedCount === 0
            ? (
                <div className="text-center py-8 border border-dashed border-[#E5E5E5] rounded-lg">
                  <div className="text-[#737373] mb-2">No connected accounts yet</div>
                  <div className="text-sm text-[#A3A3A3]">
                    Connect a connector above to get started
                  </div>
                </div>
              )
            : (
                <div className="flex flex-col gap-2">
                  {/* Connected Local Accounts (show first) */}
                  {connectedLocalAccounts.map(provider => (
                    <ConnectedLocalAccountCard
                      key={`connected-local-${provider.id}`}
                      provider={provider}
                      email={providerStatus[provider.id]?.user?.email}
                      isDisconnecting={disconnectingProviderId === provider.id}
                      onDisconnect={() => handleDisconnectLocal(provider)}
                    />
                  ))}

                  {/* Connected Pipedream Accounts */}
                  {pipedreamAccounts.map(account => (
                    <ConnectedPipedreamAccountCard
                      key={`connected-pipedream-${account.id}`}
                      account={account}
                      isDisconnecting={disconnectingAccountId === account.id}
                      onDisconnect={() => handleDisconnectPipedream(account)}
                    />
                  ))}

                  {/* Connected Additional Accounts (Token Vault) */}
                  {additionalAccounts.map(account => (
                    <ConnectedAdditionalAccountCard
                      key={`connected-additional-${account.id}`}
                      account={account}
                      isDisconnecting={disconnectingAdditionalAccountId === account.id}
                      onDisconnect={() => handleDisconnectAdditional(account)}
                    />
                  ))}
                </div>
              )}
      </div>
    </div>
  )
}

export default ConnectorsContent
