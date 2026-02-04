/**
 * ConnectAppsModal
 *
 * Modal component for connecting apps/connectors.
 * Displays a searchable list of available connectors with connect/disconnect actions.
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
import {
  Dialog,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from './dialog'
import * as DialogPrimitive from '@radix-ui/react-dialog'

// =============================================================================
// Types
// =============================================================================

export interface ConnectAppsModalProps {
  isOpen: boolean
  onClose: () => void
}

type SourceType = 'local' | 'pipedream' | 'composio' | 'cloud'

// =============================================================================
// Source Tag Component
// =============================================================================

interface SourceTagProps {
  source: SourceType
}

const SourceTag: React.FC<SourceTagProps> = ({ source }) => {
  const labelMap: Record<SourceType, string> = {
    local: 'Local',
    pipedream: 'Pipedream',
    composio: 'Composio',
    cloud: 'Cloud',
  }
  const label = labelMap[source] || source

  return (
    <span className="bg-[#f0f0f0] text-black text-[14px] font-medium px-2 py-1 rounded-full whitespace-nowrap">
      {label}
    </span>
  )
}

// =============================================================================
// Connector Row Component
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
        <div className="bg-white border border-[#e5e5e5] rounded-[4px] p-[5px] flex items-center shrink-0">
          <img
            src={icon}
            alt={name}
            className="w-[22px] h-[22px] object-contain"
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

export const ConnectAppsModal: React.FC<ConnectAppsModalProps> = ({
  isOpen,
  onClose,
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
    if (isOpen) {
      fetchComposioDefaultApps()
    }
  }, [isOpen, fetchComposioDefaultApps])

  const [searchQuery, setSearchQuery] = useState('')
  const [connectError, setConnectError] = useState<string | null>(null)

  // ==========================================================================
  // Computed Values
  // ==========================================================================

  // Filter local providers based on search
  const filteredLocalProviders = useMemo(() => {
    let providers = localProviders
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      providers = providers.filter(provider =>
        provider.name.toLowerCase().includes(query),
      )
    }
    return providers
  }, [localProviders, searchQuery])

  // Filter Pipedream accounts
  const filteredPipedreamAccounts = useMemo(() => {
    if (!searchQuery.trim()) return pipedreamAccounts
    const query = searchQuery.toLowerCase()
    return pipedreamAccounts.filter(account =>
      account.app.name.toLowerCase().includes(query),
    )
  }, [pipedreamAccounts, searchQuery])

  // Filter Composio accounts based on search
  const filteredComposioAccounts = useMemo(() => {
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
  }, [composioAccounts, searchQuery])

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
  const showPipedreamResults = isSearching && pipedreamApps.length > 0
  const showPipedreamDefaults = !isSearching && pipedreamDefaultApps.length > 0

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] bg-white max-w-[577px] w-full max-h-[720px] h-[720px] p-[20px] rounded-[20px] border border-[#dbdbdb] flex flex-col gap-[6px] shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {/* Header */}
          <DialogTitle className="font-medium text-[14px] text-[#737373] leading-normal">
            Connect apps
          </DialogTitle>

        {/* Search Input */}
        <div className="relative w-full">
          <Search className="absolute left-[8px] top-1/2 -translate-y-1/2 w-[12px] h-[12px] text-[#737373]" />
          <input
            type="text"
            placeholder="Search 3000+ apps..."
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            className="w-full h-[32px] pl-[30px] pr-[30px] py-[8px] bg-[#fafafa] border border-[#dbdbdb] rounded-[12px] text-[14px] font-medium text-[#171717] placeholder:text-[#737373] focus:outline-none focus:border-[#a5a5a5]"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-[8px] top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#171717]"
            >
              <X className="w-[12px] h-[12px]" />
            </button>
          )}
        </div>

        {/* Error Display */}
        {(connectError || localError || pipedreamAppsError || composioAccountsError || composioAppsError) && (
          <div className="p-3 bg-[#FEE] border border-[#D23535] rounded-lg text-[#D23535] text-sm">
            {connectError || localError || pipedreamAppsError || composioAccountsError || composioAppsError}
          </div>
        )}

        {/* Connectors List */}
        <div className="flex-1 bg-[#fafafa] border border-[#dbdbdb] rounded-[12px] p-[10px] overflow-y-auto flex flex-col gap-[10px]">
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
          {composioAccountsLoading && (
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
              {showPipedreamResults && pipedreamApps.map(app => (
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
          {isSearching && (
            <>
              {composioAppsLoading && (
                <div className="text-center py-4 text-[#737373]">
                  Searching Composio apps...
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
            && pipedreamApps.length === 0
            && composioApps.length === 0
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
              {showPipedreamDefaults && pipedreamDefaultApps.map(app => (
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

          {/* Composio Default Apps (when not searching) */}
          {!isSearching && (
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
        <p className="text-[14px] font-medium text-[#a5a5a5] leading-normal">
          See our
          {' '}
          <button
            className="font-semibold text-[#171717] hover:underline"
            onClick={() => window.electronAPI.openExternalUrl('https://docs.keyboard.dev/')}
          >
            docs
          </button>
          {' '}
          to learn more about how connectors work or how to connect any app.
        </p>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}

export default ConnectAppsModal
