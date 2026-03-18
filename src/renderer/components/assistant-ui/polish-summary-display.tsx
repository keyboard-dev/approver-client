import { memo, useState, useEffect, useRef } from 'react'
import { ChevronDownIcon, Loader, Sparkles } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface PolishSummaryData {
  phase: 'generating' | 'complete'
  text: string
  stepCount: number
}

interface PolishSummaryDisplayProps {
  data: PolishSummaryData
}

export const PolishSummaryDisplay = memo(function PolishSummaryDisplay({ data }: PolishSummaryDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [flashGreen, setFlashGreen] = useState(false)
  const prevPhaseRef = useRef(data.phase)

  useEffect(() => {
    if (prevPhaseRef.current === 'generating' && data.phase === 'complete') {
      setFlashGreen(true)
      const timer = setTimeout(() => setFlashGreen(false), 600)
      return () => clearTimeout(timer)
    }
    prevPhaseRef.current = data.phase
  }, [data.phase])

  const isGenerating = data.phase === 'generating'

  const statusText = isGenerating
    ? 'Summarizing...'
    : `${data.stepCount} step${data.stepCount !== 1 ? 's' : ''} completed`

  return (
    <div data-polish-summary-display className="my-2">
      <div className={cn(
        'border border-[#e5e5e5] rounded-lg overflow-hidden bg-white w-full transition-colors',
        flashGreen && 'animate-flash-green',
      )}>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-[#fafafa] transition-colors"
        >
          {isGenerating ? (
            <Loader className="size-3.5 text-purple-500 shrink-0 animate-spin" />
          ) : (
            <Sparkles className="size-3.5 text-emerald-500 shrink-0" />
          )}
          <span className="text-[13px] font-medium text-[#171717] shrink-0">
            Polish Complete
          </span>
          <span className="text-[12px] text-[#a3a3a3] truncate min-w-0 flex-1">
            {statusText}
          </span>
          <ChevronDownIcon
            className={cn(
              'size-3.5 text-[#a3a3a3] shrink-0 transition-transform',
              isExpanded ? '' : '-rotate-90',
            )}
          />
        </button>

        {isExpanded && data.text && (
          <div className="border-t border-[#f0f0f0] px-3 py-2">
            <div className="text-[12px] text-[#404040] whitespace-pre-wrap">
              {data.text}
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
