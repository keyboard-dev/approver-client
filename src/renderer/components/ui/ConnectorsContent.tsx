/**
 * ConnectorsContent
 *
 * Core reusable component for managing connectors (local + Pipedream).
 * Contains search, connector listings, and connected accounts.
 * Used by ConnectorsPanel (settings) and Integrations (onboarding).
 */

import { ExternalLink, Search, X } from 'lucide-react'
import React, { useMemo, useState } from 'react'

import squaresIconUrl from '../../../../assets/icon-squares.svg'
import { useComposio } from '../../hooks/useComposio'
import { KeyboardApiProvider, useKeyboardApiConnectors } from '../../hooks/useKeyboardApiConnectors'
import { usePipedream } from '../../hooks/usePipedream'
import { usePopup } from '../../hooks/usePopup'
import { ComposioConnectedAccount } from '../../services/composio-service'
import { PipedreamAccount } from '../../services/pipedream-service'

// =============================================================================
// Types
// =============================================================================

export interface ConnectorsContentProps {
  /** Max height for the available connectors list */
  maxConnectorsHeight?: string
  /** Additional className for the container */
  className?: string
  /** Show "Local apps are managed by..." description text */
  showDescription?: boolean
  /** Show "See our docs..." link at bottom */
  showDocsLink?: boolean
}

type FilterType = 'all' | 'local' | 'pipedream' | 'composio'

// =============================================================================
// Tag Component
// =============================================================================

type SourceType = 'local' | 'pipedream' | 'composio' | 'cloud'

interface SourceTagProps {
  source: SourceType
}

export const SourceTag: React.FC<SourceTagProps> = ({ source }) => {
  const labelMap: Record<SourceType, string> = {
    local: 'Local',
    pipedream: 'Pipedream',
    composio: 'Composio',
    cloud: 'Cloud',
  }
  const label = labelMap[source] || source

  return (
    <span className="bg-[#f0f0f0] text-black text-[14px] font-medium px-2 py-1 rounded-full">
      {label}
    </span>
  )
}

// =============================================================================
// Filter Tabs Component
// =============================================================================

interface FilterTabsProps {
  activeFilter: FilterType
  onFilterChange: (filter: FilterType) => void
}

const FilterTabs: React.FC<FilterTabsProps> = ({ activeFilter, onFilterChange }) => {
  const tabs: { id: FilterType, label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'local', label: 'Local' },
    { id: 'pipedream', label: 'Pipedream' },
    { id: 'composio', label: 'Composio' },
  ]

  return (
    <div className="flex items-center">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onFilterChange(tab.id)}
          className={`px-2 py-1 text-[14px] font-medium rounded-full transition-colors ${
            activeFilter === tab.id
              ? 'bg-[#f0f0f0] text-black'
              : 'text-[#a5a5a5] hover:text-[#737373]'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

// =============================================================================
// Connector Row Component (Unified design for all connector types)
// =============================================================================

interface ConnectorRowProps {
  icon: string
  name: string
  source: SourceType
  isConnected: boolean
  isConnecting: boolean
  isDisconnecting: boolean
  disabled?: boolean
  onConnect: () => void
  onDisconnect: () => void
}

const ConnectorRow: React.FC<ConnectorRowProps> = ({
  icon,
  name,
  source,
  isConnected,
  isConnecting,
  isDisconnecting,
  disabled = false,
  onConnect,
  onDisconnect,
}) => {
  return (
    <div className="flex items-center gap-[10px] w-full">
      {/* Left section: Icon + Name (dimmed if not connected) */}
      <div className={`flex-1 flex items-center gap-[10px] ${!isConnected ? 'opacity-50' : ''}`}>
        <div className="bg-white border border-[#e5e5e5] rounded-[4px] p-[5px] flex items-center">
          <img
            src={icon}
            alt={name}
            className="w-6 h-6 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = squaresIconUrl
            }}
          />
        </div>
        <span className="font-medium text-[14px] text-[#171717]">{name}</span>
      </div>

      {/* Middle: Source Tag */}
      <SourceTag source={source} />

      {/* Right: Action Button */}
      {isConnected
        ? (
            <button
              className="px-3 py-1 text-[14px] font-medium text-[#d23535] hover:bg-[#FEE2E2] rounded-[4px] transition-colors disabled:opacity-50"
              disabled={isDisconnecting}
              onClick={onDisconnect}
            >
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          )
        : (
            <button
              className="flex items-center gap-1 px-3 py-1 bg-white border border-[#e5e5e5] rounded-[4px] text-[14px] font-medium text-[#171717] hover:border-[#ccc] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isConnecting || disabled}
              onClick={onConnect}
            >
              <ExternalLink className="w-4 h-4" />
              {isConnecting ? 'Connecting...' : 'Connect'}
            </button>
          )}
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export const ConnectorsContent: React.FC<ConnectorsContentProps> = ({
  maxConnectorsHeight = '400px',
  className = '',
  showDescription = false,
  showDocsLink = false,
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
  } = useKeyboardApiConnectors()

  // Pipedream connectors
  const {
    accounts: pipedreamAccounts,
    apps: pipedreamApps,
    appsLoading: pipedreamAppsLoading,
    appsError: pipedreamAppsError,
    defaultApps: pipedreamDefaultApps,
    defaultAppsLoading: pipedreamDefaultAppsLoading,
    connectingApp: pipedreamConnectingApp,
    disconnectingAccountId: pipedreamDisconnectingAccountId,
    connectApp: connectPipedreamApp,
    disconnectAccount: disconnectPipedreamAccount,
    setSearchQuery: setPipedreamSearchQuery,
    clearSearch: clearPipedreamSearch,
  } = usePipedream()

  // Composio connectors
  const {
    accounts: composioAccounts,
    accountsLoading: composioAccountsLoading,
    accountsError: composioAccountsError,
    apps: composioApps,
    appsLoading: composioAppsLoading,
    appsError: composioAppsError,
    connectingApp: composioConnectingApp,
    disconnectingAccountId: composioDisconnectingAccountId,
    connectApp: connectComposioApp,
    disconnectAccount: disconnectComposioAccount,
    searchApps: searchComposioApps,
    refreshAccounts: refreshComposioAccounts,
    clearSearch: clearComposioSearch,
    fetchAppsWithTriggers: fetchComposioDefaultApps,
  } = useComposio()

  // Fetch default Composio apps on mount for logo lookups
  React.useEffect(() => {
    fetchComposioDefaultApps()
  }, [fetchComposioDefaultApps])

  const [searchQuery, setSearchQuery] = useState('')
  const [connectError, setConnectError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<FilterType>('all')

  // ==========================================================================
  // Computed Values
  // ==========================================================================

  // Filter local providers based on search and filter type
  const filteredLocalProviders = useMemo(() => {
    // Hide local if pipedream or composio filter is active
    if (filterType === 'pipedream' || filterType === 'composio') {
      return []
    }

    let providers = localProviders
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      providers = providers.filter(provider =>
        provider.name.toLowerCase().includes(query),
      )
    }
    return providers
  }, [localProviders, searchQuery, filterType])

  // Filter Pipedream apps based on filter type
  const filteredPipedreamApps = useMemo(() => {
    // Hide pipedream if local or composio filter is active
    if (filterType === 'local' || filterType === 'composio') {
      return []
    }
    return pipedreamApps
  }, [pipedreamApps, filterType])

  // Filter Pipedream default apps based on filter type
  const filteredPipedreamDefaultApps = useMemo(() => {
    // Hide pipedream if local or composio filter is active
    if (filterType === 'local' || filterType === 'composio') {
      return []
    }
    return pipedreamDefaultApps
  }, [pipedreamDefaultApps, filterType])

  // Filter Pipedream accounts based on filter type
  const filteredPipedreamAccounts = useMemo(() => {
    if (filterType === 'local' || filterType === 'composio') {
      return []
    }
    return pipedreamAccounts
  }, [pipedreamAccounts, filterType])

  // Filter Composio accounts based on search and filter type
  const filteredComposioAccounts = useMemo(() => {
    if (filterType === 'local' || filterType === 'pipedream') {
      return []
    }
    let accounts = composioAccounts
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      accounts = accounts.filter((account) => {
        const appName = account.appName?.toLowerCase() || ''
        const toolkitSlug = account.toolkit?.slug?.toLowerCase() || ''
        return appName.includes(query) || toolkitSlug.includes(query)
      })
    }
    return accounts
  }, [composioAccounts, searchQuery, filterType])

  // Filter Composio apps based on filter type
  const filteredComposioApps = useMemo(() => {
    // Hide composio if local or pipedream filter is active
    if (filterType === 'local' || filterType === 'pipedream') {
      return []
    }
    return composioApps
  }, [composioApps, filterType])

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    // Also update Pipedream search
    setPipedreamSearchQuery(value)
    // Also update Composio search
    if (value.trim()) {
      searchComposioApps(value)
    }
    else {
      clearComposioSearch()
    }
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    clearPipedreamSearch()
    clearComposioSearch()
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
        catch {
          // Error handled by disconnect function
        }
      },
      onCancel: hidePopup,
    })
  }

  const handleConnectPipedream = async (appSlug: string) => {
    setConnectError(null)
    try {
      await connectPipedreamApp(appSlug)
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
          await disconnectPipedreamAccount(account.id)
        }
        catch {
          // Error handled by disconnect function
        }
      },
      onCancel: hidePopup,
    })
  }

  const handleConnectComposio = async (appName: string) => {
    setConnectError(null)
    try {
      await connectComposioApp(appName)
      // Refresh accounts after initiating connection (user will complete OAuth in browser)
      setTimeout(() => {
        refreshComposioAccounts()
      }, 2000)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect'
      setConnectError(message)
    }
  }

  const handleDisconnectComposio = (account: ComposioConnectedAccount) => {
    showPopup({
      description: `Are you sure you want to disconnect ${account.appName}? You'll need to reconnect to use this app.`,
      onConfirm: async () => {
        hidePopup()
        try {
          await disconnectComposioAccount(account.id)
        }
        catch {
          // Error handled by disconnect function
        }
      },
      onCancel: hidePopup,
    })
  }

  // ==========================================================================
  // Render
  // ==========================================================================

  const isSearching = searchQuery.trim().length > 0
  const showPipedreamResults = isSearching && filteredPipedreamApps.length > 0
  const showPipedreamDefaults = !isSearching && filteredPipedreamDefaultApps.length > 0

  return (
    <div className={`flex flex-col gap-[15px] ${className}`}>
      {/* Filter Tabs and Search Row */}
      <div className="flex flex-col gap-[10px]">
        <div className="flex items-center justify-between">
          <FilterTabs activeFilter={filterType} onFilterChange={setFilterType} />
          <div className="relative w-[276px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#737373]" />
            <input
              type="text"
              placeholder="Search app name..."
              value={searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
              className="w-full h-8 pl-8 pr-8 py-2 bg-white border border-[#e5e5e5] rounded-[5px] text-[14px] font-medium text-[#171717] placeholder:text-[#737373] focus:outline-none focus:border-[#a5a5a5]"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#171717]"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Description Text */}
        {showDescription && (
          <p className="text-[14px] font-medium text-[#a5a5a5]">
            Local apps are managed by Keyboard. Pipedream apps are powered by
            {' '}
            <button
              className="underline decoration-solid hover:text-[#737373]"
              onClick={() => window.electronAPI.openExternalUrl('https://pipedream.com/')}
            >
              Pipedream
            </button>
            . Composio apps are powered by
            {' '}
            <button
              className="underline decoration-solid hover:text-[#737373]"
              onClick={() => window.electronAPI.openExternalUrl('https://composio.dev/')}
            >
              Composio
            </button>
            .
          </p>
        )}
      </div>

      {/* Error Display */}
      {(connectError || localError || pipedreamAppsError || composioAccountsError || composioAppsError) && (
        <div className="p-3 bg-[#FEE] border border-[#D23535] rounded-lg text-[#D23535] text-sm">
          {connectError || localError || pipedreamAppsError || composioAccountsError || composioAppsError}
        </div>
      )}

      {/* Unified Connectors List (bordered container) */}
      <div
        className="border border-[#e5e5e5] rounded-[6px] p-[15px] flex flex-col gap-[10px] overflow-y-auto"
        style={{ maxHeight: maxConnectorsHeight }}
      >
        {/* Loading State */}
        {localLoading && (
          <div className="text-center py-4 text-[#737373]">
            Loading connectors...
          </div>
        )}

        {/* Local Connectors */}
        {filteredLocalProviders.map((provider) => {
          const isAuthenticated = providerStatus[provider.id]?.authenticated || false
          return (
            <ConnectorRow
              key={`local-${provider.id}`}
              icon={provider.icon}
              name={provider.name}
              source="local"
              isConnected={isAuthenticated}
              isConnecting={connectingProviderId === provider.id}
              isDisconnecting={disconnectingProviderId === provider.id}
              disabled={!provider.configured}
              onConnect={() => handleConnectLocal(provider.id)}
              onDisconnect={() => handleDisconnectLocal(provider)}
            />
          )
        })}

        {/* Connected Pipedream Accounts */}
        {filteredPipedreamAccounts.map(account => (
          <ConnectorRow
            key={`pipedream-connected-${account.id}`}
            icon={account.app.logoUrl || squaresIconUrl}
            name={account.app.name}
            source="pipedream"
            isConnected={true}
            isConnecting={false}
            isDisconnecting={pipedreamDisconnectingAccountId === account.id}
            onConnect={() => {}}
            onDisconnect={() => handleDisconnectPipedream(account)}
          />
        ))}

        {/* Connected Composio Accounts */}
        {composioAccountsLoading && filterType !== 'local' && filterType !== 'pipedream' && (
          <div className="text-center py-4 text-[#737373]">
            Loading Composio accounts...
          </div>
        )}
        {filteredComposioAccounts.map((account) => {
          // Get app identifier - prefer appName, fallback to toolkit.slug
          const appIdentifier = account.appName || account.toolkit?.slug || ''
          const appIdentifierLower = appIdentifier.toLowerCase()

          // Find matching app for logo and display name
          const matchingApp = composioApps.find(app =>
            (app.name?.toLowerCase() || '') === appIdentifierLower
            || (app.slug?.toLowerCase() || '') === appIdentifierLower,
          )

          // Get logo from matched app or use default
          const logo = matchingApp?.meta?.logo || matchingApp?.logo || squaresIconUrl

          // Get display name - prefer matched app name, fallback to identifier, then 'Unknown App'
          const displayName = matchingApp?.name || appIdentifier || 'Unknown App'

          return (
            <ConnectorRow
              key={`composio-connected-${account.id}`}
              icon={logo}
              name={displayName}
              source="composio"
              isConnected={true}
              isConnecting={false}
              isDisconnecting={composioDisconnectingAccountId === account.id}
              onConnect={() => {}}
              onDisconnect={() => handleDisconnectComposio(account)}
            />
          )
        })}

        {/* Pipedream Apps (search results) */}
        {isSearching && (
          <>
            {pipedreamAppsLoading && (
              <div className="text-center py-4 text-[#737373]">
                Searching Pipedream apps...
              </div>
            )}
            {showPipedreamResults && filteredPipedreamApps.map(app => (
              <ConnectorRow
                key={`pipedream-${app.id}`}
                icon={app.logoUrl || squaresIconUrl}
                name={app.name}
                source="pipedream"
                isConnected={false}
                isConnecting={pipedreamConnectingApp === app.nameSlug}
                isDisconnecting={false}
                onConnect={() => handleConnectPipedream(app.nameSlug)}
                onDisconnect={() => {}}
              />
            ))}
          </>
        )}

        {/* Composio Apps (search results) */}
        {isSearching && (filterType === 'all' || filterType === 'composio') && (
          <>
            {composioAppsLoading && (
              <div className="text-center py-4 text-[#737373]">
                Searching Composio apps...
              </div>
            )}
            {filteredComposioApps
              .filter(app =>
                // Filter out already connected apps
                !composioAccounts.some((acc) => {
                  const accAppName = acc.appName?.toLowerCase() || ''
                  const accToolkitSlug = acc.toolkit?.slug?.toLowerCase() || ''
                  const appName = app.name?.toLowerCase() || ''
                  const appSlug = app.slug?.toLowerCase() || ''
                  return accAppName === appName || accAppName === appSlug
                    || accToolkitSlug === appName || accToolkitSlug === appSlug
                }),
              )
              .map(app => (
                <ConnectorRow
                  key={`composio-${app.slug}`}
                  icon={app.meta?.logo || app.logo || squaresIconUrl}
                  name={app.name || app.slug || 'Unknown'}
                  source="composio"
                  isConnected={false}
                  isConnecting={composioConnectingApp === app.slug}
                  isDisconnecting={false}
                  onConnect={() => handleConnectComposio(app.slug)}
                  onDisconnect={() => {}}
                />
              ))}
          </>
        )}

        {/* No results message */}
        {isSearching
          && !pipedreamAppsLoading
          && !composioAppsLoading
          && filteredPipedreamApps.length === 0
          && filteredComposioApps.length === 0
          && filteredLocalProviders.length === 0
          && filteredComposioAccounts.length === 0 && (
          <div className="text-center py-6 text-[#737373]">
            No connectors found for "
            {searchQuery}
            "
          </div>
        )}

        {/* Pipedream Default Apps (when not searching) */}
        {!isSearching && (
          <>
            {pipedreamDefaultAppsLoading && (
              <div className="text-center py-4 text-[#737373]">
                Loading more apps...
              </div>
            )}
            {showPipedreamDefaults && filteredPipedreamDefaultApps.map(app => (
              <ConnectorRow
                key={`pipedream-default-${app.id}`}
                icon={app.logoUrl || squaresIconUrl}
                name={app.name}
                source="pipedream"
                isConnected={false}
                isConnecting={pipedreamConnectingApp === app.nameSlug}
                isDisconnecting={false}
                onConnect={() => handleConnectPipedream(app.nameSlug)}
                onDisconnect={() => {}}
              />
            ))}
          </>
        )}

        {/* Composio Default Apps (when not searching and on Composio/All tab) */}
        {!isSearching && (filterType === 'all' || filterType === 'composio') && (
          <>
            {composioAppsLoading && (
              <div className="text-center py-4 text-[#737373]">
                Loading Composio apps...
              </div>
            )}
            {composioApps
              .filter(app =>
                // Filter out already connected apps
                !composioAccounts.some((acc) => {
                  const accAppName = acc.appName?.toLowerCase() || ''
                  const accToolkitSlug = acc.toolkit?.slug?.toLowerCase() || ''
                  const appName = app.name?.toLowerCase() || ''
                  const appSlug = app.slug?.toLowerCase() || ''
                  return accAppName === appName || accAppName === appSlug
                    || accToolkitSlug === appName || accToolkitSlug === appSlug
                }),
              )
              .map(app => (
                <ConnectorRow
                  key={`composio-default-${app.slug}`}
                  icon={app.meta?.logo || app.logo || squaresIconUrl}
                  name={app.name || app.slug || 'Unknown'}
                  source="composio"
                  isConnected={false}
                  isConnecting={composioConnectingApp === app.slug}
                  isDisconnecting={false}
                  onConnect={() => handleConnectComposio(app.slug)}
                  onDisconnect={() => {}}
                />
              ))}
          </>
        )}

        {/* Empty State */}
        {!localLoading
          && !composioAccountsLoading
          && !composioAppsLoading
          && filteredLocalProviders.length === 0
          && filteredPipedreamAccounts.length === 0
          && filteredComposioAccounts.length === 0
          && !showPipedreamResults
          && !showPipedreamDefaults
          && composioApps.length === 0
          && !isSearching && (
          <div className="text-center py-6 text-[#737373]">
            No connectors available
          </div>
        )}
      </div>

      {/* Docs Link */}
      {showDocsLink && (
        <p className="text-[14px] font-medium text-[#a5a5a5]">
          See our
          {' '}
          <button
            className="font-semibold text-[#171717] hover:underline"
            onClick={() => window.electronAPI.openExternalUrl('https://docs.keyboard.dev/')}
          >
            docs
          </button>
          {' '}
          to learn how to connect any app.
        </p>
      )}
    </div>
  )
}

export default ConnectorsContent
