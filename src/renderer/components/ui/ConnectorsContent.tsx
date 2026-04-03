/**
 * ConnectorsContent
 *
 * Core reusable component for managing connectors (local + Pipedream).
 * Contains search, connector listings, and connected accounts.
 * Used by ConnectorsPanel (settings) and Integrations (onboarding).
 */

import { ChevronDown, ExternalLink, Search, X } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import squaresIconUrl from '../../../../assets/icon-squares.svg'
import { useComposio } from '../../hooks/useComposio'
import { KeyboardApiProvider, useKeyboardApiConnectors } from '../../hooks/useKeyboardApiConnectors'
import { usePipedream } from '../../hooks/usePipedream'
import { usePopup } from '../../hooks/usePopup'
import { useSidebarStore } from '../../stores/sidebar-store'
import { ComposioConnectedAccount } from '../../services/composio-service'
import { PipedreamAccount } from '../../services/pipedream-service'

// =============================================================================
// Types
// =============================================================================

const BROWSE_PAGE_SIZE = 20

export interface ConnectorsContentProps {
  /** Max height for the available connectors list. When omitted the list fills available space. */
  maxConnectorsHeight?: string
  /** Additional className for the container */
  className?: string
  /** Show "Local apps are managed by..." description text */
  showDescription?: boolean
  /** Show "See our docs..." link at bottom */
  showDocsLink?: boolean
}

type FilterType = 'all' | 'local' | 'pipedream' | 'composio'
type ConnectionFilterOption = 'connected' | 'not-connected'
type SortOrder = 'default' | 'alphabetical'

function applySort<T>(items: T[], getName: (item: T) => string, sort: SortOrder): T[] {
  if (sort !== 'alphabetical') return items
  return [...items].sort((a, b) => getName(a).localeCompare(getName(b)))
}

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
    <span className="bg-[#f0f0f0] dark:bg-[#1F1F1F] text-black dark:text-[#A9A9A9] text-[14px] font-medium px-2 py-1 rounded-full">
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
              ? 'bg-[#f0f0f0] dark:bg-[#1F1F1F] text-black dark:text-[#A9A9A9]'
              : 'text-[#a5a5a5] hover:text-[#737373] dark:hover:text-[#a9a9a9]'
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
        <div className="bg-white dark:bg-[#2a2a2a] border border-[#e5e5e5] dark:border-[#3a3a3a] rounded-[4px] p-[5px] flex items-center">
          <img
            src={icon}
            alt={name}
            className="w-6 h-6 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = squaresIconUrl
            }}
          />
        </div>
        <span className="font-medium text-[14px] text-[#171717] dark:text-[#a9a9a9]">{name}</span>
      </div>

      {/* Middle: Source Tag */}
      <SourceTag source={source} />

      {/* Right: Action Button */}
      {isConnected
        ? (
            <button
              className="px-3 py-1 text-[14px] font-medium text-[#d23535] dark:text-[#FC8E8F] hover:bg-[#FEE2E2] dark:hover:bg-[#FC8E8F]/10 rounded-[4px] transition-colors disabled:opacity-50"
              disabled={isDisconnecting}
              onClick={onDisconnect}
            >
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          )
        : (
            <button
              className="flex items-center gap-1 px-3 py-1 bg-white dark:bg-[#171717] border border-[#e5e5e5] dark:border-[#2e2e2e] rounded-[4px] text-[14px] font-medium text-[#171717] dark:text-[#f5f5f5] hover:border-[#ccc] dark:hover:border-[#3a3a3a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
  maxConnectorsHeight,
  className = '',
  showDescription = false,
  showDocsLink = false,
}) => {
  const { showPopup, hidePopup } = usePopup()
  const { showToast } = useSidebarStore()

  const [browsableLimit, setBrowsableLimit] = useState(BROWSE_PAGE_SIZE)
  const listRef = useRef<HTMLDivElement>(null)

  const handleListScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 150) {
      setBrowsableLimit(prev => prev + BROWSE_PAGE_SIZE)
    }
  }, [])

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
  const [connectionFilters, setConnectionFilters] = useState<ConnectionFilterOption[]>([])
  const [sortOrder, setSortOrder] = useState<SortOrder>('default')
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false)

  const toggleConnectionFilter = (f: ConnectionFilterOption) => {
    setConnectionFilters(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])
  }
  const filterDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!filterDropdownOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setFilterDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [filterDropdownOpen])

  useEffect(() => {
    setBrowsableLimit(BROWSE_PAGE_SIZE)
  }, [searchQuery, filterType, connectionFilters, sortOrder])

  // ==========================================================================
  // Computed Values
  // ==========================================================================

  // Filter local providers based on search, filter type, connection filter, and sort
  const filteredLocalProviders = useMemo(() => {
    if (filterType === 'pipedream' || filterType === 'composio') return []

    let providers = localProviders
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      providers = providers.filter(p => p.name.toLowerCase().includes(query))
    }
    const onlyConnected = connectionFilters.length === 1 && connectionFilters.includes('connected')
    const onlyNotConnected = connectionFilters.length === 1 && connectionFilters.includes('not-connected')
    if (onlyConnected) providers = providers.filter(p => providerStatus[p.id]?.authenticated)
    else if (onlyNotConnected) providers = providers.filter(p => !providerStatus[p.id]?.authenticated)
    return applySort(providers, p => p.name, sortOrder)
  }, [localProviders, searchQuery, filterType, connectionFilters, sortOrder, providerStatus])

  // Filter Pipedream apps (not connected) based on filter type, connection filter, and sort
  const filteredPipedreamApps = useMemo(() => {
    if (filterType === 'local' || filterType === 'composio') return []
    if (connectionFilters.length > 0 && !connectionFilters.includes('not-connected')) return []
    return applySort(pipedreamApps, a => a.name, sortOrder)
  }, [pipedreamApps, filterType, connectionFilters, sortOrder])

  // Filter Pipedream default apps based on filter type, connection filter, and sort
  const filteredPipedreamDefaultApps = useMemo(() => {
    if (filterType === 'local' || filterType === 'composio') return []
    if (connectionFilters.length > 0 && !connectionFilters.includes('not-connected')) return []
    return applySort(pipedreamDefaultApps, a => a.name, sortOrder)
  }, [pipedreamDefaultApps, filterType, connectionFilters, sortOrder])

  // Filter Pipedream accounts (connected) based on filter type, connection filter, and sort
  const filteredPipedreamAccounts = useMemo(() => {
    if (filterType === 'local' || filterType === 'composio') return []
    if (connectionFilters.length > 0 && !connectionFilters.includes('connected')) return []
    return applySort(pipedreamAccounts, a => a.app.name, sortOrder)
  }, [pipedreamAccounts, filterType, connectionFilters, sortOrder])

  // Filter Composio accounts (connected) based on search, filter type, connection filter, and sort
  const filteredComposioAccounts = useMemo(() => {
    if (filterType === 'local' || filterType === 'pipedream') return []
    if (connectionFilters.length > 0 && !connectionFilters.includes('connected')) return []
    let accounts = composioAccounts
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      accounts = accounts.filter((account) => {
        const appName = account.appName?.toLowerCase() || ''
        const toolkitSlug = account.toolkit?.slug?.toLowerCase() || ''
        return appName.includes(query) || toolkitSlug.includes(query)
      })
    }
    return applySort(accounts, a => a.appName || a.toolkit?.slug || '', sortOrder)
  }, [composioAccounts, searchQuery, filterType, connectionFilters, sortOrder])

  // Filter Composio apps (not connected) based on filter type, connection filter, and sort
  const filteredComposioApps = useMemo(() => {
    if (filterType === 'local' || filterType === 'pipedream') return []
    if (connectionFilters.length > 0 && !connectionFilters.includes('not-connected')) return []
    return applySort(composioApps, a => a.name || a.slug || '', sortOrder)
  }, [composioApps, filterType, connectionFilters, sortOrder])

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

  const handleConnectLocal = async (providerId: string, displayName: string) => {
    setConnectError(null)
    try {
      await connectProvider(providerId)
      showToast(`Successfully added new account for ${displayName}!`)
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

  const handleConnectPipedream = async (appSlug: string, displayName: string) => {
    setConnectError(null)
    try {
      await connectPipedreamApp(appSlug)
      handleClearSearch()
      showToast(`Successfully added new account for ${displayName}!`)
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

  const handleConnectComposio = async (appSlug: string, displayName: string) => {
    setConnectError(null)
    try {
      await connectComposioApp(appSlug)
      showToast(`Successfully added new account for ${displayName}!`)
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
    <div className={`flex flex-col gap-[15px] ${!maxConnectorsHeight ? 'h-full' : ''} ${className}`}>
      {/* Filter Tabs and Search Row */}
      <div className="flex flex-col gap-[10px]">
        {/* Row 1: Source filter + Search */}
        <div className="flex items-center justify-between">
          <FilterTabs activeFilter={filterType} onFilterChange={setFilterType} />
          <div className="relative w-[276px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#737373] dark:text-[#a9a9a9]" />
            <input
              type="text"
              placeholder="Search from 3,000+ apps"
              value={searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
              className="w-full h-8 pl-8 pr-8 py-2 bg-[#FAFAFA] dark:bg-[#242424] border border-[#e5e5e5] dark:border-[#2e2e2e] rounded-[5px] text-[14px] font-medium text-[#171717] dark:text-[#a9a9a9] placeholder:text-[#737373] focus:outline-none focus:border-[#a5a5a5]"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#737373] dark:text-[#a9a9a9] hover:text-[#171717]"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Filter by + Sort by dropdowns */}
        <div className="flex items-center gap-[8px]">
          <div ref={filterDropdownRef} className="relative">
            <button
              onClick={() => setFilterDropdownOpen(prev => !prev)}
              className="flex items-center gap-[4px] text-[14px] font-medium text-[#737373] dark:text-[#a9a9a9] bg-[#FAFAFA] dark:bg-[#242424] border border-[#e5e5e5] dark:border-[#2e2e2e] rounded-[5px] px-2 py-1 cursor-pointer hover:border-[#ccc] dark:hover:border-[#444] transition-colors"
            >
              Filter by
              <ChevronDown className="w-[12px] h-[12px]" />
            </button>
            {filterDropdownOpen && (
              <div className="absolute top-full left-0 mt-[4px] bg-[#FAFAFA] dark:bg-[#242424] border border-[#e5e5e5] dark:border-[#2e2e2e] rounded-[6px] py-[6px] z-10 min-w-[148px] shadow-sm">
                {(['connected', 'not-connected'] as const).map(f => (
                  <label
                    key={f}
                    className="flex items-center gap-[8px] px-[10px] py-[5px] cursor-pointer hover:bg-[#f0f0f0] dark:hover:bg-[#1F1F1F]"
                  >
                    <input
                      type="checkbox"
                      checked={connectionFilters.includes(f)}
                      onChange={() => toggleConnectionFilter(f)}
                      className="w-[13px] h-[13px] accent-[#171717] dark:accent-[#a9a9a9] cursor-pointer"
                    />
                    <span className="text-[14px] font-medium text-[#171717] dark:text-[#a9a9a9]">
                      {f === 'connected' ? 'Connected' : 'Not connected'}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <select
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value as SortOrder)}
            className="text-[14px] font-medium text-[#737373] dark:text-[#a9a9a9] bg-[#FAFAFA] dark:bg-[#242424] border border-[#e5e5e5] dark:border-[#2e2e2e] rounded-[5px] px-2 py-1 outline-none cursor-pointer"
          >
            <option value="default">Sort by</option>
            <option value="alphabetical">A-Z</option>
          </select>
        </div>

        {/* Row 3: Active filter/sort pills */}
        {(connectionFilters.length > 0 || sortOrder !== 'default') && (
          <div className="flex items-center gap-[6px]">
            {connectionFilters.map(f => (
              <span key={f} className="flex items-center gap-[4px] px-[8px] py-[3px] bg-[#f0f0f0] dark:bg-[#1F1F1F] text-[#171717] dark:text-[#a9a9a9] text-[13px] font-medium rounded-full">
                {f === 'connected' ? 'Connected' : 'Not connected'}
                <button
                  onClick={() => toggleConnectionFilter(f)}
                  className="ml-[2px] text-[#737373] dark:text-[#a9a9a9] hover:text-[#171717] dark:hover:text-white"
                  aria-label="Clear filter"
                >
                  <X className="w-[10px] h-[10px]" />
                </button>
              </span>
            ))}
            {sortOrder !== 'default' && (
              <span className="flex items-center gap-[4px] px-[8px] py-[3px] bg-[#f0f0f0] dark:bg-[#1F1F1F] text-[#171717] dark:text-[#a9a9a9] text-[13px] font-medium rounded-full">
                A-Z
                <button
                  onClick={() => setSortOrder('default')}
                  className="ml-[2px] text-[#737373] dark:text-[#a9a9a9] hover:text-[#171717] dark:hover:text-white"
                  aria-label="Clear sort"
                >
                  <X className="w-[10px] h-[10px]" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Description Text */}
      {showDescription && (
        <p className="text-[14px] font-medium text-[#a5a5a5]">
          Local apps are managed by Keyboard. Pipedream apps are powered by
          {' '}
          <button
            className="underline decoration-solid hover:text-[#737373] dark:hover:text-[#a9a9a9]"
            onClick={() => window.electronAPI.openExternalUrl('https://pipedream.com/')}
          >
            Pipedream
          </button>
          . Composio apps are powered by
          {' '}
          <button
            className="underline decoration-solid hover:text-[#737373] dark:hover:text-[#a9a9a9]"
            onClick={() => window.electronAPI.openExternalUrl('https://composio.dev/')}
          >
            Composio
          </button>
          .
        </p>
      )}

      {/* Error Display */}
      {(connectError || localError || pipedreamAppsError || composioAccountsError || composioAppsError) && (
        <div className="p-3 bg-[#FEE] border border-[#D23535] rounded-lg text-[#D23535] text-sm">
          {connectError || localError || pipedreamAppsError || composioAccountsError || composioAppsError}
        </div>
      )}

      {/* Unified Connectors List (bordered container) */}
      <div
        ref={listRef}
        onScroll={handleListScroll}
        className={`bg-[#FAFAFA] dark:bg-[#242424] border border-[#e5e5e5] dark:border-[#2e2e2e] rounded-[6px] p-[15px] flex flex-col gap-[10px] overflow-y-auto ${!maxConnectorsHeight ? 'flex-1 min-h-0' : ''}`}
        style={maxConnectorsHeight ? { maxHeight: maxConnectorsHeight } : undefined}
      >
        {/* Loading State */}
        {localLoading && (
          <div className="text-center py-4 text-[#737373] dark:text-[#a9a9a9]">
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
              onConnect={() => handleConnectLocal(provider.id, provider.name)}
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
          <div className="text-center py-4 text-[#737373] dark:text-[#a9a9a9]">
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
              <div className="text-center py-4 text-[#737373] dark:text-[#a9a9a9]">
                Searching Pipedream apps...
              </div>
            )}
            {showPipedreamResults && filteredPipedreamApps.slice(0, browsableLimit).map(app => (
              <ConnectorRow
                key={`pipedream-${app.id}`}
                icon={app.logoUrl || squaresIconUrl}
                name={app.name}
                source="pipedream"
                isConnected={false}
                isConnecting={pipedreamConnectingApp === app.nameSlug}
                isDisconnecting={false}
                onConnect={() => handleConnectPipedream(app.nameSlug, app.name)}
                onDisconnect={() => {}}
              />
            ))}
          </>
        )}

        {/* Composio Apps (search results) */}
        {isSearching && (filterType === 'all' || filterType === 'composio') && (
          <>
            {composioAppsLoading && (
              <div className="text-center py-4 text-[#737373] dark:text-[#a9a9a9]">
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
              .slice(0, browsableLimit)
              .map(app => (
                <ConnectorRow
                  key={`composio-${app.slug}`}
                  icon={app.meta?.logo || app.logo || squaresIconUrl}
                  name={app.name || app.slug || 'Unknown'}
                  source="composio"
                  isConnected={false}
                  isConnecting={composioConnectingApp === app.slug}
                  isDisconnecting={false}
                  onConnect={() => handleConnectComposio(app.slug, app.name || app.slug || 'Unknown')}
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
          <div className="text-center py-6 text-[#737373] dark:text-[#a9a9a9]">
            No connectors found for "
            {searchQuery}
            "
          </div>
        )}

        {/* Pipedream Default Apps (when not searching) */}
        {!isSearching && (
          <>
            {pipedreamDefaultAppsLoading && (
              <div className="text-center py-4 text-[#737373] dark:text-[#a9a9a9]">
                Loading more apps...
              </div>
            )}
            {showPipedreamDefaults && filteredPipedreamDefaultApps.slice(0, browsableLimit).map(app => (
              <ConnectorRow
                key={`pipedream-default-${app.id}`}
                icon={app.logoUrl || squaresIconUrl}
                name={app.name}
                source="pipedream"
                isConnected={false}
                isConnecting={pipedreamConnectingApp === app.nameSlug}
                isDisconnecting={false}
                onConnect={() => handleConnectPipedream(app.nameSlug, app.name)}
                onDisconnect={() => {}}
              />
            ))}
          </>
        )}

        {/* Composio Default Apps (when not searching and on Composio/All tab) */}
        {!isSearching && (filterType === 'all' || filterType === 'composio') && (
          <>
            {composioAppsLoading && (
              <div className="text-center py-4 text-[#737373] dark:text-[#a9a9a9]">
                Loading Composio apps...
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
              .slice(0, browsableLimit)
              .map(app => (
                <ConnectorRow
                  key={`composio-default-${app.slug}`}
                  icon={app.meta?.logo || app.logo || squaresIconUrl}
                  name={app.name || app.slug || 'Unknown'}
                  source="composio"
                  isConnected={false}
                  isConnecting={composioConnectingApp === app.slug}
                  isDisconnecting={false}
                  onConnect={() => handleConnectComposio(app.slug, app.name || app.slug || 'Unknown')}
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
          <div className="text-center py-6 text-[#737373] dark:text-[#a9a9a9]">
            No connectors available
          </div>
        )}
      </div>

    </div>
  )
}

export default ConnectorsContent
