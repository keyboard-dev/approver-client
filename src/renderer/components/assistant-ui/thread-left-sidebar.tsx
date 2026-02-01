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
}

export const ThreadLeftSidebar: FC<ThreadLeftSidebarProps> = ({
  isOpen,
  activeTab,
  onTabClick,
}) => {
  if (!isOpen) return null

  return (
    <div className="flex flex-col h-full w-[180px] shrink-0 overflow-y-auto">
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
            activeTab === tab ? 'text-[#171717] font-semibold' : 'text-[#737373] font-medium'
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
