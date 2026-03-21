import { Camera, ChevronDownIcon, ClipboardList, FileSearch, Loader, Search, Sparkles } from 'lucide-react'
import { memo, useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/utils'

export interface PolishStepToolCall {
  name: string
  args: Record<string, unknown>
  result?: string
  isError?: boolean
}

export interface PolishStepData {
  stepNumber: number
  totalSteps: number
  phase: 'thinking' | 'executing' | 'complete' | 'discovering' | 'analyzing' | 'capturing'
  phaseType?: 'discovering' | 'analyzing' | 'thinking' | 'executing' | 'capturing'
  reasoning: string
  toolCalls: PolishStepToolCall[]
  executionNumber?: number
  totalExecutionSteps?: number
  conclusion?: string
}

const PHASE_LABELS: Record<string, { label: string, activeText: string, icon: typeof Sparkles }> = {
  discovering: { label: 'Discovery', activeText: 'Finding artifact...', icon: FileSearch },
  capturing: { label: 'Visual Inspection', activeText: 'Capturing visual...', icon: Camera },
  analyzing: { label: 'Analysis', activeText: 'Planning improvements...', icon: ClipboardList },
  thinking: { label: 'Polish Step', activeText: 'Analyzing...', icon: Search },
  executing: { label: 'Polish Step', activeText: '', icon: Sparkles },
  complete: { label: 'Polish Step', activeText: '', icon: Sparkles },
}

function AnalysisReasoning({ reasoning }: { reasoning: string }) {
  try {
    let jsonStr = reasoning.trim()
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) jsonStr = fenceMatch[1].trim()
    const parsed = JSON.parse(jsonStr)
    if (parsed.improvements && Array.isArray(parsed.improvements)) {
      return (
        <div className="max-h-[200px] overflow-auto text-[12px] text-[#404040] bg-[#fafafa] rounded p-2 space-y-1">
          {parsed.artifactType && (
            <div className="text-[11px] font-medium text-[#737373] mb-1">
              Artifact:
              {' '}
              {parsed.artifactType}
            </div>
          )}
          <ol className="list-decimal list-inside space-y-0.5">
            {parsed.improvements.map((imp: { action?: string, target?: string }, i: number) => (
              <li key={i} className="text-[12px]">
                <span className="font-medium">{imp.action}</span>
                {imp.target && (
                  <span className="text-[#737373]">
                    {' '}
                    —
                    {imp.target}
                  </span>
                )}
              </li>
            ))}
          </ol>
          {parsed.imageSearches?.length > 0 && (
            <div className="mt-1.5 text-[11px] text-[#737373]">
              {parsed.imageSearches.length}
              {' '}
              image
              {parsed.imageSearches.length !== 1 ? 's' : ''}
              {' '}
              to find
            </div>
          )}
        </div>
      )
    }
  }
  catch {
    // Not valid JSON — fall through to raw display
  }
  return (
    <div className="max-h-[200px] overflow-auto text-[12px] text-[#404040] bg-[#fafafa] rounded p-2 whitespace-pre-wrap">
      {reasoning}
    </div>
  )
}

interface PolishStepDisplayProps {
  data: PolishStepData
}

export const PolishStepDisplay = memo(function PolishStepDisplay({ data }: PolishStepDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(data.phase !== 'complete')
  const [flashGreen, setFlashGreen] = useState(false)
  const prevPhaseRef = useRef(data.phase)

  useEffect(() => {
    if (prevPhaseRef.current !== 'complete' && data.phase === 'complete') {
      setFlashGreen(true)
      setIsExpanded(false)
      const timer = setTimeout(() => setFlashGreen(false), 600)
      return () => clearTimeout(timer)
    }
    prevPhaseRef.current = data.phase
  }, [data.phase])

  const isActive = data.phase !== 'complete'
  const originalPhase = data.phaseType || data.phase
  const phaseConfig = PHASE_LABELS[originalPhase] || PHASE_LABELS.thinking
  const PhaseIcon = isActive ? Loader : phaseConfig.icon

  const titleLabel = (originalPhase === 'discovering' || originalPhase === 'analyzing' || originalPhase === 'capturing')
    ? phaseConfig.label
    : data.executionNumber != null && data.totalExecutionSteps != null
      ? `Polish Step ${data.executionNumber}/${data.totalExecutionSteps}`
      : `Polish Step ${data.stepNumber}/${data.totalSteps}`

  const statusText = (data.phase === 'discovering' || data.phase === 'capturing')
    ? phaseConfig.activeText
    : data.phase === 'analyzing'
      ? phaseConfig.activeText
      : data.phase === 'thinking'
        ? 'Analyzing...'
        : data.phase === 'executing'
          ? `Executing ${data.toolCalls.length} tool${data.toolCalls.length !== 1 ? 's' : ''}...`
          : data.conclusion
            ? data.conclusion
            : data.toolCalls.length > 0
              ? `${data.toolCalls.length} tool${data.toolCalls.length !== 1 ? 's' : ''} executed`
              : 'No changes needed'

  return (
    <div data-polish-step-display className="my-2">
      <div className={cn(
        'border border-[#e5e5e5] rounded-lg overflow-hidden bg-white w-full transition-colors',
        flashGreen && 'animate-flash-green',
      )}
      >
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-[#fafafa] transition-colors"
        >
          <PhaseIcon className={cn('size-3.5 text-purple-500 shrink-0', isActive && 'animate-spin')} />
          <span className="text-[13px] font-medium text-[#171717] shrink-0">
            {titleLabel}
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

        {isExpanded && (
          <div className="border-t border-[#f0f0f0]">
            <div className="px-3 pt-2 pb-1">
              <span className="text-[11px] font-medium text-[#737373]">
                {originalPhase === 'discovering'
                  ? 'Reading the created artifact to understand its structure'
                  : originalPhase === 'capturing'
                    ? 'Capturing screenshots of the artifact for visual quality review'
                    : originalPhase === 'analyzing'
                      ? 'Planning visual and cosmetic improvements'
                      : 'Applying improvements from the plan'}
              </span>
            </div>
            {data.reasoning && (
              <div className="px-3 py-2">
                {originalPhase === 'analyzing'
                  ? (
                      <AnalysisReasoning reasoning={data.reasoning} />
                    )
                  : (
                      <div className="max-h-[200px] overflow-auto text-[12px] text-[#404040] bg-[#fafafa] rounded p-2 whitespace-pre-wrap">
                        {data.reasoning}
                      </div>
                    )}
              </div>
            )}

            {data.toolCalls.length > 0 && (
              <div className="px-3 pb-2 space-y-1">
                {data.toolCalls.map((tc, idx) => (
                  <div key={`${tc.name}-${idx}`} className="border border-[#e5e5e5] rounded bg-[#fafafa] overflow-hidden">
                    <div className="px-2 py-1.5 text-[12px] font-medium text-[#525252]">
                      {tc.name}
                      {tc.args.explanation && (
                        <span className="font-normal text-[#a3a3a3] ml-1.5">
                          {String(tc.args.explanation).slice(0, 80)}
                        </span>
                      )}
                    </div>
                    {tc.result !== undefined && (
                      <div className={cn(
                        'px-2 py-1.5 border-t text-[11px] font-mono max-h-[150px] overflow-auto whitespace-pre-wrap',
                        tc.isError
                          ? 'border-red-200 bg-red-50 text-red-700'
                          : 'border-[#e5e5e5] bg-white text-[#404040]',
                      )}
                      >
                        {tc.result.slice(0, 500)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
})
