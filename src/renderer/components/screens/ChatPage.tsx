import { Clock } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Message } from '../../../types'
import { useAuth } from '../../hooks/useAuth'
import { useWebSocketConnection } from '../../hooks/useWebSocketConnection'
import { useDatabase } from '../../providers/DatabaseProvider'
import { databaseService } from '../../services/database-service'
import { AssistantUIChat } from '../AssistantUIChat'
import { Card, CardContent } from '../ui/card'

/**
 * ChatPage - Chat interface with optional approval message handling using routing
 *
 * This component:
 * - Handles both standalone chat (/chat) and chat with approval messages (/chat/:messageId)
 * - Fetches approval messages from IndexedDB using the messageId URL parameter
 * - Renders the AssistantUIChat component with approval message context
 * - Handles approve/reject actions that update IndexedDB and notify main process
 * - Navigates back to the message list on completion
 * - Follows the same pattern as MessageDetailScreen for consistency
 *
 * Routes:
 * - /chat - Standalone chat interface
 * - /chat/:messageId - Chat with approval message context
 */
export const ChatPage: React.FC = () => {
  const { messageId } = useParams<{ messageId?: string }>()
  const navigate = useNavigate()
  const { updateMessage } = useDatabase()
  const { authStatus, isSkippingAuth } = useAuth()
  const { connectionStatus } = useWebSocketConnection(authStatus, isSkippingAuth)

  const [approvalMessage, setApprovalMessage] = useState<Message | null>(null)
  const [isLoading, setIsLoading] = useState(!!messageId) // Only show loading if we're expecting a message
  const [error, setError] = useState<string | null>(null)

  // Debug: Track approvalMessage state changes
  useEffect(() => {
    console.log('[ChatPage] approvalMessage state changed:', approvalMessage ? `${approvalMessage.id} (${approvalMessage.status})` : 'null')
  }, [approvalMessage])

  // Helper function to fetch/refresh approval message
  const fetchApprovalMessage = async () => {
    if (!messageId) {
      setIsLoading(false)
      return
    }

    try {
      const fetchedMessage = await databaseService.getMessage(messageId)

      if (!fetchedMessage) {
        setError('Approval message not found')
        setIsLoading(false)
        return
      }

      // Verify this is a supported approval message type
      const supportedMessageTypes = ['Security Evaluation Request', 'code response approval']
      if (!supportedMessageTypes.includes(fetchedMessage.title)) {
        setError('This message type is not supported for chat approvals')
        setIsLoading(false)
        return
      }

      setApprovalMessage(fetchedMessage)
    }
    catch (err) {
      setError('Failed to load approval message')
    }
    finally {
      setIsLoading(false)
    }
  }

  // Fetch approval message from IndexedDB on mount (if messageId provided)
  useEffect(() => {
    fetchApprovalMessage()
  }, [messageId])

  // Listen for chat approval events when on chat page
  useEffect(() => {
    const handleChatApprovalMessage = (event: CustomEvent<Message>) => {
      const message = event.detail
      console.log('[ChatPage] chat-approval-message event received:', message.id, message.title, message.status)
      console.log('[ChatPage] codespaceResponse present:', !!message.codespaceResponse)
      if (authStatus.authenticated || isSkippingAuth) {
        console.log('[ChatPage] Setting approvalMessage state...')
        setApprovalMessage(message)
      }
      else {
        console.log('[ChatPage] Not authenticated, ignoring message')
      }
    }

    // Add event listener
    console.log('[ChatPage] Adding chat-approval-message event listener')
    window.addEventListener('chat-approval-message', handleChatApprovalMessage as EventListener)

    // Cleanup on unmount
    return () => {
      console.log('[ChatPage] Removing chat-approval-message event listener')
      window.removeEventListener('chat-approval-message', handleChatApprovalMessage as EventListener)
    }
  }, [authStatus.authenticated, isSkippingAuth])

  // Approve message handler (same pattern as MessageDetailScreen)
  const handleApprove = async (message: Message) => {
    console.log('[ChatPage] handleApprove called for message:', message.id, message.title)
    try {
      // 1. Update database
      console.log('[ChatPage] Updating database status to approved...')
      await updateMessage(message.id, {
        status: 'approved',
      })
      console.log('[ChatPage] Database updated successfully')

      // 2. Fetch the updated message from database
      console.log('[ChatPage] Fetching updated message from database...')
      const updatedMessage = await databaseService.getMessage(message.id)
      if (!updatedMessage) {
        throw new Error('Failed to fetch updated message')
      }
      console.log('[ChatPage] Updated message fetched:', updatedMessage.status)

      // 3. Notify main process to forward response to WebSocket
      console.log('[ChatPage] Sending response to main process via electronAPI...')
      await window.electronAPI.sendMessageResponse(updatedMessage)
      console.log('[ChatPage] Response sent to main process successfully')

      // 4. Clear the approval message from chat interface
      setApprovalMessage(null)
      console.log('[ChatPage] Approval message cleared from UI')

      // 5. Refresh the message to show updated status
      await fetchApprovalMessage()
      console.log('[ChatPage] handleApprove completed successfully')
    }
    catch (error) {
      console.error('[ChatPage] handleApprove error:', error)
    }
  }

  // Reject message handler (same pattern as MessageDetailScreen)
  const handleReject = async (message: Message) => {
    console.log('[ChatPage] handleReject called for message:', message.id, message.title)
    try {
      // 1. Update database
      console.log('[ChatPage] Updating database status to rejected...')
      await updateMessage(message.id, {
        status: 'rejected',
      })
      console.log('[ChatPage] Database updated successfully')

      // 2. Fetch the updated message from database
      console.log('[ChatPage] Fetching updated message from database...')
      const updatedMessage = await databaseService.getMessage(message.id)
      if (!updatedMessage) {
        throw new Error('Failed to fetch updated message')
      }
      console.log('[ChatPage] Updated message fetched:', updatedMessage.status)

      // 3. Notify main process to forward response to WebSocket
      console.log('[ChatPage] Sending response to main process via electronAPI...')
      await window.electronAPI.sendMessageResponse(updatedMessage)
      console.log('[ChatPage] Response sent to main process successfully')

      // 4. Clear the approval message from chat interface
      setApprovalMessage(null)
      console.log('[ChatPage] Approval message cleared from UI')

      // 5. Refresh the message to show updated status
      await fetchApprovalMessage()
      console.log('[ChatPage] handleReject completed successfully')
    }
    catch (error) {
      console.error('[ChatPage] handleReject error:', error)
    }
  }

  // Clear approval message handler
  const handleClearApprovalMessage = () => {
    console.log('[ChatPage] handleClearApprovalMessage called - clearing approvalMessage')
    console.trace('[ChatPage] Stack trace for clear:')
    setApprovalMessage(null)
  }

  // Back handler
  const handleBack = () => {
    navigate('/')
  }

  // Loading state (only show when fetching approval message)
  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <Card className="p-6">
          <CardContent className="flex items-center space-x-4">
            <Clock className="h-6 w-6 text-gray-400 animate-pulse" />
            <p className="text-gray-600">Loading approval message...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state (only show for messageId-related errors)
  if (error && messageId) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <Card className="p-6">
          <CardContent className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={handleBack}
              className="text-blue-600 hover:underline"
            >
              ← Back to Messages
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Render chat interface
  return (
    <AssistantUIChat
      onBack={handleBack}
      currentApprovalMessage={approvalMessage || undefined}
      onApproveMessage={handleApprove}
      onRejectMessage={handleReject}
      onClearApprovalMessage={handleClearApprovalMessage}
    />
  )
}
