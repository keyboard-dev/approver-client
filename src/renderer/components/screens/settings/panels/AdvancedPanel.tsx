import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ButtonDesigned } from '../../../ui/ButtonDesigned'
import Toggle from '../../../ui/Toggle'

export const AdvancedPanel: React.FC = () => {
  const [fullCodeExecution, setFullCodeExecution] = useState(false)
  const [fullCodeExecutionDisabled, setFullCodeExecutionDisabled] = useState(true)
  const [executionPreference, setExecutionPreference] = useState<'github-codespace' | 'keyboard-environment'>('github-codespace')
  const [executionPreferenceDisabled, setExecutionPreferenceDisabled] = useState(true)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const executionPreferenceDebounceRef = useRef<NodeJS.Timeout | null>(null)

  // Subscription state
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false)
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(true)
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null)
  const [pollingTimeoutId, setPollingTimeoutId] = useState<NodeJS.Timeout | null>(null)

  const loadFullCodeExecutionSetting = async () => {
    const value = await window.electronAPI.getFullCodeExecution()
    setFullCodeExecution(value)
    setFullCodeExecutionDisabled(false)
  }

  const loadExecutionPreferenceSetting = async () => {
    const result = await window.electronAPI.getExecutionPreference()
    if (result.preference && !result.error) {
      setExecutionPreference(result.preference as 'github-codespace' | 'keyboard-environment')
    }
    setExecutionPreferenceDisabled(false)
  }

  // Check subscription status
  const checkSubscriptionStatus = async (): Promise<boolean> => {
    try {
      setIsCheckingSubscription(true)
      const result = await window.electronAPI.getPaymentStatus()
      if (result.success && result.subscriptions && result.subscriptions.length > 0) {
        setHasActiveSubscription(true)
        setSubscriptionError(null)
        // Clear polling if active
        if (pollingTimeoutId) {
          clearTimeout(pollingTimeoutId)
          setPollingTimeoutId(null)
        }
        return true
      }
      setHasActiveSubscription(false)
      return false
    }
    catch (_error) {
      setHasActiveSubscription(false)
      return false
    }
    finally {
      setIsCheckingSubscription(false)
    }
  }

  // Start subscription polling after checkout
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
        // Auto-enable keyboard environment after subscription confirmed
        handleChangeExecutionPreferenceSetting(true)
        return
      }

      if (attempts >= maxAttempts) {
        setSubscriptionError('We couldn\'t automatically detect your subscription. Please click \'Refresh Status\' to check again, or contact support if you\'ve completed the purchase.')
        setIsCheckingSubscription(false)
        return
      }

      // Schedule next poll
      const timeoutId = setTimeout(poll, 5000)
      setPollingTimeoutId(timeoutId)
    }

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
    catch (_error) {
      setSubscriptionError('Failed to create checkout session. Please try again.')
    }
  }

  const handleChangeFullCodeExecutionSetting = useCallback(async (checked: boolean) => {
    // Execute change immediately
    await window.electronAPI.setFullCodeExecution(checked)
    setFullCodeExecution(checked) // Update local state immediately for better UX

    // Disable further changes
    setFullCodeExecutionDisabled(true)

    // Clear any existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    // Re-enable after debounce period
    debounceTimeoutRef.current = setTimeout(async () => {
      await loadFullCodeExecutionSetting() // Ensure consistency with backend
      setFullCodeExecutionDisabled(false)
    }, 300)
  }, [])

  const handleChangeExecutionPreferenceSetting = useCallback(async (checked: boolean) => {
    const newPreference = checked ? 'keyboard-environment' : 'github-codespace'

    // Execute change immediately
    const result = await window.electronAPI.setExecutionPreference(newPreference)
    if (result.success) {
      setExecutionPreference(newPreference) // Update local state immediately for better UX
    }

    // Disable further changes
    setExecutionPreferenceDisabled(true)

    // Clear any existing timeout
    if (executionPreferenceDebounceRef.current) {
      clearTimeout(executionPreferenceDebounceRef.current)
    }

    // Re-enable after debounce period
    executionPreferenceDebounceRef.current = setTimeout(async () => {
      await loadExecutionPreferenceSetting() // Ensure consistency with backend
      setExecutionPreferenceDisabled(false)
    }, 300)
  }, [])

  useEffect(() => {
    loadFullCodeExecutionSetting()
    loadExecutionPreferenceSetting()
    checkSubscriptionStatus()
  }, [])

  // Cleanup polling timeout on unmount
  useEffect(() => {
    return () => {
      if (pollingTimeoutId) {
        clearTimeout(pollingTimeoutId)
      }
    }
  }, [pollingTimeoutId])

  return (
    <div
      className="grow shrink min-w-0 h-full py-[0.5rem] flex flex-col gap-[0.63rem] overflow-y-auto"
    >
      <div className="text-[1.13rem] px-[0.94rem]">
        Advanced
      </div>

      <div
        className="p-[0.94rem] border border-[#E5E5E5] rounded-[0.38rem] flex flex-col"
      >
        <div
          className="flex gap-[0.63rem]"
        >
          <div
            className="flex flex-col gap-[0.63rem] shrink grow basis-0 min-w-0"
          >
            <div>
              Full code execution
            </div>
            <div
              className="text-[#737373]"
            >
              Enable full code execution mode. When enabled, creates a configuration file at ~/.keyboard-mcp/full-code-execution.
            </div>
          </div>
          <div
            className="px-[0.63rem] py-[0.38rem] border border-[#E5E5E5] rounded-[0.25rem] flex gap-[0.38rem] items-center whitespace-nowrap w-fit h-fit"
          >
            <div>
              {fullCodeExecution ? 'Enabled' : 'Disabled'}
            </div>
            <Toggle
              disabled={fullCodeExecutionDisabled}
              isChecked={fullCodeExecution}
              onChange={handleChangeFullCodeExecutionSetting}
            />
          </div>
        </div>
      </div>

      <div
        className="p-[0.94rem] border border-[#E5E5E5] rounded-[0.38rem] flex flex-col gap-[0.63rem]"
      >
        <div
          className="flex gap-[0.63rem]"
        >
          <div
            className="flex flex-col gap-[0.63rem] shrink grow basis-0 min-w-0"
          >
            <div>
              Execution Environment
            </div>
            <div
              className="text-[#737373]"
            >
              Choose where code execution should run. GitHub Codespace uses your GitHub Codespace as an execution, while Keyboard Environment uses a managed keyboard environment for you.
            </div>
          </div>
          <div
            className="px-[0.63rem] py-[0.38rem] border border-[#E5E5E5] rounded-[0.25rem] flex gap-[0.38rem] items-center whitespace-nowrap w-fit h-fit"
          >
            <div>
              {executionPreference === 'keyboard-environment' ? 'Keyboard Environment' : 'GitHub Codespace'}
            </div>
            <Toggle
              disabled={executionPreferenceDisabled || (!hasActiveSubscription && executionPreference !== 'keyboard-environment')}
              isChecked={executionPreference === 'keyboard-environment'}
              onChange={handleChangeExecutionPreferenceSetting}
            />
          </div>
        </div>

        {/* Subscription status and purchase option */}
        {isCheckingSubscription && (
          <div className="text-sm text-blue-700 bg-blue-50 p-2 rounded-md border border-blue-200">
            Checking subscription status...
          </div>
        )}

        {!isCheckingSubscription && hasActiveSubscription && (
          <div className="text-sm text-green-700 bg-green-50 p-2 rounded-md border border-green-200">
            ✓ Hosted server subscription active
          </div>
        )}

        {!isCheckingSubscription && !hasActiveSubscription && (
          <div className="flex flex-col gap-[0.63rem]">
            <div className="text-sm text-amber-700 bg-amber-50 p-2 rounded-md border border-amber-200">
              Keyboard Environment requires an active subscription. Subscribe to use the managed execution environment.
            </div>
            <div className="flex gap-[0.63rem]">
              <ButtonDesigned
                variant="primary-black"
                onClick={handleBuyHostedServer}
                className="px-[1rem] py-[0.5rem]"
                hasBorder
              >
                Subscribe ($5/month)
              </ButtonDesigned>
              <ButtonDesigned
                variant="clear"
                onClick={checkSubscriptionStatus}
                className="px-[1rem] py-[0.5rem]"
                hasBorder
              >
                Refresh Status
              </ButtonDesigned>
            </div>
          </div>
        )}

        {subscriptionError && (
          <div className="text-sm text-red-700 bg-red-50 p-2 rounded-md border border-red-200">
            {subscriptionError}
          </div>
        )}
      </div>
    </div>
  )
}
