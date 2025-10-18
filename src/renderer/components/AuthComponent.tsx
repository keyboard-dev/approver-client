import { AlertCircle, CheckCircle, LogOut, Shield, User } from 'lucide-react'
import React, { useState } from 'react'

import { Alert, AlertDescription } from '../../components/ui/alert'
import { useAuth } from '../hooks/useAuth'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

import keyboardLogo from '../assets/keyboard-logo.png'

const AuthComponent: React.FC = () => {
  const {
    authStatus,
    isSkippingAuth,
    isLoading,
    error,
    login,
    logout,
  } = useAuth()
  const [showAuthDetails, setShowAuthDetails] = useState(false)
  if (authStatus.authenticated || isSkippingAuth) {
    return (
      <Card className="w-full mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
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
                  onClick={logout}
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
    <div className="w-full h-full flex flex-col justify-between items-center gap-4">
      <div className="w-full flex-1 px-2.5 py-3 bg-white rounded-lg flex flex-col justify-center items-center gap-4">
        <div className="w-full flex-1 px-6 sm:px-12 lg:px-24 pt-4 pb-8 sm:pt-6 sm:pb-12 flex flex-col justify-center items-center gap-6">
          <div className="w-full max-w-md flex flex-col justify-start items-start gap-8">
            {/* Logo */}
            <div className="w-16 h-16  flex items-center justify-center">
              <img src={keyboardLogo} alt="Keyboard Logo" />
              {/* <img src={advancedSettingsImg} alt="Advanced Settings" />
              <img src={installExtensionImg} alt="Install Extension" /> */}
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
                onClick={login}
                disabled={isLoading}
                className="self-stretch h-10 px-5 py-2 rounded border border-gray-300 hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50 flex justify-center items-center gap-2.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-200"
              >
                <span className="text-gray-900 text-sm font-medium font-inter">
                  {isLoading ? 'Authenticating...' : 'Sign in with browser'}
                </span>
              </button>

              {/* OR divider */}
              {/* <div className="self-stretch flex justify-center items-center gap-2.5">
                <div className="flex-1 h-px border-t border-gray-300"></div>
                <span className="text-gray-400 text-xs font-medium font-inter">OR</span>
                <div className="flex-1 h-px border-t border-gray-300"></div>
              </div> */}

              {/* Continue without authenticating */}
              {/* <div className="self-stretch flex flex-col justify-start items-start">
                <button
                  onClick={skipAuth}
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
                <span className="text-gray-400 text-xs font-medium font-inter ml-2 mt-1">Certain features will be limited.</span>
              </div> */}
            </div>

            {/* Help text */}
          </div>
        </div>
      </div>
      <div className="w-full max-w-md text-center">
        <span className="text-gray-400 text-sm font-medium font-inter">Need help? </span>
        <span
          className="text-gray-900 text-sm font-medium font-inter cursor-pointer hover:underline"
          onClick={() => window.electronAPI.openExternalUrl('https://discord.com/invite/UxsRWtV6M2')}
        >
          Ask in our Discord
        </span>
        <span className="text-gray-400 text-sm font-medium font-inter"> or read the </span>
        <span
          className="text-gray-900 text-sm font-medium font-inter cursor-pointer hover:underline"
          onClick={() => window.electronAPI.openExternalUrl('https://docs.keyboard.dev')}
        >
          docs
        </span>
        <span className="text-gray-400 text-sm font-medium font-inter">.</span>
      </div>
    </div>
  )
}

export default AuthComponent
