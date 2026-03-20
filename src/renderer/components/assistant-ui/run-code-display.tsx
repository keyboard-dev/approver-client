import { memo, useState } from 'react'
import { CheckIcon, ChevronDownIcon, CopyIcon, PlayIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

interface RunCodeData {
  explanation?: string
  code?: string
  language?: string
}

/**
 * Parse a run-code JSON block from raw code content.
 * Handles both complete JSON and partial streaming content via regex fallback.
 * Returns null if the content is not a run-code block.
 */
/**
 * Parse a run-code JSON block from raw code content.
 * Handles both complete JSON and partial streaming content via regex fallback.
 * When isToolArgs is true, skips the "run-code" marker check (tool name already known).
 * Returns null if the content is not a run-code block.
 */
export function parseRunCodeBlock(rawContent: string, isToolArgs = false): RunCodeData | null {
  if (!rawContent) return null
  // When parsing markdown code blocks, require "run-code" marker; for tool args, skip this check
  if (!isToolArgs && !rawContent.includes('"run-code"')) return null

  // Try full JSON parse first
  try {
    const parsed = JSON.parse(rawContent)
    if (isToolArgs || parsed?.ability === 'run-code' || parsed?.type === 'run-code') {
      if (!parsed.code) return null // No code yet -- don't render empty block
      return {
        explanation: parsed.explanation_of_code ?? parsed.explanation ?? parsed.description ?? undefined,
        code: parsed.code ?? undefined,
        language: parsed.language ?? undefined,
      }
    }
  } catch {
    // Streaming / incomplete JSON -- use regex fallback
  }

  // Regex fallback for streaming partial JSON
  const codeMatch = rawContent.match(/"code"\s*:\s*"((?:[^"\\]|\\.)*)/)
  if (!codeMatch) return null // No code field yet -- don't collapse prematurely

  const explanation =
    rawContent.match(/"(?:explanation_of_code|explanation|description)"\s*:\s*"((?:[^"\\]|\\.)*)"?/)?.[1]
      ?.replace(/\\n/g, '\n')
      ?.replace(/\\t/g, '\t')
      ?.replace(/\\"/g, '"') ?? undefined

  const code = codeMatch[1]
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')

  // Don't render if code is empty (streaming hasn't populated it yet, or AI truncated it)
  if (!code) return null

  const language =
    rawContent.match(/"language"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1] ?? undefined

  return { explanation, code, language }
}

interface RunCodeDisplayProps {
  data: RunCodeData
  rawCode: string
}

export const RunCodeDisplay = memo(function RunCodeDisplay({ data, rawCode: _rawCode }: RunCodeDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  const lineCount = data.code ? data.code.split('\n').length : 0
  const summary = data.explanation
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
      <div className="border border-[#e5e5e5] rounded-lg overflow-hidden bg-white w-full">
        {/* Collapsed row */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-[#fafafa] transition-colors"
        >
          <PlayIcon className="size-3.5 text-emerald-500 shrink-0" />
          <span className="text-[13px] font-medium text-[#171717] shrink-0">
            Run Code
          </span>
          {data.language && (
            <span className="text-[11px] font-medium text-[#6366f1] bg-[#eef2ff] border border-[#c7d2fe] rounded-full px-1.5 py-0.5 shrink-0">
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
          <div className="border-t border-[#f0f0f0]">
            {data.explanation && (
              <div className="px-3 pt-2 pb-1">
                <p className="text-[12px] text-[#525252] leading-relaxed">{data.explanation}</p>
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
