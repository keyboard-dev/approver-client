import { IpcRendererEvent } from 'electron'
import { Check } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { Footer } from './Footer'
import GitHubOAuthButton from './GitHubOAuthButton'
import McpSetup from './McpSetup'
import Persona from './Persona'
import { ProgressIndicator } from './ProgressIndicator'

interface OnboardingViewProps {
  onComplete?: () => void
}

interface ProviderAuthEventData {
  providerId: string
}

type OnboardingStep = 'github' | 'mcp-setup' | 'persona' | 'connect-apps'

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onComplete }) => {
  const [isGitHubConnected, setIsGitHubConnected] = useState(false)
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState(false)
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('github')

  // Initial status check and step determination (only on mount)
  useEffect(() => {
    const initializeStep = async () => {
      const connected = await window.electronAPI.checkOnboardingGithubToken()
      const completed = await window.electronAPI.checkOnboardingCompleted()

      setIsGitHubConnected(connected)
      setIsOnboardingCompleted(completed)

      // Only set initial step, don't interfere with manual navigation
      if (!connected) {
        setCurrentStep('github')
      }
      else if (!completed) {
        setCurrentStep('mcp-setup')
      }
      else {
        // Onboarding is complete, proceed to main app
        onComplete?.()
        return
      }
    }

    initializeStep()
  }, [onComplete])

  // Check status periodically when on GitHub step
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null

    const checkGitHubConnection = async () => {
      if (currentStep === 'github') {
        const connected = await window.electronAPI.checkOnboardingGithubToken()
        setIsGitHubConnected(connected)

        // If connected, move to next step
        if (connected) {
          setCurrentStep('mcp-setup')
        }
        else {
          // Check again in a few seconds if still on GitHub step
          timeoutId = setTimeout(checkGitHubConnection, 2000)
        }
      }
    }

    // Start checking if we're on GitHub step
    if (currentStep === 'github') {
      checkGitHubConnection()
    }

    // Listen for provider auth success specifically for onboarding
    const handleProviderAuthSuccess = async (_event: IpcRendererEvent, data: ProviderAuthEventData) => {
      if (data.providerId === 'onboarding') {
        // Check status when onboarding OAuth completes
        const connected = await window.electronAPI.checkOnboardingGithubToken()
        const completed = await window.electronAPI.checkOnboardingCompleted()

        setIsGitHubConnected(connected)
        setIsOnboardingCompleted(completed)

        // If onboarding is already completed, proceed to main app
        if (completed && connected) {
          onComplete?.()
          return
        }
        if (!connected) {
          setCurrentStep('github')
        }

        // If GitHub just got connected and we're on the github step, move to next step
        if (connected && currentStep === 'github') {
          setCurrentStep('mcp-setup')
        }
      }
    }

    // Add event listener
    if (window.electronAPI.onProviderAuthSuccess) {
      window.electronAPI.onProviderAuthSuccess(handleProviderAuthSuccess)
    }

    return () => {
      // Clear timeout if exists
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      // Clean up event listener
      if (window.electronAPI.removeAllListeners) {
        window.electronAPI.removeAllListeners('provider-auth-success')
      }
    }
  }, [currentStep, onComplete])

  const handleNextStep = () => {
    switch (currentStep) {
      case 'mcp-setup':
        setCurrentStep('persona')
        break
      default:
        break
    }
  }

  const handleCompleteOnboarding = async () => {
    try {
      await window.electronAPI.markOnboardingCompleted()
      setIsOnboardingCompleted(true)
      onComplete?.()
    }
    catch (error) {
      console.error('Error completing onboarding:', error)
    }
  }

  // If onboarding is completed, don't render anything (let main app show)
  if (isOnboardingCompleted && isGitHubConnected) {
    return null
  }

  // Render different components based on current step
  if (currentStep === 'mcp-setup') {
    return <McpSetup onNext={handleNextStep} />
  }

  if (currentStep === 'persona') {
    return <Persona onComplete={handleCompleteOnboarding} />
  }

  // Default: GitHub connection step
  return (
    <div className="flex items-start start justify-center min-h-screen w-full p-6 bg-white">
      <div style={{ height: '70vh', display: 'flex', flexDirection: 'column' }} className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-gray-900">
            Welcome! First things first...
          </h1>
          <p className="text-gray-600">
            Connect to GitHub to use all of Keyboard&apos;s features.
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex justify-center space-x-2">
          <ProgressIndicator progress={0} />
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
              onClick={() => {
                handleNextStep()
              }}
              className="px-8 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-sm font-medium transition-colors cursor-pointer"
            >
              Next
            </button>
          </div>
        )}

        {/* Footer */}
        <Footer />
      </div>
    </div>
  )
}

export default OnboardingView
