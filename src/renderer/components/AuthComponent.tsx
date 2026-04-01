import { AlertCircle, CheckCircle, LogOut, Shield, User } from 'lucide-react'
import React, { useState } from 'react'

import { Alert, AlertDescription } from '../../components/ui/alert'
import { useAuth } from '../hooks/useAuth'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'


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
      <div className="w-full flex-1 px-2.5 py-3 bg-white dark:bg-[#1f1f1f] rounded-lg flex flex-col justify-center items-center gap-4">
        <div className="w-full flex-1 px-6 sm:px-12 lg:px-24 pt-4 pb-8 sm:pt-6 sm:pb-12 flex flex-col justify-center items-center gap-6">
          <div className="w-full max-w-md flex flex-col justify-start items-start gap-8">
            {/* Logo */}
            <div className="w-16 h-16 flex items-center justify-center text-[#171717] dark:text-[#F5F5F5]">
              <svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                <path d="M119.96 80.117L209.713 79.5938C228.221 79.5938 259.165 80.1167 271.889 80.117C284.614 80.1172 317.018 80.117 325.222 80.117C340.049 80.117 352.52 91.3825 352.52 107.143C352.52 122.903 352.52 151.042 352.52 162.822C352.52 176.195 352.52 194.091 352.52 212.599V311.78C352.52 330.287 352.52 346.444 352.52 358.584C352.52 370.725 352.371 396.545 352.371 405.46C352.371 424.734 335.204 432.047 327.073 432.047C306.716 432.047 266.319 432.067 255.052 432.067C243.785 432.067 228.039 432.079 209.531 432.079L120.227 432.406C101.72 432.406 88.4833 432.406 76.0161 432.406C63.8952 432.406 43.9681 432.352 28.5906 432.352C12.6064 432.352 0.354103 421.454 0.354103 406.58C0.354103 398.013 0.380231 350.893 0.379733 338.357C0.37883 326.698 0.140625 311.836 0.140625 293.329V204.081C0.140625 185.573 0.472811 171.418 0.306356 159.695C0.139901 147.973 0.324085 117.244 0.324085 106.698C0.324085 95.3842 7.06979 80.0187 27.0974 80.0188C46.4923 80.019 63.5527 80.0641 76.0139 80.0641C88.4751 80.0641 101.453 80.117 119.96 80.117ZM207.965 236.04C208.206 235.728 253.255 176.582 254.281 175.187C255.307 173.791 257.886 170.439 257.886 170.439C257.886 170.439 218.51 170.465 216.881 170.465C213.617 170.465 214.119 170.465 213.036 170.465L149.803 258.017V170.447C145.549 170.447 141.729 170.447 137.792 170.447C134.421 170.447 141.163 170.447 137.792 170.447C134.421 170.447 135.955 170.447 131.802 170.447C128.431 170.447 120.755 170.465 113.075 170.465V360.08C118.061 360.08 115.981 360.08 120.347 360.08C127.582 360.08 126.128 360.08 129.499 360.08C132.871 360.08 146.121 360.08 149.809 360.08C149.809 357.37 149.773 307.603 149.773 304.231L169.84 282.17L216.73 360.069C221.335 360.069 260.141 360.057 260.203 360.057C260.266 360.057 241.688 330.489 240.708 328.925C239.727 327.36 226.055 305.467 225.623 304.764C225.191 304.06 212.787 284.243 212.327 283.533C211.866 282.823 194.07 254.31 194.07 254.31C194.07 254.31 207.725 236.351 207.965 236.04Z" fill="currentColor"/>
                <rect x="397.521" y="404.746" width="114.339" height="27.66" fill="currentColor"/>
              </svg>
            </div>

            {/* Title */}
            <div className="flex flex-col justify-start items-start gap-2.5">
              <h1 className="text-gray-900 dark:text-[#f5f5f5] text-xl font-semibold font-inter">Get started with Keyboard</h1>
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
                className="self-stretch h-10 px-5 py-2 rounded border border-gray-300 dark:border-[#3a3a3a] hover:border-gray-400 dark:hover:border-[#555] hover:bg-gray-50 dark:hover:bg-[#2a2a2a] disabled:opacity-50 flex justify-center items-center gap-2.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-[#3a3a3a]"
              >
                <span className="text-gray-900 dark:text-[#f5f5f5] text-sm font-medium font-inter">
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
        <span className="text-gray-400 dark:text-[#a9a9a9] text-sm font-medium font-inter">Need help? Reach out at </span>
        <span
          className="text-gray-900 dark:text-[#f5f5f5] text-sm font-medium font-inter cursor-pointer hover:underline"
          onClick={() => window.electronAPI.openExternalUrl('mailto:support@keyboard.dev')}
        >
          support@keyboard.dev
        </span>
      </div>
    </div>
  )
}

export default AuthComponent
