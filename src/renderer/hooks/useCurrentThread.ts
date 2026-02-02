import { useThreadListItem } from '@assistant-ui/react'

/**
 * Hook to get the current thread's ID and title.
 * Useful for associating approval messages with their originating chat thread.
 */
export function useCurrentThread() {
  const threadListItem = useThreadListItem({ optional: true })

  return {
    threadId: threadListItem?.id ?? null,
    threadTitle: threadListItem?.title ?? 'New Chat',
    isMain: threadListItem?.isMain ?? true,
  }
}
