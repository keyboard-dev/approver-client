import { ClipboardCheckIcon, MessageSquareIcon } from 'lucide-react'
import type { FC } from 'react'
import { cn } from '../../lib/utils'

/**
 * Settings tabs matching the SettingsScreen
 */
const SETTINGS_TABS = [
  'WebSocket',
  'Security',
  'Security Policies',
  'AI Providers',
  'AI Credits',
  'Notifications',
  'Connectors',
  'Triggers',
  'Advanced',
] as const

export type SettingsTabType = typeof SETTINGS_TABS[number]

interface ThreadLeftSidebarProps {
  isOpen: boolean
  activeTab?: SettingsTabType | null
  onTabClick?: (tab: SettingsTabType) => void
  onChatClick?: () => void
  onApprovalRequestsClick?: () => void
}

export const ThreadLeftSidebar: FC<ThreadLeftSidebarProps> = ({
  isOpen,
  activeTab,
  onTabClick,
  onChatClick,
  onApprovalRequestsClick,
}) => {
  if (!isOpen) return null

  // Chat is active when no settings tab is selected
  const isChatActive = !activeTab

  return (
    <div className="flex flex-col h-full w-[180px] shrink-0 overflow-y-auto">
      {/* Chat Option */}
      <button
        type="button"
        onClick={onChatClick}
        className={cn(
          'flex items-center gap-[10px] px-[16px] py-[10px] w-full text-left transition-colors',
          'hover:bg-[#e5e5e5]',
          isChatActive ? 'bg-[#e5e5e5]' : ''
        )}
      >
        <MessageSquareIcon className="size-[20px] text-[#171717]" />
        <span className={cn(
          'text-[14px] leading-normal',
          isChatActive ? 'text-[#171717] font-semibold' : 'text-[#737373] font-medium'
        )}>
          Chat
        </span>
      </button>

      {/* Approval Requests Option */}
      <button
        type="button"
        onClick={onApprovalRequestsClick}
        className={cn(
          'flex items-center gap-[10px] px-[16px] py-[10px] w-full text-left transition-colors',
          'hover:bg-[#e5e5e5]'
        )}
      >
        <ClipboardCheckIcon className="size-[20px] text-[#171717]" />
        <span className="text-[14px] leading-normal text-[#737373] font-medium">
          Approval Requests
        </span>
      </button>

      {/* Divider */}
      <div className="h-[1px] bg-[#dbdbdb] mx-[16px] my-[8px]" />

      {/* Settings Header */}
      <div className="px-[16px] py-[8px]">
        <p className="font-semibold text-[14px] text-[#737373] leading-normal">
          Settings
        </p>
      </div>

      {/* Settings Navigation */}
      {SETTINGS_TABS.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onTabClick?.(tab)}
          className={cn(
            'px-[16px] py-[8px] w-full text-left transition-colors',
            'hover:bg-[#e5e5e5]',
            activeTab === tab ? 'bg-[#e5e5e5] text-[#171717] font-semibold' : 'text-[#737373] font-medium'
          )}
        >
          <span className="text-[14px] leading-normal">
            {tab}
          </span>
        </button>
      ))}
    </div>
  )
}

export { SETTINGS_TABS }
