import Editor from '@monaco-editor/react'
import { Separator } from '@radix-ui/react-separator'
import { AlertTriangle, CheckCircle, Clock, Wifi, WifiOff, XCircle } from 'lucide-react'
import * as monaco from 'monaco-editor'
import lazyTheme from 'monaco-themes/themes/Lazy.json'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import iconGearUrl from '../../assets/icon-gear.svg'
import { Textarea } from '../components/ui/textarea'
import { AuthStatus, ElectronAPI } from '../preload'
import { Message } from '../types'
import './App.css'
import AuthComponent from './components/AuthComponent'
import { ApprovalScreen } from './components/screens/ApprovalScreen'
import { SettingsScreen } from './components/screens/settings/SettingsScreen'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'

// Monaco Editor configuration for output display
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
  wordWrap: 'on',
})

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [currentMessage, setCurrentMessage] = useState<Message | null>(null)
  const [feedback, setFeedback] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected')
  // const [isAlertDismissed, setIsAlertDismissed] = useState(false)
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ authenticated: false })
  const [isInitialized, setIsInitialized] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isSkippingAuth, setIsSkippingAuth] = useState(false)
  const [isFontLoaded, setIsFontLoaded] = useState(false)

  // Use refs to track state without causing re-renders
  const authStatusRef = useRef<AuthStatus>({ authenticated: false })
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Font loading effect
  useEffect(() => {
    // Wait for Fira Code font to load before initializing Monaco Editor
    const checkFontLoaded = async () => {
      try {
        await document.fonts.load('400 16px "Fira Code"')
        // Small delay to ensure font is fully rendered
        setTimeout(() => setIsFontLoaded(true), 100)
      }
      catch (error) {
        console.warn('Font loading failed, proceeding with fallback:', error)
        setIsFontLoaded(true)
      }
    }

    checkFontLoaded()
  }, [])

  // Debounced connection status update
  const updateConnectionStatus = useCallback((status: 'connected' | 'disconnected' | 'connecting') => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current)
    }

    connectionTimeoutRef.current = setTimeout(() => {
      setConnectionStatus(status)
      // if (status === 'connected') {
      //   setIsAlertDismissed(false)
      // }
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

  // Handle authentication state changes
  const handleAuthChange = useCallback((newAuthStatus: AuthStatus) => {
    authStatusRef.current = newAuthStatus
    setAuthStatus(newAuthStatus)

    // If user logged out, clear messages for security
    if (!newAuthStatus.authenticated) {
      setMessages([])
      setCurrentMessage(null)
      setFeedback('')
      setShowFeedback(false)
      setIsInitialized(false)
    }
    else if (!isInitialized) {
      // Only load messages on first authentication, not on every auth change
      setIsInitialized(true);
      // Load messages directly without dependency
      (async () => {
        if (newAuthStatus.authenticated) {
          updateLoadingState(true)
          try {
            const loadedMessages = await window.electronAPI.getMessages()
            setMessages(loadedMessages)
          }
          catch (error) {
            console.error('Error loading messages:', error)
          }
          finally {
            updateLoadingState(false)
          }
        }
      })()
    }
  }, [isInitialized, updateLoadingState])

  // Refresh messages without showing loading state for better UX
  const refreshMessages = useCallback(async () => {
    if (!authStatusRef.current.authenticated) {
      return
    }

    try {
      const loadedMessages = await window.electronAPI.getMessages()
      setMessages(loadedMessages)
    }
    catch (error) {
      console.error('Error refreshing messages:', error)
    }
  }, [])

  // Initialize event listeners only once
  useEffect(() => {
    // Listen for regular messages from main process
    const handleShowMessage = (_event: unknown, message: Message) => {
      // Only handle messages if authenticated
      if (!authStatusRef.current.authenticated) {
        return
      }

      setCurrentMessage(message)
      setMessages((prev) => {
        const existing = prev.find(m => m.id === message.id)
        if (existing) {
          return prev.map(m => m.id === message.id ? message : m)
        }
        return [message, ...prev]
      })
    }

    // Listen for websocket messages
    const handleWebSocketMessage = (_event: unknown, message: Message) => {
      // Only handle messages if authenticated
      if (!authStatusRef.current.authenticated) {
        return
      }

      setCurrentMessage(message)
      setMessages((prev) => {
        const existing = prev.find(m => m.id === message.id)
        if (existing) {
          return prev.map(m => m.id === message.id ? message : m)
        }
        return [message, ...prev]
      })
      updateConnectionStatus('connected')
    }

    // Listen for connection status changes
    const handleConnectionStatusChange = (_event: unknown, status: 'connected' | 'disconnected' | 'connecting') => {
      updateConnectionStatus(status)
    }

    window.electronAPI.onShowMessage(handleShowMessage)
    window.electronAPI.onWebSocketMessage(handleWebSocketMessage)

    // Listen for connection status if available
    if ('onConnectionStatusChange' in window.electronAPI) {
      (window.electronAPI as ElectronAPI & { onConnectionStatusChange?: (handler: typeof handleConnectionStatusChange) => void }).onConnectionStatusChange?.(handleConnectionStatusChange)
    }

    // Cleanup listeners on unmount
    return () => {
      window.electronAPI.removeAllListeners('show-message')
      window.electronAPI.removeAllListeners('websocket-message')

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
  }, [updateConnectionStatus]) // Only depend on the stable callback

  // Approve message
  const approveMessage = async () => {
    if (!currentMessage || !authStatusRef.current.authenticated) return

    try {
      await window.electronAPI.approveMessage(currentMessage, showFeedback ? feedback : undefined)

      currentMessage.status = 'approved'

      refreshMessages()

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
      await window.electronAPI.rejectMessage(currentMessage.id, showFeedback ? feedback : undefined)

      currentMessage.status = 'rejected'

      refreshMessages()

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

  // Go back to message list
  const showMessageList = () => {
    setCurrentMessage(null)
    setFeedback('')
    setShowFeedback(false)
    setShowSettings(false)
    refreshMessages() // Refresh to show updated status without loading state
  }

  const toggleSettings = () => {
    setShowSettings(!showSettings)
    setCurrentMessage(null)
    setFeedback('')
    setShowFeedback(false)
  }

  const getStatusIcon = (status?: string) => {
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
  }

  const getStatusBadge = (status?: string) => {
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
  }

  const getPriorityBadge = (priority?: string) => {
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
  }

  const getCodeBlock = (message: Message) => {
    switch (message.title) {
      case 'code response approval': {
        if (!currentMessage || !currentMessage.codespaceResponse) return
        // const parsedBody = extractJsonFromCodeApproval(currentMessage.body)
        const { codespaceResponse } = currentMessage
        const { data: codespaceResponseData } = codespaceResponse
        const hasError = Boolean(codespaceResponseData.stderr)

        return (
          <div className="bg-gray-100 p-4 rounded-lg h-96 overflow-hidden flex flex-col">
            {/* Standard Output */}
            <div className="mb-2 flex-grow flex flex-col">
              <div className="text-sm font-medium text-gray-700 mb-1">Output:</div>
              <div className="border border-gray-200 rounded flex-grow">
                {isFontLoaded
                  ? (
                      <Editor
                        height="100%"
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
              <div className="mt-2 flex-grow flex flex-col">
                <div className="text-sm font-medium text-red-700 mb-1">
                  Error Output (Please review to see if there are any sensitive content):
                </div>
                <div className="border border-red-200 rounded bg-red-50 flex-grow">
                  {isFontLoaded
                    ? (
                        <Editor
                          height="100%"
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
  }

  const getMessageSummary = (message: Message) => {
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
  }

  const getMessageScreen = () => {
    switch (currentMessage?.title) {
      case 'Security Evaluation Request':
        return (
          <ApprovalScreen
            message={currentMessage}
            onApprove={approveMessage}
            onBack={showMessageList}
            onReject={rejectMessage}
            systemStatus="" // todo
          />
        )

      default:
        return (
          <div
            className="flex flex-col w-full grow min-h-0 bg-white rounded-[0.5rem] px-[0.63rem] py-[0.75rem] not-draggable gap-[0.63rem] items-start overflow-auto"
          >
            <div className="max-w-4xl mx-auto">
              {/* Authentication Component */}
              <AuthComponent
                onAuthChange={handleAuthChange}
                isSkippingAuth={isSkippingAuth}
                setIsSkippingAuth={setIsSkippingAuth}
              />

              {/* Only show main content if authenticated */}
              {(authStatus.authenticated || isSkippingAuth) && (
                <div className="content-fade-in">
                  {currentMessage
                    ? (
                  // Message Detail View
                        <Card className="w-full">
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
                              {currentMessage.title}
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
                          <CardContent className="space-y-6">
                            {/* Message Body - Show tabs if codeEval is true, otherwise show regular body */}
                            <div>
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
                          </CardContent>
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
                          {messages.length === 0
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
                                  {messages.map(message => (
                                    <Card
                                      key={message.id}
                                      className="cursor-pointer hover:shadow-md transition-shadow"
                                      onClick={() => showMessageDetail(message)}
                                    >
                                      <CardContent className="p-4">
                                        <div className="flex items-center justify-between mb-2">
                                          <h3 className="text-lg font-semibold truncate">{message.title}</h3>
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
                                  ))}
                                </div>
                              )}

                        </div>
                      )}
                </div>
              )}
            </div>
          </div>
        )
    }
  }

  return (
    <div
      className="flex flex-col w-full h-screen bg-transparent draggable rounded-[0.5rem] p-[0.63rem] pt-0 items-center text-[0.88rem] text-[#171717] font-medium"
    >
      <div className="flex w-full -h-[1.56rem] mx-[1.25rem] my-[0.5rem] justify-between">
        <div
          className="px-[0.5rem] py-[0.25rem] w-4 h-4"
        />
        <div
          className="px-[0.75rem] py-[0.25rem] rounded-full bg-[#BFBFBF] flex items-center gap-[0.63rem]"
        >
          <div
            className="w-[10px] h-[10px] rounded-full bg-[#7BB750]"
          />
          <div
            className="text-[#737373]"
          >
            All systems are
            {' '}
            <span className="text-[#7BB750] font-semibold">
              normal
            </span>
          </div>
        </div>
        <button
          onClick={toggleSettings}
          className="px-[0.5rem] py-[0.25rem] rounded-full bg-[#BFBFBF] not-draggable"
        >
          <img src={iconGearUrl} alt="Settings" className="w-4 h-4" />
        </button>
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

export default App
