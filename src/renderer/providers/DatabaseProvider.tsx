import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Message, ShareMessage } from '../../types'
import { databaseService } from '../services/database-service'

interface DatabaseContextValue {
  isInitialized: boolean
  addMessage: (message: Message) => Promise<void>
  updateMessage: (messageId: string, updates: Partial<Message>) => Promise<void>
  deleteMessage: (messageId: string) => Promise<void>
  deleteMessages: (messageIds: string[]) => Promise<void>
  clearAllMessages: () => Promise<void>
  addShareMessage: (shareMessage: ShareMessage) => Promise<void>
  updateShareMessage: (messageId: string, updates: Partial<ShareMessage>) => Promise<void>
  clearAllShareMessages: () => Promise<void>
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null)

export const useDatabase = (): DatabaseContextValue => {
  const context = useContext(DatabaseContext)
  if (!context) {
    throw new Error('useDatabase must be used within DatabaseProvider')
  }
  return context
}

// Query hooks for data fetching:
// - useMessagesQuery() for messages/shareMessages
// - Use databaseService.getTotalPendingCount() directly for pending count

interface DatabaseProviderProps {
  children: React.ReactNode
}

export const DatabaseProvider: React.FC<DatabaseProviderProps> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState<boolean>(false)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize database
  useEffect(() => {
    const initDatabase = async () => {
      try {
        await databaseService.initialize()
        setIsInitialized(true)
      }
      catch (error) {
      }
    }

    initDatabase()

    // Cleanup on unmount
    return () => {
      // Clear any pending debounced notifications
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      databaseService.close()
    }
  }, [])

  // Helper to notify main process about pending count changes (for tray icon)
  // Debounced to avoid excessive IPC calls during batch operations
  const notifyPendingCountChange = useCallback(async () => {
    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Set a new timer to debounce the notification
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const count = await databaseService.getTotalPendingCount()
        // Ensure electronAPI exists before invoking
        if (window.electronAPI && typeof window.electronAPI.dbPendingCountUpdated === 'function') {
          window.electronAPI.dbPendingCountUpdated(count)
        }
      }
      catch (error) {
      }
    }, 150) // 150ms debounce delay
  }, [])

  const addMessage = useCallback(async (message: Message) => {
    try {
      await databaseService.addMessage(message)
      // Only notify if the message is pending (optimization: reduce IPC calls)
      if (message.status === 'pending' || !message.status) {
        await notifyPendingCountChange()
      }
    }
    catch (error) {
      throw error
    }
  }, [notifyPendingCountChange])

  const updateMessage = useCallback(async (messageId: string, updates: Partial<Message>) => {
    try {
      // Only notify if status is being changed
      const shouldNotify = updates.status !== undefined
      await databaseService.updateMessage(messageId, updates)
      if (shouldNotify) {
        await notifyPendingCountChange()
      }
    }
    catch (error) {
      throw error
    }
  }, [notifyPendingCountChange])

  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      await databaseService.deleteMessage(messageId)
      // Always notify after delete (optimization: removed redundant read)
      // The getTotalPendingCount will return the correct count after deletion
      await notifyPendingCountChange()
    }
    catch (error) {
      throw error
    }
  }, [notifyPendingCountChange])

  const deleteMessages = useCallback(async (messageIds: string[]) => {
    try {
      await databaseService.deleteMessages(messageIds)
      // Always notify after batch delete (optimization: removed redundant reads)
      // The getTotalPendingCount will return the correct count after deletion
      await notifyPendingCountChange()
    }
    catch (error) {
      throw error
    }
  }, [notifyPendingCountChange])

  const clearAllMessages = useCallback(async () => {
    try {
      await databaseService.clearAllMessages()
      await notifyPendingCountChange()
    }
    catch (error) {
      throw error
    }
  }, [notifyPendingCountChange])

  const addShareMessage = useCallback(async (shareMessage: ShareMessage) => {
    try {
      await databaseService.addShareMessage(shareMessage)
      // Only notify if the share message is pending (optimization: reduce IPC calls)
      if (shareMessage.status === 'pending' || !shareMessage.status) {
        await notifyPendingCountChange()
      }
    }
    catch (error) {
      throw error
    }
  }, [notifyPendingCountChange])

  const updateShareMessage = useCallback(async (messageId: string, updates: Partial<ShareMessage>) => {
    try {
      // Only notify if status is being changed
      const shouldNotify = updates.status !== undefined
      await databaseService.updateShareMessage(messageId, updates)
      if (shouldNotify) {
        await notifyPendingCountChange()
      }
    }
    catch (error) {
      throw error
    }
  }, [notifyPendingCountChange])

  const clearAllShareMessages = useCallback(async () => {
    try {
      await databaseService.clearAllShareMessages()
      await notifyPendingCountChange()
    }
    catch (error) {
      throw error
    }
  }, [notifyPendingCountChange])

  // Note: Query methods removed - use direct databaseService calls or query hooks instead:
  // - useMessagesQuery() for messages/shareMessages
  // - databaseService.getTotalPendingCount() for pending count

  // Listen for messages-clear event from main process
  // Note: websocket-message and collection-share-request are handled in useGlobalWebSocketListeners
  useEffect(() => {
    if (!isInitialized) return

    const handleMessagesClear = async () => {
      await clearAllMessages()
      await clearAllShareMessages()
    }

    // Set up listener for messages-clear event
    const cleanupFunctions: Array<() => void> = []

    if (window.electronAPI) {
      const unsubClear = window.electronAPI.onMessagesClear?.(handleMessagesClear)

      // Only add function if it's actually a cleanup function
      if (typeof unsubClear === 'function') cleanupFunctions.push(unsubClear)
    }

    return () => {
      // Clean up specific listeners using returned unsubscribe functions
      cleanupFunctions.forEach(cleanup => cleanup?.())
    }
  }, [isInitialized, clearAllMessages, clearAllShareMessages])

  const value: DatabaseContextValue = {
    isInitialized,
    addMessage,
    updateMessage,
    deleteMessage,
    deleteMessages,
    clearAllMessages,
    addShareMessage,
    updateShareMessage,
    clearAllShareMessages,
  }

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  )
}
