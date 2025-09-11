import React from 'react'
import { Check } from 'lucide-react'
import GitHubOAuthButton from './GitHubOAuthButton'

interface OnboardingViewProps {
  onComplete?: () => void
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onComplete }) => {
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
          <GitHubOAuthButton />
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
            className="px-8 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium transition-colors"
          >
            Next
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