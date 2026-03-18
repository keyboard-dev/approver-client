import { memo, useState, useEffect, useRef } from 'react'
import { ChevronDownIcon, Gauge, Loader, Sparkles } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface EvalPhaseData {
  evalType: string
  phase: 'evaluating' | 'complete' | 'error'
  reasoning: string
  result?: Record<string, unknown>
}

const EVAL_CONFIG: Record<string, { icon: typeof Gauge; label: string; resultLabel: (r: Record<string, unknown>) => string }> = {
  'task-completion': {
    icon: Gauge,
    label: 'Evaluating task completion',
    resultLabel: (r) => r.isComplete ? 'Task complete' : 'Continuing...',
  },
  'recovery-research': {
    icon: Gauge,
    label: 'Evaluating recovery strategy',
    resultLabel: (r) => r.needsResearch ? 'Research needed' : 'No research needed',
  },
  'polish-evaluation': {
    icon: Sparkles,
    label: 'Evaluating polish opportunity',
    resultLabel: (r) => r.shouldPolish ? 'Polish needed' : 'Already polished',
  },
}

interface EvaluationDisplayProps {
  data: EvalPhaseData
}

export const EvaluationDisplay = memo(function EvaluationDisplay({ data }: EvaluationDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [flashGreen, setFlashGreen] = useState(false)
  const prevPhaseRef = useRef(data.phase)

  useEffect(() => {
    if (prevPhaseRef.current === 'evaluating' && data.phase === 'complete') {
      setFlashGreen(true)
      const timer = setTimeout(() => setFlashGreen(false), 600)
      return () => clearTimeout(timer)
    }
    prevPhaseRef.current = data.phase
  }, [data.phase])

  const config = EVAL_CONFIG[data.evalType] ?? {
    icon: Gauge,
    label: `Evaluating ${data.evalType}`,
    resultLabel: () => 'Done',
  }

  const Icon = config.icon
  const isEvaluating = data.phase === 'evaluating'

  const statusText = isEvaluating
    ? 'Analyzing...'
    : data.phase === 'error'
      ? 'Error'
      : config.resultLabel(data.result ?? {})

  return (
    <div data-evaluation-display className="my-2">
      <div className={cn(
        'border border-[#e5e5e5] rounded-lg overflow-hidden bg-white w-full transition-colors',
        flashGreen && 'animate-flash-green',
      )}>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-[#fafafa] transition-colors"
        >
          {isEvaluating ? (
            <Loader className="size-3.5 text-blue-500 shrink-0 animate-spin" />
          ) : (
            <Icon className="size-3.5 text-emerald-500 shrink-0" />
          )}
          <span className="text-[13px] font-medium text-[#171717] shrink-0">
            {config.label}
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

        {isExpanded && data.reasoning && (
          <div className="border-t border-[#f0f0f0] px-3 py-2">
            <div className="max-h-[200px] overflow-auto text-[12px] text-[#404040] bg-[#fafafa] rounded p-2 whitespace-pre-wrap">
              {data.reasoning}
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
