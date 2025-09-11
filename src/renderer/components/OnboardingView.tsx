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
    <div className="flex items-center justify-center min-h-screen p-6 bg-white">
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

        {/* Next Button */}
        <div className="flex justify-center">
          <button
            onClick={onComplete}
            disabled={!isGitHubConnected}
            className={`px-8 py-2 rounded-md text-sm font-medium transition-colors ${
              isGitHubConnected
                ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer'
                : 'bg-gray-50 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isGitHubConnected ? 'Next' : 'Connect GitHub to continue'}
          </button>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500">
          Need help?{' '}
          <a href="#" className="text-blue-600 hover:underline">
            Contact us
          </a>{' '}
          or read the{' '}
          <a href="#" className="text-blue-600 hover:underline">
            docs
          </a>
          .
        </div>
      </div>
    </div>
  )
}

export default OnboardingView