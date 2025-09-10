import React, { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { Badge } from './ui/badge'
import { User, LogOut, Shield, AlertCircle, CheckCircle, ChevronRight } from 'lucide-react'
import { AuthStatus, AuthError } from '../../preload'
import { SKIP_AUTH_USER_EMAIL, SKIP_AUTH_USER_FIRST_NAME, SKIP_AUTH_USER_ID, SKIP_AUTH_USER_LAST_NAME } from '../../lib/constants/auth.constants'

interface AuthComponentProps {
  isSkippingAuth: boolean
  onAuthChange: (authStatus: AuthStatus) => void
  setIsSkippingAuth: (isSkippingAuth: boolean) => void
}

const AuthComponent: React.FC<AuthComponentProps> = ({
  isSkippingAuth,
  onAuthChange,
  setIsSkippingAuth,
}) => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>({ authenticated: false })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAuthDetails, setShowAuthDetails] = useState(false)

  const handleAuthSuccess = (
    _event: Electron.CrossProcessExports.IpcRendererEvent | null,
    data: AuthStatus,
  ) => {
    onAuthChange(data)
    setAuthStatus(data)
    setError(null)
    setIsLoading(false)
  }

  // Load initial auth status
  useEffect(() => {
    loadAuthStatus()

    // Listen for auth events
    // const handleAuthSuccess = (event: any, data: AuthStatus) => {
    //   setAuthStatus(data);
    //   setError(null);
    //   setIsLoading(false);
    //   onAuthChange(data);
    // };

    const handleAuthError = (_event: Electron.CrossProcessExports.IpcRendererEvent | null, errorData: AuthError) => {
      console.error('Auth error:', errorData)
      setError(errorData.message)
      setIsLoading(false)
    }

    const handleAuthLogout = () => {
      setAuthStatus({ authenticated: false })
      setError(null)
      onAuthChange({ authenticated: false })
    }

    window.electronAPI.onAuthSuccess(handleAuthSuccess)
    window.electronAPI.onAuthError(handleAuthError)
    window.electronAPI.onAuthLogout(handleAuthLogout)

    return () => {
      window.electronAPI.removeAllListeners('auth-success')
      window.electronAPI.removeAllListeners('auth-error')
      window.electronAPI.removeAllListeners('auth-logout')
    }
  }, [onAuthChange])

  const loadAuthStatus = async () => {
    try {
      if (isSkippingAuth) {
        setAuthStatus({ authenticated: true, user: { id: SKIP_AUTH_USER_ID, email: SKIP_AUTH_USER_EMAIL, firstName: SKIP_AUTH_USER_FIRST_NAME, lastName: SKIP_AUTH_USER_LAST_NAME } })
        onAuthChange({ authenticated: true, user: { id: SKIP_AUTH_USER_ID, email: SKIP_AUTH_USER_EMAIL, firstName: SKIP_AUTH_USER_FIRST_NAME, lastName: SKIP_AUTH_USER_LAST_NAME } })
        return
      }

      const status = await window.electronAPI.getAuthStatus()
      setAuthStatus(status)
      onAuthChange(status)
    }
    catch (error) {
      console.error('Error loading auth status:', error)
    }
  }

  const handleLogin = async () => {
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
  }

  const handleSkipAuth = () => {
    setIsSkippingAuth(true)
    setError(null)

    handleAuthSuccess(
      null,
      {
        authenticated: true,
        user: {
          id: SKIP_AUTH_USER_ID,
          email: SKIP_AUTH_USER_EMAIL,
          firstName: SKIP_AUTH_USER_FIRST_NAME,
          lastName: SKIP_AUTH_USER_LAST_NAME,
        },
      },
    )
  }

  const handleLogout = async () => {
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
  }

  if (authStatus.authenticated || isSkippingAuth) {
    return (
      <Card className="w-full mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center space-x-2">
              <Shield className="h-5 w-5 text-green-600" />
              {isSkippingAuth ? 'Skipping Authentication' : 'Authenticated'}
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                <CheckCircle className="h-3 w-3 mr-1" />
                {isSkippingAuth ? 'Skipping Authentication' : 'Logged In'}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAuthDetails(!showAuthDetails)}
              >
                {showAuthDetails ? 'Hide' : 'Show'}
                {' '}
                Details
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {showAuthDetails && (
            <div className="space-y-3">
              {authStatus.user && (
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <User className="h-8 w-8 text-gray-600" />
                  <div>
                    <p className="font-medium text-sm">
                      {authStatus.user.firstName}
                      {' '}
                      {authStatus.user.lastName}
                    </p>
                    <p className="text-xs text-gray-500">{authStatus.user.email}</p>
                    <p className="text-xs text-gray-400">
                      ID:
                      {authStatus.user.id}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="w-full h-full p-2.5 flex flex-col justify-between items-center gap-4">
      <div className="w-full flex-1 px-2.5 py-3 bg-white rounded-lg flex flex-col justify-center items-center gap-4">
        <div className="w-full flex-1 px-6 sm:px-12 lg:px-24 py-8 sm:py-12 flex flex-col justify-center items-center gap-10">
          <div className="w-full max-w-md flex flex-col justify-start items-start gap-10">
            {/* Logo */}
            <div className="w-16 h-16 bg-black rounded-lg flex items-center justify-center">
              <span className="text-white text-2xl font-bold font-mono">K</span>
            </div>

            {/* Title */}
            <div className="flex flex-col justify-start items-start gap-2.5">
              <h1 className="text-gray-900 text-xl font-semibold font-inter">Get started with Keyboard</h1>
            </div>

            {/* Main Content */}
            <div className="self-stretch flex-1 flex flex-col justify-start items-start gap-4">
              {error && (
                <Alert className="self-stretch border-red-200 bg-red-50 mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-red-800">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {/* Sign in button */}
              <button
                onClick={handleLogin}
                disabled={isLoading}
                className="self-stretch h-10 px-5 py-2 rounded border border-gray-300 hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50 flex justify-center items-center gap-2.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-200"
              >
                <span className="text-gray-900 text-sm font-medium font-inter">
                  {isLoading ? 'Authenticating...' : 'Sign in with browser'}
                </span>
              </button>

              {/* OR divider */}
              <div className="self-stretch flex justify-center items-center gap-2.5">
                <div className="flex-1 h-px border-t border-gray-300"></div>
                <span className="text-gray-400 text-xs font-medium font-inter">OR</span>
                <div className="flex-1 h-px border-t border-gray-300"></div>
              </div>

              {/* Continue without authenticating */}
              <div className="self-stretch flex flex-col justify-start items-start">
                <button
                  onClick={handleSkipAuth}
                  disabled={isLoading}
                  className="self-stretch flex justify-between items-center hover:bg-gray-50 p-2 rounded transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-200"
                >
                  <span className="text-gray-900 text-sm font-medium font-inter text-left">
                    Continue without authenticating
                  </span>
                  <div className="w-6 h-6 flex justify-center items-center">
                    <ChevronRight className="w-4 h-4 text-gray-900" />
                  </div>
                </button>
                <span className="text-gray-400 text-xs font-medium font-inter mt-1">Certain features will be limited.</span>
              </div>
            </div>

            {/* Help text */}
          </div>
        </div>
      </div>
      <div className="w-full max-w-md text-center">
              <span className="text-gray-400 text-sm font-medium font-inter">Need help? </span>
              <span 
                className="text-gray-900 text-sm font-medium font-inter cursor-pointer hover:underline"
                onClick={() => window.electronAPI.openExternal('https://discord.com/invite/UxsRWtV6M2')}
              >
                Ask in our Discord
              </span>
              <span className="text-gray-400 text-sm font-medium font-inter"> or read the </span>
              <span 
                className="text-gray-900 text-sm font-medium font-inter cursor-pointer hover:underline"
                onClick={() => window.electronAPI.openExternal('https://docs.keyboard.dev')}
              >
                docs
              </span>
              <span className="text-gray-400 text-sm font-medium font-inter">.</span>
      </div>
    </div>
  )
}

export default AuthComponent
