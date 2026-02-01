import { BotIcon, HomeIcon, ListTodoIcon, SettingsIcon, WorkflowIcon } from 'lucide-react'
import type { FC } from 'react'
import { cn } from '../../lib/utils'

interface NavItem {
  id: string
  label: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: <HomeIcon className="size-[24px]" />,
  },
  {
    id: 'agentic-chat',
    label: 'Agentic chat',
    icon: <BotIcon className="size-[24px]" />,
  },
  {
    id: 'flow-shortcuts',
    label: 'Flow shortcuts',
    icon: <WorkflowIcon className="size-[24px]" />,
  },
  {
    id: 'task-approvals',
    label: 'Task approvals',
    icon: <ListTodoIcon className="size-[24px]" />,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <SettingsIcon className="size-[24px]" />,
  },
]

interface ThreadLeftSidebarProps {
  isOpen: boolean
  activeItem?: string
  onItemClick?: (itemId: string) => void
}

export const ThreadLeftSidebar: FC<ThreadLeftSidebarProps> = ({
  isOpen,
  activeItem = 'agentic-chat',
  onItemClick,
}) => {
  if (!isOpen) return null

  return (
    <div className="flex flex-col h-full w-[215px] max-w-[500px] overflow-x-clip overflow-y-auto">
      {navItems.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onItemClick?.(item.id)}
          className={cn(
            'flex gap-[10px] items-center justify-start px-[16px] py-[8px] w-full text-left transition-colors',
            'hover:bg-[#e0e0e0] rounded-lg',
            activeItem === item.id && 'bg-[#e5e5e5]'
          )}
        >
          <span className="text-[#171717]">
            {item.icon}
          </span>
          <p className="flex-1 font-medium text-[14px] text-[#171717] leading-normal">
            {item.label}
          </p>
        </button>
      ))}
    </div>
  )
}
