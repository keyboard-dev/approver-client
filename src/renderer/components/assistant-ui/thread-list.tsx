import { type FC, useRef, useState } from 'react'
import {
  ThreadListItemPrimitive,
  ThreadListPrimitive,
} from '@assistant-ui/react'
import { ArchiveIcon, PlusIcon, TrashIcon } from 'lucide-react'

import { cn } from '../../lib/utils'
import { TooltipIconButton } from './tooltip-icon-button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'

interface NewChatButtonProps {
  onChatSelect?: () => void
}

/**
 * New chat button - exported for use in sidebar
 */
export const NewChatButton: FC<NewChatButtonProps> = ({ onChatSelect }) => {
  return (
    <ThreadListPrimitive.Root className="aui-root">
      <ThreadListPrimitive.New asChild>
        <button
          type="button"
          onClick={onChatSelect}
          className={cn(
            'flex items-center gap-[10px] mx-[6px] px-[4px] py-[8px] w-[calc(100%-12px)] text-left transition-colors',
            'hover:bg-[#e5e5e5] dark:hover:bg-[#2a2a2a] rounded-[8px]',
          )}
        >
          <PlusIcon className="size-[18px] text-[#737373] dark:text-[#a9a9a9]" />
          <span className="text-[14px] leading-normal text-[#737373] dark:text-[#a9a9a9] font-medium">
            New chat
          </span>
        </button>
      </ThreadListPrimitive.New>
    </ThreadListPrimitive.Root>
  )
}

interface ThreadListItemsProps {
  onChatSelect?: () => void
  showActiveState?: boolean
}

/**
 * Thread list items - exported for use in sidebar
 */
export const ThreadListItems: FC<ThreadListItemsProps> = ({ onChatSelect, showActiveState = true }) => {
  return (
    <ThreadListPrimitive.Root className="aui-root aui-thread-list-root flex flex-col items-stretch gap-0.5">
      <ThreadListPrimitive.Items components={{ ThreadListItem: () => <ThreadListItem onChatSelect={onChatSelect} showActiveState={showActiveState} /> }} />
    </ThreadListPrimitive.Root>
  )
}

interface ThreadListItemProps {
  onChatSelect?: () => void
  showActiveState?: boolean
}

const ThreadListItem: FC<ThreadListItemProps> = ({ onChatSelect, showActiveState = true }) => {
  return (
    <ThreadListItemPrimitive.Root
      className={cn(
        'aui-thread-list-item group flex items-center gap-2 rounded-[8px] transition-all',
        'hover:bg-[#e5e5e5] dark:hover:bg-[#2a2a2a] focus-visible:bg-[#e5e5e5] dark:focus-visible:bg-[#2a2a2a] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        showActiveState && 'data-[active]:bg-[#e5e5e5] dark:data-[active]:bg-[#2a2a2a]',
      )}
    >
      <ThreadListItemPrimitive.Trigger
        className="aui-thread-list-item-trigger flex-grow px-[8px] py-[8px] text-start min-w-0"
        onClick={onChatSelect}
      >
        <ThreadListItemTitle showActiveState={showActiveState} />
      </ThreadListItemPrimitive.Trigger>
      <div className="hidden group-hover:flex items-center gap-1 pr-2">
        <ThreadListItemArchive />
        <ThreadListItemDelete />
      </div>
    </ThreadListItemPrimitive.Root>
  )
}

const ThreadListItemTitle: FC<{ showActiveState?: boolean }> = ({ showActiveState = true }) => {
  const spanRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)

  const handleMouseEnter = () => {
    const el = spanRef.current
    if (el && el.scrollWidth > el.clientWidth) setOpen(true)
  }

  return (
    <TooltipProvider delayDuration={2500} skipDelayDuration={2500}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <span
            ref={spanRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => setOpen(false)}
            className={cn(
              'aui-thread-list-item-title text-[14px] leading-normal text-[#737373] dark:text-[#a9a9a9] font-medium truncate block',
              showActiveState && 'group-data-[active]:text-[#171717] dark:group-data-[active]:text-[#F5F5F5]',
            )}
          >
            <ThreadListItemPrimitive.Title fallback="New chat" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="right" className="z-[9999] bg-[#171717] text-white border-none">
          <ThreadListItemPrimitive.Title fallback="New chat" />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

const ThreadListItemArchive: FC = () => {
  return (
    <ThreadListItemPrimitive.Archive asChild>
      <TooltipIconButton
        className="size-6 p-1 text-[#737373] dark:text-[#a9a9a9] hover:text-[#171717] dark:hover:text-[#f5f5f5] hover:bg-[#dbdbdb] dark:hover:bg-[#2e2e2e] rounded"
        variant="ghost"
        tooltip="Archive thread"
        side="right"
        tooltipClassName="z-[9999] bg-[#171717] text-white border-none"
      >
        <ArchiveIcon className="size-4" />
      </TooltipIconButton>
    </ThreadListItemPrimitive.Archive>
  )
}

const ThreadListItemDelete: FC = () => {
  return (
    <ThreadListItemPrimitive.Delete asChild>
      <TooltipIconButton
        className="size-6 p-1 text-[#737373] dark:text-[#a9a9a9] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded"
        variant="ghost"
        tooltip="Delete thread"
        side="right"
        tooltipClassName="z-[9999] bg-[#171717] text-white border-none"
      >
        <TrashIcon className="size-4" />
      </TooltipIconButton>
    </ThreadListItemPrimitive.Delete>
  )
}

/**
 * Full ThreadList component (kept for backward compatibility)
 */
export const ThreadList: FC = () => {
  return (
    <div className="flex flex-col">
      <NewChatButton />
      <ThreadListItems />
    </div>
  )
}
