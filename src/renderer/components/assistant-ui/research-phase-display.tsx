import { memo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  BookOpen,
  CheckCircle,
  ChevronDownIcon,
  Image,
  Loader,
  Microscope,
  Pen,
  Search,
  XCircle,
} from 'lucide-react'

import { cn } from '../../lib/utils'

export interface ResearchSearch {
  id: string
  topic: string
  phase: 'init' | 'searching' | 'reading_results' | 'responding' | 'complete' | 'error'
  searchQuery: string
  sourceHostnames: string[]
  sourceUrls: string[]
  accumulatedText: string
  error?: string
  category?: string
}

export interface ResearchPhaseData {
  totalSearches: number
  isComplete: boolean
  searches: ResearchSearch[]
  summaryLine: string
  completedCount: number
  currentRound?: number
  totalRounds?: number
  summarization?: {
    phase: 'summarizing' | 'complete'
    accumulatedText: string
  }
}

interface ResearchPhaseDisplayProps {
  data: ResearchPhaseData
}

export const ResearchPhaseDisplay = memo(function ResearchPhaseDisplay({ data }: ResearchPhaseDisplayProps) {
  const { totalSearches, isComplete, searches, summaryLine, completedCount, currentRound, totalRounds } = data

  return (
    <div className="my-2">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Microscope className="size-4 text-[#737373] shrink-0" />
        <span className="text-[13px] font-medium text-[#737373]">
          {summaryLine}
        </span>
        {currentRound && currentRound > 1 && (
          <span className="inline-flex items-center text-[11px] font-medium text-[#6366f1] bg-[#eef2ff] border border-[#c7d2fe] rounded-full px-1.5 py-0.5">
            Round {currentRound}{totalRounds ? `/${totalRounds}` : ''}
          </span>
        )}
        {!isComplete && (
          <span className="text-[12px] text-[#a3a3a3]">
            {completedCount} of {totalSearches} complete
          </span>
        )}
      </div>

      {/* Search rows card */}
      <div className="border border-[#e5e5e5] rounded-lg overflow-hidden bg-white w-full">
        {searches.map((search, i) => (
          <SearchRow
            key={search.id}
            search={search}
            isLast={!data.summarization && i === searches.length - 1}
          />
        ))}
        {data.summarization && (
          <SummarizationRow
            phase={data.summarization.phase}
            accumulatedText={data.summarization.accumulatedText}
          />
        )}
      </div>
    </div>
  )
})

interface SearchRowProps {
  search: ResearchSearch
  isLast: boolean
}

const SearchRow = memo(function SearchRow({ search, isLast }: SearchRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const prevPhaseRef = useRef(search.phase)
  const [flashComplete, setFlashComplete] = useState(false)

  if (prevPhaseRef.current !== 'complete' && search.phase === 'complete') {
    if (!flashComplete) {
      setFlashComplete(true)
      setTimeout(() => setFlashComplete(false), 600)
    }
  }
  prevPhaseRef.current = search.phase

  const isImageSearch = search.category === 'images'
  const PhaseIcon = isImageSearch ? getImageSearchPhaseIcon(search.phase) : getPhaseIcon(search.phase)
  const statusText = getStatusText(search)

  return (
    <div className={cn(!isLast && 'border-b border-[#f0f0f0]')}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-[#fafafa] transition-colors',
          flashComplete && 'animate-flash-green',
        )}
      >
        <span className="shrink-0">
          <PhaseIcon phase={search.phase} />
        </span>

        <span className="text-[13px] font-medium text-[#171717] truncate min-w-0 flex-1">
          {isImageSearch ? `Find image: ${search.topic}` : search.topic}
        </span>

        <span className="text-[12px] text-[#a3a3a3] truncate shrink-0 max-w-[200px]">
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
        <div className="px-3 pb-3 pt-1 border-t border-[#f0f0f0]">
          {search.searchQuery && (
            <div className="mb-2">
              <span className="text-[11px] font-medium text-[#a3a3a3] uppercase tracking-wide">Query</span>
              <p className="text-[12px] text-[#525252] mt-0.5">{search.searchQuery}</p>
            </div>
          )}

          {search.sourceHostnames.length > 0 && (
            <div className="mb-2">
              <span className="text-[11px] font-medium text-[#a3a3a3] uppercase tracking-wide">Sources</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {search.sourceHostnames.map((hostname, i) => (
                  <span
                    key={`${hostname}-${i}`}
                    className="inline-block text-[11px] text-[#525252] bg-[#f5f5f5] border border-[#e5e5e5] rounded-full px-2 py-0.5"
                  >
                    {hostname}
                  </span>
                ))}
              </div>
            </div>
          )}

          {search.accumulatedText && (
            <div className="mt-2 max-h-[300px] overflow-y-auto rounded-md bg-[#fafafa] border border-[#e5e5e5] p-2.5">
              <div className="prose prose-sm max-w-none text-[12px] text-[#404040] leading-relaxed [&_h1]:text-[14px] [&_h2]:text-[13px] [&_h3]:text-[12px] [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:mt-0.5 [&_pre]:text-[11px] [&_code]:text-[11px]">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {search.accumulatedText}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {search.error && (
            <p className="text-[12px] text-red-600 mt-1">{search.error}</p>
          )}
        </div>
      )}
    </div>
  )
})

interface SummarizationRowProps {
  phase: 'summarizing' | 'complete'
  accumulatedText: string
}

const SummarizationRow = memo(function SummarizationRow({ phase, accumulatedText }: SummarizationRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const prevPhaseRef = useRef(phase)
  const [flashComplete, setFlashComplete] = useState(false)

  if (prevPhaseRef.current !== 'complete' && phase === 'complete') {
    if (!flashComplete) {
      setFlashComplete(true)
      setTimeout(() => setFlashComplete(false), 600)
    }
  }
  prevPhaseRef.current = phase

  const isSummarizing = phase === 'summarizing'
  const title = isSummarizing ? 'Summarizing research...' : 'Summary complete'
  const statusText = isSummarizing ? 'Compressing results...' : 'Done'

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-[#fafafa] transition-colors',
          flashComplete && 'animate-flash-green',
        )}
      >
        <span className="shrink-0">
          {isSummarizing
            ? <Loader className="size-3.5 text-purple-500 animate-spin" />
            : <CheckCircle className="size-3.5 text-green-500" />
          }
        </span>
        <span className="text-[13px] font-medium text-[#171717] truncate min-w-0 flex-1">
          {title}
        </span>
        <span className="text-[12px] text-[#a3a3a3] truncate shrink-0 max-w-[200px]">
          {statusText}
        </span>
        <ChevronDownIcon
          className={cn(
            'size-3.5 text-[#a3a3a3] shrink-0 transition-transform',
            isExpanded ? '' : '-rotate-90',
          )}
        />
      </button>

      {isExpanded && accumulatedText && (
        <div className="px-3 pb-3 pt-1 border-t border-[#f0f0f0]">
          <div className="max-h-[300px] overflow-y-auto rounded-md bg-[#fafafa] border border-[#e5e5e5] p-2.5">
            <div className="prose prose-sm max-w-none text-[12px] text-[#404040] leading-relaxed [&_h1]:text-[14px] [&_h2]:text-[13px] [&_h3]:text-[12px] [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:mt-0.5 [&_pre]:text-[11px] [&_code]:text-[11px]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {accumulatedText}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

function getImageSearchPhaseIcon(phase: ResearchSearch['phase']): React.FC<{ phase: string }> {
  switch (phase) {
    case 'complete':
      return () => <Image className="size-3.5 text-green-500" />
    case 'error':
      return () => <XCircle className="size-3.5 text-red-500" />
    default:
      return () => <Image className="size-3.5 text-blue-500 animate-pulse" />
  }
}

function getPhaseIcon(phase: ResearchSearch['phase']): React.FC<{ phase: string }> {
  switch (phase) {
    case 'init':
      return () => <Loader className="size-3.5 text-[#a3a3a3] animate-spin" />
    case 'searching':
      return () => <Search className="size-3.5 text-blue-500 animate-pulse" />
    case 'reading_results':
      return () => <BookOpen className="size-3.5 text-amber-500" />
    case 'responding':
      return () => <Pen className="size-3.5 text-purple-500" />
    case 'complete':
      return () => <CheckCircle className="size-3.5 text-green-500" />
    case 'error':
      return () => <XCircle className="size-3.5 text-red-500" />
    default:
      return () => <Loader className="size-3.5 text-[#a3a3a3] animate-spin" />
  }
}

function getStatusText(search: ResearchSearch): string {
  const isImageSearch = search.category === 'images'
  switch (search.phase) {
    case 'init':
      return isImageSearch ? 'Looking for stock images...' : 'Starting...'
    case 'searching':
      return isImageSearch ? `Searching stock images for '${search.searchQuery}'...` : `Searching for '${search.searchQuery}'...`
    case 'reading_results':
      return `Reading ${search.sourceUrls.length} source${search.sourceUrls.length !== 1 ? 's' : ''}...`
    case 'responding':
      return 'Synthesizing...'
    case 'complete':
      if (isImageSearch) {
        const count = search.sourceUrls.length
        return count > 0 ? `Done — ${count} image${count !== 1 ? 's' : ''}` : 'Done — no images found'
      }
      return `Done — ${search.sourceUrls.length} source${search.sourceUrls.length !== 1 ? 's' : ''}`
    case 'error':
      return 'Failed'
    default:
      return ''
  }
}
