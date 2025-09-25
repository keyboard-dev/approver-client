import { IpcRendererEvent } from 'electron'
import React, { useEffect, useState } from 'react'
import blueCheckIconUrl from '../../../../../assets/icon-check-blue.svg'
import { Footer } from '../../Footer'
import GitHubOAuthButton from '../../GitHubOAuthButton'
import { ButtonDesigned } from '../../ui/ButtonDesigned'
import McpSetup from './McpSetup'
import Persona from './Persona'
import { ProgressIndicator } from './ProgressIndicator'
import Integrations from './integrations'

interface OnboardingViewProps {
  onComplete?: () => void
}

interface ProviderAuthEventData {
  providerId: string
}

type OnboardingStep = 'github' | 'mcp-setup' | 'persona' | 'integrations'

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
      case 'github':
        setCurrentStep('mcp-setup')
        break
      case 'mcp-setup':
        setCurrentStep('persona')
        break
      case 'persona':
        setCurrentStep('integrations')
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
    return <Persona onComplete={handleNextStep} />
  }

  if (currentStep === 'integrations') {
    return <Integrations onComplete={handleCompleteOnboarding} />
  }

  // Default: GitHub connection step
  return (
    <div
      className="flex flex-col h-full w-full py-[3.88rem] items-center"
    >
      <div
        className="flex flex-col items-start h-full max-w-[22.88rem] justify-between"
      >
        <div
          className="flex w-full flex-col items-start gap-[2.5rem]"
        >
          <div
            className="flex w-full flex-col items-start gap-[0.63rem] pb-[1.25rem] border-b"
          >
            <div
              className="text-[1.38rem] font-semibold"
            >
              Welcome! First things first...
            </div>
            <div
              className="text-[#A5A5A5]"
            >
              Connect to GitHub to use all of Keyboard’s features.
            </div>

            <div
              className="flex w-full justify-center"
            >
              <ProgressIndicator progress={0} />
            </div>
          </div>

          <div
            className="flex flex-col items-start gap-[0.94rem] text-[#A5A5A5] w-full"
          >
            <GitHubOAuthButton
              className="w-full"
              buttonClassName="w-full px-[1.25rem] py-[0.5rem] bg-transparent hover:bg-transparent text-[#171717] border border-[#A5A5A5] rounded-[0.25rem]"
              isConnected={isGitHubConnected}
            />

            <div>
              Permission will allow Keyboard to:
            </div>

            <div
              className="flex items-center gap-[0.31rem]"
            >
              <div
                className="p-[0.25rem]"
              >
                <img src={blueCheckIconUrl} alt="check" className="w-[1rem] h-[1rem]" />
              </div>
              <div>
                Use script shortcuts to 10x your efficiency
              </div>
            </div>

            <div
              className="flex items-center gap-[0.31rem]"
            >
              <div
                className="p-[0.25rem]"
              >
                <img src={blueCheckIconUrl} alt="check" className="w-[1rem] h-[1rem]" />
              </div>
              <div>
                Start and stop codespaces on public repos
              </div>
            </div>

            <div
              className="flex items-center gap-[0.31rem]"
            >
              <div
                className="p-[0.25rem]"
              >
                <img src={blueCheckIconUrl} alt="check" className="w-[1rem] h-[1rem]" />
              </div>
              <div>
                Create a fork of the codespace-executor and app-creator repos
              </div>
            </div>
          </div>

          {isGitHubConnected && (
            <ButtonDesigned
              variant="clear"
              onClick={() => {
                handleNextStep()
              }}
              className="px-[1rem] py-[0.5rem] self-end"
              hasBorder
            >
              Next
            </ButtonDesigned>
          )}
        </div>

        <Footer />
      </div>
    </div>
  )
}

export default OnboardingView
