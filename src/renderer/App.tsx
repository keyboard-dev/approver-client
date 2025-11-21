import { AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { MemoryRouter, useNavigate } from 'react-router-dom'

import { CollectionRequest, Message, ShareMessage } from '../types'
import './App.css'
import { AppRoutes } from './AppRoutes'
import { AssistantUIChat } from './components/AssistantUIChat'
import AuthComponent from './components/AuthComponent'
import { Chat } from './components/Chat'
import { CopilotKitChat } from './components/CopilotKitChat'
import GitHubOAuthButton from './components/GitHubOAuthButton'
import { Prompter } from './components/Prompter'
import OnboardingView from './components/screens/onboarding/OnboardingView'
import { Share } from './components/Share'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Card, CardContent } from './components/ui/card'
import { Toaster } from './components/ui/sonner'
import { useAuth } from './hooks/useAuth'
import { useMessagesQuery } from './hooks/useMessagesQuery'
import { useDatabase } from './providers/DatabaseProvider'
import { Providers } from './providers/Providers'

// Utility function to convert to sentence case
const toSentenceCase = (text: string): string => {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

/*
 * REACT ROUTER MIGRATION NOTE:
 *
 * This app uses React Router for navigation with MemoryRouter.
 *
 * Routing Structure:
 * - / : Message list view (this component)
 * - /messages/:messageId : Message detail view (MessageDetailScreen)
 *   - Security Evaluation Request → ApprovalPanel
 *   - code response approval → CodeResponseApprovalPanel
 * - /settings/:tab? : Settings screen
 *
 * Why MemoryRouter?
 * - Electron apps use file:// protocol, which doesn't work well with BrowserRouter
 * - MemoryRouter keeps history in memory, perfect for desktop apps
 * - No URL bar in Electron, so memory-based routing is ideal
 *
 * Migration Status:
 * ✅ Security Evaluation Request migrated to /messages/:messageId route
 * ✅ code response approval migrated to /messages/:messageId route
 * ✅ Settings screen uses /settings/:tab routes
 * ⏳ Prompter-only mode still uses state (showPrompterOnly) - special case
 *
 * See ROUTER_MIGRATION.md for detailed migration guide.
 */

export const AppContent: React.FC = () => {
  const navigate = useNavigate()
  // Auth state from useAuth hook (clean separation)
  const {
    authStatusRef,
    authStatus,
    isAuthenticated,
    isSkippingAuth,
  } = useAuth()

  // Database hook for initialization and mutations
  const { isInitialized: isDbInitialized, deleteMessages, updateShareMessage, updateMessage, addMessage } = useDatabase()

  // Fetch messages directly from database (no in-memory cache)
  const { messages, shareMessages, refetch: refetchMessages } = useMessagesQuery()
  // Message and app state (moved back from auth hook)
  const [currentMessage, setCurrentMessage] = useState<Message | null>(null)
  const [currentShareMessage, setCurrentShareMessage] = useState<ShareMessage | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isGitHubConnected, setIsGitHubConnected] = useState(false)
  const [isCheckingGitHub, setIsCheckingGitHub] = useState(true)
  const [showPrompterOnly, setShowPrompterOnly] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showCopilotChat, setShowCopilotChat] = useState(false)
  const [showAssistantChat, setShowAssistantChat] = useState(false)

  // Use refs to track state without causing re-renders
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Check GitHub connection status
  const checkGitHubConnection = useCallback(async () => {
    try {
      const connected = await window.electronAPI.checkOnboardingGithubToken()
      setIsGitHubConnected(connected)
    }
    catch (error) {
      console.error('Failed to check GitHub connection:', error)
      setIsGitHubConnected(false)
    }
    finally {
      setIsCheckingGitHub(false)
    }
  }, [])

  // Check GitHub connection on mount and when auth status changes
  useEffect(() => {
    if (authStatus.authenticated || isSkippingAuth) {
      checkGitHubConnection()
    }
  }, [authStatus.authenticated, isSkippingAuth, checkGitHubConnection])

  // Debounced loading state update
  const updateLoadingState = useCallback((loading: boolean) => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current)
    }

    if (loading) {
      // Show loading immediately
      setIsLoading(true)
    }
    else {
      // Delay hiding loading to prevent flicker
      loadingTimeoutRef.current = setTimeout(() => {
        setIsLoading(false)
      }, 200)
    }
  }, [])

  // Refresh messages without showing loading state for better UX
  const refreshMessages = useCallback(async () => {
    if (!authStatusRef.current.authenticated) {
      return
    }

    try {
      await refetchMessages()
    }
    catch (error) {
      console.error('Error refreshing messages:', error)
    }
  }, [authStatusRef, refetchMessages])

  // Clear non-pending messages
  const clearNonPendingMessages = useCallback(async () => {
    try {
      const nonPendingMessages = messages.filter(m => m.status !== 'pending' && m.status)
      const messageIds = nonPendingMessages.map(m => m.id)
      await deleteMessages(messageIds)
      refreshMessages()
    }
    catch (error) {
      console.error('Error clearing messages:', error)
    }
  }, [messages, refreshMessages, deleteMessages])

  // Handle authentication state changes with message/UI management
  useEffect(() => {
    if (!isAuthenticated) {
      // If user logged out, clear UI state
      // Messages will be cleared from IndexedDB if needed
      setCurrentMessage(null)
      setCurrentShareMessage(null)
      setIsInitialized(false)
    }
    else if (!isInitialized && isAuthenticated && isDbInitialized) {
      setIsInitialized(true)
      // Messages are already loaded by DatabaseProvider
      updateLoadingState(false)
    }
  }, [isAuthenticated, isInitialized, isDbInitialized, updateLoadingState])

  // Initialize event listeners only once
  useEffect(() => {
    // Listen for regular messages from main process
    const handleShowMessage = async (_event: unknown, message: Message) => {
      // Only handle messages if authenticated
      if (!authStatusRef.current.authenticated) {
        return
      }

      try {
        // CRITICAL: Save to database FIRST to prevent race conditions
        await addMessage(message)

        // For Security Evaluation Request and code response approval, handle based on context
        if (message.title === 'Security Evaluation Request' || message.title === 'code response approval') {
          if (showAssistantChat) {
            // If in chat mode, set currentMessage for inline approval
            setCurrentMessage(message)
          }
          else {
            // If not in chat mode, navigate to the message detail route
            navigate(`/messages/${message.id}`)
          }
        }
        else {
          // For other message types, keep existing state-based behavior
          setCurrentMessage(message)
        }
      }
      catch (error) {
        console.error('Failed to save message to database:', error)
        // Still proceed with UI update as fallback (DatabaseProvider listener may save it)
        if (message.title === 'Security Evaluation Request' || message.title === 'code response approval') {
          if (showAssistantChat) {
            // If in chat mode, set currentMessage for inline approval
            setCurrentMessage(message)
          }
          else {
            // If not in chat mode, navigate to the message detail route
            navigate(`/messages/${message.id}`)
          }
        }
        else {
          setCurrentMessage(message)
        }
      }
    }


    // Listen for custom chat approval events from the global WebSocket listener
    const handleChatApprovalMessage = (event: CustomEvent<Message>) => {
      const message = event.detail
      console.log('💬 App.tsx: Received chat-approval-message event', message)
      console.log('💬 App.tsx: showAssistantChat state:', showAssistantChat)
      console.log('💬 App.tsx: authenticated:', authStatusRef.current.authenticated)
      
      // Check if we're currently on the home route (where chat can be active)
      if (authStatusRef.current.authenticated) {
        // Always set currentMessage when on home route - let the chat component decide if it should display
        console.log('💬 App.tsx: Setting currentMessage for potential inline approval', message)
        setCurrentMessage(message)
      } else {
        console.log('💬 App.tsx: Not authenticated, ignoring approval message')
      }
    }

    // NOTE: WebSocket message listeners (websocket-message, collection-share-request, show-share-message)
    // are now handled globally in Layout via useGlobalWebSocketListeners hook.
    // This ensures they persist across route changes and don't get cleaned up when this component unmounts.

    window.electronAPI.onShowMessage(handleShowMessage)
    window.addEventListener('chat-approval-message', handleChatApprovalMessage as EventListener)

    // Cleanup listeners on unmount
    return () => {
      window.electronAPI.removeAllListeners('show-message')
      window.removeEventListener('chat-approval-message', handleChatApprovalMessage as EventListener)
      // NOTE: websocket-message, collection-share-request, show-share-message cleanup
      // is handled by useGlobalWebSocketListeners in Layout

      // Clean up timeouts
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }
    }
  }, [authStatusRef, navigate, addMessage]) // Removed addShareMessage since we no longer use it here

  // Show message detail
  const showMessageDetail = (message: Message) => {
    if (!authStatusRef.current.authenticated) return

    // For Security Evaluation Request and code response approval, use routing instead of state
    if (message.title === 'Security Evaluation Request' || message.title === 'code response approval') {
      navigate(`/messages/${message.id}`)
    }
    else {
      // For other message types, keep existing state-based behavior
      setCurrentMessage(message)
    }
  }

  // Approve collection share
  const approveCollectionShare = async (messageId: string, updatedRequest: CollectionRequest) => {
    if (!authStatusRef.current.authenticated) return

    try {
      // 1. Update database directly
      await updateShareMessage(messageId, {
        status: 'approved',
        collectionRequest: updatedRequest,
      })

      // 2. Notify main process for WebSocket response only
      await window.electronAPI.approveCollectionShare(messageId, updatedRequest)

      setCurrentShareMessage(null)
      // Note: No manual refresh needed - database events trigger automatic UI update
    }
    catch (error) {
      console.error('Error approving collection share:', error)
    }
  }

  // Reject collection share
  const rejectCollectionShare = async (messageId: string) => {
    if (!authStatusRef.current.authenticated) return

    try {
      // 1. Update database directly
      await updateShareMessage(messageId, {
        status: 'rejected',
      })

      // 2. Notify main process for WebSocket response only
      await window.electronAPI.rejectCollectionShare(messageId)

      setCurrentShareMessage(null)
      // Note: No manual refresh needed - database events trigger automatic UI update
    }
    catch (error) {
      console.error('Error rejecting collection share:', error)
    }
  }

  // Approve message (for inline chat approvals)
  const approveMessage = async () => {
    if (!currentMessage || !authStatusRef.current.authenticated) return

    try {
      // 1. Update database
      await updateMessage(currentMessage.id, {
        status: 'approved',
      })

      // 2. Fetch the updated message from database to get latest state
      const databaseService = await import('./services/database-service')
      const updatedMessage = await databaseService.databaseService.getMessage(currentMessage.id)
      if (!updatedMessage) {
        throw new Error('Failed to fetch updated message')
      }

      // 3. Notify main process to forward response to WebSocket
      await window.electronAPI.sendMessageResponse(updatedMessage)

      // 4. Clear the current message from chat interface
      setCurrentMessage(null)

      // 5. Refresh messages to show updated status
      refreshMessages()
    }
    catch (error) {
      console.error('Error approving message:', error)
    }
  }

  // Reject message (for inline chat approvals)
  const rejectMessage = async () => {
    if (!currentMessage || !authStatusRef.current.authenticated) return

    try {
      // 1. Update database
      await updateMessage(currentMessage.id, {
        status: 'rejected',
      })

      // 2. Fetch the updated message from database to get latest state
      const databaseService = await import('./services/database-service')
      const updatedMessage = await databaseService.databaseService.getMessage(currentMessage.id)
      if (!updatedMessage) {
        throw new Error('Failed to fetch updated message')
      }

      // 3. Notify main process to forward response to WebSocket
      await window.electronAPI.sendMessageResponse(updatedMessage)

      // 4. Clear the current message from chat interface
      setCurrentMessage(null)

      // 5. Refresh messages to show updated status
      refreshMessages()
    }
    catch (error) {
      console.error('Error rejecting message:', error)
    }
  }

  // Go back to message list
  const showMessageList = () => {
    setCurrentMessage(null)
    setCurrentShareMessage(null)
    setShowPrompterOnly(false)
    setShowChat(false)
    setShowCopilotChat(false)
    setShowAssistantChat(false)
    navigate('/') // Use React Router to navigate home
    refreshMessages() // Refresh to show updated status
  }

  const getStatusIcon = useCallback((status?: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />
    }
  }, [])

  const getStatusBadge = useCallback((status?: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>
      default:
        return <Badge variant="outline">New</Badge>
    }
  }, [])

  const getPriorityBadge = useCallback((priority?: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">High Priority</Badge>
      case 'normal':
        return <Badge variant="secondary">Normal</Badge>
      case 'low':
        return <Badge variant="outline">Low Priority</Badge>
      default:
        return null
    }
  }, [])

  const getMessagesDisplay = () => {
    const sortedMessages = [...messages, ...shareMessages].sort((a, b) => b.timestamp - a.timestamp)

    return sortedMessages.map((message) => {
      if (message.type === 'prompt-response') {
        return (
          <Card
            key={`message-display-${message.id}`}
            className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-blue-500"
            onClick={() => setCurrentShareMessage(message as ShareMessage)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold truncate">{toSentenceCase(message.title)}</h3>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(message.status)}
                  {getStatusBadge(message.status)}
                </div>
              </div>
              <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                {message.body}
              </p>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>
                  From:
                  {' '}
                  {message.sender || 'Unknown'}
                  {' '}
                  • Collection Share
                </span>
                <span>{new Date(message.timestamp).toLocaleString()}</span>
              </div>
              {message.priority && (
                <div className="mt-2">
                  {getPriorityBadge(message.priority)}
                </div>
              )}
            </CardContent>
          </Card>
        )
      }
      return (
        <Card
          key={`message-display-${message.id}`}
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => showMessageDetail(message as Message)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold truncate">{toSentenceCase(message.title)}</h3>
              <div className="flex items-center space-x-2">
                {getStatusIcon(message.status)}
                {getStatusBadge(message.status)}
              </div>
            </div>
            <p className="text-gray-600 text-sm mb-2 line-clamp-2">
              {getMessageSummary(message)}
            </p>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                From:
                {message.sender || 'Unknown'}
              </span>
              <span>{new Date(message.timestamp).toLocaleString()}</span>
            </div>
            {message.priority && (
              <div className="mt-2">
                {getPriorityBadge(message.priority)}
              </div>
            )}
          </CardContent>
        </Card>
      )
    })
  }

  const getMessageSummary = useCallback((message: Message) => {
    switch (message.title) {
      case 'code response approval': {
        const { codespaceResponse } = message
        if (!codespaceResponse) return message.body
        const { data: codespaceResponseData } = codespaceResponse
        if (!codespaceResponseData) return message.body
        const { stdout, stderr } = codespaceResponseData
        return (
          <>
            {stderr && (
              <span className="text-red-500">
                Error:
                {' '}
                {stderr}
              </span>
            )}
            {stdout}
          </>
        )
      }
      case 'Security Evaluation Request':
      default:
        return message.body
    }
  }, [])

  const openPrompterOnly = () => {
    setShowPrompterOnly(true)
  }

  const handleBackFromPrompter = () => {
    setShowPrompterOnly(false)
    navigate('/')
  }

  const getMessageScreen = () => {
    // Special case: Chat modes
    if (showAssistantChat) {
      console.log('showAssistantChat', currentMessage)
      return (
        <AssistantUIChat
          onBack={showMessageList}
          currentApprovalMessage={
            (currentMessage?.title === 'Security Evaluation Request'
              || currentMessage?.title === 'code response approval')
              ? currentMessage
              : undefined
          }
          onApproveMessage={async (message) => {
            // Set the currentMessage to match what App.tsx expects, then call approveMessage
            setCurrentMessage(message)
            await approveMessage()
          }}
          onRejectMessage={async (message) => {
            // Set the currentMessage to match what App.tsx expects, then call rejectMessage
            setCurrentMessage(message)
            await rejectMessage()
          }}
          onClearApprovalMessage={() => {
            // Clear the current approval message after action is complete
            setCurrentMessage(null)
          }}
        />
      )
    }

    if (showCopilotChat) {
      return <CopilotKitChat onBack={showMessageList} />
    }

    if (showChat) {
      return <Chat onBack={showMessageList} />
    }

    // Special case: Prompter-only mode (opened from button, not a message)
    if (showPrompterOnly) {
      return (
        <Prompter message={{ title: 'prompter-request' }} onBack={handleBackFromPrompter} />
      )
    }

    // Check if onboarding is needed
    if ((authStatus.authenticated || isSkippingAuth) && !isCheckingGitHub && !isGitHubConnected) {
      return <OnboardingView onComplete={checkGitHubConnection} />
    }

    // Show collection share request if present
    if (currentShareMessage) {
      return (
        <Share
          request={currentShareMessage.collectionRequest}
          onApprove={updatedRequest => approveCollectionShare(currentShareMessage.id, updatedRequest)}
          onReject={() => rejectCollectionShare(currentShareMessage.id)}
          onBack={showMessageList}
        />
      )
    }

    // Show message detail if present
    if (currentMessage) {
      switch (currentMessage.title) {
        // NOTE: Security Evaluation Request and code response approval now use routing (/messages/:messageId)
        // They are handled by MessageDetailScreen component

        case 'prompter-request':
          return (
            <Prompter message={currentMessage} onBack={showMessageList} />
          )

        default:
          // For any other message types not yet migrated to routing
          // This should rarely be reached as most messages use routing now
          return null
      }
    }

    // Main screen: Authentication + Message List
    return (
      <div className="w-full grow min-h-0 mx-auto flex flex-col">
        {/* Authentication Component */}
        <AuthComponent />

        {/* Show loading while checking GitHub connection */}
        {(authStatus.authenticated || isSkippingAuth) && isCheckingGitHub && (
          <div className="flex items-center justify-center min-h-screen">
            <Card className="p-6">
              <CardContent className="flex items-center space-x-4">
                <Clock className="h-6 w-6 text-gray-400 animate-pulse" />
                <p className="text-gray-600">Checking GitHub connection...</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Only show main content if authenticated and GitHub connected */}
        {(authStatus.authenticated || isSkippingAuth) && isGitHubConnected && (
          <div className="content-fade-in grow min-h-0">
            {/* Message List View */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold">
                  Message Approvals
                </h1>
                <div className="flex items-center space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowAssistantChat(true)}
                    className="flex items-center space-x-2"
                  >
                    <span>Chat</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={openPrompterOnly}
                    className="flex items-center space-x-2"
                  >
                    <span>Open Prompter</span>
                  </Button>
                  <GitHubOAuthButton />
                  {(messages.length > 0 || shareMessages.length > 0) && (
                    <Button
                      variant="outline"
                      onClick={() => clearNonPendingMessages()}
                      className="flex items-center space-x-2"
                    >
                      <span>Clear Non-Pending</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Message List View */}
              {(messages.length === 0 && shareMessages.length === 0)
                ? (
                    <Card>
                      <CardContent className="p-8 text-center">
                        <Clock className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <p className="text-gray-500">
                          {isLoading ? 'Loading messages...' : 'No messages to approve. Waiting for WebSocket messages...'}
                        </p>
                      </CardContent>
                    </Card>
                  )
                : (
                    <div className={`grid gap-4 ${isLoading ? 'loading-fade' : ''}`}>
                      {getMessagesDisplay()}
                    </div>
                  )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return getMessageScreen()
}

const App: React.FC = () => {
  return (
    <Providers>
      <MemoryRouter>
        <AppRoutes />
      </MemoryRouter>
      <Toaster />
    </Providers>
  )
}

export default App
