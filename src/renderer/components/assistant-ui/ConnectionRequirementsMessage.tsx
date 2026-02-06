/**
 * ConnectionRequirementsMessage Component
 *
 * A specialized assistant message that shows when connections are required
 * but missing. Displays the AI's explanation along with the connection prompt UI.
 */

import { ChevronDownIcon, Search, Sparkles } from 'lucide-react'
import React, { useEffect, useState } from 'react'

import { cn } from '../../lib/utils'
import { MissingConnection, MissingConnectionsPrompt } from './MissingConnectionsPrompt'

export interface ConnectionRequirementsMessageProps {
  /** The thinking time in seconds (if known) */
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
  /** Callback to open the connectors search modal */
  onSearchConnectors?: () => void
  /** Actual reasoning/thinking content from the AI */
  reasoningContent?: string
  /** Whether reasoning is currently streaming */
  isReasoningStreaming?: boolean
}

export const ConnectionRequirementsMessage: React.FC<ConnectionRequirementsMessageProps> = ({
  thinkingTime,
  explanation,
  missingConnections,
  onConnect,
  onDismiss,
  isExpanded: controlledIsExpanded,
  onToggleExpanded,
  onSearchConnectors,
  reasoningContent,
  isReasoningStreaming = false,
}) => {
  // Internal state for expansion when not controlled
  const [internalIsExpanded, setInternalIsExpanded] = useState(false)

  // Use controlled state if provided, otherwise use internal state
  const isExpanded = controlledIsExpanded !== undefined ? controlledIsExpanded : internalIsExpanded

  const handleToggleExpanded = () => {
    if (onToggleExpanded) {
      onToggleExpanded()
    }
    else {
      setInternalIsExpanded(!internalIsExpanded)
    }
  }

  // Track thinking duration while streaming
  const [thinkingStartTime] = useState(() => Date.now())
  const [thinkingDuration, setThinkingDuration] = useState(0)

  useEffect(() => {
    if (isReasoningStreaming) {
      setInternalIsExpanded(true)
      const interval = setInterval(() => {
        setThinkingDuration(Math.floor((Date.now() - thinkingStartTime) / 1000))
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [isReasoningStreaming, thinkingStartTime])

  // Calculate display time - use prop if provided, tracked duration, or estimate from content
  const displayTime = thinkingTime ?? (thinkingDuration > 0 ? thinkingDuration : (reasoningContent ? Math.max(1, Math.ceil(reasoningContent.length / 100)) : 1))

  // Only show reasoning section if we have actual reasoning content
  const hasReasoning = !!reasoningContent

  return (
    <div
      className="aui-assistant-message-root w-full animate-in px-[20px] py-[10px] duration-150 ease-out fade-in slide-in-from-bottom-1"
      data-role="assistant"
    >
      <div className="flex flex-col gap-[6px] w-full">
        {/* Thinking indicator row - only show if we have reasoning content */}
        {hasReasoning && (
          <div className="flex gap-[6px] items-center">
            {/* AI Icon */}
            <div className="flex items-center justify-center overflow-hidden">
              <Sparkles className="w-[14px] h-[14px] text-[#737373]" />
            </div>

            {/* Thinking time */}
            <div className="max-w-[720px] rounded-[12px]">
              <p className="font-medium text-[14px] text-[#737373] leading-normal">
                {isReasoningStreaming ? 'Thinking' : 'Thought'}
                {' for '}
                {displayTime}
                {' '}
                {displayTime !== 1 ? 'seconds' : 'second'}
                {isReasoningStreaming && '...'}
              </p>
            </div>

            {/* Expand/collapse toggle */}
            <button
              type="button"
              onClick={handleToggleExpanded}
              className="flex items-center justify-center w-[24px] h-[24px] hover:bg-[#f0f0f0] rounded transition-colors"
              aria-label={isExpanded ? 'Collapse thinking' : 'Expand thinking'}
            >
              <ChevronDownIcon
                className={cn(
                  'w-[16px] h-[16px] text-[#737373] transition-transform',
                  isExpanded ? '' : '-rotate-90',
                )}
              />
            </button>
          </div>
        )}

        {/* Expandable reasoning content */}
        {hasReasoning && isExpanded && (
          <div
            className={cn(
              'mt-[6px] max-w-[720px] rounded-[12px] bg-[#f9f9f9] p-[12px] border border-[#e5e5e5]',
              isReasoningStreaming && 'border-blue-200 bg-blue-50/50',
            )}
            aria-busy={isReasoningStreaming}
          >
            <div className="aui-reasoning-content text-[14px] text-[#737373] leading-normal whitespace-pre-wrap">
              {reasoningContent}
            </div>
          </div>
        )}

        {/* Explanation text */}
        <div className="max-w-[720px] rounded-[12px]">
          <div className="text-[14px] font-medium text-[#171717] leading-normal whitespace-pre-wrap">
            {explanation}
          </div>
        </div>

        {/* Connection prompt */}
        <MissingConnectionsPrompt
          message="To complete your request, I would need to the relevant apps, please connect to the relevant ones below:"
          missingConnections={missingConnections}
          onConnect={onConnect}
          className="mt-[4px]"
        />

        {/* Search for more apps link */}
        {onSearchConnectors && (
          <button
            type="button"
            onClick={onSearchConnectors}
            className="flex items-center gap-[6px] text-[14px] font-medium text-[#0066cc] hover:text-[#0052a3] transition-colors mt-[8px] self-start"
          >
            <Search className="w-[14px] h-[14px]" />
            <span>Don't see the app you need? Try searching for it</span>
          </button>
        )}

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
