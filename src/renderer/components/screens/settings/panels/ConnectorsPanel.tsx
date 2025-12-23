/**
 * ConnectorsPanel
 *
 * Settings panel wrapper for managing connectors.
 * Adds auth gate, header, and footer around ConnectorsContent.
 */

import React from 'react'

import { useAuth } from '../../../../hooks/useAuth'
import { Confirmation } from '../../../ui/Confirmation'
import { ConnectorsContent, SourceTag } from '../../../ui/ConnectorsContent'

// =============================================================================
// Main Component
// =============================================================================

export const ConnectorsPanel: React.FC = () => {
  const { isAuthenticated, isSkippingAuth } = useAuth()

  return (
    <div className="relative grow shrink min-w-0 h-full py-2 flex flex-col gap-4 overflow-auto">
      {/* Auth Gate */}
      {(!isAuthenticated || isSkippingAuth) && (
        <Confirmation
          confirmText="Authenticate"
          description="You must be signed in to manage connectors."
          onConfirm={window.electronAPI.startOAuth}
          relative
          title="Connectors"
        />
      )}

      {/* Header */}
      <div className="px-4">
        <div className="text-lg font-medium">Connectors</div>
        <div className="text-[#737373] text-sm">
          Connect your accounts to let Keyboard access external services on your behalf.
          {' '}
          <button
            className="underline"
            onClick={() => window.electronAPI.openExternalUrl('https://docs.keyboard.dev/')}
          >
            Learn more
          </button>
        </div>
      </div>

      {/* Core Content */}
      <div className="px-4 flex-1 min-h-0 flex flex-col">
        <ConnectorsContent maxConnectorsHeight="400px" />
      </div>

      {/* Info Footer */}
      <div className="px-4 mt-auto pt-4">
        <div className="text-xs text-[#A3A3A3]">
          <span className="inline-flex items-center gap-1">
            <SourceTag source="local" />
            connectors are managed by Keyboard.
          </span>
          {' '}
          <span className="inline-flex items-center gap-1">
            <SourceTag source="pipedream" />
            apps are powered by
            {' '}
            <button
              className="underline"
              onClick={() => window.electronAPI.openExternalUrl('https://pipedream.com')}
            >
              Pipedream Connect
            </button>
            .
          </span>
        </div>
      </div>
    </div>
  )
}

export default ConnectorsPanel
