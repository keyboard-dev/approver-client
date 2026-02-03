import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Message, ShareMessage } from '../../types'
import { currentThreadRef } from '../components/screens/ChatPage'
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
  const { addMessage, addShareMessage, isInitialized } = useDatabase()

  // Define message types that should trigger automatic navigation to detail view
  const MESSAGE_TYPES_WITH_NAVIGATION = ['Security Evaluation Request', 'code response approval']

  useEffect(() => {
    console.log('[RENDERER-DEBUG] useGlobalWebSocketListeners useEffect running')
    console.log('[RENDERER-DEBUG] Auth status:', authStatus.authenticated)
    console.log('[RENDERER-DEBUG] Database initialized:', isInitialized)

    // Don't register listeners until database is initialized
    if (!isInitialized) {
      console.log('[RENDERER-DEBUG] Database not initialized yet, skipping listener registration')
      return
    }

    // Listen for websocket messages
    const handleWebSocketMessage = async (_event: unknown, message: Message) => {
      console.log('[RENDERER-DEBUG] handleWebSocketMessage called!')
      console.log('[RENDERER-DEBUG] Received message:', JSON.stringify(message, null, 2))
      console.log('[RENDERER-DEBUG] Message title:', message.title)
      console.log('[RENDERER-DEBUG] Message id:', message.id)
      console.log('[RENDERER-DEBUG] Auth status authenticated:', authStatus.authenticated)
      console.log('[RENDERER-DEBUG] Database initialized:', isInitialized)

      // Only handle messages if authenticated
      if (!authStatus.authenticated) {
        console.log('[RENDERER-DEBUG] WARNING: Not authenticated, ignoring message')
        return
      }

      try {
        // Check if we're on a chat route and have thread context
        const isChatRoute = location.pathname === '/' || location.pathname.startsWith('/chat')
        console.log('[RENDERER-DEBUG] Current pathname:', location.pathname)
        console.log('[RENDERER-DEBUG] Is chat route:', isChatRoute)
        console.log('[RENDERER-DEBUG] currentThreadRef:', currentThreadRef)

        // Attach thread context if we're in a chat and have a thread ID
        const messageWithThread: Message = {
          ...message,
          ...(isChatRoute && currentThreadRef.threadId ? {
            threadId: currentThreadRef.threadId,
            threadTitle: currentThreadRef.threadTitle,
          } : {}),
        }

        console.log('[RENDERER-DEBUG] Saving message to database...')
        // Save to database first (critical for persistence)
        await addMessage(messageWithThread)
        console.log('[RENDERER-DEBUG] Message saved to database successfully')

        // For Security Evaluation Request and code response approval, navigate to detail view
        // BUT only if we're not on the home route (/) where chat mode might be active
        console.log('[RENDERER-DEBUG] MESSAGE_TYPES_WITH_NAVIGATION:', MESSAGE_TYPES_WITH_NAVIGATION)
        console.log('[RENDERER-DEBUG] Message title matches navigation types:', MESSAGE_TYPES_WITH_NAVIGATION.includes(message.title))

        if (MESSAGE_TYPES_WITH_NAVIGATION.includes(message.title)) {
          // If we're on a chat route (/ or /chat), emit a custom event for inline display
          // If we're on other routes, auto-navigate to dedicated approval page
          if (!isChatRoute) {
            console.log('[RENDERER-DEBUG] Not on chat route, navigating to:', `/messages/${message.id}`)
            navigate(`/messages/${message.id}`)
          }
          else {
            // On chat route - emit custom event with thread context for inline display
            console.log('[RENDERER-DEBUG] On chat route, dispatching chat-approval-message event')
            window.dispatchEvent(new CustomEvent('chat-approval-message', { detail: messageWithThread }))
          }
        }
        else {
          console.log('[RENDERER-DEBUG] Message title not in navigation types, not navigating')
        }
        // For other message types, don't navigate - let the current route handle the message
        // The message is already saved to DB, and route-specific components can query it
      }
      catch (error) {
        console.error('[RENDERER-DEBUG] Error handling message:', error)
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
    console.log('[RENDERER-DEBUG] Registering websocket-message listener')
    window.electronAPI.onWebSocketMessage(handleWebSocketMessage)
    console.log('[RENDERER-DEBUG] websocket-message listener registered')

    console.log('[RENDERER-DEBUG] Registering collection-share-request listener')
    window.electronAPI.onCollectionShareRequest(handleCollectionShareRequest)

    console.log('[RENDERER-DEBUG] Registering show-share-message listener')
    window.electronAPI.onShowShareMessage(handleShowShareMessage)

    console.log('[RENDERER-DEBUG] All listeners registered successfully')

    // Cleanup: Remove only these specific listeners
    // NOTE: We use removeAllListeners here because the current preload API doesn't
    // return cleanup functions. This is safe because Layout unmounts only when the app closes.
    return () => {
      console.log('[RENDERER-DEBUG] Cleaning up listeners')
      window.electronAPI.removeAllListeners('websocket-message')
      window.electronAPI.removeAllListeners('collection-share-request')
      window.electronAPI.removeAllListeners('show-share-message')
    }
  }, [authStatus.authenticated, navigate, location.pathname, addMessage, addShareMessage, isInitialized])
}
