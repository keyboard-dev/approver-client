import { useEffect } from 'react'
import { useThreadListItem, useThreadListItemRuntime } from '@assistant-ui/react'
import { currentThreadRef } from '../screens/ChatPage'

interface ThreadTrackerProps {
  onTitleCallbackReady?: (callback: (title: string) => void) => void
}

/**
 * ThreadTracker - Invisible component that syncs the current thread info
 * to a global ref for use in approval message association.
 * Also handles automatic thread title renaming when AI generates a title.
 *
 * This component must be rendered inside an AssistantRuntimeProvider.
 */
export function ThreadTracker({ onTitleCallbackReady }: ThreadTrackerProps) {
  const threadListItem = useThreadListItem({ optional: true })
  const threadListItemRuntime = useThreadListItemRuntime({ optional: true })

  useEffect(() => {
    if (threadListItem) {
      currentThreadRef.threadId = threadListItem.id
      currentThreadRef.threadTitle = threadListItem.title ?? 'New Chat'
    }
  }, [threadListItem?.id, threadListItem?.title])

  // Set up the rename callback when runtime is available
  useEffect(() => {
    if (threadListItemRuntime && onTitleCallbackReady) {
      const renameCallback = (title: string) => {
        threadListItemRuntime.rename(title)
      }
      onTitleCallbackReady(renameCallback)
    }
  }, [threadListItemRuntime, onTitleCallbackReady])

  return null
}
