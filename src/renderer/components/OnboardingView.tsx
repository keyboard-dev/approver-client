import React, { useState, useEffect } from 'react'
import { Check } from 'lucide-react'
import GitHubOAuthButton from './GitHubOAuthButton'

interface OnboardingViewProps {
  onComplete?: () => void
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onComplete }) => {
  const [isGitHubConnected, setIsGitHubConnected] = useState(false)

  useEffect(() => {
    const checkGitHubConnection = async () => {
      const connected = await window.electronAPI.checkOnboardingGithubToken()
      setIsGitHubConnected(connected)
    }

    checkGitHubConnection()
    
    // Set up interval to check periodically
    const interval = setInterval(checkGitHubConnection, 1000)

    // Listen for provider auth success specifically for onboarding
    const handleProviderAuthSuccess = (_event: any, data: any) => {
      if (data.providerId === 'onboarding') {
        // Immediately check GitHub connection when onboarding OAuth completes
        checkGitHubConnection()
      }
    }

    // Add event listener
    if (window.electronAPI.onProviderAuthSuccess) {
      window.electronAPI.onProviderAuthSuccess(handleProviderAuthSuccess)
    }

    return () => {
      clearInterval(interval)
      // Clean up event listener
      if (window.electronAPI.removeAllListeners) {
        window.electronAPI.removeAllListeners('provider-auth-success')
      }
    }
  }, [])
  return (
    <div className="flex items-start start justify-center min-h-screen w-full p-6 bg-white">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-gray-900">
            Welcome! First things first...
          </h1>
          <p className="text-gray-600">
            Connect to GitHub to use all of Keyboard's features.
          </p>
        </div>

        {/* Connect Button */}
        <div className="flex justify-center">
          <GitHubOAuthButton isConnected={isGitHubConnected} />
        </div>

        {/* Permissions List */}
        <div className="space-y-4">
          <p className="text-gray-700 text-sm">Permission will allow Keyboard to:</p>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700 text-sm">
                Use script shortcuts to 10x your efficiency
              </span>
            </div>
            <div className="flex items-start space-x-3">
              <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700 text-sm">
                Start and stop codespaces on public repos
              </span>
            </div>
            <div className="flex items-start space-x-3">
              <Check className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-gray-700 text-sm">
                Create a fork of the codespace-executor and app-creator repos
              </span>
            </div>
          </div>
        </div>

        {/* Next Button - Only show when GitHub is connected */}
        {isGitHubConnected && (
          <div className="flex justify-center">
            <button
              onClick={onComplete}
              className="px-8 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium transition-colors cursor-pointer"
            >
              Next
            </button>
          </div>
        )}

        {/* Footer */}
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
    </div>
  )
}

export default OnboardingView