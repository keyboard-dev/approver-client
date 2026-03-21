import { useState } from 'react'
import type { ToolCallMessagePartComponent } from '@assistant-ui/react'
import { ChevronDownIcon, CheckCircleIcon, XCircleIcon } from 'lucide-react'
import { cn } from '../../lib/utils'
import { RunCodeDisplay } from './run-code-display'
import { AbilityCallDisplay } from './ability-call-display'

/**
 * Named tool UI component for `run-code` ability calls.
 * Renders as a collapsible RunCodeDisplay when the args contain code,
 * otherwise falls through to showing tool name + args.
 */
export const RunCodeToolPart: ToolCallMessagePartComponent = ({
  toolName,
  args,
  argsText,
  result,
  isError,
}) => {
  const isComplete = result !== undefined

  // Completed: use parsed args for clean display
  if (isComplete) {
    const explanation = typeof args?.explanation_of_code === 'string' ? args.explanation_of_code
      : typeof args?.explanation === 'string' ? args.explanation : undefined
    const code = typeof args?.code === 'string' ? args.code : undefined
    const language = typeof args?.language === 'string' ? args.language : undefined
    if (explanation || code) {
      return (
        <div data-tool-part="run-code" className="my-2">
          <RunCodeDisplay data={{ explanation, code, language }} />
          <ToolResult result={result} isError={isError} />
        </div>
      )
    }
  }

  // Streaming: extract partial fields from argsText for progressive display
  if (argsText) {
    const explanation = typeof args?.explanation_of_code === 'string' ? args.explanation_of_code
      : typeof args?.explanation === 'string' ? args.explanation
      : argsText.match(/"(?:explanation_of_code|explanation)"\s*:\s*"((?:[^"\\]|\\.)*)"?/)?.[1]
          ?.replace(/\\n/g, '\n')?.replace(/\\t/g, '\t')?.replace(/\\"/g, '"')
      ?? undefined
    const code = typeof args?.code === 'string' ? args.code
      : argsText.match(/"code"\s*:\s*"((?:[^"\\]|\\.)*)/)?.[1]
          ?.replace(/\\n/g, '\n')?.replace(/\\t/g, '\t')?.replace(/\\"/g, '"')
      ?? undefined
    const language = typeof args?.language === 'string' ? args.language
      : argsText.match(/"language"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1] ?? undefined

    console.log('[RunCodeToolPart][streaming]', {
      ts: Date.now(),
      hasExplanation: !!explanation,
      codeLen: code?.length ?? 0,
      argsTextLen: argsText.length,
    })

    return (
      <div data-tool-part="run-code" className="my-2">
        <RunCodeDisplay data={{ explanation, code, language }} rawStreamingText={argsText} />
        {isComplete && <ToolResult result={result} isError={isError} />}
      </div>
    )
  }

  return <GenericToolPart toolName={toolName} argsText={argsText} result={result} isError={isError} />
}

/**
 * Named tool UI component for non-run-code ability calls
 * (web-search, save-keyboard-shortcut-script-template, etc.).
 * Renders as a collapsible AbilityCallDisplay.
 */
export const AbilityCallToolPart: ToolCallMessagePartComponent = ({
  toolName,
  args,
  argsText,
  result,
  isError,
}) => {
  const abilityData = {
    ability: toolName,
    parameters: (args && typeof args === 'object') ? args as Record<string, unknown> : {},
  }

  return (
    <div data-tool-part={toolName} className="my-2">
      <AbilityCallDisplay data={abilityData} rawCode={argsText} />
      {result !== undefined && (
        <ToolResult result={result} isError={isError} />
      )}
    </div>
  )
}

/**
 * Extract a short summary from a tool result string.
 */
function getResultSummary(result: string, isError: boolean): string {
  try {
    const parsed = JSON.parse(result)
    // run-code shape: { code, stdout, stderr }
    if (parsed.code !== undefined) {
      const status = parsed.code === 0 ? 'Success' : `Exit code ${parsed.code}`
      const firstLine = (parsed.stdout || parsed.stderr || '').split('\n')[0]?.slice(0, 80)
      return firstLine ? `${status} — ${firstLine}` : status
    }
    // Array -- summarize by length
    if (Array.isArray(parsed)) {
      return `Array with ${parsed.length} item${parsed.length !== 1 ? 's' : ''}`
    }
    // Object -- try common message-like fields, then show key names
    if (typeof parsed === 'object' && parsed !== null) {
      const keys = Object.keys(parsed)
      for (const key of ['message', 'result', 'output', 'text', 'content', 'summary', 'description']) {
        if (typeof parsed[key] === 'string' && parsed[key]) {
          return parsed[key].split('\n')[0].slice(0, 80)
        }
      }
      if (keys.length > 0) {
        const preview = keys.slice(0, 4).join(', ')
        return keys.length > 4 ? `{${preview}, ...}` : `{${preview}}`
      }
    }
  } catch { /* not JSON -- fall through */ }

  // Plain text: skip trivial lines like lone braces/brackets
  const lines = result.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed && trimmed !== '{' && trimmed !== '[' && trimmed !== '}' && trimmed !== ']') {
      return trimmed.slice(0, 80)
    }
  }
  return isError ? 'Error' : 'Success'
}

/**
 * Shared collapsible result display for tool parts.
 */
export function ToolResult({ result, isError }: { result: unknown; isError?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const resultStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2)
  const summary = getResultSummary(resultStr, !!isError)

  return (
    <div className={cn(
      'mt-1 border rounded-lg overflow-hidden',
      isError ? 'border-red-200 bg-white' : 'border-green-200 bg-white',
    )}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-[#fafafa] transition-colors"
      >
        {isError
          ? <XCircleIcon className="size-3.5 text-red-500 shrink-0" />
          : <CheckCircleIcon className="size-3.5 text-emerald-500 shrink-0" />}
        <span className={cn('text-[13px] font-medium shrink-0', isError ? 'text-red-700' : 'text-green-700')}>
          {isError ? 'Error' : 'Result'}
        </span>
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

      {isExpanded && (
        <div className="border-t border-[#f0f0f0] px-3 py-2">
          <pre className={cn(
            'whitespace-pre-wrap break-words text-[11px] max-h-[400px] overflow-auto font-mono',
            isError ? 'text-red-700' : 'text-green-700',
          )}>
            {resultStr}
          </pre>
        </div>
      )}
    </div>
  )
}

/**
 * Generic fallback for tools that don't have specialized display.
 */
export function GenericToolPart({ toolName, argsText, result, isError }: { toolName: string; argsText: string; result?: unknown; isError?: boolean }) {
  // Reuse the AbilityCallDisplay for generic display
  let parsedArgs: Record<string, unknown> = {}
  try {
    parsedArgs = JSON.parse(argsText)
  } catch {
    parsedArgs = { raw: argsText }
  }

  const abilityData = { ability: toolName, parameters: parsedArgs }

  return (
    <div data-tool-part={toolName} className="my-2">
      <AbilityCallDisplay data={abilityData} rawCode={argsText} />
      {result !== undefined && (
        <ToolResult result={result} isError={isError} />
      )}
    </div>
  )
}
