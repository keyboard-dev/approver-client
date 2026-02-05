import { ChevronDownIcon, ExternalLink, Loader2, PlusIcon } from 'lucide-react'
import type { FC } from 'react'
import { useState } from 'react'
import squaresIconUrl from '../../../../assets/icon-squares.svg'
import { useComposio } from '../../hooks/useComposio'
import { useKeyboardApiConnectors } from '../../hooks/useKeyboardApiConnectors'
import { usePipedream } from '../../hooks/usePipedream'
import { usePopup } from '../../hooks/usePopup'
import { cn } from '../../lib/utils'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { ConnectAppsModal } from '../ui/ConnectAppsModal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip'

// =============================================================================
// Types
// =============================================================================

type SourceType = 'local' | 'pipedream' | 'composio'

interface ConnectedApp {
  id: string
  name: string
  icon: string
  source: SourceType
  isConnected: boolean
  isConnecting?: boolean
  isDisconnecting?: boolean
}

// =============================================================================
// Source Tag Component
// =============================================================================

const SourceTag: FC<{ source: SourceType }> = ({ source }) => {
  const labelMap: Record<SourceType, string> = {
    local: 'Local',
    pipedream: 'Pipedream',
    composio: 'Composio',
  }
  return (
    <span className="bg-[#f0f0f0] text-black text-[11px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap">
      {labelMap[source]}
    </span>
  )
}

// =============================================================================
// Connected App Row Component
// =============================================================================

interface ConnectedAppRowProps {
  app: ConnectedApp
  onConnect: () => void
  onDisconnect: () => void
}

const ConnectedAppRow: FC<ConnectedAppRowProps> = ({ app, onConnect, onDisconnect }) => {
  return (
    <div className="flex items-center gap-[6px] w-full min-w-0">
      {/* Icon + Name */}
      <div className="flex-1 flex items-center gap-[6px] min-w-0">
        <div className="bg-white border border-[#e5e5e5] rounded-[4px] p-[4px] flex items-center shrink-0">
          <img
            src={app.icon}
            alt={app.name}
            className="w-[18px] h-[18px] object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = squaresIconUrl
            }}
          />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="font-medium text-[13px] text-[#171717] truncate min-w-0 cursor-default">
              {app.name}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-[#171717] text-white border-none">
            <p>{app.name}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Source Tag */}
      <SourceTag source={app.source} />

      {/* Action Button */}
      {app.isConnecting || app.isDisconnecting
        ? (
            <Loader2 className="w-5 h-5 animate-spin text-[#737373] shrink-0" />
          )
        : app.isConnected
          ? (
              <button
                className="px-2 py-0.5 text-[12px] font-medium text-[#d23535] hover:bg-[#FEE2E2] rounded-[4px] transition-colors shrink-0"
                onClick={onDisconnect}
              >
                Remove
              </button>
            )
          : (
              <button
                className="flex items-center gap-1 px-2 py-0.5 bg-white border border-[#e5e5e5] rounded-[4px] text-[12px] font-medium text-[#171717] hover:border-[#ccc] transition-colors shrink-0"
                onClick={onConnect}
              >
                <ExternalLink className="w-3 h-3" />
                Connect
              </button>
            )}
    </div>
  )
}

interface ProviderConfig {
  id: string
  name: string
  models: Array<{ id: string, name: string }>
  supportsMCP?: boolean
}

interface ThreadSidebarProps {
  isOpen: boolean
  onClose?: () => void
  // Provider/Model selection
  providers?: ProviderConfig[]
  availableProviders?: string[]
  selectedProvider?: string
  selectedModel?: string
  onProviderChange?: (providerId: string, defaultModelId?: string) => void
  onModelChange?: (modelId: string) => void
  // MCP status
  mcpConnected?: boolean
  mcpAbilities?: number
  mcpError?: string | null
  onRetryMCP?: () => void
  // Connector usage tracking - only show connectors that have been used in this chat
  // Format: 'local-providerId', 'pipedream-accountId', 'composio-accountId'
  usedConnectorIds?: string[]
}

export const ThreadSidebar: FC<ThreadSidebarProps> = ({
  isOpen,
  providers = [],
  availableProviders = [],
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
  mcpConnected,
  mcpAbilities,
  mcpError,
  onRetryMCP,
  usedConnectorIds = [],
}) => {
  const [modelPreferencesOpen, setModelPreferencesOpen] = useState(true)
  const [connectorsOpen, setConnectorsOpen] = useState(true)
  const [connectAppsModalOpen, setConnectAppsModalOpen] = useState(false)

  const { showPopup, hidePopup } = usePopup()

  // Local connectors
  const {
    providers: localProviders,
    providerStatus,
    connectingProviderId,
    disconnectingProviderId,
    connectProvider,
    disconnectProvider,
  } = useKeyboardApiConnectors()

  // Pipedream connectors
  const {
    accounts: pipedreamAccounts,
    disconnectingAccountId: pipedreamDisconnectingAccountId,
    disconnectAccount: disconnectPipedreamAccount,
  } = usePipedream()

  // Composio connectors
  const {
    accounts: composioAccounts,
    apps: composioApps,
    disconnectingAccountId: composioDisconnectingAccountId,
    disconnectAccount: disconnectComposioAccount,
  } = useComposio()

  if (!isOpen) return null

  // Build list of all connected apps (for reference when filtering)
  const allConnectedApps: ConnectedApp[] = [
    // Local providers that are authenticated
    ...localProviders
      .filter(provider => providerStatus[provider.id]?.authenticated)
      .map(provider => ({
        id: `local-${provider.id}`,
        name: provider.name,
        icon: provider.icon,
        source: 'local' as SourceType,
        isConnected: true,
        isDisconnecting: disconnectingProviderId === provider.id,
      })),
    // Pipedream connected accounts
    ...pipedreamAccounts.map(account => ({
      id: `pipedream-${account.id}`,
      name: account.app.name,
      icon: account.app.logoUrl || squaresIconUrl,
      source: 'pipedream' as SourceType,
      isConnected: true,
      isDisconnecting: pipedreamDisconnectingAccountId === account.id,
    })),
    // Composio connected accounts
    ...composioAccounts.map((account) => {
      const appIdentifier = account.appName || account.toolkit?.slug || ''
      const matchingApp = composioApps.find(app =>
        (app.name?.toLowerCase() || '') === appIdentifier.toLowerCase()
        || (app.slug?.toLowerCase() || '') === appIdentifier.toLowerCase(),
      )
      return {
        id: `composio-${account.id}`,
        name: matchingApp?.name || appIdentifier || 'Unknown App',
        icon: matchingApp?.meta?.logo || matchingApp?.logo || squaresIconUrl,
        source: 'composio' as SourceType,
        isConnected: true,
        isDisconnecting: composioDisconnectingAccountId === account.id,
      }
    }),
  ]

  // Filter to only show connectors that have been used in this chat
  // If usedConnectorIds is empty, no connectors are shown (correct for new chats)
  const connectedApps = allConnectedApps.filter(app =>
    usedConnectorIds.includes(app.id),
  )

  const handleDisconnect = (app: ConnectedApp) => {
    showPopup({
      description: `Are you sure you want to disconnect ${app.name}?`,
      onConfirm: async () => {
        hidePopup()
        if (app.source === 'local') {
          const providerId = app.id.replace('local-', '')
          await disconnectProvider(providerId)
        }
        else if (app.source === 'pipedream') {
          const accountId = app.id.replace('pipedream-', '')
          await disconnectPipedreamAccount(accountId)
        }
        else if (app.source === 'composio') {
          const accountId = app.id.replace('composio-', '')
          await disconnectComposioAccount(accountId)
        }
      },
      onCancel: hidePopup,
    })
  }

  const currentProvider = providers.find(p => p.id === selectedProvider)
  const currentModelName = currentProvider?.models.find(m => m.id === selectedModel)?.name || 'Select model'

  return (
    <div className="flex flex-col gap-[10px] h-full w-full overflow-x-clip overflow-y-auto">
      {/* Overview Header */}
      <div className="flex items-center justify-center px-[15px]">
        <p className="flex-1 font-semibold text-[14px] text-[#737373] leading-normal">
          Overview
        </p>
      </div>

      {/* Model Preferences Section */}
      <div className="flex flex-col gap-[10px] px-[15px]">
        <button
          type="button"
          onClick={() => setModelPreferencesOpen(!modelPreferencesOpen)}
          className="flex gap-[10px] items-center justify-center w-full text-left"
        >
          <ChevronDownIcon
            className={cn(
              'size-[24px] text-[#171717] transition-transform duration-200',
              !modelPreferencesOpen && '-rotate-90',
            )}
          />
          <p className="flex-1 font-semibold text-[16px] text-[#171717] leading-normal">
            Model preferences
          </p>
        </button>

        {modelPreferencesOpen && (
          <div className="flex flex-col gap-[10px]">
            {/* Provider Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="bg-[#fafafa] border border-[#dbdbdb] flex h-[44px] items-center justify-between p-[10px] rounded-[12px] w-full hover:bg-[#f5f5f5] transition-colors"
                >
                  <p className="font-medium text-[14px] text-[#737373] leading-normal">
                    {currentProvider?.name || 'Select provider'}
                  </p>
                  <ChevronDownIcon className="size-[24px] text-[#737373]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[270px]">
                {providers
                  .filter(p => availableProviders.includes(p.id))
                  .map(provider => (
                    <DropdownMenuItem
                      key={provider.id}
                      onClick={() => onProviderChange?.(provider.id, provider.models[0]?.id)}
                      className="cursor-pointer"
                    >
                      <span className={cn(
                        'font-medium text-[14px]',
                        provider.id === selectedProvider ? 'text-[#171717]' : 'text-[#737373]',
                      )}
                      >
                        {provider.name}
                      </span>
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Model Dropdown */}
            {currentProvider && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="bg-[#fafafa] border border-[#dbdbdb] flex h-[44px] items-center justify-between p-[10px] rounded-[12px] w-full hover:bg-[#f5f5f5] transition-colors"
                  >
                    <p className="font-medium text-[14px] text-[#737373] leading-normal">
                      {currentModelName}
                    </p>
                    <ChevronDownIcon className="size-[24px] text-[#737373]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[270px]">
                  {currentProvider.models.map(model => (
                    <DropdownMenuItem
                      key={model.id}
                      onClick={() => onModelChange?.(model.id)}
                      className="cursor-pointer"
                    >
                      <span className={cn(
                        'font-medium text-[14px]',
                        model.id === selectedModel ? 'text-[#171717]' : 'text-[#737373]',
                      )}
                      >
                        {model.name}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-[1px] bg-[#dbdbdb] w-full" />

      {/* Connectors Section */}
      <div className="flex flex-col gap-[10px] px-[15px]">
        <button
          type="button"
          onClick={() => setConnectorsOpen(!connectorsOpen)}
          className="flex gap-[10px] items-center justify-center w-full text-left"
        >
          <ChevronDownIcon
            className={cn(
              'size-[24px] text-[#171717] transition-transform duration-200',
              !connectorsOpen && '-rotate-90',
            )}
          />
          <p className="flex-1 font-semibold text-[16px] text-[#171717] leading-normal">
            Connectors
          </p>
        </button>

        {connectorsOpen && (
          <>
            <p className="font-medium text-[14px] text-[#737373] leading-normal">
              Apps used in this chat
            </p>

            {/* Connected Apps List */}
            <TooltipProvider delayDuration={300}>
              <div className="bg-[#fafafa] border border-[#dbdbdb] flex flex-col gap-[8px] p-[10px] rounded-[12px] w-full overflow-hidden">
                {connectedApps.length > 0
                  ? (
                      connectedApps.map(app => (
                        <ConnectedAppRow
                          key={app.id}
                          app={app}
                          onConnect={() => {}}
                          onDisconnect={() => handleDisconnect(app)}
                        />
                      ))
                    )
                  : (
                      <p className="font-medium text-[14px] text-[#737373] leading-normal">
                        None in use
                      </p>
                    )}
              </div>
            </TooltipProvider>

            {/* Connect more apps button */}
            <button
              type="button"
              onClick={() => setConnectAppsModalOpen(true)}
              className="bg-[#fafafa] border border-[#dbdbdb] flex gap-[4px] items-center justify-center px-[20px] py-[4px] rounded-[12px] self-start hover:bg-[#f5f5f5] transition-colors"
            >
              <PlusIcon className="size-[24px] text-[#171717]" />
              <p className="font-medium text-[14px] text-[#171717] leading-normal">
                Connect more apps
              </p>
            </button>

            {/* Connect Apps Modal */}
            <ConnectAppsModal
              isOpen={connectAppsModalOpen}
              onClose={() => setConnectAppsModalOpen(false)}
            />

            {/* Docs link */}
            <div className="flex flex-col gap-[6px] w-full">
              <p className="font-medium text-[14px] text-[#a5a5a5] leading-normal">
                See our
                {' '}
                <span className="font-semibold text-[#171717] cursor-pointer hover:underline">
                  docs
                </span>
                {' '}
                to learn more about how connectors work or how to connect any app.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
