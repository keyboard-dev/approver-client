import { Clock } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Message } from '../../../types'
import { useAuth } from '../../hooks/useAuth'
import { useWebSocketConnection } from '../../hooks/useWebSocketConnection'
import { useDatabase } from '../../providers/DatabaseProvider'
import { databaseService } from '../../services/database-service'
import { Card, CardContent } from '../ui/card'
import { ApprovalScreen } from './ApprovalPanel'
import { CodeResponseApprovalPanel } from './CodeResponseApprovalPanel'

/**
 * MessageDetailScreen - Displays Security Evaluation Request and Code Response Approval messages using routing
 *
 * This component:
 * - Fetches the message from IndexedDB using the messageId URL parameter
 * - Renders the ApprovalScreen component for Security Evaluation Request messages
 * - Renders the CodeResponseApprovalPanel component for code response approval messages
 * - Handles approve/reject actions that update IndexedDB and notify main process
 * - Navigates back to the message list on completion
 *
 * Route: /messages/:messageId
 */
export const MessageDetailScreen: React.FC = () => {
  const { messageId } = useParams<{ messageId: string }>()
  const navigate = useNavigate()
  const { updateMessage } = useDatabase()
  const { authStatus, isSkippingAuth } = useAuth()
  const { connectionStatus } = useWebSocketConnection(authStatus, isSkippingAuth)

  const [message, setMessage] = useState<Message | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Helper function to fetch/refresh message
  const fetchMessage = async () => {
    if (!messageId) {
      setError('No message ID provided')
      setIsLoading(false)
      return
    }

    try {
      const fetchedMessage = await databaseService.getMessage(messageId)

      if (!fetchedMessage) {
        setError('Message not found')
        setIsLoading(false)
        return
      }

      // Verify this is a supported message type
      const supportedMessageTypes = ['Security Evaluation Request', 'code response approval']
      if (!supportedMessageTypes.includes(fetchedMessage.title)) {
        setError('This route only handles Security Evaluation Request and code response approval messages')
        setIsLoading(false)
        return
      }

      setMessage(fetchedMessage)
    }
    catch (err) {
      setError('Failed to load message')
    }
    finally {
      setIsLoading(false)
    }
  }

  // Fetch message from IndexedDB on mount
  useEffect(() => {
    fetchMessage()
  }, [messageId])

  // Approve message handler
  const handleApprove = async () => {
    if (!message) return

    try {
      // 1. Update database
      await updateMessage(message.id, {
        status: 'approved',
      })

      // 2. Fetch the updated message from database
      const updatedMessage = await databaseService.getMessage(message.id)
      if (!updatedMessage) {
        throw new Error('Failed to fetch updated message')
      }

      // 3. Notify main process to forward response to WebSocket
      await window.electronAPI.sendMessageResponse(updatedMessage)

      // 4. Refresh the message to show updated status
      await fetchMessage()
    }
    catch (error) {
      // Error occurred during approval
    }
  }

  // Reject message handler
  const handleReject = async () => {
    if (!message) return

    try {
      // 1. Update database
      await updateMessage(message.id, {
        status: 'rejected',
      })

      // 2. Fetch the updated message from database
      const updatedMessage = await databaseService.getMessage(message.id)
      if (!updatedMessage) {
        throw new Error('Failed to fetch updated message')
      }

      // 3. Notify main process to forward response to WebSocket
      await window.electronAPI.sendMessageResponse(updatedMessage)

      // 4. Refresh the message to show updated status
      await fetchMessage()
    }
    catch (error) {
      // Error occurred during rejection
    }
  }

  // Back handler
  const handleBack = () => {
    navigate('/')
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <Card className="p-6">
          <CardContent className="flex items-center space-x-4">
            <Clock className="h-6 w-6 text-gray-400 animate-pulse" />
            <p className="text-gray-600">Loading message...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (error || !message) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <Card className="p-6">
          <CardContent className="text-center">
            <p className="text-red-600 mb-4">{error || 'Message not found'}</p>
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

  // Render appropriate approval screen based on message type
  switch (message.title) {
    case 'Security Evaluation Request':
      return (
        <ApprovalScreen
          message={message}
          onApprove={handleApprove}
          onReject={handleReject}
          onBack={handleBack}
        />
      )

    case 'code response approval':
      return (
        <CodeResponseApprovalPanel
          message={message}
          onApprove={handleApprove}
          onReject={handleReject}
          onBack={handleBack}
          connectionStatus={connectionStatus}
        />
      )

    default:
      // Should never reach here due to validation above
      return null
  }
}
