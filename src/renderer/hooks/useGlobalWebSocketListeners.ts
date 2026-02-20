import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Message, ShareMessage } from '../../types'
import { currentThreadRef } from '../components/screens/ChatPage'
import { useDatabase } from '../providers/DatabaseProvider'
import { isFromOurApp } from '../services/pending-tool-calls'
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
  const { addMessage, addShareMessage, isInitialized } = useDatabase()

  // Define message types that should trigger automatic navigation to detail view
  const MESSAGE_TYPES_WITH_NAVIGATION = ['Security Evaluation Request', 'code response approval']

  useEffect(() => {
    if (!isInitialized) {
      return
    }

    // Listen for websocket messages
    const handleWebSocketMessage = async (_event: unknown, message: Message) => {
      if (!authStatus.authenticated) {
        return
      }

      try {
        // Check if we're on a chat route and have thread context
        const isChatRoute = location.pathname === '/' || location.pathname.startsWith('/chat')
        const isSecurityEvaluation = message.title === 'Security Evaluation Request'

        if (isSecurityEvaluation) {
        }

        const messageIsFromOurApp = isSecurityEvaluation
          && !!message.explanation
          && isFromOurApp(message.explanation)

        const messageWithThread: Message = {
          ...message,
          isFromOurApp: messageIsFromOurApp,
          ...(isChatRoute && currentThreadRef.threadId
            ? {
                threadId: currentThreadRef.threadId,
                threadTitle: currentThreadRef.threadTitle,
              }
            : {}),
        }

        await addMessage(messageWithThread)
        if (MESSAGE_TYPES_WITH_NAVIGATION.includes(message.title)) {
          // For Security Evaluation Request: use fingerprint to decide inline vs full view
          // For code response approval: always inline if on chat route (no fingerprint to check)
          if (isSecurityEvaluation) {
            // Security Evaluation Request - use fingerprint matching
            if (!isChatRoute || !messageIsFromOurApp) {
              navigate(`/messages/${message.id}`)
            }
            else {
              window.dispatchEvent(new CustomEvent('chat-approval-message', { detail: messageWithThread }))
            }
          }
          else {
            // code response approval - no fingerprint, use original behavior
            if (!isChatRoute) {
              navigate(`/messages/${message.id}`)
            }
            else {
              window.dispatchEvent(new CustomEvent('chat-approval-message', { detail: messageWithThread }))
            }
          }
        }
        else {
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
    return () => {
      window.electronAPI.removeAllListeners('websocket-message')
      window.electronAPI.removeAllListeners('collection-share-request')
      window.electronAPI.removeAllListeners('show-share-message')
    }
  }, [authStatus.authenticated, navigate, location.pathname, addMessage, addShareMessage, isInitialized])
}
