import { AlertCircleIcon, CheckCircle2Icon, ChevronDownIcon, ExternalLink, Loader2, PencilLineIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import type { FC } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAssistantState } from '@assistant-ui/react'
import { fetchConnectorNotes, getConnectorNote, setConnectorNote } from '../../services/context-service'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import squaresIconUrl from '../../../../assets/icon-squares.svg'
import { useComposio } from '../../hooks/useComposio'
import { useKeyboardApiConnectors } from '../../hooks/useKeyboardApiConnectors'
import { usePipedream } from '../../hooks/usePipedream'
import { cn } from '../../lib/utils'
import { ConnectAppsModal } from '../ui/ConnectAppsModal'
import { useSidebarStore } from '../../stores/sidebar-store'
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
  chatId: string
  name: string
  icon: string
  darkIcon?: string
  source: SourceType
  appSlug: string
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
    <span className="bg-[#f0f0f0] dark:bg-[#2e2e2e] text-black dark:text-[#f5f5f5] text-[11px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap">
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

const ConnectedAppRow: FC<ConnectedAppRowProps & { notesReady: boolean }> = ({ app, onConnect, onDisconnect, notesReady }) => {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const observer = new MutationObserver(() => setIsDark(document.documentElement.classList.contains('dark')))
    observer.observe(document.documentElement, { attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  const iconSrc = (isDark && app.darkIcon) ? app.darkIcon : app.icon

  const [noteOpen, setNoteOpen] = useState(false)
  const [noteValue, setNoteValue] = useState('')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hasNote = notesReady && getConnectorNote(app.source, app.appSlug).length > 0

  const openDialog = useCallback(() => {
    setNoteValue(getConnectorNote(app.source, app.appSlug))
    setNoteOpen(true)
    setTimeout(() => textareaRef.current?.focus(), 100)
  }, [app.source, app.appSlug])

  const handleSave = useCallback(async () => {
    setSaving(true)
    await setConnectorNote(app.source, app.appSlug, noteValue)
    setSaving(false)
    setNoteOpen(false)
  }, [app.source, app.appSlug, noteValue])

  const handleDelete = useCallback(async () => {
    setSaving(true)
    await setConnectorNote(app.source, app.appSlug, '')
    setSaving(false)
    setNoteValue('')
    setNoteOpen(false)
  }, [app.source, app.appSlug])

  return (
    <>
      <div className="flex items-center gap-[6px] w-full min-w-0">
        {/* Icon + Name */}
        <div className="flex-1 flex items-center gap-[6px] min-w-0">
          <div className="bg-white dark:bg-[#292929] border border-[#e5e5e5] dark:border-[#3a3a3a] rounded-[4px] p-[4px] flex items-center shrink-0">
            <img
              src={iconSrc}
              alt={app.name}
              className="w-[18px] h-[18px] object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = squaresIconUrl
              }}
            />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-medium text-[13px] text-[#171717] dark:text-[#a9a9a9] truncate min-w-0 cursor-default">
                {app.name}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-[#171717] text-white border-none">
              <p>{app.name}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Note button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={openDialog}
              className={cn(
                'p-0.5 rounded transition-colors shrink-0',
                hasNote
                  ? 'text-blue-600 hover:bg-blue-50'
                  : 'text-[#b0b0b0] hover:text-[#737373] dark:hover:text-[#a9a9a9] hover:bg-[#f0f0f0]',
              )}
            >
              <PencilLineIcon className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-[#171717] text-white border-none">
            <p>{hasNote ? 'Edit note' : 'Add note for AI'}</p>
          </TooltipContent>
        </Tooltip>

        {/* Action Button */}
        {app.isConnecting || app.isDisconnecting
          ? (
              <Loader2 className="w-5 h-5 animate-spin text-[#737373] dark:text-[#a9a9a9] shrink-0" />
            )
          : app.isConnected
            ? (
                <button
                  className="px-2 py-0.5 text-[12px] font-medium text-[#d23535] dark:text-[#FC8E8F] hover:bg-[#FEE2E2] dark:hover:bg-[#FC8E8F]/10 rounded-[4px] transition-colors shrink-0"
                  onClick={onDisconnect}
                >
                  Remove
                </button>
              )
            : (
                <button
                  className="flex items-center gap-1 px-2 py-0.5 bg-white dark:bg-[#2a2a2a] border border-[#e5e5e5] dark:border-[#3a3a3a] rounded-[4px] text-[12px] font-medium text-[#171717] dark:text-[#f5f5f5] hover:border-[#ccc] transition-colors shrink-0"
                  onClick={onConnect}
                >
                  <ExternalLink className="w-3 h-3" />
                  Connect
                </button>
              )}
      </div>

      {/* Note dialog */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <img
                src={iconSrc}
                alt={app.name}
                className="w-5 h-5 object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = squaresIconUrl
                }}
              />
              Notes for
              {' '}
              {app.name}
            </DialogTitle>
            <DialogDescription>
              Add instructions the AI should follow when using this service. For example: which API version to use, workspace IDs, or special considerations.
            </DialogDescription>
          </DialogHeader>

          <textarea
            ref={textareaRef}
            value={noteValue}
            onChange={e => setNoteValue(e.target.value)}
            placeholder="e.g. Use the v2 REST API, not GraphQL. My workspace ID is ABC123. Always include the X-Custom-Header..."
            className="w-full text-[14px] text-[#171717] dark:text-[#f5f5f5] bg-[#fafafa] dark:bg-[#242424] border border-[#dbdbdb] dark:border-[#2e2e2e] rounded-lg px-3 py-2.5 resize-none outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors min-h-[120px]"
            rows={5}
          />

          <DialogFooter className="flex-row justify-between sm:justify-between">
            {hasNote
              ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#d23535] dark:text-[#FC8E8F] hover:bg-red-50 dark:hover:bg-[#FC8E8F]/10 rounded-md transition-colors disabled:opacity-50"
                  >
                    <Trash2Icon className="w-3.5 h-3.5" />
                    Delete note
                  </button>
                )
              : <div />}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setNoteOpen(false)}
                disabled={saving}
                className="px-3 py-1.5 text-[13px] font-medium text-[#737373] dark:text-[#a9a9a9] hover:bg-[#f0f0f0] dark:hover:bg-[#2a2a2a] rounded-md transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !noteValue.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 text-[13px] font-medium text-white bg-[#171717] hover:bg-[#333] rounded-md transition-colors disabled:opacity-50"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save
              </button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface ProviderConfig {
  id: string
  name: string
  models: Array<{ id: string, name: string }>
  supportsMCP?: boolean
}

interface OrgProviderData {
  configured: boolean
  provider_type?: string
  display_name?: string
  is_active?: boolean
  allowed_models?: string[] | null
}

const PROVIDER_TYPE_LABELS: Record<string, string> = {
  'anthropic': 'Anthropic (Direct API)',
  'aws-bedrock': 'AWS Bedrock',
  'gcp-vertex': 'GCP Vertex AI',
  'digitalocean': 'DigitalOcean',
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
  // Org provider (passed from parent to avoid duplicate fetch)
  orgProvider?: OrgProviderData | null
  // Thinking mode
  thinkingEnabled?: boolean
  onThinkingChange?: (enabled: boolean) => void
  // MCP status
  mcpConnected?: boolean
  mcpAbilities?: number
  mcpError?: string | null
  onRetryMCP?: () => void
}

export const ThreadSidebar: FC<ThreadSidebarProps> = ({
  isOpen,
  providers = [],
  availableProviders = [],
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
  orgProvider,
  thinkingEnabled,
  onThinkingChange,
  mcpConnected,
  mcpAbilities,
  mcpError,
  onRetryMCP,
}) => {
  const [modelPreferencesOpen, setModelPreferencesOpen] = useState(true)
  const [connectorsOpen, setConnectorsOpen] = useState(true)
  const [connectAppsModalOpen, setConnectAppsModalOpen] = useState(false)
  const [notesReady, setNotesReady] = useState(false)

  const { pathname } = useLocation()

  const { chatAppsByThread, addChatApp, removeChatApp } = useSidebarStore()

  // Fetch connector notes on mount
  useEffect(() => {
    fetchConnectorNotes().then(() => setNotesReady(true)).catch(() => setNotesReady(true))
  }, [])

  // Local connectors
  const {
    providers: localProviders,
    providerStatus,
    connectingProviderId,
    disconnectingProviderId,
    refreshStatus: refreshLocalStatus,
  } = useKeyboardApiConnectors()

  // Pipedream connectors
  const {
    accounts: pipedreamAccounts,
    refreshAccounts: refreshPipedreamAccounts,
  } = usePipedream()

  // Composio connectors
  const {
    accounts: composioAccounts,
    apps: composioApps,
    refreshAccounts: refreshComposioAccounts,
  } = useComposio()

  // Collect unique tool names called in the current thread (stable via joined string)
  const usedToolNamesKey = useAssistantState(({ thread }) => {
    const names = new Set<string>()
    for (const message of thread.messages) {
      if (message.role === 'assistant') {
        for (const part of message.content) {
          if ((part as { type: string }).type === 'tool-call') {
            names.add((part as { toolName: string }).toolName)
          }
        }
      }
    }
    return [...names].sort().join(',')
  })

  // Build list of connected apps (before early return so connectedAppsRef can be set)
  const connectedApps: ConnectedApp[] = [
    // Local providers that are authenticated
    ...localProviders
      .filter(provider => providerStatus[provider.id]?.authenticated)
      .map(provider => ({
        id: `local-${provider.id}`,
        chatId: `local:${provider.id}`,
        name: provider.name,
        icon: provider.icon,
        darkIcon: provider.darkIcon,
        source: 'local' as SourceType,
        appSlug: provider.id,
        isConnected: true,
        isDisconnecting: disconnectingProviderId === provider.id,
      })),
    // Pipedream connected accounts
    ...pipedreamAccounts.map(account => ({
      id: `pipedream-${account.id}`,
      chatId: `pipedream:${account.app.nameSlug}`,
      name: account.app.name,
      icon: account.app.logoUrl || squaresIconUrl,
      darkIcon: account.app.darkLogoUrl,
      source: 'pipedream' as SourceType,
      appSlug: account.app.nameSlug,
      isConnected: true,
      isDisconnecting: false,
    })),
    // Composio connected accounts
    ...composioAccounts.map((account) => {
      const appIdentifier = account.appName || account.toolkit?.slug || ''
      const matchingApp = composioApps.find(app =>
        (app.name?.toLowerCase() || '') === appIdentifier.toLowerCase()
        || (app.slug?.toLowerCase() || '') === appIdentifier.toLowerCase(),
      )
      const slug = matchingApp?.slug || appIdentifier
      return {
        id: `composio-${account.id}`,
        chatId: `composio:${slug.toLowerCase()}`,
        name: matchingApp?.name || appIdentifier || 'Unknown App',
        icon: matchingApp?.meta?.logo || matchingApp?.logo || squaresIconUrl,
        darkIcon: matchingApp?.meta?.darkLogo || matchingApp?.darkLogo,
        source: 'composio' as SourceType,
        appSlug: slug,
        isConnected: true,
        isDisconnecting: false,
      }
    }),
  ]

  const connectedAppsRef = useRef<ConnectedApp[]>([])
  connectedAppsRef.current = connectedApps

  const chatAppIds = chatAppsByThread[pathname] || []
  const chatConnectedApps = connectedApps.filter(app => chatAppIds.includes(app.chatId))

  // Auto-add apps detected via tool calls to the store
  useEffect(() => {
    if (!pathname || !usedToolNamesKey) return
    const currentChatAppIds = useSidebarStore.getState().chatAppsByThread[pathname] || []
    const toolNamesList = usedToolNamesKey.split(',')
    for (const app of connectedAppsRef.current) {
      const toolMatch = toolNamesList.some((t) => {
        const lower = t.toLowerCase()
        const slug = app.appSlug.toLowerCase()
        return lower.startsWith(slug + '_') || lower.startsWith(slug + '-') || lower === slug
      })
      if (toolMatch && !currentChatAppIds.includes(app.chatId)) {
        addChatApp(pathname, app.chatId)
      }
    }
  }, [usedToolNamesKey, pathname, addChatApp])

  if (!isOpen) return null

  const handleRemoveFromChat = (app: ConnectedApp) => {
    removeChatApp(pathname, app.chatId)
  }

  const currentProvider = providers.find(p => p.id === selectedProvider)
  const currentModelName = currentProvider?.models.find(m => m.id === selectedModel)?.name || 'Select model'

  return (
    <div className="flex flex-col gap-[10px] h-full w-full overflow-x-clip overflow-y-auto">
      {/* Overview Header */}
      <div className="flex items-center justify-center pl-[8px]">
        <p className="flex-1 font-semibold text-[14px] text-[#737373] dark:text-[#a9a9a9] leading-normal">
          Overview
        </p>
      </div>

      {/* MCP Connection Status */}
      <div className="pl-[8px]">
        {mcpConnected
          ? (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600" />
                <span className="text-[13px] font-medium text-emerald-800">
                  Server connected
                </span>
                {mcpAbilities != null && mcpAbilities > 0 && (
                  <span className="ml-auto text-[11px] font-medium text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                    {mcpAbilities}
                    {' '}
                    tools
                  </span>
                )}
              </div>
            )
          : mcpError
            ? (
                <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                  <AlertCircleIcon className="size-4 shrink-0 text-red-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-red-800 truncate">Connection failed</p>
                  </div>
                  {onRetryMCP && (
                    <button
                      type="button"
                      onClick={onRetryMCP}
                      className="shrink-0 text-[11px] font-medium text-red-700 bg-red-100 hover:bg-red-200 px-2 py-0.5 rounded-full transition-colors"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )
            : (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <Loader2 className="size-4 shrink-0 text-amber-600 animate-spin" />
                  <span className="text-[13px] font-medium text-amber-800">
                    Connecting...
                  </span>
                </div>
              )}
      </div>

      {/* Model Preferences Section */}
      <div className="flex flex-col gap-[10px] pl-[8px]">
        <button
          type="button"
          onClick={() => setModelPreferencesOpen(!modelPreferencesOpen)}
          className="flex gap-[10px] items-center justify-center w-full text-left"
        >
          <ChevronDownIcon
            className={cn(
              'size-[24px] text-[#171717] dark:text-[#A9A9A9] transition-transform duration-200',
              !modelPreferencesOpen && '-rotate-90',
            )}
          />
          <p className="flex-1 font-semibold text-[16px] text-[#171717] dark:text-[#f5f5f5] leading-normal">
            Model preferences
          </p>
        </button>

        {modelPreferencesOpen && (
          <div className="flex flex-col gap-[10px]">
            {orgProvider?.configured ? (
              <>
                {/* Org Provider Card */}
                <div className="bg-[#fafafa] dark:bg-[#242424] border border-[#dbdbdb] dark:border-[#2e2e2e] flex flex-col gap-[6px] p-[10px] rounded-[12px] w-full">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-[14px] text-[#171717] dark:text-[#f5f5f5] leading-normal">
                      {orgProvider.display_name || 'Organization AI Provider'}
                    </p>
                    <span className="text-[11px] font-medium text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full">
                      Org
                    </span>
                  </div>
                  <p className="text-[12px] text-[#737373] dark:text-[#a9a9a9] leading-normal">
                    {PROVIDER_TYPE_LABELS[orgProvider.provider_type || ''] || orgProvider.provider_type || 'Custom Provider'}
                  </p>
                </div>

                {/* Org Model Dropdown */}
                {orgProvider.allowed_models && orgProvider.allowed_models.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="bg-[#fafafa] dark:bg-[#242424] border border-[#dbdbdb] dark:border-[#2e2e2e] flex h-[44px] items-center justify-between p-[10px] rounded-[12px] w-full hover:bg-[#f5f5f5] dark:hover:bg-[#2a2a2a] transition-colors"
                      >
                        <p className="font-medium text-[14px] text-[#737373] dark:text-[#a9a9a9] leading-normal">
                          {selectedModel || 'Select model'}
                        </p>
                        <ChevronDownIcon className="size-[24px] text-[#737373] dark:text-[#a9a9a9]" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-[270px]">
                      {orgProvider.allowed_models.map(modelId => (
                        <DropdownMenuItem
                          key={modelId}
                          onClick={() => onModelChange?.(modelId)}
                          className="cursor-pointer"
                        >
                          <span className={cn(
                            'font-medium text-[14px]',
                            modelId === selectedModel ? 'text-[#171717] dark:text-[#f5f5f5]' : 'text-[#737373] dark:text-[#a9a9a9]',
                          )}
                          >
                            {modelId}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </>
            ) : (
              <>
                {/* Provider Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="bg-[#fafafa] dark:bg-[#242424] border border-[#dbdbdb] dark:border-[#2e2e2e] flex h-[44px] items-center justify-between p-[10px] rounded-[12px] w-full hover:bg-[#f5f5f5] dark:hover:bg-[#2a2a2a] transition-colors"
                    >
                      <p className="font-medium text-[14px] text-[#737373] dark:text-[#a9a9a9] leading-normal">
                        {currentProvider?.name || 'Select provider'}
                      </p>
                      <ChevronDownIcon className="size-[24px] text-[#737373] dark:text-[#a9a9a9]" />
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
                            provider.id === selectedProvider ? 'text-[#171717] dark:text-[#f5f5f5]' : 'text-[#737373] dark:text-[#a9a9a9]',
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
                        className="bg-[#fafafa] dark:bg-[#242424] border border-[#dbdbdb] dark:border-[#2e2e2e] flex h-[44px] items-center justify-between p-[10px] rounded-[12px] w-full hover:bg-[#f5f5f5] dark:hover:bg-[#2a2a2a] transition-colors"
                      >
                        <p className="font-medium text-[14px] text-[#737373] dark:text-[#a9a9a9] leading-normal">
                          {currentModelName}
                        </p>
                        <ChevronDownIcon className="size-[24px] text-[#737373] dark:text-[#a9a9a9]" />
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
                            model.id === selectedModel ? 'text-[#171717] dark:text-[#f5f5f5]' : 'text-[#737373] dark:text-[#a9a9a9]',
                          )}
                          >
                            {model.name}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </>
            )}
            {/* Extended Thinking Toggle */}
            <div
              className="bg-[#fafafa] dark:bg-[#242424] border border-[#dbdbdb] dark:border-[#2e2e2e] flex items-center justify-between p-[10px] rounded-[12px] w-full cursor-pointer hover:bg-[#f5f5f5] dark:hover:bg-[#2a2a2a] transition-colors"
              onClick={() => onThinkingChange?.(!thinkingEnabled)}
            >
              <div className="flex flex-col gap-[2px]">
                <p className="font-medium text-[14px] text-[#171717] dark:text-[#a9a9a9] leading-normal">
                  Extended thinking
                </p>
                <p className="text-[11px] text-[#737373] dark:text-[#a9a9a9] leading-normal">
                  Deeper reasoning for complex tasks
                </p>
              </div>
              <div
                className={cn(
                  'relative w-[36px] h-[20px] rounded-full transition-colors shrink-0',
                  thinkingEnabled ? 'bg-[#171717] dark:bg-[#f5f5f5]' : 'bg-[#dbdbdb] dark:bg-[#3a3a3a]',
                )}
              >
                <div
                  className={cn(
                    'absolute top-[2px] w-[16px] h-[16px] rounded-full bg-white dark:bg-[#a9a9a9] transition-transform',
                    thinkingEnabled ? 'translate-x-[18px]' : 'translate-x-[2px]',
                  )}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="shrink-0 h-px bg-[#dbdbdb] dark:bg-[#2e2e2e] ml-[8px]" />

      {/* Connectors Section */}
      <div className="flex flex-col gap-[10px] pl-[8px]">
        <button
          type="button"
          onClick={() => setConnectorsOpen(!connectorsOpen)}
          className="flex gap-[10px] items-center justify-center w-full text-left"
        >
          <ChevronDownIcon
            className={cn(
              'size-[24px] text-[#171717] dark:text-[#A9A9A9] transition-transform duration-200',
              !connectorsOpen && '-rotate-90',
            )}
          />
          <p className="flex-1 font-semibold text-[16px] text-[#171717] dark:text-[#f5f5f5] leading-normal">
            Connectors
          </p>
        </button>

        {connectorsOpen && (
          <>
            <p className="font-medium text-[14px] text-[#737373] dark:text-[#a9a9a9] leading-normal">
              Apps used in this chat
            </p>

            {/* Connected Apps List */}
            <TooltipProvider delayDuration={300}>
              <div className="bg-[#fafafa] dark:bg-[#242424] border border-[#dbdbdb] dark:border-[#2e2e2e] flex flex-col gap-[8px] p-[10px] rounded-[12px] w-full overflow-hidden">
                {chatConnectedApps.length > 0
                  ? (
                      chatConnectedApps.map(app => (
                        <ConnectedAppRow
                          key={app.id}
                          app={app}
                          notesReady={notesReady}
                          onConnect={() => {}}
                          onDisconnect={() => handleRemoveFromChat(app)}
                        />
                      ))
                    )
                  : (
                      <p className="font-medium text-[14px] text-[#737373] dark:text-[#a9a9a9] leading-normal">
                        None in use
                      </p>
                    )}
              </div>
            </TooltipProvider>

            {/* Add more apps button */}
            <button
              type="button"
              onClick={() => setConnectAppsModalOpen(true)}
              className="bg-[#fafafa] dark:bg-[#242424] border border-[#dbdbdb] dark:border-[#2e2e2e] flex gap-[6px] items-center justify-center w-full py-[8px] rounded-[12px] hover:bg-[#f5f5f5] dark:hover:bg-[#2a2a2a] transition-colors"
            >
              <PlusIcon className="size-[16px] text-[#171717] dark:text-[#a9a9a9]" />
              <p className="font-medium text-[14px] text-[#171717] dark:text-[#a9a9a9] leading-normal">
                Add more apps
              </p>
            </button>

            {/* Connect Apps Modal */}
            <ConnectAppsModal
              isOpen={connectAppsModalOpen}
              onClose={() => setConnectAppsModalOpen(false)}
              chatAppIds={chatAppIds}
              chatConnectedApps={chatConnectedApps}
              onAddToChat={(chatId) => addChatApp(pathname, chatId)}
              onRemoveFromChat={(chatId) => removeChatApp(pathname, chatId)}
              onDisconnected={() => {
                refreshPipedreamAccounts()
                refreshComposioAccounts()
                refreshLocalStatus()
              }}
            />

          </>
        )}
      </div>
    </div>
  )
}
