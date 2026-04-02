/**
 * ConnectAppsModal
 *
 * Modal component for adding apps to the current chat thread.
 * Shows "Apps used in chat" and "All apps" sections.
 */

import { Loader2, PlusIcon, Search, X } from 'lucide-react'
import React, { useMemo, useState } from 'react'

import squaresIconUrl from '../../../../assets/icon-squares.svg'
import { useComposio } from '../../hooks/useComposio'
import { useKeyboardApiConnectors } from '../../hooks/useKeyboardApiConnectors'
import { usePipedream } from '../../hooks/usePipedream'
import { useSidebarStore } from '../../stores/sidebar-store'
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
  onDismiss?: () => void
  onDisconnected?: () => void
  chatAppIds?: string[]
  chatConnectedApps?: Array<{ chatId: string; name: string; icon: string; source: 'local' | 'pipedream' | 'composio' }>
  onAddToChat?: (chatId: string) => void
  onRemoveFromChat?: (chatId: string) => void
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
    <span className="bg-[#f0f0f0] dark:bg-[#1F1F1F] text-black dark:text-[#A9A9A9] text-[14px] font-medium px-2 py-1 rounded-full whitespace-nowrap">
      {label}
    </span>
  )
}

// =============================================================================
// Connector Row Component (+ button style)
// =============================================================================

interface ConnectorRowProps {
  icon: string
  name: string
  source: SourceType
  isConnected: boolean
  isConnecting: boolean
  disabled?: boolean
  onAdd: () => void
}

const ConnectorRow: React.FC<ConnectorRowProps> = ({
  icon,
  name,
  source,
  isConnected,
  isConnecting,
  disabled = false,
  onAdd,
}) => {
  return (
    <div className="flex items-center gap-[10px] w-full">
      <div className={`flex-1 flex items-center gap-[10px] ${!isConnected ? 'opacity-50' : ''}`}>
        <div className="bg-white dark:bg-[#2a2a2a] border border-[#e5e5e5] dark:border-[#3a3a3a] rounded-[4px] p-[5px] flex items-center shrink-0">
          <img
            src={icon}
            alt={name}
            className="w-[22px] h-[22px] object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = squaresIconUrl
            }}
          />
        </div>
        <span className="font-medium text-[14px] text-[#171717] dark:text-[#a9a9a9]">{name}</span>
      </div>
      <SourceTag source={source} />
      <button
        className="flex items-center justify-center w-[28px] h-[28px] rounded-[6px] text-[#171717] dark:text-[#a9a9a9] hover:bg-[#f0f0f0] dark:hover:bg-[#2a2a2a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={isConnecting || disabled}
        onClick={onAdd}
      >
        {isConnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusIcon className="w-4 h-4" />}
      </button>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export const ConnectAppsModal: React.FC<ConnectAppsModalProps> = ({
  isOpen,
  onClose,
  onDismiss,
  onDisconnected,
  chatAppIds,
  chatConnectedApps,
  onAddToChat,
  onRemoveFromChat,
}) => {
  const { showToast } = useSidebarStore()

  // Local (Keyboard API) connectors
  const {
    providers: localProviders,
    providersLoading: localLoading,
    providersError: localError,
    providerStatus,
    connectingProviderId,
    connectProvider,
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
    connectApp: connectPipedreamApp,
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
    connectApp: connectComposioApp,
    searchApps: searchComposioApps,
    refreshAccounts: refreshComposioAccounts,
    clearSearch: clearComposioSearch,
    fetchAppsWithTriggers: fetchComposioDefaultApps,
  } = useComposio()

  // Fetch default Composio apps on mount
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

  const chatAppIdsSet = new Set(chatAppIds ?? [])

  // Filter local providers based on search, exclude already-in-chat
  const filteredLocalProviders = useMemo(() => {
    let providers = localProviders.filter(
      provider => providerStatus[provider.id]?.authenticated && !chatAppIdsSet.has(`local:${provider.id}`),
    )
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      providers = providers.filter(provider =>
        provider.name.toLowerCase().includes(query),
      )
    }
    return providers
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localProviders, providerStatus, searchQuery, chatAppIds])

  // Filter Pipedream connected accounts, exclude already-in-chat
  const filteredPipedreamAccounts = useMemo(() => {
    let accounts = pipedreamAccounts.filter(
      account => !chatAppIdsSet.has(`pipedream:${account.app.nameSlug}`),
    )
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      accounts = accounts.filter(account =>
        account.app.name.toLowerCase().includes(query),
      )
    }
    return accounts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipedreamAccounts, searchQuery, chatAppIds])

  // Filter Composio connected accounts, exclude already-in-chat
  const filteredComposioAccounts = useMemo(() => {
    let accounts = composioAccounts.filter((account) => {
      const slug = (account.toolkit?.slug || account.appName || '').toLowerCase()
      return !chatAppIdsSet.has(`composio:${slug}`)
    })
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      accounts = accounts.filter((account) => {
        const appName = account.appName?.toLowerCase() || ''
        const toolkitSlug = account.toolkit?.slug?.toLowerCase() || ''
        return appName.includes(query) || toolkitSlug.includes(query)
      })
    }
    return accounts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composioAccounts, searchQuery, chatAppIds])

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setPipedreamSearchQuery(value)
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
      const chatId = `local:${providerId}`
      showToast(`Successfully added new account for ${displayName}!`)
      onAddToChat?.(chatId)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect'
      setConnectError(message)
    }
  }

  const handleConnectPipedream = async (appSlug: string, displayName: string) => {
    setConnectError(null)
    try {
      await connectPipedreamApp(appSlug)
      handleClearSearch()
      const chatId = `pipedream:${appSlug}`
      showToast(`Successfully added new account for ${displayName}!`)
      onAddToChat?.(chatId)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect'
      setConnectError(message)
    }
  }

  const handleConnectComposio = async (appSlug: string, displayName: string) => {
    setConnectError(null)
    try {
      await connectComposioApp(appSlug)
      const chatId = `composio:${appSlug}`
      showToast(`Successfully added new account for ${displayName}!`)
      onAddToChat?.(chatId)
      setTimeout(() => {
        refreshComposioAccounts()
      }, 2000)
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

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%] bg-white dark:bg-[#1e1e1e] max-w-[577px] w-full max-h-[720px] h-[720px] p-[20px] rounded-[20px] border border-[#dbdbdb] dark:border-[#2e2e2e] flex flex-col gap-[12px] shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {/* Header */}
          <DialogTitle className="font-medium text-[14px] text-[#737373] dark:text-[#a9a9a9] leading-normal">
            Add apps
          </DialogTitle>

          {/* Search Input */}
          <div className="relative w-full">
            <Search className="absolute left-[8px] top-1/2 -translate-y-1/2 w-[12px] h-[12px] text-[#737373] dark:text-[#a9a9a9]" />
            <input
              type="text"
              placeholder="Search 3000+ apps..."
              value={searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
              className="w-full h-[32px] pl-[30px] pr-[30px] py-[8px] bg-[#fafafa] dark:bg-[#242424] border border-[#dbdbdb] dark:border-[#2e2e2e] rounded-[12px] text-[14px] font-medium text-[#171717] dark:text-[#a9a9a9] placeholder:text-[#737373] focus:outline-none focus:border-[#a5a5a5]"
            />
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-[8px] top-1/2 -translate-y-1/2 text-[#737373] dark:text-[#a9a9a9] hover:text-[#171717]"
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

          {/* Apps used in chat */}
          <div className="flex flex-col gap-[8px] shrink-0">
            <p className="text-[13px] font-medium text-[#737373] dark:text-[#a9a9a9]">Apps used in chat</p>
            <div className="bg-[#fafafa] dark:bg-[#242424] border border-[#dbdbdb] dark:border-[#2e2e2e] rounded-[12px] p-[10px] flex flex-col gap-[8px]">
              {(chatConnectedApps ?? []).length > 0
                ? (chatConnectedApps ?? []).map(app => (
                    <div key={app.chatId} className="flex items-center gap-[10px] w-full">
                      <div className="flex-1 flex items-center gap-[10px]">
                        <div className="bg-white dark:bg-[#2a2a2a] border border-[#e5e5e5] dark:border-[#3a3a3a] rounded-[4px] p-[5px] flex items-center shrink-0">
                          <img
                            src={app.icon}
                            alt={app.name}
                            className="w-[22px] h-[22px] object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = squaresIconUrl
                            }}
                          />
                        </div>
                        <span className="font-medium text-[14px] text-[#171717] dark:text-[#a9a9a9]">{app.name}</span>
                      </div>
                      <SourceTag source={app.source} />
                      <button
                        className="flex items-center justify-center w-[28px] h-[28px] rounded-[6px] text-[#737373] dark:text-[#a9a9a9] hover:bg-[#f0f0f0] dark:hover:bg-[#2a2a2a] transition-colors"
                        onClick={() => onRemoveFromChat?.(app.chatId)}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                : (
                    <p className="font-medium text-[14px] text-[#737373] dark:text-[#a9a9a9]">None in use</p>
                  )}
            </div>
          </div>

          {/* All apps label */}
          <p className="text-[13px] font-medium text-[#737373] dark:text-[#a9a9a9] shrink-0">All apps</p>

          {/* All apps list (scrollable) */}
          <div className="flex-1 bg-[#fafafa] dark:bg-[#242424] border border-[#dbdbdb] dark:border-[#2e2e2e] rounded-[12px] p-[10px] overflow-y-auto flex flex-col gap-[10px]">
            {/* Loading State */}
            {localLoading && (
              <div className="text-center py-4 text-[#737373] dark:text-[#a9a9a9]">
                Loading connectors...
              </div>
            )}

            {/* Local Connectors (connected, not yet in chat) */}
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
                  disabled={!provider.configured}
                  onAdd={() => {
                    if (isAuthenticated) {
                      onAddToChat?.(`local:${provider.id}`)
                    }
                    else {
                      handleConnectLocal(provider.id, provider.name)
                    }
                  }}
                />
              )
            })}

            {/* Connected Pipedream Accounts (not yet in chat) */}
            {filteredPipedreamAccounts.map(account => (
              <ConnectorRow
                key={`pipedream-connected-${account.id}`}
                icon={account.app.logoUrl || squaresIconUrl}
                name={account.app.name}
                source="pipedream"
                isConnected={true}
                isConnecting={false}
                onAdd={() => onAddToChat?.(`pipedream:${account.app.nameSlug}`)}
              />
            ))}

            {/* Connected Composio Accounts (not yet in chat) */}
            {composioAccountsLoading && (
              <div className="text-center py-4 text-[#737373] dark:text-[#a9a9a9]">
                Loading Composio accounts...
              </div>
            )}
            {filteredComposioAccounts.map((account) => {
              const appIdentifier = account.appName || account.toolkit?.slug || ''
              const appIdentifierLower = appIdentifier.toLowerCase()
              const matchingApp = composioApps.find(app =>
                (app.name?.toLowerCase() || '') === appIdentifierLower
                || (app.slug?.toLowerCase() || '') === appIdentifierLower,
              )
              const logo = matchingApp?.meta?.logo || matchingApp?.logo || squaresIconUrl
              const displayName = matchingApp?.name || appIdentifier || 'Unknown App'
              const slug = (matchingApp?.slug || appIdentifier).toLowerCase()

              return (
                <ConnectorRow
                  key={`composio-connected-${account.id}`}
                  icon={logo}
                  name={displayName}
                  source="composio"
                  isConnected={true}
                  isConnecting={false}
                  onAdd={() => onAddToChat?.(`composio:${slug}`)}
                />
              )
            })}

            {/* Pipedream Apps (search results — unconnected) */}
            {isSearching && (
              <>
                {pipedreamAppsLoading && (
                  <div className="text-center py-4 text-[#737373] dark:text-[#a9a9a9]">
                    Searching Pipedream apps...
                  </div>
                )}
                {showPipedreamResults && pipedreamApps
                  .filter(app => !pipedreamAccounts.some(acc => acc.app.nameSlug === app.nameSlug))
                  .map(app => (
                    <ConnectorRow
                      key={`pipedream-${app.id}`}
                      icon={app.logoUrl || squaresIconUrl}
                      name={app.name}
                      source="pipedream"
                      isConnected={false}
                      isConnecting={pipedreamConnectingApp === app.nameSlug}
                      onAdd={() => handleConnectPipedream(app.nameSlug, app.name)}
                    />
                  ))}
              </>
            )}

            {/* Composio Apps (search results — unconnected) */}
            {isSearching && (
              <>
                {composioAppsLoading && (
                  <div className="text-center py-4 text-[#737373] dark:text-[#a9a9a9]">
                    Searching Composio apps...
                  </div>
                )}
                {composioApps
                  .filter(app =>
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
                      onAdd={() => handleConnectComposio(app.slug, app.name || app.slug || 'Unknown')}
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
                {showPipedreamDefaults && pipedreamDefaultApps
                  .filter(app => !pipedreamAccounts.some(acc => acc.app.nameSlug === app.nameSlug))
                  .map(app => (
                    <ConnectorRow
                      key={`pipedream-default-${app.id}`}
                      icon={app.logoUrl || squaresIconUrl}
                      name={app.name}
                      source="pipedream"
                      isConnected={false}
                      isConnecting={pipedreamConnectingApp === app.nameSlug}
                      onAdd={() => handleConnectPipedream(app.nameSlug, app.name)}
                    />
                  ))}
              </>
            )}

            {/* Composio Default Apps (when not searching) */}
            {!isSearching && (
              <>
                {composioAppsLoading && (
                  <div className="text-center py-4 text-[#737373] dark:text-[#a9a9a9]">
                    Loading Composio apps...
                  </div>
                )}
                {composioApps
                  .filter(app =>
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
                      onAdd={() => handleConnectComposio(app.slug, app.name || app.slug || 'Unknown')}
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

          {/* Dismiss and continue anyway (when opened from chat flow) */}
          {onDismiss && (
            <button
              onClick={() => {
                onDismiss()
                onClose()
              }}
              className="text-[14px] font-medium text-[#737373] dark:text-[#a9a9a9] hover:text-[#171717] transition-colors self-start"
            >
              Dismiss and continue anyway
            </button>
          )}

          {/* Support Link */}
          <p className="text-[14px] font-medium text-[#a5a5a5] leading-normal">
            Need help? Reach out at
            {' '}
            <button
              className="font-semibold text-[#171717] dark:text-[#F5F5F5] hover:underline"
              onClick={() => window.electronAPI.openExternalUrl('mailto:support@keyboard.dev')}
            >
              support@keyboard.dev
            </button>
          </p>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}

export default ConnectAppsModal
