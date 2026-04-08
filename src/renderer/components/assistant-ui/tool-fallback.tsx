import type { ToolCallMessagePartComponent } from '@assistant-ui/react'
import { useMessage } from '@assistant-ui/react'
import { CheckIcon, LoaderCircle, PlusIcon, XCircle } from 'lucide-react'
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import squaresIconUrl from '../../../../assets/icon-squares.svg'
import { cn } from '../../lib/utils'
import { resolveInteractiveToolCall } from '../../services/pending-tool-calls'
import { useSidebarStore } from '../../stores/sidebar-store'
import { useMcpClientContext } from '../../services/mcp-client-context'
import { McpAppHost } from './mcp-app-host'
import { GenericToolPart } from './tool-parts'

// =============================================================================
// connect-reconnect-accounts compact card
// =============================================================================

const SOURCE_LABELS: Record<string, string> = { pipedream: 'Pipedream', composio: 'Composio', local: 'Local' }

function parseRequestedApps(args: Record<string, unknown> | undefined): string[] {
  if (!args) return []
  if (Array.isArray(args.apps)) return args.apps.map(String).filter(Boolean)
  if (typeof args.apps === 'string') return args.apps.split(',').map(s => s.trim()).filter(Boolean)
  if (Array.isArray(args.appNames)) return args.appNames.map(String).filter(Boolean)
  if (typeof args.appName === 'string' && args.appName) return [args.appName]
  if (typeof args.query === 'string') return args.query.split(',').map(s => s.trim()).filter(Boolean)
  for (const val of Object.values(args)) {
    if (Array.isArray(val) && val.length > 0 && val.every(v => typeof v === 'string')) return val as string[]
  }
  return []
}

function prettifyAppName(slug: string): string {
  return slug.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function ConnectReconnectCard({ args, result }: { args: Record<string, unknown> | undefined, result: unknown }) {
  const { pathname } = useLocation()
  const { allConnectedApps, chatAppsByThread, addChatApp, setConnectAppsModalOpen, setRightSidebarOpen } = useSidebarStore()
  const chatAppIds = chatAppsByThread[pathname] || []

  const requestedSlugs = parseRequestedApps(args)

  const requestedApps = requestedSlugs.map((slug) => {
    const lower = slug.toLowerCase().replace(/[-\s_]/g, '')
    const connected = allConnectedApps.find((a) => {
      const aSlug = a.appSlug.toLowerCase().replace(/[-\s_]/g, '')
      const aName = a.displayName.toLowerCase().replace(/[-\s_]/g, '')
      return aSlug === lower || aName.includes(lower) || lower.includes(aSlug)
    })
    return {
      slug,
      displayName: connected?.displayName ?? prettifyAppName(slug),
      connected,
      inChat: connected ? chatAppIds.includes(connected.chatId) : false,
    }
  })

  // Auto-resolve when no apps were requested, or when all requested+connected apps are in chat
  const connectedChatIds = requestedApps.filter(a => a.connected).map(a => a.connected!.chatId).join(',')
  const allInChat = requestedApps.filter(a => a.connected).every(a => a.inChat)
  useEffect(() => {
    if (result !== undefined) return
    if (requestedSlugs.length === 0 || (connectedChatIds && allInChat)) {
      resolveInteractiveToolCall('connect-reconnect-accounts', {})
    }
  }, [chatAppIds.join(','), connectedChatIds, allInChat, result, requestedSlugs.length])

  const handlePlus = (app: typeof requestedApps[0]) => {
    if (app.connected) {
      addChatApp(pathname, app.connected.chatId)
    }
    else {
      setRightSidebarOpen(true)
      setConnectAppsModalOpen(true)
    }
  }

  // Completed state — compact success line
  if (result !== undefined) {
    return (
      <div className="my-2 flex items-center gap-1.5 text-[12px] text-[#737373] dark:text-[#a9a9a9]">
        <CheckIcon className="size-3.5 text-emerald-500 shrink-0" />
        <span>Apps updated</span>
      </div>
    )
  }

  if (requestedApps.length === 0) return null

  const appNames = requestedApps.map(a => a.displayName).join(' or ')

  return (
    <div className="my-2">
      <p className="text-[14px] text-[#404040] dark:text-[#d4d4d4] mb-2">
        {`I don't have access to ${appNames} in this chat. To complete your request, I would need:`}
      </p>
      <div className="border border-[#e5e5e5] dark:border-[#2e2e2e] rounded-[12px] overflow-hidden bg-white dark:bg-[#1f1f1f]">
      {requestedApps.map((app, i) => (
        <div
          key={app.slug}
          className={cn(
            'flex items-center gap-[10px] px-[14px] py-[10px]',
            i > 0 && 'border-t border-[#f0f0f0] dark:border-[#2e2e2e]',
          )}
        >
          <div className="bg-white dark:bg-[#292929] border border-[#e5e5e5] dark:border-[#3a3a3a] rounded-[6px] p-[5px] flex items-center shrink-0">
            <img
              src={app.connected?.icon || squaresIconUrl}
              alt={app.displayName}
              className="w-[18px] h-[18px] object-contain"
              onError={(e) => { (e.target as HTMLImageElement).src = squaresIconUrl }}
            />
          </div>
          <span className="flex-1 font-medium text-[14px] text-[#171717] dark:text-[#f5f5f5]">
            {app.displayName}
          </span>
          {app.connected && (
            <span className="bg-[#f0f0f0] dark:bg-[#2e2e2e] text-[#171717] dark:text-[#f5f5f5] text-[11px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap">
              {SOURCE_LABELS[app.connected.source] || app.connected.source}
            </span>
          )}
          {app.inChat
            ? (
                <div className="flex items-center justify-center w-[28px] h-[28px] rounded-full bg-emerald-100 dark:bg-emerald-900/30 shrink-0">
                  <CheckIcon className="size-[14px] text-emerald-600" />
                </div>
              )
            : (
                <button
                  type="button"
                  onClick={() => handlePlus(app)}
                  className="flex items-center justify-center w-[28px] h-[28px] rounded-full bg-[#f0f0f0] dark:bg-[#2e2e2e] hover:bg-[#e0e0e0] dark:hover:bg-[#3a3a3a] transition-colors shrink-0"
                >
                  <PlusIcon className="size-[14px] text-[#171717] dark:text-[#f5f5f5]" />
                </button>
              )}
        </div>
      ))}
      </div>
    </div>
  )
}

// =============================================================================
// ToolFallback
// =============================================================================

export const ToolFallback: ToolCallMessagePartComponent = ({
  toolName,
  args,
  result,
  isError,
}) => {
  const message = useMessage({ optional: true } as Parameters<typeof useMessage>[0])
  const isRunning = result === undefined && message?.status.type === 'running'
  const isFailed = isError && !isRunning

  // connect-reconnect-accounts: render compact custom card
  if (toolName === 'connect-reconnect-accounts') {
    return (
      <ConnectReconnectCard
        args={args as Record<string, unknown> | undefined}
        result={result}
      />
    )
  }

  // Check if this tool has an MCP App UI widget
  let resourceUri: string | undefined
  try {
    const ctx = useMcpClientContext()
    resourceUri = ctx.toolResourceMap.get(toolName)
  }
  catch {
    // Context not available — no widget rendering
  }

  // Render MCP App widget if tool has a UI resource
  if (resourceUri) {
    return (
      <div className={`aui-tool-fallback-root mb-4 flex w-full flex-col gap-3 rounded-lg border py-3 ${isFailed ? 'border-red-300 bg-red-50/50' : ''}`}>
        <div className="aui-tool-fallback-header flex items-center gap-2 px-4">
          {isRunning
            ? <LoaderCircle className="aui-tool-fallback-icon size-4 animate-spin text-blue-500" />
            : isFailed
              ? <XCircle className="aui-tool-fallback-icon size-4 text-red-500" />
              : <CheckIcon className="aui-tool-fallback-icon size-4 text-green-600" />}
          <p className="aui-tool-fallback-title flex-grow text-sm">
            {isRunning ? 'Running' : isFailed ? 'Failed' : 'Used tool'}
            :
            {' '}
            <b>{toolName}</b>
          </p>
        </div>
        <div className="px-4">
          <McpAppHost
            resourceUri={resourceUri}
            toolArgs={args as Record<string, unknown> ?? {}}
            toolResult={typeof result === 'string' ? result : result !== undefined ? JSON.stringify(result, null, 2) : undefined}
            toolName={toolName}
          />
        </div>
      </div>
    )
  }

  // Non-widget tools: render GenericToolPart for rich inline display
  return <GenericToolPart toolName={toolName} argsText={typeof args === 'object' ? JSON.stringify(args) : ''} result={result} isError={isError} />
}
