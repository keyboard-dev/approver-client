import type { FC } from 'react'
import { useState } from 'react'
import {
  ThreadListItemPrimitive,
  ThreadListPrimitive,
} from '@assistant-ui/react'
import { ArchiveIcon, ChevronDownIcon, ChevronUpIcon, PlusIcon, TrashIcon } from 'lucide-react'

import { cn } from '../../lib/utils'
import { TooltipIconButton } from './tooltip-icon-button'

const VISIBLE_CHAT_LIMIT = 5

/**
 * New Chat button - exported for use in sidebar
 */
export const NewChatButton: FC = () => {
  return (
    <ThreadListPrimitive.Root className="aui-root">
      <ThreadListPrimitive.New asChild>
        <button
          type="button"
          className={cn(
            'flex items-center gap-[10px] px-[16px] py-[10px] w-full text-left transition-colors',
            'hover:bg-[#e5e5e5] rounded-md',
          )}
        >
          <PlusIcon className="size-[18px] text-[#171717]" />
          <span className="text-[14px] leading-normal text-[#171717] font-medium">
            New Chat
          </span>
        </button>
      </ThreadListPrimitive.New>
    </ThreadListPrimitive.Root>
  )
}

/**
 * Thread list items with expand/collapse - exported for use in sidebar
 */
export const ThreadListItems: FC = () => {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="flex flex-col">
      <ThreadListPrimitive.Root
        className={cn(
          'aui-root aui-thread-list-root flex flex-col items-stretch gap-0.5',
          !expanded && 'thread-list-collapsed',
        )}
      >
        <ThreadListPrimitive.Items components={{ ThreadListItem }} />
      </ThreadListPrimitive.Root>
      <ExpandCollapseButton expanded={expanded} onToggle={() => setExpanded(!expanded)} />
      <style>{`
        .thread-list-collapsed .aui-thread-list-item:nth-child(n+${VISIBLE_CHAT_LIMIT + 1}) {
          display: none;
        }
      `}</style>
    </div>
  )
}

const ExpandCollapseButton: FC<{ expanded: boolean; onToggle: () => void }> = ({ expanded, onToggle }) => {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex items-center justify-center gap-1 px-[16px] py-[6px] w-full text-left transition-colors',
        'hover:bg-[#e5e5e5] rounded-md',
      )}
    >
      {expanded ? (
        <ChevronUpIcon className="size-[14px] text-[#737373]" />
      ) : (
        <ChevronDownIcon className="size-[14px] text-[#737373]" />
      )}
      <span className="text-[12px] leading-normal text-[#737373] font-medium">
        {expanded ? 'Show less' : 'Show all'}
      </span>
    </button>
  )
}

const ThreadListItem: FC = () => {
  return (
    <ThreadListItemPrimitive.Root className={cn(
      'aui-thread-list-item group flex items-center gap-2 rounded-md transition-all',
      'hover:bg-[#e5e5e5] focus-visible:bg-[#e5e5e5] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
      'data-[active]:bg-[#e5e5e5]',
    )}
    >
      <ThreadListItemPrimitive.Trigger className="aui-thread-list-item-trigger flex-grow px-[16px] py-[8px] text-start min-w-0">
        <ThreadListItemTitle />
      </ThreadListItemPrimitive.Trigger>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pr-2">
        <ThreadListItemArchive />
        <ThreadListItemDelete />
      </div>
    </ThreadListItemPrimitive.Root>
  )
}

const ThreadListItemTitle: FC = () => {
  return (
    <span className="aui-thread-list-item-title text-[14px] leading-normal text-[#737373] font-medium truncate block">
      <ThreadListItemPrimitive.Title fallback="New Chat" />
    </span>
  )
}

const ThreadListItemArchive: FC = () => {
  return (
    <ThreadListItemPrimitive.Archive asChild>
      <TooltipIconButton
        className="size-6 p-1 text-[#737373] hover:text-[#171717] hover:bg-[#dbdbdb] rounded"
        variant="ghost"
        tooltip="Archive thread"
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
        className="size-6 p-1 text-[#737373] hover:text-red-600 hover:bg-red-50 rounded"
        variant="ghost"
        tooltip="Delete thread"
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
