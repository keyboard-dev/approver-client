import {
  BellIcon,
  ClipboardCheckIcon,
  CogIcon,
  CpuIcon,
  CreditCardIcon,
  PlugIcon,
  ShieldIcon,
  ShieldCheckIcon,
  WifiIcon,
  ZapIcon,
} from 'lucide-react'
import type { FC, ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { NewChatButton, ThreadListItems } from './thread-list'

/**
 * Settings tabs with icons
 */
const SETTINGS_TABS: Array<{ id: SettingsTabId, label: string, icon: ReactNode }> = [
  { id: 'WebSocket', label: 'WebSocket', icon: <WifiIcon className="size-[16px]" /> },
  { id: 'Security', label: 'Security', icon: <ShieldIcon className="size-[16px]" /> },
  { id: 'Security Policies', label: 'Security Policies', icon: <ShieldCheckIcon className="size-[16px]" /> },
  { id: 'AI Providers', label: 'AI Providers', icon: <CpuIcon className="size-[16px]" /> },
  { id: 'AI Credits', label: 'AI Credits', icon: <CreditCardIcon className="size-[16px]" /> },
  { id: 'Notifications', label: 'Notifications', icon: <BellIcon className="size-[16px]" /> },
  { id: 'Connectors', label: 'Connectors', icon: <PlugIcon className="size-[16px]" /> },
  { id: 'Triggers', label: 'Triggers', icon: <ZapIcon className="size-[16px]" /> },
  { id: 'Advanced', label: 'Advanced', icon: <CogIcon className="size-[16px]" /> },
]

type SettingsTabId = 'WebSocket' | 'Security' | 'Security Policies' | 'AI Providers' | 'AI Credits' | 'Notifications' | 'Connectors' | 'Triggers' | 'Advanced'

export type SettingsTabType = SettingsTabId

interface ThreadLeftSidebarProps {
  isOpen: boolean
  activeTab?: SettingsTabType | null
  onTabClick?: (tab: SettingsTabType) => void
  onApprovalRequestsClick?: () => void
  onChatSelect?: () => void
}

export const ThreadLeftSidebar: FC<ThreadLeftSidebarProps> = ({
  isOpen,
  activeTab,
  onTabClick,
  onApprovalRequestsClick,
  onChatSelect,
}) => {
  if (!isOpen) return null

  return (
    <div className="flex flex-col h-full w-[220px] shrink-0 overflow-hidden bg-white">
      {/* Top Section - New Chat, Approval Requests & Settings */}
      <div className="py-2">
        {/* New Chat Button */}
        <NewChatButton onChatSelect={onChatSelect} />

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

        {/* Settings Navigation - Always Visible */}
        <div className="pl-[28px]">
          {SETTINGS_TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabClick?.(tab.id)}
              className={cn(
                'flex items-center gap-[8px] px-[12px] py-[6px] w-full text-left transition-colors rounded-md',
                'hover:bg-[#e5e5e5]',
                activeTab === tab.id ? 'bg-[#e5e5e5] text-[#171717] font-semibold' : 'text-[#737373] font-medium',
              )}
            >
              <span className={activeTab === tab.id ? 'text-[#171717]' : 'text-[#737373]'}>
                {tab.icon}
              </span>
              <span className="text-[13px] leading-normal">
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Bottom Section - Chat History */}
      <div className="flex-1 overflow-y-auto border-t border-[#dbdbdb] py-2">
        <ThreadListItems onChatSelect={onChatSelect} />
      </div>
    </div>
  )
}

export { SETTINGS_TABS }
