import { ClipboardCheckIcon, ChevronDownIcon, ChevronRightIcon, SettingsIcon } from 'lucide-react'
import type { FC } from 'react'
import { useState } from 'react'
import { cn } from '../../lib/utils'
import { ThreadList } from './thread-list'

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
  onApprovalRequestsClick?: () => void
}

export const ThreadLeftSidebar: FC<ThreadLeftSidebarProps> = ({
  isOpen,
  activeTab,
  onTabClick,
  onApprovalRequestsClick,
}) => {
  const [settingsExpanded, setSettingsExpanded] = useState(false)

  if (!isOpen) return null

  return (
    <div className="flex flex-col h-full w-[220px] shrink-0 overflow-hidden bg-white">
      {/* Thread List Section */}
      <div className="flex-1 overflow-y-auto py-2">
        <ThreadList />
      </div>

      {/* Bottom Section - Approval Requests & Settings */}
      <div className="border-t border-[#dbdbdb] py-2">
        {/* Approval Requests Option */}
        <button
          type="button"
          onClick={onApprovalRequestsClick}
          className={cn(
            'flex items-center gap-[10px] px-[16px] py-[10px] w-full text-left transition-colors',
            'hover:bg-[#e5e5e5]',
          )}
        >
          <ClipboardCheckIcon className="size-[18px] text-[#737373]" />
          <span className="text-[14px] leading-normal text-[#737373] font-medium">
            Approval Requests
          </span>
        </button>

        {/* Settings Collapsible */}
        <button
          type="button"
          onClick={() => setSettingsExpanded(!settingsExpanded)}
          className={cn(
            'flex items-center gap-[10px] px-[16px] py-[10px] w-full text-left transition-colors',
            'hover:bg-[#e5e5e5]',
            activeTab ? 'bg-[#e5e5e5]' : '',
          )}
        >
          <SettingsIcon className="size-[18px] text-[#737373]" />
          <span className="text-[14px] leading-normal text-[#737373] font-medium flex-1">
            Settings
          </span>
          {settingsExpanded
            ? (
                <ChevronDownIcon className="size-[16px] text-[#737373]" />
              )
            : (
                <ChevronRightIcon className="size-[16px] text-[#737373]" />
              )}
        </button>

        {/* Settings Navigation - Collapsible */}
        {settingsExpanded && (
          <div className="pl-[28px]">
            {SETTINGS_TABS.map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => onTabClick?.(tab)}
                className={cn(
                  'px-[16px] py-[6px] w-full text-left transition-colors rounded-md',
                  'hover:bg-[#e5e5e5]',
                  activeTab === tab ? 'bg-[#e5e5e5] text-[#171717] font-semibold' : 'text-[#737373] font-medium',
                )}
              >
                <span className="text-[13px] leading-normal">
                  {tab}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export { SETTINGS_TABS }
