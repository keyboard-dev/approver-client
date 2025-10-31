import Editor from '@monaco-editor/react'
import { Separator } from '@radix-ui/react-separator'
import { AlertTriangle, CheckCircle, Clock, Wifi, WifiOff, XCircle } from 'lucide-react'
import * as monaco from 'monaco-editor'
import lazyTheme from 'monaco-themes/themes/Lazy.json'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import iconGearUrl from '../../assets/icon-gear.svg'
import { Textarea } from '../components/ui/textarea'
import { ElectronAPI } from '../preload'
import { CollectionRequest, Message, ShareMessage } from '../types'
import './App.css'
import AuthComponent from './components/AuthComponent'
import GitHubOAuthButton from './components/GitHubOAuthButton'
import { Prompter } from './components/Prompter'
import { ApprovalScreen } from './components/screens/ApprovalPanel'
import OnboardingView from './components/screens/onboarding/OnboardingView'
import { SettingsScreen } from './components/screens/settings/SettingsScreen'
import { Share } from './components/Share'
import StatusDisplay from './components/StatusDisplay'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { ButtonDesigned } from './components/ui/ButtonDesigned'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { useAuth } from './hooks/useAuth'
import { useMessagesQuery } from './hooks/useMessagesQuery'
import { useDatabase } from './providers/DatabaseProvider'
import { Providers } from './providers/Providers'

const handleEditorWillMount = (monacoInstance: typeof monaco) => {
  monacoInstance.editor.defineTheme('lazy', lazyTheme as monaco.editor.IStandaloneThemeData)
}

const getEditorOptions = (): monaco.editor.IStandaloneEditorConstructionOptions => ({
  automaticLayout: true,
  fontFamily: '"Fira Code", monospace',
  fontSize: 14,
  fontWeight: '400',
  lineHeight: 1.5,
  lineNumbersMinChars: 0,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  wordWrap: 'on',
})

// Utility function to convert to sentence case
const toSentenceCase = (text: string): string => {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

const AppContent: React.FC = () => {
  // Auth state from useAuth hook (clean separation)
  const {
    authStatusRef,
    authStatus,
    isAuthenticated,
    isSkippingAuth,
  } = useAuth()

  // Database hook for initialization and mutations
  const { isInitialized: isDbInitialized, deleteMessages, updateMessage, updateShareMessage } = useDatabase()

  // Fetch messages directly from database (no in-memory cache)
  const { messages, shareMessages, refetch: refetchMessages } = useMessagesQuery()

  // Message and app state (moved back from auth hook)
  const [currentMessage, setCurrentMessage] = useState<Message | null>(null)
  const [currentShareMessage, setCurrentShareMessage] = useState<ShareMessage | null>(null)
  const [feedback, setFeedback] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected')
  const [isInitialized, setIsInitialized] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isFontLoaded, setIsFontLoaded] = useState(false)
  const [isGitHubConnected, setIsGitHubConnected] = useState(false)
  const [isCheckingGitHub, setIsCheckingGitHub] = useState(true)
  const [showPrompterOnly, setShowPrompterOnly] = useState(false)
  const [isConnectingToCodespace, setIsConnectingToCodespace] = useState(false)

  // Use refs to track state without causing re-renders
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Font loading effect
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null

    // Wait for Fira Code font to load before initializing Monaco Editor
    const checkFontLoaded = async () => {
      try {
        await document.fonts.load('400 16px "Fira Code"')
        // Small delay to ensure font is fully rendered
        timeoutId = setTimeout(() => setIsFontLoaded(true), 100)
      }
      catch {
        setIsFontLoaded(true)
      }
    }

    checkFontLoaded()

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [])

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

  // Debounced connection status update
  const updateConnectionStatus = useCallback((status: 'connected' | 'disconnected' | 'connecting') => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current)
    }

    connectionTimeoutRef.current = setTimeout(() => {
      setConnectionStatus(status)
    }, 100) // Small debounce to prevent rapid flickering
  }, [])

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
      setFeedback('')
      setShowFeedback(false)
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
    const handleShowMessage = (_event: unknown, message: Message) => {
      // Only handle messages if authenticated
      if (!authStatusRef.current.authenticated) {
        return
      }

      setCurrentMessage(message)
      // Message is automatically added to IndexedDB by DatabaseProvider
    }

    // Listen for websocket messages
    const handleWebSocketMessage = (_event: unknown, message: Message) => {
      // Only handle messages if authenticated
      if (!authStatusRef.current.authenticated) {
        return
      }

      setCurrentMessage(message)
      // Message is automatically added to IndexedDB by DatabaseProvider
      updateConnectionStatus('connected')
    }

    // Listen for collection share requests
    const handleCollectionShareRequest = (_event: unknown, shareMessage: ShareMessage) => {
      // Only handle messages if authenticated
      if (!authStatusRef.current.authenticated) {
        return
      }

      setCurrentShareMessage(shareMessage)
      // Share message stored in currentShareMessage state
      updateConnectionStatus('connected')
    }

    // Listen for show share message
    const handleShowShareMessage = (_event: unknown, shareMessage: ShareMessage) => {
      setCurrentShareMessage(shareMessage)
    }

    // Listen for connection status changes
    const handleConnectionStatusChange = (_event: unknown, status: 'connected' | 'disconnected' | 'connecting') => {
      updateConnectionStatus(status)
    }

    window.electronAPI.onShowMessage(handleShowMessage)
    window.electronAPI.onWebSocketMessage(handleWebSocketMessage)
    window.electronAPI.onCollectionShareRequest(handleCollectionShareRequest)
    window.electronAPI.onShowShareMessage(handleShowShareMessage)

    // Listen for connection status if available
    if ('onConnectionStatusChange' in window.electronAPI) {
      (window.electronAPI as ElectronAPI & { onConnectionStatusChange?: (handler: typeof handleConnectionStatusChange) => void }).onConnectionStatusChange?.(handleConnectionStatusChange)
    }

    // Cleanup listeners on unmount
    return () => {
      window.electronAPI.removeAllListeners('show-message')
      window.electronAPI.removeAllListeners('websocket-message')
      window.electronAPI.removeAllListeners('collection-share-request')
      window.electronAPI.removeAllListeners('show-share-message')

      if (window.electronAPI.removeAllListeners) {
        window.electronAPI.removeAllListeners('connection-status-change')
      }

      // Clean up timeouts
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current)
      }
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }
    }
  }, [updateConnectionStatus, authStatusRef]) // Only depend on the stable callbacks

  // Approve message
  const approveMessage = async () => {
    if (!currentMessage || !authStatusRef.current.authenticated) return

    try {
      // 1. Update database directly
      await updateMessage(currentMessage.id, {
        status: 'approved',
        feedback: showFeedback ? feedback : undefined,
      })

      // 2. Notify main process for WebSocket response only
      currentMessage.status = 'approved'
      await window.electronAPI.approveMessage(currentMessage, showFeedback ? feedback : undefined)

      // Note: No immediate refetch needed - list will refresh when navigating back via showMessageList()

      setFeedback('')
      setShowFeedback(false)
    }
    catch (error) {
      console.error('Error approving message:', error)
    }
  }

  // Reject message
  const rejectMessage = async () => {
    if (!currentMessage || !authStatusRef.current.authenticated) return

    try {
      // 1. Update database directly
      await updateMessage(currentMessage.id, {
        status: 'rejected',
        feedback: showFeedback ? feedback : undefined,
      })

      // 2. Notify main process for WebSocket response only
      await window.electronAPI.rejectMessage(currentMessage.id, showFeedback ? feedback : undefined)

      currentMessage.status = 'rejected'

      // Note: No immediate refetch needed - list will refresh when navigating back via showMessageList()

      setFeedback('')
      setShowFeedback(false)
    }
    catch (error) {
      console.error('Error rejecting message:', error)
    }
  }

  // Show message detail
  const showMessageDetail = (message: Message) => {
    if (!authStatusRef.current.authenticated) return

    setCurrentMessage(message)
    setFeedback(message.feedback || '')
    setShowFeedback(false)
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

  // Go back to message list
  const showMessageList = () => {
    setCurrentMessage(null)
    setCurrentShareMessage(null)
    setFeedback('')
    setShowFeedback(false)
    setShowSettings(false)
    setShowPrompterOnly(false)
    refreshMessages() // Refresh to show updated status
  }

  const toggleSettings = () => {
    setShowSettings(!showSettings)
    setCurrentMessage(null)
    setFeedback('')
    setShowFeedback(false)
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
          onClick={() => showMessageDetail(message)}
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

  const getCodeBlock = useCallback((message: Message) => {
    switch (message.title) {
      case 'code response approval': {
        if (!currentMessage || !currentMessage.codespaceResponse) return
        // const parsedBody = extractJsonFromCodeApproval(currentMessage.body)
        const { codespaceResponse } = currentMessage
        const { data: codespaceResponseData } = codespaceResponse
        if (!codespaceResponseData) return
        const hasError = Boolean(codespaceResponseData.stderr)

        return (
          <div className="bg-gray-100 p-4 rounded-lg grow shrink overflow-hidden flex flex-col">
            {/* Standard Output */}
            <div className="mb-2 grow shrink flex flex-col">
              <div className="text-sm font-medium text-gray-700 mb-1">Output:</div>
              <div className="border border-gray-200 rounded grow shrink">
                {isFontLoaded
                  ? (
                      <Editor
                        className="grow shrink min-h-24"
                        language="plaintext"
                        defaultValue="No output"
                        value={codespaceResponseData.stdout}
                        onChange={value => codespaceResponseData.stdout = value}
                        theme="lazy"
                        beforeMount={handleEditorWillMount}
                        options={getEditorOptions()}
                      />
                    )
                  : (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        Loading editor...
                      </div>
                    )}
              </div>
            </div>

            {/* Error Output */}
            {hasError && (
              <div className="mt-2 grow shrink flex flex-col">
                <div className="text-sm font-medium text-red-700 mb-1">
                  Error Output (Please review to see if there are any sensitive content):
                </div>
                <div className="border border-red-200 rounded bg-red-50 grow shrink">
                  {isFontLoaded
                    ? (
                        <Editor
                          className="min-h-24"
                          language="plaintext"
                          value={codespaceResponseData.stderr}
                          onChange={value => codespaceResponseData.stderr = value}
                          theme="lazy"
                          beforeMount={handleEditorWillMount}
                          options={getEditorOptions()}
                        />
                      )
                    : (
                        <div className="flex items-center justify-center h-full text-red-500">
                          Loading editor...
                        </div>
                      )}
                </div>
              </div>
            )}
          </div>
        )
      }
      default:
        return (
          <div className="bg-gray-100 p-4 rounded-lg max-h-96 overflow-auto">
            <pre className="whitespace-pre-wrap text-sm">
              {message.body}
            </pre>
          </div>
        )
    }
  }, [currentMessage, isFontLoaded, handleEditorWillMount, getEditorOptions])

  const getMessageSummary = useCallback((message: Message) => {
    switch (message.title) {
      case 'code response approval': {
        const { codespaceResponse } = message
        if (!codespaceResponse) return message.body
        const { data: codespaceResponseData } = codespaceResponse
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

  const connectToBestCodespace = async () => {
    if (!authStatusRef.current.authenticated) return

    setIsConnectingToCodespace(true)
    try {
      const success = await window.electronAPI.connectToBestCodespace()
      if (success) {
        updateConnectionStatus('connected')
      }
    }
    catch (error) {
      console.error('Failed to connect to best codespace:', error)
    }
    finally {
      setIsConnectingToCodespace(false)
    }
  }

  const getMessageScreen = () => {
    if (showPrompterOnly) {
      return (
        <Prompter message={{ title: 'prompter-request' }} onBack={showMessageList} />
      )
    }

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

    if ((authStatus.authenticated || isSkippingAuth) && !isCheckingGitHub && !isGitHubConnected) {
      return <OnboardingView onComplete={checkGitHubConnection} />
    }

    switch (currentMessage?.title) {
      case 'Security Evaluation Request':
        return (
          <ApprovalScreen
            message={currentMessage}
            onApprove={approveMessage}
            onBack={showMessageList}
            onReject={rejectMessage}
          />
        )
      case 'prompter-request':
        return (
          <Prompter message={currentMessage} />
        )

      default:
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
                {currentMessage
                  ? (
                // Message Detail View
                      <Card className="w-full h-full flex flex-col gap-6">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <Button variant="outline" onClick={showMessageList}>
                              ← Back to Messages
                            </Button>
                            <div className="flex items-center space-x-3">
                              {/* Connection Status Badge */}
                              <Badge
                                variant={connectionStatus === 'connected' ? 'default' : 'destructive'}
                                className={`connection-status-badge flex items-center space-x-2 px-3 py-2 ${
                                  connectionStatus === 'connected'
                                    ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100'
                                    : 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100'
                                }`}
                              >
                                {connectionStatus === 'connected'
                                  ? (
                                      <Wifi className="h-3 w-3" />
                                    )
                                  : (
                                      <WifiOff className="h-3 w-3" />
                                    )}
                                <span className="text-xs font-medium">
                                  {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
                                </span>
                              </Badge>
                              <div className="flex items-center space-x-2">
                                {getStatusIcon(currentMessage.status)}
                                {getStatusBadge(currentMessage.status)}
                              </div>
                            </div>
                          </div>
                          <CardTitle className="text-2xl font-bold mt-4">
                            {toSentenceCase(currentMessage.title)}
                          </CardTitle>
                          <div className="flex items-center space-x-4 text-sm text-gray-500">
                            <span>
                              From:
                              {currentMessage.sender || 'Unknown'}
                            </span>
                            <span>•</span>
                            <span>{new Date(currentMessage.timestamp).toLocaleString()}</span>
                            {currentMessage.priority && (
                              <>
                                <span>•</span>
                                {getPriorityBadge(currentMessage.priority)}
                              </>
                            )}
                          </div>
                        </CardHeader>
                        <div
                          className="p-6 grow shrink flex flex-col"
                        >
                          {/* Message Body - Show tabs if codeEval is true, otherwise show regular body */}
                          <div
                            className="grow shrink flex flex-col"
                          >
                            <h3 className="text-lg font-semibold mb-2">Request Details</h3>
                            {getCodeBlock(currentMessage)}
                          </div>

                          <Separator />

                          {/* Action Buttons */}
                          {currentMessage.status === 'pending' || !currentMessage.status
                            ? (
                                <div className="space-y-4">
                                  <h3 className="text-lg font-semibold">Actions Required</h3>

                                  {/* Feedback Section Toggle */}
                                  <div className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      id="show-feedback"
                                      checked={showFeedback}
                                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                        setShowFeedback(e.target.checked)}
                                      className="rounded"
                                    />
                                    <label htmlFor="show-feedback" className="text-sm">
                                      Add feedback/comments
                                    </label>
                                  </div>

                                  {/* Feedback Textarea */}
                                  {showFeedback && (
                                    <div className="space-y-2">
                                      <label className="text-sm font-medium">Feedback</label>
                                      <Textarea
                                        placeholder="Enter your feedback or comments..."
                                        value={feedback}
                                        onChange={e => setFeedback(e.target.value)}
                                        className="min-h-[100px]"
                                      />
                                    </div>
                                  )}

                                  {/* Action Buttons */}
                                  <div className="flex space-x-4">
                                    <Button
                                      onClick={approveMessage}
                                      className="bg-green-600 hover:bg-green-700 text-white"
                                    >
                                      <CheckCircle className="mr-2 h-4 w-4" />
                                      Approve
                                    </Button>
                                    <Button
                                      onClick={rejectMessage}
                                      variant="destructive"
                                    >
                                      <XCircle className="mr-2 h-4 w-4" />
                                      Reject
                                    </Button>
                                  </div>
                                </div>
                              )
                            : (
                                <div className="space-y-4">
                                  <h3 className="text-lg font-semibold">Status</h3>
                                  <div className="flex items-center space-x-2">
                                    {getStatusIcon(currentMessage.status)}
                                    <span className="text-sm">
                                      This request has been
                                      {' '}
                                      {currentMessage.status}
                                    </span>
                                  </div>

                                  {currentMessage.feedback && (
                                    <div className="space-y-2">
                                      <label className="text-sm font-medium">Feedback</label>
                                      <div className="bg-gray-100 p-3 rounded-lg text-sm">
                                        {currentMessage.feedback}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                        </div>
                      </Card>
                    )
                  : (
                // Message List View
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h1 className="text-3xl font-bold">
                            {showSettings ? 'Settings' : 'Message Approvals'}
                          </h1>
                          <div className="flex items-center space-x-3">
                            {!showSettings && (
                              <Button
                                variant="outline"
                                onClick={openPrompterOnly}
                                className="flex items-center space-x-2"
                              >
                                <span>Open Prompter</span>
                              </Button>
                            )}
                            {!showSettings && (
                              <Button
                                variant="outline"
                                onClick={connectToBestCodespace}
                                disabled={isConnectingToCodespace || connectionStatus === 'connected'}
                                className="flex items-center space-x-2"
                              >
                                <span>
                                  {isConnectingToCodespace
                                    ? 'Connecting...'
                                    : connectionStatus === 'connected'
                                      ? 'Connected'
                                      : 'Connect to Codespace'}
                                </span>
                              </Button>
                            )}
                            {!showSettings && (
                              <GitHubOAuthButton />
                            )}
                            {!showSettings && (messages.length > 0 || shareMessages.length > 0) && (
                              <Button
                                variant="outline"
                                onClick={() => clearNonPendingMessages()}
                                className="flex items-center space-x-2"
                              >
                                <span>Clear Non-Pending</span>
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              onClick={toggleSettings}
                              className="flex items-center space-x-2"
                            >
                              <span>{showSettings ? 'Back to Messages' : 'Settings'}</span>
                            </Button>
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
                    )}
              </div>
            )}
          </div>
        )
    }
  }

  return (
    <div
      className="flex flex-col w-full h-screen bg-transparent draggable rounded-[0.5rem] p-[0.63rem] pt-0 items-center text-[0.88rem] text-[#171717] font-medium font-inter"
    >
      <div className="flex w-full -h-[1.56rem] mx-[1.25rem] my-[0.5rem] justify-between z-20">
        <div
          className="px-[0.5rem] py-[0.25rem] w-4 h-4"
        />
        <StatusDisplay />
        <ButtonDesigned
          className="px-[0.5rem] py-[0.25rem] rounded-full not-draggable"
          variant="secondary"
          onClick={toggleSettings}
        >
          <img src={iconGearUrl} alt="Settings" className="w-4 h-4" />
        </ButtonDesigned>
      </div>

      <div
        className="flex flex-col w-full min-w-0 grow min-h-0 bg-white rounded-[0.5rem] px-[0.63rem] py-[0.75rem] not-draggable gap-[0.63rem] items-start overflow-auto"
      >
        {showSettings
          ? (
              <SettingsScreen
                onBack={showMessageList}
              />
            )
          : getMessageScreen()}
      </div>
    </div>
  )
}

const App: React.FC = () => {
  return (
    <Providers>
      <AppContent />
    </Providers>
  )
}

export default App
