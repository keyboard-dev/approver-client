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
import { ExplainerDiagram } from '../ExplainerDiagram'
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
    <div className="flex flex-col h-full w-full py-[50px] items-center">
      <div className="flex flex-col items-start h-full max-w-[800px] justify-between px-[100px]">
        <div className="flex w-full flex-col items-start gap-[40px]">
          {/* Header */}
          <div className="flex w-full flex-col items-start gap-[10px] pb-[20px] border-b border-[#e5e5e5]">
            <div className="text-[22px] font-semibold text-[#171717]">
              Connect your apps
            </div>
            <div className="text-[#a5a5a5] text-[14px] font-medium">
              You can always adjust these later.
            </div>

            <div className="flex w-full justify-center py-[5px]">
              <ProgressIndicator progress={3} totalSteps={4} />
            </div>
          </div>

          {/* Explainer Diagram */}
          <div className="max-w-[400px]">
            <ExplainerDiagram type="integrations" />
          </div>

          {/* Connectors Content */}
          <div className="w-full flex-1 min-h-0 flex flex-col gap-[15px]">
            <ConnectorsContent
              maxConnectorsHeight="280px"
              showDescription
              showDocsLink
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-[5px] justify-end max-w-[400px] w-full">
            <ButtonDesigned
              variant="clear"
              onClick={handleComplete}
              className="px-3 py-1 text-[14px]"
            >
              Skip
            </ButtonDesigned>

            <ButtonDesigned
              variant="clear"
              onClick={handleComplete}
              className="px-3 py-1 text-[14px]"
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
