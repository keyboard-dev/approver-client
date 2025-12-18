import { IpcRendererEvent } from 'electron'
import React, { useEffect, useRef, useState } from 'react'
import blueCheckIconUrl from '../../../../../assets/icon-check-blue.svg'
import { Footer } from '../../Footer'
import GitHubOAuthButton from '../../GitHubOAuthButton'
import { ButtonDesigned } from '../../ui/ButtonDesigned'
import McpSetup from './McpSetup'
import Persona from './Persona'
import { ProgressIndicator } from './ProgressIndicator'
import { Integrations } from './integrations'

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
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(false)
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null)
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false)
  const [pollingTimeoutId, setPollingTimeoutId] = useState<NodeJS.Timeout | null>(null)
  const [preferenceSetError, setPreferenceSetError] = useState<string | null>(null)
  const [isSettingPreference, setIsSettingPreference] = useState(false)
  const preferenceSetRef = useRef(false)

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

  // Set execution preference to keyboard-environment when subscription is detected
  const setExecutionPreferenceOnSubscription = async (): Promise<void> => {
    // Prevent duplicate calls
    if (preferenceSetRef.current) {
      return
    }
    preferenceSetRef.current = true

    setIsSettingPreference(true)
    setPreferenceSetError(null)

    try {
      const result = await window.electronAPI.setExecutionPreference('keyboard-environment')

      if (result.success) {
        console.log('✓ Execution preference set to keyboard-environment')
      }
      else {
        const errorMsg = result.error || 'Failed to set execution preference'
        console.error('Failed to set execution preference:', errorMsg)
        setPreferenceSetError(errorMsg)
      }
    }
    catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error setting execution preference:', errorMsg)
      setPreferenceSetError(errorMsg)
    }
    finally {
      setIsSettingPreference(false)
    }
  }

  // Subscription status check
  const checkSubscriptionStatus = async (): Promise<boolean> => {
    try {
      const result = await window.electronAPI.getPaymentStatus()
      if (result.success && result.subscriptions && result.subscriptions.length > 0) {
        setHasActiveSubscription(true)
        setSubscriptionError(null)
        // Clear polling if active
        if (pollingTimeoutId) {
          clearTimeout(pollingTimeoutId)
          setPollingTimeoutId(null)
        }
        // Set execution preference BEFORE proceeding
        await setExecutionPreferenceOnSubscription()
        // Auto-proceed to next step (even if preference setting failed)
        handleNextStep()
        return true
      }
      return false
    }
    catch (error) {
      console.error('Error checking subscription status:', error)
      return false
    }
  }

  // Start subscription polling
  const startSubscriptionPolling = () => {
    setIsCheckingSubscription(true)
    setSubscriptionError(null)

    let attempts = 0
    const maxAttempts = 36 // 3 minutes at 5 second intervals

    const poll = async () => {
      attempts++
      const hasSubscription = await checkSubscriptionStatus()

      if (hasSubscription) {
        setIsCheckingSubscription(false)
        return
      }

      if (attempts >= maxAttempts) {
        setSubscriptionError('We couldn\'t automatically detect your subscription. Please click \'Refresh Status\' to check again, or contact support if you\'ve completed the purchase.')
        // Keep isCheckingSubscription true so refresh button remains available
        return
      }

      // Schedule next poll
      const timeoutId = setTimeout(poll, 5000)
      setPollingTimeoutId(timeoutId)
    }

    // Start polling
    poll()
  }

  // Handle buy hosted server button click
  const handleBuyHostedServer = async () => {
    try {
      setSubscriptionError(null)
      const result = await window.electronAPI.createSubscriptionCheckout()

      if (result.success) {
        // Checkout URL will be opened automatically by the IPC handler
        // Start polling for subscription status
        startSubscriptionPolling()
      }
      else {
        setSubscriptionError(result.error || 'Failed to create checkout session')
      }
    }
    catch (error) {
      console.error('Error creating subscription checkout:', error)
      setSubscriptionError('Failed to create checkout session. Please try again.')
    }
  }

  // Handle manual refresh status button click
  const handleRefreshStatus = async () => {
    setSubscriptionError(null)
    await checkSubscriptionStatus()
  }

  // Cleanup polling timeout on unmount
  useEffect(() => {
    return () => {
      if (pollingTimeoutId) {
        clearTimeout(pollingTimeoutId)
      }
      // Reset preference tracking on unmount
      preferenceSetRef.current = false
    }
  }, [pollingTimeoutId])

  // If onboarding is completed, don't render anything (let main app show)
  if (isOnboardingCompleted && isGitHubConnected) {
    return null
  }

  // Render different components based on current step
  if (currentStep === 'mcp-setup') {
    return <McpSetup onNext={handleNextStep} />
  }

  if (currentStep === 'persona') {
    return <Persona onNext={handleNextStep} />
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
            {/* Hosted Server Section */}
            <div className="flex flex-col gap-[0.63rem] w-full">
              <div className="text-[0.88rem] text-[#171717]">
                Use our hosted Keyboard Service, where you get an isolated hosted execution environment. Only 5 dollars from automating everything!
              </div>

              <div className="flex gap-[0.63rem]">
                <ButtonDesigned
                  variant="primary-black"
                  onClick={handleBuyHostedServer}
                  disabled={isCheckingSubscription || hasActiveSubscription}
                  className="px-[1rem] py-[0.5rem] flex-1"
                  hasBorder
                >
                  {hasActiveSubscription ? 'Subscribed' : 'Use Hosted Server'}
                </ButtonDesigned>

                {isCheckingSubscription && (
                  <ButtonDesigned
                    variant="clear"
                    onClick={handleRefreshStatus}
                    className="px-[1rem] py-[0.5rem]"
                    hasBorder
                  >
                    Refresh Status
                  </ButtonDesigned>
                )}
              </div>

              {isCheckingSubscription && !hasActiveSubscription && (
                <div className="text-sm text-blue-700 bg-blue-50 p-2 rounded-md border border-blue-200">
                  Checking subscription status...
                </div>
              )}

              {hasActiveSubscription && (
                <div className="flex flex-col gap-2">
                  <div className="text-sm text-green-700 bg-green-50 p-2 rounded-md border border-green-200">
                    ✓ Hosted server subscription active!
                  </div>

                  {isSettingPreference && (
                    <div className="text-sm text-blue-700 bg-blue-50 p-2 rounded-md border border-blue-200">
                      Configuring execution environment...
                    </div>
                  )}

                  {preferenceSetError && (
                    <div className="text-sm text-yellow-700 bg-yellow-50 p-2 rounded-md border border-yellow-200">
                      ⚠ Note: Execution environment preference could not be set automatically. You can configure this later in Settings → Advanced.
                    </div>
                  )}
                </div>
              )}

              {subscriptionError && (
                <div className="text-sm text-red-700 bg-red-50 p-2 rounded-md border border-red-200">
                  {subscriptionError}
                </div>
              )}
            </div>

            {/* Divider with OR */}
            <div className="flex items-center gap-[0.63rem] w-full my-[0.31rem]">
              <div className="flex-1 h-[1px] bg-[#E5E5E5]" />
              <div className="text-[0.88rem] text-[#171717] font-medium">OR</div>
              <div className="flex-1 h-[1px] bg-[#E5E5E5]" />
            </div>

            {/* GitHub Section */}
            <div className="flex flex-col gap-[0.63rem] w-full">
              <div className="text-[0.95rem] text-[#171717] font-medium">
                Want to get started for free instead using GitHub?  Use your own GitHub account and codespaces in one click.
              </div>

              <GitHubOAuthButton
                className="w-full"
                buttonClassName="w-full px-[1.25rem] py-[0.5rem] bg-transparent hover:bg-transparent text-[#171717] border border-[#A5A5A5] rounded-[0.25rem]"
                isConnected={isGitHubConnected}
              />

              <div className="text-sm bg-blue-50 p-3 rounded-md border border-blue-200">
                <div className="font-medium text-blue-900 mb-1">🔒 Security First</div>
                <div className="text-blue-800">
                  We heavily prioritize the security of your credentials. Your GitHub token is one of the only credentials we store in the cloud, and it's encrypted with industry-standard security.
                </div>
              </div>
            </div>

            {/* <div>
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
            </div> */}
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
