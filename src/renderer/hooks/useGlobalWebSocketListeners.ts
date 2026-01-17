import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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
 * - Handle context-aware navigation for Security Evaluation Request messages
 * - Coordinate with DatabaseProvider for message persistence
 * - Clean up listeners on unmount (without affecting other components' listeners)
 *
 * NOTE: This hook is route-aware and won't auto-navigate approval messages when on the home route (/)
 * to allow for inline chat approvals. Route-specific components handle their own UI state.
 */
export const useGlobalWebSocketListeners = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { authStatus } = useAuth()
  const { addMessage, addShareMessage } = useDatabase()

  // Define message types that should trigger automatic navigation to detail view
  const MESSAGE_TYPES_WITH_NAVIGATION = ['Security Evaluation Request', 'code response approval']

  useEffect(() => {
    // Listen for websocket messages
    const handleWebSocketMessage = async (_event: unknown, message: Message) => {
      // Only handle messages if authenticated
      if (!authStatus.authenticated) {
        return
      }

      try {
        // Save to database first (critical for persistence)
        await addMessage(message)

        // For Security Evaluation Request and code response approval, navigate to detail view
        // BUT only if we're not on the home route (/) where chat mode might be active
        if (MESSAGE_TYPES_WITH_NAVIGATION.includes(message.title)) {
          // If we're on the home route, emit a custom event for AppContent to potentially handle
          // If we're on other routes, auto-navigate to dedicated approval page
          if (location.pathname !== '/chat') {
            navigate(`/messages/${message.id}`)
          }
          else {
            // On home route - emit custom event that App.tsx can listen for

            window.dispatchEvent(new CustomEvent('chat-approval-message', { detail: message }))
          }
        }
        // For other message types, don't navigate - let the current route handle the message
        // The message is already saved to DB, and route-specific components can query it
      }
      catch (error) {
        if (MESSAGE_TYPES_WITH_NAVIGATION.includes(message.title)) {
          if (location.pathname !== '/') {
            navigate(`/messages/${message.id}`)
          }
        }
      }
    }

    // Listen for collection share requests
    const handleCollectionShareRequest = async (_event: unknown, shareMessage: ShareMessage) => {
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
      }
    }

    // Listen for show share message events
    const handleShowShareMessage = async (_event: unknown, shareMessage: ShareMessage) => {
      if (!authStatus.authenticated) {
        return
      }

      try {
        // Save to database to ensure it exists (idempotent)
        await addShareMessage(shareMessage)
        // Note: Not navigating here - let route-specific components handle display
      }
      catch (error) {
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
  }, [authStatus.authenticated, navigate, location.pathname, addMessage, addShareMessage])
}
