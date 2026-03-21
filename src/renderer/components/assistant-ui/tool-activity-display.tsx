import { memo, useState, useEffect, useRef } from 'react'
import { ChevronDownIcon, ChevronRightIcon, Wrench, Loader, CheckCircle, XCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface ToolActivityEntry {
  name: string
  phase: 'running' | 'complete' | 'error'
  startedAt: number
  completedAt?: number
  result?: string
}

export interface ToolActivityData {
  iteration: number
  phase: 'running' | 'complete'
  tools: ToolActivityEntry[]
}

function formatElapsed(entry: ToolActivityEntry): string {
  const end = entry.completedAt ?? Date.now()
  const ms = end - entry.startedAt
  if (ms < 1000) return '<1s'
  return `${Math.round(ms / 1000)}s`
}

function ToolEntryRow({ tool, index }: { tool: ToolActivityEntry, index: number }) {
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const hasDetail = !!tool.result
  const codePreviewRef = useRef<HTMLPreElement>(null)

  // Auto-scroll to bottom when result updates
  useEffect(() => {
    if (codePreviewRef.current && isDetailOpen) {
      codePreviewRef.current.scrollTop = codePreviewRef.current.scrollHeight
    }
  }, [tool.result, isDetailOpen])

  return (
    <div key={`${tool.name}-${index}`}>
      <button
        type="button"
        onClick={() => hasDetail && setIsDetailOpen(!isDetailOpen)}
        className={cn(
          'flex items-center gap-2 py-1 w-full text-left',
          hasDetail && 'cursor-pointer hover:bg-[#fafafa] rounded -mx-1 px-1',
        )}
      >
        {tool.phase === 'running' && <Loader className="size-3 text-blue-500 animate-spin shrink-0" />}
        {tool.phase === 'complete' && <CheckCircle className="size-3 text-emerald-500 shrink-0" />}
        {tool.phase === 'error' && <XCircle className="size-3 text-red-500 shrink-0" />}
        <span className="text-[12px] text-[#404040] truncate flex-1">
          {tool.name}
        </span>
        <span className="text-[11px] text-[#a3a3a3] shrink-0 mr-1">{formatElapsed(tool)}</span>
        {hasDetail && (
          isDetailOpen
            ? <ChevronDownIcon className="size-3 text-[#a3a3a3] shrink-0" />
            : <ChevronRightIcon className="size-3 text-[#a3a3a3] shrink-0" />
        )}
      </button>
      {isDetailOpen && tool.result && (
        <pre
          ref={codePreviewRef}
          className={cn(
            'mt-1 mb-2 rounded-md text-[11px] leading-relaxed overflow-x-auto overflow-y-auto whitespace-pre-wrap break-words',
            'max-h-[200px] px-3 py-2',
            tool.phase === 'error'
              ? 'bg-red-950/80 text-red-200 border border-red-500/20'
              : 'bg-[#1e1e2e] text-emerald-200 border border-emerald-500/20',
          )}
        >
          {tool.result}
        </pre>
      )}
    </div>
  )
}

interface ToolActivityDisplayProps {
  data: ToolActivityData
}

export const ToolActivityDisplay = memo(function ToolActivityDisplay({ data }: ToolActivityDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [flashGreen, setFlashGreen] = useState(false)
  const prevPhaseRef = useRef(data.phase)
  const [, setTick] = useState(0)

  // Tick every second while tools are running so elapsed times update
  useEffect(() => {
    if (data.phase === 'running') {
      const id = setInterval(() => setTick(t => t + 1), 1000)
      return () => clearInterval(id)
    }
  }, [data.phase])

  useEffect(() => {
    if (prevPhaseRef.current === 'running' && data.phase === 'complete') {
      setFlashGreen(true)
      const timer = setTimeout(() => setFlashGreen(false), 600)
      return () => clearTimeout(timer)
    }
    prevPhaseRef.current = data.phase
  }, [data.phase])

  const completedCount = data.tools.filter(t => t.phase === 'complete').length
  const errorCount = data.tools.filter(t => t.phase === 'error').length
  const total = data.tools.length

  const statusText = data.phase === 'running'
    ? `${completedCount} of ${total} complete`
    : errorCount > 0
      ? `${completedCount} complete, ${errorCount} failed`
      : `${total} complete`

  return (
    <div data-tool-activity-display className="my-2">
      <div className={cn(
        'border border-[#e5e5e5] rounded-lg overflow-hidden bg-white w-full transition-colors',
        flashGreen && 'animate-flash-green',
      )}>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-[#fafafa] transition-colors"
        >
          {data.phase === 'running' ? (
            <Loader className="size-3.5 text-blue-500 shrink-0 animate-spin" />
          ) : (
            <Wrench className="size-3.5 text-emerald-500 shrink-0" />
          )}
          <span className="text-[13px] font-medium text-[#171717] shrink-0">
            Tool Activity
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

        {isExpanded && data.tools.length > 0 && (
          <div className="border-t border-[#f0f0f0] px-3 py-1.5">
            {data.tools.map((tool, i) => (
              <ToolEntryRow key={`${tool.name}-${i}`} tool={tool} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
})
