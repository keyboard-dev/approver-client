import { ChevronDownIcon } from 'lucide-react'
import type { FC, PropsWithChildren } from 'react'
import { useState } from 'react'

import type { ReasoningGroupProps, ReasoningMessagePartProps } from '@assistant-ui/react'

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
 */
export const ReasoningGroup: FC<PropsWithChildren<ReasoningGroupProps>> = ({
  children,
  startIndex,
  endIndex,
}) => {
  const [isExpanded, setIsExpanded] = useState(false)

  // Calculate approximate thinking time based on content length (rough estimate)
  // In a real implementation, this should come from the API response metadata
  const thinkingTime = Math.max(1, Math.floor((endIndex - startIndex + 1) * 3))

  return (
    <div className="aui-reasoning-group mb-[6px]">
      {/* Thinking indicator row */}
      <div className="flex gap-[6px] items-center">
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
        <div className="mt-[6px] max-w-[720px] rounded-[12px] bg-[#f9f9f9] p-[12px] border border-[#e5e5e5]">
          {children}
        </div>
      )}
    </div>
  )
}
