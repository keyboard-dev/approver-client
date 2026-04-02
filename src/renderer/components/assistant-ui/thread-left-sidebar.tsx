import {
  ArrowLeftIcon,
  CogIcon,
  CreditCardIcon,
  EyeIcon,
  LogOutIcon,
  PlugIcon,
  PlusIcon,
  SearchIcon,
  SlidersHorizontalIcon,
} from 'lucide-react'
import type { FC } from 'react'
import { useEffect, useRef, useState } from 'react'
import { ThreadListPrimitive, useAssistantRuntime } from '@assistant-ui/react'
import { cn } from '../../lib/utils'
import { useSidebarStore } from '../../stores/sidebar-store'
import { NewChatButton, ThreadListItems } from './thread-list'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'

type SettingsTabId = 'WebSocket' | 'Security' | 'Security Policies' | 'AI Providers' | 'AI Credits' | 'Notifications' | 'Connectors' | 'Triggers' | 'Advanced' | 'Appearance'

export type SettingsTabType = SettingsTabId

interface ThreadLeftSidebarProps {
  isOpen: boolean
  width: number
  activeTab?: SettingsTabType | null
  onTabClick?: (tab: SettingsTabType) => void
  onChatSelect?: () => void
}

const SETTINGS_SUB_TABS: Array<{ id: SettingsTabType, label: string, icon: React.ReactNode }> = [
  { id: 'Appearance', label: 'Appearance', icon: <EyeIcon className="size-[16px]" /> },
  { id: 'AI Credits', label: 'AI Credits', icon: <CreditCardIcon className="size-[16px]" /> },
  { id: 'Advanced', label: 'Advanced', icon: <SlidersHorizontalIcon className="size-[16px]" /> },
]

const COLLAPSED_WIDTH = 44

function avatarColor(initials: string): string {
  const colors = ['#e05e38', '#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626']
  const idx = initials.charCodeAt(0) % colors.length
  return colors[idx]
}

// Simple tooltip wrapper for collapsed icon buttons
const NavTooltip: FC<{ label: string, children: React.ReactNode }> = ({ label, children }) => (
  <Tooltip>
    <TooltipTrigger asChild>{children as React.ReactElement}</TooltipTrigger>
    <TooltipContent side="right">{label}</TooltipContent>
  </Tooltip>
)

interface SearchResult {
  threadId: string
  title: string
  snippet: string
}

const ChatSearchDialog: FC<{ onClose: () => void, onSelect: (threadId: string) => void }> = ({ onClose, onSelect }) => {
  const runtime = useAssistantRuntime()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      setResults([])
      return
    }

    const state = runtime.threads.getState()
    const allIds = [...state.threads, ...state.archivedThreads]
    const matches: SearchResult[] = []

    for (const threadId of allIds) {
      const item = state.threadItems[threadId]
      const title = item?.title ?? 'New Chat'
      const titleLower = title.toLowerCase()

      // Search messages for content
      let snippet = ''
      try {
        const messages = runtime.threads.getById(threadId).getState().messages
        for (const msg of messages) {
          if (msg.role === 'system') continue
          for (const part of msg.content as Array<{ type: string, text?: string }>) {
            if (part.type === 'text' && part.text) {
              if (part.text.toLowerCase().includes(q)) {
                const idx = part.text.toLowerCase().indexOf(q)
                const start = Math.max(0, idx - 40)
                const end = Math.min(part.text.length, idx + q.length + 40)
                snippet = (start > 0 ? '…' : '') + part.text.slice(start, end) + (end < part.text.length ? '…' : '')
                break
              }
            }
          }
          if (snippet) break
        }
      }
      catch {
        // thread may not be loaded yet
      }

      if (titleLower.includes(q) || snippet) {
        matches.push({ threadId, title, snippet })
      }
    }

    setResults(matches)
  }, [query, runtime])

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#242424] rounded-[12px] border border-[#E5E5E5] dark:border-[#2e2e2e] shadow-xl w-[480px] max-h-[60vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-[10px] px-[16px] py-[14px] border-b border-[#E5E5E5] dark:border-[#2e2e2e]">
          <SearchIcon className="size-[16px] text-[#737373] dark:text-[#a9a9a9] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search chats…"
            className="flex-1 text-[14px] text-[#171717] dark:text-[#f5f5f5] placeholder-[#a3a3a3] outline-none bg-transparent"
          />
          <span className="text-[11px] text-[#a3a3a3] shrink-0">Esc to close</span>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {query.trim() === '' && (
            <div className="px-[16px] py-[24px] text-[13px] text-[#a3a3a3] text-center">
              Type to search your chats
            </div>
          )}
          {query.trim() !== '' && results.length === 0 && (
            <div className="px-[16px] py-[24px] text-[13px] text-[#a3a3a3] text-center">
              No results found
            </div>
          )}
          {results.map(r => (
            <button
              key={r.threadId}
              type="button"
              onClick={() => { onSelect(r.threadId); onClose() }}
              className="w-full text-left px-[16px] py-[12px] hover:bg-[#F5F5F5] dark:hover:bg-[#2a2a2a] transition-colors flex flex-col gap-[2px]"
            >
              <span className="text-[14px] font-medium text-[#171717] dark:text-[#f5f5f5] truncate">{r.title}</span>
              {r.snippet && (
                <span className="text-[12px] text-[#737373] dark:text-[#a9a9a9] line-clamp-2 leading-relaxed">{r.snippet}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export const ThreadLeftSidebar: FC<ThreadLeftSidebarProps> = ({
  isOpen,
  width,
  activeTab,
  onTabClick,
  onChatSelect,
}) => {
  const { setLeftSidebarOpen } = useSidebarStore()
  const runtime = useAssistantRuntime()
  const [inSettingsView, setInSettingsView] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [credits, setCredits] = useState<{ balance_cents: number, total_purchased_cents: number } | null>(null)
  const [user, setUser] = useState<{ firstName: string, lastName: string, email: string } | null>(null)

  // Cmd+K to open search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleSearchSelect = (threadId: string) => {
    runtime.threads.switchToThread(threadId)
    onChatSelect?.()
  }

  useEffect(() => {
    window.electronAPI.getCreditsBalance()
      .then((res) => {
        if (res?.success) {
          setCredits({ balance_cents: res.balance_cents, total_purchased_cents: res.total_purchased_cents })
        }
      })
      .catch(() => {})

    window.electronAPI.getAuthStatus()
      .then((status) => {
        if (status?.authenticated && status.user) {
          setUser({
            firstName: status.user.firstName,
            lastName: status.user.lastName,
            email: status.user.email,
          })
        }
      })
      .catch(() => {})
  }, [])

  // Sync settings view state with active tab from outside
  useEffect(() => {
    if (activeTab === 'Connectors') setInSettingsView(false)
  }, [activeTab])

  const handleSettingsClick = () => {
    setInSettingsView(true)
    onTabClick?.('AI Credits')
  }

  const handleBack = () => {
    setInSettingsView(false)
    onChatSelect?.()
  }

  const handleConnectorsClick = () => {
    setInSettingsView(false)
    onTabClick?.('Connectors')
  }

  const handleLogout = () => {
    window.electronAPI.logout().catch(() => {})
  }

  const userInitials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : ''

  const MONTHLY_REFRESH_TOKENS = 500
  const creditsPct = credits
    ? Math.min(100, (credits.balance_cents / MONTHLY_REFRESH_TOKENS) * 100)
    : 0

  // ── Collapsed view (icons only) ──
  if (!isOpen) {
    return (
      <div className="flex flex-col h-full bg-[#EBEBEB] dark:bg-[#161616] overflow-hidden" style={{ width: COLLAPSED_WIDTH }}>
        <div className="py-2">
          {inSettingsView
            ? (
                <>
                  {/* Back */}
                  <NavTooltip label="Back">
                    <button
                      type="button"
                      onClick={handleBack}
                      className="flex items-center justify-center ml-[4px] w-[28px] h-[28px] rounded-[8px] text-[#737373] dark:text-[#a9a9a9] hover:bg-[#e5e5e5] dark:hover:bg-[#2a2a2a] transition-colors"
                    >
                      <ArrowLeftIcon className="size-[18px]" />
                    </button>
                  </NavTooltip>

                  {/* Appearance */}
                  <NavTooltip label="Appearance">
                    <button
                      type="button"
                      onClick={() => onTabClick?.('Appearance')}
                      className={cn(
                        'flex items-center justify-center ml-[4px] w-[28px] h-[28px] rounded-[8px] transition-colors hover:bg-[#e5e5e5] dark:hover:bg-[#2a2a2a]',
                        activeTab === 'Appearance' ? 'text-[#171717] dark:text-[#F5F5F5]' : 'text-[#737373] dark:text-[#a9a9a9]',
                      )}
                    >
                      <EyeIcon className="size-[18px]" />
                    </button>
                  </NavTooltip>

                  {/* AI Credits */}
                  <NavTooltip label="AI Credits">
                    <button
                      type="button"
                      onClick={() => onTabClick?.('AI Credits')}
                      className={cn(
                        'flex items-center justify-center ml-[4px] w-[28px] h-[28px] rounded-[8px] transition-colors hover:bg-[#e5e5e5] dark:hover:bg-[#2a2a2a]',
                        activeTab === 'AI Credits' ? 'text-[#171717] dark:text-[#F5F5F5]' : 'text-[#737373] dark:text-[#a9a9a9]',
                      )}
                    >
                      <CreditCardIcon className="size-[18px]" />
                    </button>
                  </NavTooltip>

                  {/* Advanced */}
                  <NavTooltip label="Advanced">
                    <button
                      type="button"
                      onClick={() => onTabClick?.('Advanced')}
                      className={cn(
                        'flex items-center justify-center ml-[4px] w-[28px] h-[28px] rounded-[8px] transition-colors hover:bg-[#e5e5e5] dark:hover:bg-[#2a2a2a]',
                        activeTab === 'Advanced' ? 'text-[#171717] dark:text-[#F5F5F5]' : 'text-[#737373] dark:text-[#a9a9a9]',
                      )}
                    >
                      <SlidersHorizontalIcon className="size-[18px]" />
                    </button>
                  </NavTooltip>
                </>
              )
            : (
                <>
                  {/* New Chat */}
                  <ThreadListPrimitive.Root className="aui-root">
                    <Tooltip>
                      <ThreadListPrimitive.New asChild>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={onChatSelect}
                            className="flex items-center justify-center ml-[4px] w-[28px] h-[28px] rounded-[8px] text-[#737373] dark:text-[#a9a9a9] hover:bg-[#e5e5e5] dark:hover:bg-[#2a2a2a] transition-colors"
                          >
                            <PlusIcon className="size-[18px]" />
                          </button>
                        </TooltipTrigger>
                      </ThreadListPrimitive.New>
                      <TooltipContent side="right">New Chat</TooltipContent>
                    </Tooltip>
                  </ThreadListPrimitive.Root>

                  {/* Search */}
                  <NavTooltip label="Search chats (⌘K)">
                    <button
                      type="button"
                      onClick={() => setSearchOpen(true)}
                      className="flex items-center justify-center ml-[4px] w-[28px] h-[28px] rounded-[8px] text-[#737373] dark:text-[#a9a9a9] hover:bg-[#e5e5e5] dark:hover:bg-[#2a2a2a] transition-colors"
                    >
                      <SearchIcon className="size-[18px]" />
                    </button>
                  </NavTooltip>

                  {/* Connectors */}
                  <NavTooltip label="Connectors">
                    <button
                      type="button"
                      onClick={handleConnectorsClick}
                      className={cn(
                        'flex items-center justify-center ml-[4px] w-[28px] h-[28px] rounded-[8px] transition-colors hover:bg-[#e5e5e5] dark:hover:bg-[#2a2a2a]',
                        activeTab === 'Connectors' ? 'text-[#171717] dark:text-[#F5F5F5]' : 'text-[#737373] dark:text-[#a9a9a9]',
                      )}
                    >
                      <PlugIcon className="size-[18px]" />
                    </button>
                  </NavTooltip>

                  {/* Settings */}
                  <NavTooltip label="Settings">
                    <button
                      type="button"
                      onClick={handleSettingsClick}
                      className="flex items-center justify-center ml-[4px] w-[28px] h-[28px] rounded-[8px] text-[#737373] dark:text-[#a9a9a9] hover:bg-[#e5e5e5] dark:hover:bg-[#2a2a2a] transition-colors"
                    >
                      <CogIcon className="size-[18px]" />
                    </button>
                  </NavTooltip>
                </>
              )}
        </div>

        {/* Divider */}
        <div className="ml-[4px] w-[28px] border-t border-[#dbdbdb] dark:border-[#2e2e2e]" />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom divider + section */}
        <div className="ml-[4px] w-[28px] border-t border-[#dbdbdb] dark:border-[#2e2e2e]" />
        <div className="py-[14px] flex flex-col items-start gap-[12px]">
          {user && (
            <NavTooltip label={`${user.firstName} ${user.lastName}`}>
              <div
                className="ml-[1px] size-[34px] rounded-full flex items-center justify-center text-white text-[12px] font-semibold cursor-default select-none"
                style={{ backgroundColor: avatarColor(userInitials) }}
              >
                {userInitials}
              </div>
            </NavTooltip>
          )}

          <NavTooltip label="Log out">
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center justify-center ml-[4px] w-[28px] h-[28px] rounded-[8px] text-[#737373] dark:text-[#a9a9a9] hover:text-[#171717] dark:hover:text-[#f5f5f5] hover:bg-[#e5e5e5] dark:hover:bg-[#2a2a2a] transition-colors"
            >
              <LogOutIcon className="size-[14px]" />
            </button>
          </NavTooltip>
        </div>
        {searchOpen && (
          <ChatSearchDialog onClose={() => setSearchOpen(false)} onSelect={handleSearchSelect} />
        )}
      </div>
    )
  }

  // ── Expanded view ──
  return (
    <div className="flex flex-col h-full shrink-0 overflow-hidden bg-[#EBEBEB] dark:bg-[#161616]" style={{ width }}>
      {!inSettingsView
        ? (
        // ── Main View ──
        <div className="flex flex-col h-full" style={{ width }}>
          <div className="py-2">
            <NewChatButton onChatSelect={onChatSelect} />

            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-[10px] mx-[6px] px-[4px] py-[8px] w-[calc(100%-12px)] rounded-[8px] text-left transition-colors hover:bg-[#e5e5e5] dark:hover:bg-[#2a2a2a] text-[#737373] dark:text-[#a9a9a9]"
            >
              <SearchIcon className="size-[18px]" />
              <span className="text-[14px] leading-normal font-medium">Search</span>
              <span className="ml-auto text-[11px] text-[#a3a3a3]">⌘K</span>
            </button>

            <button
              type="button"
              onClick={handleConnectorsClick}
              className={cn(
                'flex items-center gap-[10px] mx-[6px] px-[4px] py-[8px] w-[calc(100%-12px)] rounded-[8px] text-left transition-colors hover:bg-[#e5e5e5] dark:hover:bg-[#2a2a2a]',
                activeTab === 'Connectors' ? 'text-[#171717] dark:text-[#F5F5F5]' : 'text-[#737373] dark:text-[#a9a9a9]',
              )}
            >
              <PlugIcon className="size-[18px]" />
              <span className="text-[14px] leading-normal font-medium">Connectors</span>
            </button>

            <button
              type="button"
              onClick={handleSettingsClick}
              className={cn(
                'flex items-center gap-[10px] mx-[6px] px-[4px] py-[8px] w-[calc(100%-12px)] rounded-[8px] text-left transition-colors hover:bg-[#e5e5e5] dark:hover:bg-[#2a2a2a]',
                inSettingsView ? 'text-[#171717] dark:text-[#F5F5F5]' : 'text-[#737373] dark:text-[#a9a9a9]',
              )}
            >
              <CogIcon className="size-[18px]" />
              <span className="text-[14px] leading-normal font-medium">Settings</span>
            </button>
          </div>

          <div className="mx-[6px] border-t border-[#dbdbdb] dark:border-[#2e2e2e]" />
          <div className="px-[8px] pt-[10px] pb-[4px]">
            <span className="text-[11px] font-semibold text-[#a3a3a3] uppercase tracking-wide">Recents</span>
          </div>

          <div className="flex-1 overflow-y-auto py-1 px-[6px]">
            <ThreadListItems onChatSelect={onChatSelect} />
          </div>

          <div className="mx-[6px] border-t border-[#dbdbdb] dark:border-[#2e2e2e]" />
          <div className="px-[8px] py-[14px] flex flex-col gap-[12px]">
            {credits !== null && (
              <div>
                <div className="flex items-center justify-between mb-[6px]">
                  <span className="text-[13px] font-medium text-[#171717] dark:text-[#f5f5f5]">Credits</span>
                  <span className="text-[13px] font-medium text-[#171717] dark:text-[#f5f5f5]">
                    {credits.balance_cents}
                    {' / '}
                    {MONTHLY_REFRESH_TOKENS}
                  </span>
                </div>
                <div className="h-[5px] rounded-full bg-[#e5e5e5] dark:bg-[#2e2e2e] overflow-hidden mb-[10px]">
                  <div
                    className="h-full bg-[#99A0FF] rounded-full transition-all"
                    style={{ width: `${creditsPct}%` }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => window.electronAPI.createCreditsCheckout(1000)}
                  className="w-full bg-[#99A0FF] hover:bg-[#8088ee] text-[#171717] text-[13px] font-semibold py-[9px] rounded-[8px] transition-colors"
                >
                  Buy Credits
                </button>
              </div>
            )}

            {user && (
              <div className="flex items-center gap-[10px] min-w-0">
                <div
                  className="size-[34px] rounded-full flex items-center justify-center text-white text-[12px] font-semibold shrink-0"
                  style={{ backgroundColor: avatarColor(userInitials) }}
                >
                  {userInitials}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[#171717] dark:text-[#f5f5f5] truncate">
                    {user.firstName}
                    {' '}
                    {user.lastName}
                  </div>
                  <div className="text-[11px] text-[#737373] dark:text-[#a9a9a9] truncate">{user.email}</div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-[8px] px-[4px] py-[8px] w-full rounded-[8px] text-[13px] text-[#737373] dark:text-[#a9a9a9] hover:text-[#171717] dark:hover:text-[#f5f5f5] hover:bg-[#e5e5e5] dark:hover:bg-[#2a2a2a] transition-colors"
            >
              <LogOutIcon className="size-[14px]" />
              <span>Log out</span>
            </button>
          </div>
        </div>
        )
        : (
        // ── Settings Sub-View ──
        <div className="flex flex-col h-full">
          <div className="py-2">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-[10px] mx-[6px] px-[4px] py-[8px] w-[calc(100%-12px)] rounded-[8px] text-left text-[#737373] dark:text-[#a9a9a9] hover:text-[#171717] dark:hover:text-[#f5f5f5] hover:bg-[#e5e5e5] dark:hover:bg-[#2a2a2a] transition-colors"
            >
              <ArrowLeftIcon className="size-[18px]" />
              <span className="text-[14px] font-medium">Back</span>
            </button>
          </div>

          <div className="flex-1 py-1">
            {SETTINGS_SUB_TABS.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabClick?.(tab.id)}
                className={cn(
                  'flex items-center gap-[10px] mx-[6px] px-[4px] py-[8px] w-[calc(100%-12px)] rounded-[8px] text-left transition-colors hover:bg-[#e5e5e5] dark:hover:bg-[#2a2a2a]',
                  activeTab === tab.id ? 'bg-[#e5e5e5] dark:bg-[#2a2a2a] text-[#171717] dark:text-[#F5F5F5]' : 'text-[#737373] dark:text-[#a9a9a9]',
                )}
              >
                {tab.icon}
                <span className="text-[14px] font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
        )}
      {searchOpen && (
        <ChatSearchDialog onClose={() => setSearchOpen(false)} onSelect={handleSearchSelect} />
      )}
    </div>
  )
}
