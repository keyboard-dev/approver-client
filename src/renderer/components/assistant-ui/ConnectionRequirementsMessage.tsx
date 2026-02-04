/**
 * ConnectionRequirementsMessage Component
 *
 * A specialized assistant message that shows when connections are required
 * but missing. Displays the AI's explanation along with the connection prompt UI.
 */

import { Sparkles } from 'lucide-react'
import React from 'react'

import { MissingConnection, MissingConnectionsPrompt } from './MissingConnectionsPrompt'

export interface ConnectionRequirementsMessageProps {
  /** The "thinking" time to display (simulated) */
  thinkingTime?: number
  /** Explanation message from the AI about why connections are needed */
  explanation: string
  /** List of missing connections */
  missingConnections: MissingConnection[]
  /** Callback when user clicks Connect for a service */
  onConnect: (connection: MissingConnection) => void
  /** Callback when user dismisses the prompt */
  onDismiss?: () => void
  /** Whether the thinking section is expanded */
  isExpanded?: boolean
  /** Toggle thinking section expansion */
  onToggleExpanded?: () => void
}

export const ConnectionRequirementsMessage: React.FC<ConnectionRequirementsMessageProps> = ({
  thinkingTime = 12,
  explanation,
  missingConnections,
  onConnect,
  onDismiss,
  isExpanded = false,
  onToggleExpanded,
}) => {
  return (
    <div
      className="aui-assistant-message-root w-full animate-in px-[20px] py-[10px] duration-150 ease-out fade-in slide-in-from-bottom-1"
      data-role="assistant"
    >
      <div className="flex flex-col gap-[6px] w-full">
        {/* Thinking indicator row */}
        <div className="flex gap-[6px] items-center">
          {/* AI Icon */}
          <div className="flex items-center justify-center overflow-hidden">
            <Sparkles className="w-[14px] h-[14px] text-[#737373]" />
          </div>

          {/* Thinking time */}
          <div className="max-w-[720px] rounded-[12px]">
            <p className="font-medium text-[14px] text-[#737373] leading-normal">
              Thought for
              {' '}
              {thinkingTime}
              {' '}
              seconds
            </p>
          </div>

          {/* Expand/collapse toggle */}
          <button
            type="button"
            onClick={onToggleExpanded}
            className="flex items-center justify-center w-[24px] h-[24px] hover:bg-[#f0f0f0] rounded transition-colors"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            <svg
              className={`w-[16px] h-[16px] text-[#737373] transition-transform ${isExpanded ? '' : '-rotate-90'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Explanation text */}
        <div className="max-w-[720px] rounded-[12px]">
          <div className="text-[14px] font-medium text-[#171717] leading-normal whitespace-pre-wrap">
            {explanation}
          </div>
        </div>

        {/* Connection prompt */}
        <MissingConnectionsPrompt
          message="To complete your request, I would need:"
          missingConnections={missingConnections}
          onConnect={onConnect}
          className="mt-[4px]"
        />

        {/* Dismiss button (optional) */}
        {onDismiss && (
          <div className="mt-[10px]">
            <button
              type="button"
              onClick={onDismiss}
              className="text-[14px] font-medium text-[#737373] hover:text-[#171717] transition-colors"
            >
              Dismiss and continue anyway
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default ConnectionRequirementsMessage
