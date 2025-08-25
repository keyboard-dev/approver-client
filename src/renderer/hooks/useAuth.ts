import { useCallback, useRef, useState } from 'react'
import { AuthStatus } from '../../preload'

export const useAuth = () => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ authenticated: false })
  const [isSkippingAuth, setIsSkippingAuth] = useState(false)

  // Use ref to track state without causing re-renders
  const authStatusRef = useRef<AuthStatus>({ authenticated: false })

  // Handle authentication state changes
  const handleAuthChange = useCallback((newAuthStatus: AuthStatus) => {
    authStatusRef.current = newAuthStatus
    setAuthStatus(newAuthStatus)
  }, [])

  // Update skipping auth state
  const updateSkippingAuth = useCallback((skipping: boolean) => {
    setIsSkippingAuth(skipping)
  }, [])

  // Helper to check if authenticated (including skipping auth)
  const isAuthenticated = authStatus.authenticated || isSkippingAuth

  return {
    authStatus,
    setAuthStatus,
    isSkippingAuth,
    setIsSkippingAuth,
    authStatusRef,
    handleAuthChange,
    updateSkippingAuth,
    isAuthenticated,
  }
}
