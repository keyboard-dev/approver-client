import type { FC } from 'react'
import {
  ThreadListItemPrimitive,
  ThreadListPrimitive,
} from '@assistant-ui/react'
import { ArchiveIcon, PlusIcon, TrashIcon } from 'lucide-react'

import { cn } from '../../lib/utils'
import { TooltipIconButton } from './tooltip-icon-button'

export const ThreadList: FC = () => {
  return (
    <ThreadListPrimitive.Root className="aui-root aui-thread-list-root flex flex-col items-stretch gap-0.5">
      <ThreadListNew />
      <ThreadListItems />
    </ThreadListPrimitive.Root>
  )
}

const ThreadListNew: FC = () => {
  return (
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
  )
}

const ThreadListItems: FC = () => {
  return <ThreadListPrimitive.Items components={{ ThreadListItem }} />
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
