/**
 * Integrations (Onboarding Step)
 *
 * Main container for the integrations onboarding step with tab navigation.
 * Users can switch between OAuth providers and Pipedream integrations.
 */

import React, { useState } from 'react'

import { useAuth } from '../../../../hooks/useAuth'
import { Footer } from '../../../Footer'
import { ButtonDesigned } from '../../../ui/ButtonDesigned'
import { ProgressIndicator } from '../ProgressIndicator'
import { OAuthPanel } from './OAuthPanel'
import { PipedreamPanel } from './PipedreamPanel'

// =============================================================================
// Types
// =============================================================================

interface IntegrationsProps {
  onComplete: () => void
}

type IntegrationTab = 'oauth' | 'pipedream'

// =============================================================================
// Component
// =============================================================================

export const Integrations: React.FC<IntegrationsProps> = ({ onComplete }) => {
  const { isAuthenticated, isSkippingAuth } = useAuth()
  const [activeTab, setActiveTab] = useState<IntegrationTab>('oauth')

  // ===========================================================================
  // Handlers
  // ===========================================================================

  const handleComplete = async () => {
    try {
      await window.electronAPI.markOnboardingCompleted()
      onComplete()
    }
    catch (error) {
      console.error('Error completing onboarding:', error)
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
        <div className="flex w-full flex-col items-start gap-[2rem]">
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

          {/* Tab Navigation */}
          <div className="flex w-full border-b border-neutral-200">
            <button
              className={`px-4 py-2 text-[14px] font-medium border-b-2 transition-colors ${
                activeTab === 'oauth'
                  ? 'border-[#5093B7] text-[#5093B7]'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
              onClick={() => setActiveTab('oauth')}
            >
              OAuth Providers
            </button>
            <button
              className={`px-4 py-2 text-[14px] font-medium border-b-2 transition-colors ${
                activeTab === 'pipedream'
                  ? 'border-[#5093B7] text-[#5093B7]'
                  : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
              onClick={() => setActiveTab('pipedream')}
            >
              Pipedream Integrations
            </button>
          </div>

          {/* Tab Content */}
          <div className="w-full">
            {activeTab === 'oauth' && <OAuthPanel />}
            {activeTab === 'pipedream' && <PipedreamPanel isAuthenticated={isAuthenticated && !isSkippingAuth} />}
          </div>

          {/* Buttons */}
          <div className="flex gap-[5px] justify-end w-full max-w-[400px]">
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
