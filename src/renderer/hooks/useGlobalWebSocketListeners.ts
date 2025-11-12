import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Message, ShareMessage } from '../../types'
import { useDatabase } from '../providers/DatabaseProvider'
import { useAuth } from './useAuth'

/**
 * useGlobalWebSocketListeners
 *
 * Global hook that manages WebSocket message event listeners across the entire application.
 * This hook should be called once at the Layout level to ensure listeners persist across route changes.
 *
 * Responsibilities:
 * - Register listeners for websocket-message and collection-share-request events
 * - Handle navigation for Security Evaluation Request messages
 * - Coordinate with DatabaseProvider for message persistence
 * - Clean up listeners on unmount (without affecting other components' listeners)
 *
 * NOTE: This hook does NOT manage UI state (currentMessage, currentShareMessage).
 * Route-specific components should handle their own UI state based on route params or database queries.
 */
export const useGlobalWebSocketListeners = () => {
  const navigate = useNavigate()
  const { authStatus } = useAuth()
  const { addMessage, addShareMessage } = useDatabase()

  // Define message types that should trigger automatic navigation to detail view
  const MESSAGE_TYPES_WITH_NAVIGATION = ['Security Evaluation Request', 'code response approval']

  useEffect(() => {
    // Listen for websocket messages
    const handleWebSocketMessage = async (_event: unknown, message: Message) => {
      console.log('handleWebSocketMessage', message)

      // Only handle messages if authenticated
      if (!authStatus.authenticated) {
        return
      }

      try {
        // Save to database first (critical for persistence)
        await addMessage(message)

        // For Security Evaluation Request and code response approval, navigate to detail view
        if (MESSAGE_TYPES_WITH_NAVIGATION.includes(message.title)) {
          navigate(`/messages/${message.id}`)
        }
        // For other message types, don't navigate - let the current route handle the message
        // The message is already saved to DB, and route-specific components can query it
      }
      catch (error) {
        console.error('Failed to save message to database:', error)
        // Still attempt navigation for Security Evaluation Request and code response approval as fallback
        if (MESSAGE_TYPES_WITH_NAVIGATION.includes(message.title)) {
          navigate(`/messages/${message.id}`)
        }
      }
    }

    // Listen for collection share requests
    const handleCollectionShareRequest = async (_event: unknown, shareMessage: ShareMessage) => {
      console.log('handleCollectionShareRequest', shareMessage)

      // Only handle messages if authenticated
      if (!authStatus.authenticated) {
        return
      }

      try {
        // Save to database first
        await addShareMessage(shareMessage)
        // Note: Not navigating here - let route-specific components handle display
      }
      catch (error) {
        console.error('Failed to save share message to database:', error)
      }
    }

    // Listen for show share message events
    const handleShowShareMessage = async (_event: unknown, shareMessage: ShareMessage) => {
      console.log('handleShowShareMessage', shareMessage)

      if (!authStatus.authenticated) {
        return
      }

      try {
        // Save to database to ensure it exists (idempotent)
        await addShareMessage(shareMessage)
        // Note: Not navigating here - let route-specific components handle display
      }
      catch (error) {
        console.error('Failed to save share message to database:', error)
      }
    }

    // Register event listeners
    window.electronAPI.onWebSocketMessage(handleWebSocketMessage)
    window.electronAPI.onCollectionShareRequest(handleCollectionShareRequest)
    window.electronAPI.onShowShareMessage(handleShowShareMessage)

    // Cleanup: Remove only these specific listeners
    // NOTE: We use removeAllListeners here because the current preload API doesn't
    // return cleanup functions. This is safe because Layout unmounts only when the app closes.
    return () => {
      window.electronAPI.removeAllListeners('websocket-message')
      window.electronAPI.removeAllListeners('collection-share-request')
      window.electronAPI.removeAllListeners('show-share-message')
    }
  }, [authStatus.authenticated, navigate, addMessage, addShareMessage])
}
