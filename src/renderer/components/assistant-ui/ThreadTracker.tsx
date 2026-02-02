import { useEffect } from 'react'
import { useThreadListItem } from '@assistant-ui/react'
import { currentThreadRef } from '../screens/ChatPage'

/**
 * ThreadTracker - Invisible component that syncs the current thread info
 * to a global ref for use in approval message association.
 *
 * This component must be rendered inside an AssistantRuntimeProvider.
 */
export function ThreadTracker() {
  const threadListItem = useThreadListItem({ optional: true })

  useEffect(() => {
    if (threadListItem) {
      currentThreadRef.threadId = threadListItem.id
      currentThreadRef.threadTitle = threadListItem.title ?? 'New Chat'
    }
  }, [threadListItem?.id, threadListItem?.title])

  return null
}
