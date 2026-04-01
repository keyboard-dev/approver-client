import { memo, useState } from 'react'
import { CheckIcon, ChevronDownIcon, CopyIcon, Loader, PlayIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

interface RunCodeData {
  explanation?: string
  code?: string
  language?: string
}

/**
 * Parse a run-code JSON block from raw code content (markdown code blocks).
 * Handles both complete JSON and partial streaming content via regex fallback.
 * Returns null if the content is not a run-code block.
 */
export function parseRunCodeBlock(rawContent: string): RunCodeData | null {
  if (!rawContent) return null
  if (!rawContent.includes('"run-code"')) return null

  // Try full JSON parse first
  try {
    const parsed = JSON.parse(rawContent)
    if (parsed?.ability === 'run-code' || parsed?.type === 'run-code') {
      const explanation = parsed.explanation_of_code ?? parsed.explanation ?? parsed.description ?? undefined
      const code = parsed.code ?? undefined
      const language = parsed.language ?? undefined
      if (explanation || code) return { explanation, code, language }
      return null
    }
  }
  catch {
    // Streaming / incomplete JSON -- use regex fallback
  }

  // Regex fallback for markdown code blocks -- require code field
  const codeMatch = rawContent.match(/"code"\s*:\s*"((?:[^"\\]|\\.)*)/)
  if (!codeMatch) return null

  const explanation
    = rawContent.match(/"(?:explanation_of_code|explanation|description)"\s*:\s*"((?:[^"\\]|\\.)*)"?/)?.[1]
      ?.replace(/\\n/g, '\n')
      ?.replace(/\\t/g, '\t')
      ?.replace(/\\"/g, '"') ?? undefined

  const code = codeMatch[1]
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')

  if (!code) return null

  const language
    = rawContent.match(/"language"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1] ?? undefined

  return { explanation, code, language }
}

interface RunCodeDisplayProps {
  data: RunCodeData
  rawStreamingText?: string
}

export const RunCodeDisplay = memo(function RunCodeDisplay({ data, rawStreamingText }: RunCodeDisplayProps) {
  const isStreaming = !!rawStreamingText
  const [isExpanded, setIsExpanded] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const lineCount = data.code ? data.code.split('\n').length : 0
  const summary = !data.code && !data.explanation
    ? 'Writing code…'
    : data.explanation
      ? data.explanation.length > 80
        ? `${data.explanation.slice(0, 80)}...`
        : data.explanation
      : `${lineCount} line${lineCount !== 1 ? 's' : ''} of code`

  const copyCode = () => {
    if (!data.code || isCopied) return
    navigator.clipboard.writeText(data.code).then(() => {
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 3000)
    }).catch(() => {})
  }

  return (
    <div data-run-code-display className="my-2">
      <div className="border border-[#e5e5e5] dark:border-[#333] rounded-lg overflow-hidden bg-white dark:bg-[#1e1e1e] w-full">
        {/* Collapsed row */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-[#fafafa] dark:hover:bg-[#2a2a2a] transition-colors"
        >
          {isStreaming && !data.code
            ? <Loader className="size-3.5 text-blue-500 shrink-0 animate-spin" />
            : <PlayIcon className="size-3.5 text-emerald-500 shrink-0" />}
          <span className="text-[13px] font-medium text-[#171717] dark:text-[#e5e5e5] shrink-0">
            Run Code
          </span>
          {data.language && (
            <span className="text-[11px] font-medium text-[#6366f1] bg-[#eef2ff] border border-[#c7d2fe] dark:text-[#818cf8] dark:bg-[#1e1b4b] dark:border-[#4338ca] rounded-full px-1.5 py-0.5 shrink-0">
              {data.language}
            </span>
          )}
          <span className="text-[12px] text-[#a3a3a3] truncate min-w-0 flex-1">
            {summary}
          </span>
          <ChevronDownIcon
            className={cn(
              'size-3.5 text-[#a3a3a3] shrink-0 transition-transform',
              isExpanded ? '' : '-rotate-90',
            )}
          />
        </button>

        {/* Expanded content */}
        {isExpanded && (
          <div className="border-t border-[#f0f0f0] dark:border-[#2e2e2e]">
            {data.explanation && (
              <div className="px-3 pt-2 pb-1">
                <p className="text-[12px] text-[#525252] dark:text-[#a3a3a3] leading-relaxed">{data.explanation}</p>
              </div>
            )}
            {isStreaming && !data.code && (
              <div className="px-3 py-3">
                <p className="text-[13px] text-[#a3a3a3] font-mono animate-pulse">
                  ###### executing task ######
                </p>
              </div>
            )}
            {isStreaming && rawStreamingText && (
              <div className="px-3 pb-3 pt-1">
                <pre className="max-h-[400px] overflow-auto rounded-md bg-[#1e1e1e] p-3 text-[12px] text-[#d4d4d4] leading-relaxed whitespace-pre-wrap break-words font-mono">
                  {rawStreamingText}
                </pre>
              </div>
            )}
            {data.code && (
              <div className="px-3 pb-3 pt-1">
                <div className="relative">
                  <button
                    type="button"
                    onClick={copyCode}
                    className="absolute top-2 right-2 p-1 rounded hover:bg-white/10 transition-colors text-[#a3a3a3] hover:text-white"
                    title="Copy code"
                  >
                    {isCopied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
                  </button>
                  <pre className="max-h-[400px] overflow-auto rounded-md bg-[#1e1e1e] p-3 pr-10 text-[12px] text-[#d4d4d4] leading-relaxed whitespace-pre-wrap break-words font-mono">
                    {data.code}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
})
