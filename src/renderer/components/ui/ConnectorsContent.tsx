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
import { KeyboardApiProvider, useKeyboardApiConnectors } from '../../hooks/useKeyboardApiConnectors'
import { usePipedream } from '../../hooks/usePipedream'
import { usePopup } from '../../hooks/usePopup'
import { PipedreamAccount } from '../../services/pipedream-service'
import { isWeb } from '../../web/platform'

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

type FilterType = 'all' | 'local' | 'pipedream'

// =============================================================================
// Tag Component
// =============================================================================

type SourceType = 'local' | 'pipedream' | 'cloud'

interface SourceTagProps {
  source: SourceType
}

export const SourceTag: React.FC<SourceTagProps> = ({ source }) => {
  const label = source === 'local' ? 'Local' : 'Pipedream'

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
  const isWebMode = isWeb()

  const tabs: { id: FilterType, label: string }[] = [
    { id: 'all', label: 'All' },
    // Hide local filter in web mode
    ...(!isWebMode ? [{ id: 'local' as FilterType, label: 'Local' }] : []),
    { id: 'pipedream', label: 'Pipedream' },
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
  const isWebMode = isWeb()

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
    connectingApp,
    disconnectingAccountId,
    connectApp,
    disconnectAccount,
    setSearchQuery: setPipedreamSearchQuery,
    clearSearch: clearPipedreamSearch,
  } = usePipedream()

  const [searchQuery, setSearchQuery] = useState('')
  const [connectError, setConnectError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<FilterType>('all')

  // ==========================================================================
  // Computed Values
  // ==========================================================================

  // Filter local providers based on search and filter type
  const filteredLocalProviders = useMemo(() => {
    // Hide local in web mode
    if (isWebMode) {
      return []
    }

    // Hide local if pipedream filter is active
    if (filterType === 'pipedream') {
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
  }, [localProviders, searchQuery, filterType, isWebMode])

  // Filter Pipedream apps based on filter type
  const filteredPipedreamApps = useMemo(() => {
    // Hide pipedream if local filter is active
    if (filterType === 'local') {
      return []
    }
    return pipedreamApps
  }, [pipedreamApps, filterType])

  // Filter Pipedream default apps based on filter type
  const filteredPipedreamDefaultApps = useMemo(() => {
    // Hide pipedream if local filter is active
    if (filterType === 'local') {
      return []
    }
    return pipedreamDefaultApps
  }, [pipedreamDefaultApps, filterType])

  // Filter Pipedream accounts based on filter type
  const filteredPipedreamAccounts = useMemo(() => {
    if (filterType === 'local') {
      return []
    }
    return pipedreamAccounts
  }, [pipedreamAccounts, filterType])

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
            {!isWebMode && (
              <>
                Local apps are managed by Keyboard. Pipedream apps are powered by
                {' '}
              </>
            )}
            {isWebMode && (
              <>
                Pipedream apps are powered by
                {' '}
              </>
            )}
            <button
              className="underline decoration-solid hover:text-[#737373]"
              onClick={() => window.electronAPI.openExternalUrl('https://pipedream.com/')}
            >
              Pipedream
            </button>
            .
          </p>
        )}
      </div>

      {/* Error Display */}
      {(connectError || (!isWebMode && localError) || pipedreamAppsError) && (
        <div className="p-3 bg-[#FEE] border border-[#D23535] rounded-lg text-[#D23535] text-sm">
          {connectError || (!isWebMode && localError) || pipedreamAppsError}
        </div>
      )}

      {/* Unified Connectors List (bordered container) */}
      <div
        className="border border-[#e5e5e5] rounded-[6px] p-[15px] flex flex-col gap-[10px] overflow-y-auto"
        style={{ maxHeight: maxConnectorsHeight }}
      >
        {/* Loading State */}
        {!isWebMode && localLoading && (
          <div className="text-center py-4 text-[#737373]">
            Loading connectors...
          </div>
        )}

        {/* Local Connectors - Only show in Electron mode */}
        {!isWebMode && filteredLocalProviders.map((provider) => {
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
            isDisconnecting={disconnectingAccountId === account.id}
            onConnect={() => {}}
            onDisconnect={() => handleDisconnectPipedream(account)}
          />
        ))}

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
                isConnecting={connectingApp === app.nameSlug}
                isDisconnecting={false}
                onConnect={() => handleConnectPipedream(app.nameSlug)}
                onDisconnect={() => {}}
              />
            ))}
            {!pipedreamAppsLoading && filteredPipedreamApps.length === 0 && filteredLocalProviders.length === 0 && (
              <div className="text-center py-6 text-[#737373]">
                No connectors found for "
                {searchQuery}
                "
              </div>
            )}
          </>
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
                isConnecting={connectingApp === app.nameSlug}
                isDisconnecting={false}
                onConnect={() => handleConnectPipedream(app.nameSlug)}
                onDisconnect={() => {}}
              />
            ))}
          </>
        )}

        {/* Empty State */}
        {(!isWebMode ? !localLoading : true) && filteredLocalProviders.length === 0 && filteredPipedreamAccounts.length === 0 && !showPipedreamResults && !showPipedreamDefaults && (
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
