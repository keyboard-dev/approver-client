import { IpcRendererEvent } from 'electron'
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { SKIP_AUTH_USER_EMAIL, SKIP_AUTH_USER_FIRST_NAME, SKIP_AUTH_USER_ID, SKIP_AUTH_USER_LAST_NAME } from '../../lib/constants/auth.constants'
import { AuthError, AuthStatus, ElectronAPI } from '../../preload'
import { CollectionRequest, Message, ShareMessage } from '../../types'

interface AuthContextType {
  authStatus: AuthStatus
  isSkippingAuth: boolean
  authStatusRef: React.MutableRefObject<AuthStatus>
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: () => Promise<void>
  logout: () => Promise<void>
  skipAuth: () => void
  
  // GitHub connection management
  isGitHubConnected: boolean
  isCheckingGitHub: boolean
  checkGitHubConnection: () => Promise<void>
  
  // Message management
  messages: Message[]
  shareMessages: ShareMessage[]
  currentMessage: Message | null
  currentShareMessage: ShareMessage | null
  refreshMessages: () => Promise<void>
  clearNonPendingMessages: () => Promise<void>
  
  // App state management
  isInitialized: boolean
  connectionStatus: 'connected' | 'disconnected' | 'connecting'
  
  // Message actions (with auth guards)
  approveMessage: (message: Message, feedback?: string) => Promise<void>
  rejectMessage: (messageId: string, feedback?: string) => Promise<void>
  showMessageDetail: (message: Message) => void
  approveCollectionShare: (messageId: string, updatedRequest: CollectionRequest) => Promise<void>
  rejectCollectionShare: (messageId: string) => Promise<void>
  
  // UI state management
  currentMessageRef: React.MutableRefObject<Message | null>
  currentShareMessageRef: React.MutableRefObject<ShareMessage | null>
  setCurrentMessage: (message: Message | null) => void
  setCurrentShareMessage: (message: ShareMessage | null) => void
  
  // Connection management
  updateConnectionStatus: (status: 'connected' | 'disconnected' | 'connecting') => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: React.ReactNode
  onAuthChange?: (authStatus: AuthStatus) => void
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, onAuthChange }) => {
  // Auth state
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ authenticated: false })
  const [isSkippingAuth, setIsSkippingAuth] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // GitHub connection state
  const [isGitHubConnected, setIsGitHubConnected] = useState(false)
  const [isCheckingGitHub, setIsCheckingGitHub] = useState(true)

  // Message state
  const [messages, setMessages] = useState<Message[]>([])
  const [shareMessages, setShareMessages] = useState<ShareMessage[]>([])
  const [currentMessage, setCurrentMessage] = useState<Message | null>(null)
  const [currentShareMessage, setCurrentShareMessage] = useState<ShareMessage | null>(null)

  // App state
  const [isInitialized, setIsInitialized] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected')

  // Refs for stable references
  const authStatusRef = useRef<AuthStatus>({ authenticated: false })
  const currentMessageRef = useRef<Message | null>(null)
  const currentShareMessageRef = useRef<ShareMessage | null>(null)
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Sync refs with state
  useEffect(() => {
    currentMessageRef.current = currentMessage
  }, [currentMessage])

  useEffect(() => {
    currentShareMessageRef.current = currentShareMessage
  }, [currentShareMessage])

  const handleAuthSuccess = useCallback((
    _event: Electron.CrossProcessExports.IpcRendererEvent | null,
    data: AuthStatus,
  ) => {
    authStatusRef.current = data
    setAuthStatus(data)
    setError(null)
    setIsLoading(false)
    onAuthChange?.(data)
  }, [onAuthChange])

  // GitHub connection management
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

  // Message management
  const refreshMessages = useCallback(async () => {
    if (!authStatusRef.current.authenticated) {
      return
    }

    try {
      const [loadedMessages, loadedShareMessages] = await Promise.all([
        window.electronAPI.getMessages(),
        window.electronAPI.getShareMessages(),
      ])
      setMessages(loadedMessages)
      setShareMessages(loadedShareMessages)
    }
    catch (error) {
      console.error('Error refreshing messages:', error)
    }
  }, [])

  const clearNonPendingMessages = useCallback(async () => {
    try {
      const nonPendingMessages = messages.filter(m => m.status !== 'pending' && m.status)
      for (const message of nonPendingMessages) {
        await window.electronAPI.deleteMessage(message.id)
      }
      refreshMessages()
    }
    catch (error) {
      console.error('Error clearing messages:', error)
    }
  }, [messages, refreshMessages])

  // Connection status management with debouncing
  const updateConnectionStatus = useCallback((status: 'connected' | 'disconnected' | 'connecting') => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current)
    }

    connectionTimeoutRef.current = setTimeout(() => {
      setConnectionStatus(status)
    }, 100) // Small debounce to prevent rapid flickering
  }, [])

  // Message actions with auth guards
  const approveMessage = useCallback(async (message: Message, feedback?: string) => {
    if (!message || !authStatusRef.current.authenticated) return

    try {
      await window.electronAPI.approveMessage(message, feedback)
      message.status = 'approved'
      refreshMessages()
    }
    catch (error) {
      console.error('Error approving message:', error)
    }
  }, [refreshMessages])

  const rejectMessage = useCallback(async (messageId: string, feedback?: string) => {
    if (!messageId || !authStatusRef.current.authenticated) return

    try {
      await window.electronAPI.rejectMessage(messageId, feedback)
      refreshMessages()
    }
    catch (error) {
      console.error('Error rejecting message:', error)
    }
  }, [refreshMessages])

  const showMessageDetail = useCallback((message: Message) => {
    if (!authStatusRef.current.authenticated) return
    setCurrentMessage(message)
  }, [])

  const approveCollectionShare = useCallback(async (messageId: string, updatedRequest: CollectionRequest) => {
    if (!authStatusRef.current.authenticated) return

    try {
      await window.electronAPI.approveCollectionShare(messageId, updatedRequest)
      setCurrentShareMessage(null)
      refreshMessages()
    }
    catch (error) {
      console.error('Error approving collection share:', error)
    }
  }, [refreshMessages])

  const rejectCollectionShare = useCallback(async (messageId: string) => {
    if (!authStatusRef.current.authenticated) return

    try {
      await window.electronAPI.rejectCollectionShare(messageId)
      setCurrentShareMessage(null)
      refreshMessages()
    }
    catch (error) {
      console.error('Error rejecting collection share:', error)
    }
  }, [refreshMessages])

  const loadAuthStatus = useCallback(async () => {
    try {
      if (isSkippingAuth) {
        const skipAuthUser = {
          id: SKIP_AUTH_USER_ID,
          email: SKIP_AUTH_USER_EMAIL,
          firstName: SKIP_AUTH_USER_FIRST_NAME,
          lastName: SKIP_AUTH_USER_LAST_NAME,
        }
        const skipAuthStatus = { authenticated: true, user: skipAuthUser }
        handleAuthSuccess(null, skipAuthStatus)
        return
      }

      const status = await window.electronAPI.getAuthStatus()
      handleAuthSuccess(null, status)
    }
    catch (error) {
      console.error('Error loading auth status:', error)
      setError('Failed to load authentication status')
    }
  }, [isSkippingAuth, handleAuthSuccess])

  const login = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      await window.electronAPI.startOAuth()
      // The actual authentication will be handled by the OAuth flow
      // and the auth-success event will be triggered
    }
    catch (error) {
      console.error('Error starting OAuth:', error)
      setError('Failed to start authentication')
      setIsLoading(false)
    }
  }, [])

  const skipAuth = useCallback(() => {
    setIsSkippingAuth(true)
    setError(null)

    const skipAuthStatus = {
      authenticated: true,
      user: {
        id: SKIP_AUTH_USER_ID,
        email: SKIP_AUTH_USER_EMAIL,
        firstName: SKIP_AUTH_USER_FIRST_NAME,
        lastName: SKIP_AUTH_USER_LAST_NAME,
      },
    }

    handleAuthSuccess(null, skipAuthStatus)
  }, [handleAuthSuccess])

  const logout = useCallback(async () => {
    if (isSkippingAuth) {
      setIsSkippingAuth(false)
    }

    try {
      await window.electronAPI.logout()
      // The auth-logout event will be triggered
    }
    catch (error) {
      console.error('Error logging out:', error)
      setError('Failed to logout')
    }
  }, [isSkippingAuth])

  // Auth initialization and cleanup
  useEffect(() => {
    loadAuthStatus()

    const handleAuthError = (
      _event: Electron.CrossProcessExports.IpcRendererEvent | null,
      errorData: AuthError,
    ) => {
      console.error('Auth error:', errorData)
      setError(errorData.message)
      setIsLoading(false)
    }

    const handleAuthLogout = () => {
      const logoutStatus = { authenticated: false }
      setAuthStatus(logoutStatus)
      setError(null)
      authStatusRef.current = logoutStatus
      onAuthChange?.(logoutStatus)
    }

    window.electronAPI.onAuthSuccess((event: IpcRendererEvent, data: AuthStatus) => {
      setIsSkippingAuth(false)
      handleAuthSuccess(event, data)
    })
    window.electronAPI.onAuthError(handleAuthError)
    window.electronAPI.onAuthLogout(handleAuthLogout)

    return () => {
      window.electronAPI.removeAllListeners('auth-success')
      window.electronAPI.removeAllListeners('auth-error')
      window.electronAPI.removeAllListeners('auth-logout')
    }
  }, [loadAuthStatus, handleAuthSuccess])

  // Check GitHub connection when authenticated
  useEffect(() => {
    if (authStatus.authenticated || isSkippingAuth) {
      checkGitHubConnection()
    }
  }, [authStatus.authenticated, isSkippingAuth, checkGitHubConnection])

  // Handle authentication state changes with message/UI management
  useEffect(() => {
    if (!authStatus.authenticated) {
      // If user logged out, clear messages for security
      setMessages([])
      setShareMessages([])
      setCurrentMessage(null)
      setCurrentShareMessage(null)
      setIsInitialized(false)
    }
    else if (!isInitialized && authStatus.authenticated) {
      setIsInitialized(true)

      const loadInitialMessages = async () => {
        try {
          const [loadedMessages, loadedShareMessages] = await Promise.all([
            window.electronAPI.getMessages(),
            window.electronAPI.getShareMessages(),
          ])
          setMessages(loadedMessages)
          setShareMessages(loadedShareMessages)
        }
        catch (error) {
          console.error('Error loading messages:', error)
        }
      }

      loadInitialMessages()
    }
  }, [authStatus.authenticated, isInitialized])

  // Initialize event listeners for messages
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

    // Listen for collection share requests
    const handleCollectionShareRequest = (_event: unknown, shareMessage: ShareMessage) => {
      // Only handle messages if authenticated
      if (!authStatusRef.current.authenticated) {
        return
      }

      setCurrentShareMessage(shareMessage)
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
    }
  }, [updateConnectionStatus])

  const isAuthenticated = authStatus.authenticated

  const contextValue = {
    authStatus,
    isSkippingAuth,
    authStatusRef,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    skipAuth,
    
    // GitHub connection management
    isGitHubConnected,
    isCheckingGitHub,
    checkGitHubConnection,
    
    // Message management
    messages,
    shareMessages,
    currentMessage,
    currentShareMessage,
    refreshMessages,
    clearNonPendingMessages,
    
    // App state management
    isInitialized,
    connectionStatus,
    
    // Message actions (with auth guards)
    approveMessage,
    rejectMessage,
    showMessageDetail,
    approveCollectionShare,
    rejectCollectionShare,
    
    // UI state management
    currentMessageRef,
    currentShareMessageRef,
    setCurrentMessage,
    setCurrentShareMessage,
    
    // Connection management
    updateConnectionStatus,
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
