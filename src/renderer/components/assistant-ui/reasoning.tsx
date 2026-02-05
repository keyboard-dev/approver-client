import { ChevronDownIcon } from 'lucide-react'
import type { FC, PropsWithChildren } from 'react'
import { useEffect, useState } from 'react'

import type { ReasoningGroupProps, ReasoningMessagePartProps } from '@assistant-ui/react'
import { useAssistantState } from '@assistant-ui/react'

import { cn } from '../../lib/utils'

/**
 * Component to render individual reasoning/thinking content from Claude's extended thinking.
 * This displays the actual reasoning text when the thinking section is expanded.
 */
export const Reasoning: FC<ReasoningMessagePartProps> = ({ text }) => {
  return (
    <div className="aui-reasoning-content text-[14px] text-[#737373] leading-normal whitespace-pre-wrap">
      {text}
    </div>
  )
}

/**
 * Component to wrap reasoning parts with expand/collapse functionality.
 * Shows "Thought for X seconds" with an expandable arrow to view the actual reasoning.
 * Auto-expands during streaming and shows actual reasoning content.
 */
export const ReasoningGroup: FC<PropsWithChildren<ReasoningGroupProps>> = ({
  children,
  startIndex,
  endIndex,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [thinkingStartTime] = useState(() => Date.now())
  const [thinkingDuration, setThinkingDuration] = useState(0)

  // Check if reasoning is currently streaming using modern API
  const isReasoningStreaming = useAssistantState(({ message }) => {
    if (!message || message.status?.type !== 'running') return false
    const parts = message.content
    const lastIndex = parts.length - 1
    if (lastIndex < 0) return false
    const lastPart = parts[lastIndex]
    if (lastPart?.type !== 'reasoning') return false
    return lastIndex >= startIndex && lastIndex <= endIndex
  })

  // Auto-expand during streaming
  useEffect(() => {
    if (isReasoningStreaming) {
      setIsExpanded(true)
    }
  }, [isReasoningStreaming])

  // Track thinking duration while streaming
  useEffect(() => {
    if (isReasoningStreaming) {
      const interval = setInterval(() => {
        setThinkingDuration(Math.floor((Date.now() - thinkingStartTime) / 1000))
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [isReasoningStreaming, thinkingStartTime])

  // Calculate display time - use tracked duration or estimate from content
  const displayTime = thinkingDuration > 0
    ? thinkingDuration
    : Math.max(1, Math.floor((endIndex - startIndex + 1) * 2))

  return (
    <div className="aui-reasoning-group mb-[6px]">
      {/* Thinking indicator row */}
      <div className="flex gap-[6px] items-center">
        {/* Thinking time */}
        <div className="max-w-[720px] rounded-[12px]">
          <p className="font-medium text-[14px] text-[#737373] leading-normal">
            {isReasoningStreaming ? 'Thinking' : 'Thought'}
            {' for '}
            {displayTime}
            {' '}
            second{displayTime !== 1 ? 's' : ''}
            {isReasoningStreaming && '...'}
          </p>
        </div>

        {/* Expand/collapse toggle */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
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

      {/* Expandable reasoning content */}
      {isExpanded && (
        <div
          className={cn(
            'mt-[6px] max-w-[720px] rounded-[12px] bg-[#f9f9f9] p-[12px] border border-[#e5e5e5]',
            isReasoningStreaming && 'border-blue-200 bg-blue-50/50',
          )}
          aria-busy={isReasoningStreaming}
        >
          {children}
        </div>
      )}
    </div>
  )
}
