import { useCallback, useEffect, useState } from 'react'
import { Message, ShareMessage } from '../../types'
import { useDatabase } from '../providers/DatabaseProvider'
import { databaseService } from '../services/database-service'

interface UseMessagesQueryResult {
  messages: Message[]
  shareMessages: ShareMessage[]
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Custom hook for fetching messages directly from IndexedDB
 * This hook manages its own loading state and fetches messages on mount
 * Call refetch() to manually refresh the data
 */
export function useMessagesQuery(): UseMessagesQueryResult {
  const { isInitialized: isDbInitialized } = useDatabase()
  const [messages, setMessages] = useState<Message[]>([])
  const [shareMessages, setShareMessages] = useState<ShareMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchMessages = useCallback(async () => {
    // Don't fetch if database is not initialized
    if (!isDbInitialized) {
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const [msgs, shareMsgs] = await Promise.all([
        databaseService.getAllMessages(),
        databaseService.getAllShareMessages(),
      ])

      setMessages(msgs)
      setShareMessages(shareMsgs)
    }
    catch (err) {
      console.error('Failed to fetch messages:', err)
      setError(err instanceof Error ? err : new Error('Failed to fetch messages'))
    }
    finally {
      setIsLoading(false)
    }
  }, [isDbInitialized])

  // Fetch when database is initialized
  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  // Listen for database change events and auto-refetch
  useEffect(() => {
    if (!isDbInitialized) return

    const handleDatabaseChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ type: 'messages' | 'shareMessages' | 'both' }>

      // Refetch when any database changes occur
      fetchMessages()
    }

    window.addEventListener('db-change', handleDatabaseChange)

    return () => {
      window.removeEventListener('db-change', handleDatabaseChange)
    }
  }, [isDbInitialized, fetchMessages])

  return {
    messages,
    shareMessages,
    isLoading,
    error,
    refetch: fetchMessages,
  }
}
