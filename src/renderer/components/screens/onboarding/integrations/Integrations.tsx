/**
 * Integrations (Onboarding Step)
 *
 * Onboarding step for connecting apps. Uses the shared ConnectorsContent
 * component to provide a unified experience with the settings panel.
 */

import React from 'react'

import { useAuth } from '../../../../hooks/useAuth'
import { Footer } from '../../../Footer'
import { ButtonDesigned } from '../../../ui/ButtonDesigned'
import { ConnectorsContent } from '../../../ui/ConnectorsContent'
import { ProgressIndicator } from '../ProgressIndicator'

// =============================================================================
// Types
// =============================================================================

interface IntegrationsProps {
  onComplete: () => void
}

// =============================================================================
// Component
// =============================================================================

export const Integrations: React.FC<IntegrationsProps> = ({ onComplete }) => {
  const { isAuthenticated, isSkippingAuth } = useAuth()

  // ===========================================================================
  // Handlers
  // ===========================================================================

  const handleComplete = async () => {
    try {
      await window.electronAPI.markOnboardingCompleted()
      onComplete()
    }
    catch (error) {
    }
  }

  // ===========================================================================
  // Effects
  // ===========================================================================

  // If user is not authenticated or is skipping auth, auto-complete onboarding
  // since integrations require authentication to work
  React.useEffect(() => {
    if (!isAuthenticated || isSkippingAuth) {
      handleComplete()
    }
  }, [isAuthenticated, isSkippingAuth])

  // ===========================================================================
  // Render
  // ===========================================================================

  return (
    <div className="flex flex-col h-full w-full py-[3.88rem] items-center">
      <div className="flex flex-col items-start h-full max-w-[800px] justify-between px-[100px]">
        <div className="flex w-full flex-col items-start gap-[1.5rem]">
          {/* Header */}
          <div className="flex w-full flex-col items-start gap-[0.63rem] pb-[1.25rem] border-b border-neutral-200">
            <div className="text-[1.38rem] font-semibold">
              Do you have any apps you want to connect?
            </div>
            <div className="text-[#A5A5A5] text-[14px]">
              You can also do this later in the app.
            </div>

            <div className="flex w-full justify-center py-[5px]">
              <ProgressIndicator progress={3} />
            </div>
          </div>

          {/* Connectors Content */}
          <div className="w-full">
            <ConnectorsContent maxConnectorsHeight="280px" />
          </div>

          {/* Buttons */}
          <div className="flex gap-[5px] justify-end w-full">
            <ButtonDesigned
              variant="clear"
              onClick={handleComplete}
              className="px-[16px] py-[8px] text-[14px]"
            >
              Skip
            </ButtonDesigned>

            <ButtonDesigned
              variant="clear"
              onClick={handleComplete}
              className="px-[16px] py-[8px] text-[14px]"
              hasBorder
            >
              Complete
            </ButtonDesigned>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  )
}

export default Integrations
