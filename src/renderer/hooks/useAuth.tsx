import { IpcRendererEvent } from 'electron'
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { SKIP_AUTH_USER_EMAIL, SKIP_AUTH_USER_FIRST_NAME, SKIP_AUTH_USER_ID, SKIP_AUTH_USER_LAST_NAME } from '../../lib/constants/auth.constants'
import { AuthError, AuthStatus } from '../../preload'

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: React.ReactNode
  onAuthChange?: (authStatus: AuthStatus) => void
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, onAuthChange }) => {
  // Auth state only
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ authenticated: false })
  const [isSkippingAuth, setIsSkippingAuth] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Ref for stable auth reference
  const authStatusRef = useRef<AuthStatus>({ authenticated: false })

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
      setError('Failed to logout')
    }
  }, [isSkippingAuth])

  // Auth initialization and cleanup - only auth-specific logic
  useEffect(() => {
    loadAuthStatus()

    const handleAuthError = (
      _event: Electron.CrossProcessExports.IpcRendererEvent | null,
      errorData: AuthError,
    ) => {
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
