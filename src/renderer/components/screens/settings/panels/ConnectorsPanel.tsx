/**
 * ConnectorsPanel
 *
 * Settings panel wrapper for managing connectors.
 * Adds auth gate, header, and footer around ConnectorsContent.
 */

import React from 'react'

import { useAuth } from '../../../../hooks/useAuth'
import { Confirmation } from '../../../ui/Confirmation'
import { ConnectorsContent } from '../../../ui/ConnectorsContent'

// =============================================================================
// Main Component
// =============================================================================

export const ConnectorsPanel: React.FC = () => {
  const { isAuthenticated, isSkippingAuth } = useAuth()

  return (
    <div className="relative grow shrink min-w-0 h-full p-[16px] flex flex-col gap-4">
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
      <div className="shrink-0">
        <div className="text-lg font-medium">Connectors</div>
        <div className="text-[#737373] dark:text-[#a9a9a9] text-sm">
          Connect your apps to enable Keyboard to take actions on your behalf.
          {' '}
          Local connectors are managed by Keyboard. Pipedream apps are powered by
          {' '}
          <button
            className="no-underline dark:text-[#f5f5f5] hover:text-[#404040] dark:hover:text-white"
            onClick={() => window.electronAPI.openExternalUrl('https://pipedream.com')}
          >
            Pipedream Connect
          </button>
          . Composio apps are powered by
          {' '}
          <button
            className="no-underline dark:text-[#f5f5f5] hover:text-[#404040] dark:hover:text-white"
            onClick={() => window.electronAPI.openExternalUrl('https://composio.dev')}
          >
            Composio
          </button>
          .
        </div>
      </div>

      {/* Core Content */}
      <div className="flex-1 min-h-0 flex flex-col">
        <ConnectorsContent />
      </div>
    </div>
  )
}

export default ConnectorsPanel
