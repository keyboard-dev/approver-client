import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { SKIP_AUTH_USER_EMAIL, SKIP_AUTH_USER_FIRST_NAME, SKIP_AUTH_USER_ID, SKIP_AUTH_USER_LAST_NAME } from '../../lib/constants/auth.constants'
import { AuthError, AuthStatus } from '../../preload'

interface AuthContextType {
  authStatus: AuthStatus
  setAuthStatus: (status: AuthStatus) => void
  isSkippingAuth: boolean
  setIsSkippingAuth: (skipping: boolean) => void
  authStatusRef: React.MutableRefObject<AuthStatus>
  handleAuthChange: (newAuthStatus: AuthStatus) => void
  updateSkippingAuth: (skipping: boolean) => void
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: () => Promise<void>
  logout: () => Promise<void>
  skipAuth: () => void
  loadAuthStatus: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: React.ReactNode
  onAuthChange?: (authStatus: AuthStatus) => void
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, onAuthChange }) => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ authenticated: false })
  const [isSkippingAuth, setIsSkippingAuth] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const authStatusRef = useRef<AuthStatus>({ authenticated: false })

  const handleAuthSuccess = useCallback((
    _event: Electron.CrossProcessExports.IpcRendererEvent | null,
    data: AuthStatus,
  ) => {
    console.log('AuthProvider - handleAuthSuccess', data)
    authStatusRef.current = data
    setAuthStatus(data)
    setError(null)
    setIsLoading(false)
    onAuthChange?.(data)
  }, [onAuthChange])

  const handleAuthChange = useCallback((newAuthStatus: AuthStatus) => {
    console.log('AuthProvider')
    console.log('handleAuthChange', newAuthStatus)
    authStatusRef.current = newAuthStatus
    setAuthStatus(newAuthStatus)
  }, [])

  const updateSkippingAuth = useCallback((skipping: boolean) => {
    setIsSkippingAuth(skipping)
  }, [])

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

    window.electronAPI.onAuthSuccess(handleAuthSuccess)
    window.electronAPI.onAuthError(handleAuthError)
    window.electronAPI.onAuthLogout(handleAuthLogout)

    return () => {
      window.electronAPI.removeAllListeners('auth-success')
      window.electronAPI.removeAllListeners('auth-error')
      window.electronAPI.removeAllListeners('auth-logout')
    }
  }, [loadAuthStatus, handleAuthSuccess])

  const isAuthenticated = authStatus.authenticated

  const contextValue = {
    authStatus,
    setAuthStatus,
    isSkippingAuth,
    setIsSkippingAuth,
    authStatusRef,
    handleAuthChange,
    updateSkippingAuth,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    skipAuth,
    loadAuthStatus,
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
