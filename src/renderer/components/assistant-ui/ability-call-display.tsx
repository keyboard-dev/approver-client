import { memo, useState } from 'react'
import { ChevronDownIcon, ClockIcon, ImageIcon, ListIcon, PencilIcon, SaveIcon, SearchIcon, ZapIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface AbilityCallData {
  ability: string
  parameters: Record<string, unknown>
}

const ABILITY_MAP: Record<string, { icon: typeof SearchIcon, label: string, summaryParam?: string }> = {
  'web-search': { icon: SearchIcon, label: 'Web Search', summaryParam: 'query' },
  'save-keyboard-shortcut-script-template': { icon: SaveIcon, label: 'Save Shortcut', summaryParam: 'name' },
  'update-keyboard-shortcut-script-template': { icon: PencilIcon, label: 'Update Shortcut', summaryParam: 'name' },
  'poll-background-job': { icon: ClockIcon, label: 'Poll Job', summaryParam: 'jobId' },
  'list-background-jobs': { icon: ListIcon, label: 'List Jobs' },
  'search-images': { icon: ImageIcon, label: 'Image Search', summaryParam: 'query' },
}

/**
 * Parse an ability-call JSON block from raw code content.
 * Returns null if content is not an ability block or if it's a run-code block
 * (those are handled by RunCodeDisplay).
 */
export function parseAbilityBlock(rawContent: string): AbilityCallData | null {
  if (!rawContent || !rawContent.includes('"ability"')) {
    return null
  }

  // Try full JSON parse first
  try {
    const parsed = JSON.parse(rawContent)
    if (parsed?.ability) {
      if (parsed.ability === 'run-code') {
        return null
      }
      const { ability, ...rest } = parsed
      const result = { ability, parameters: rest.parameters ?? rest }
      return result
    }
  }
  catch {
    // Streaming / incomplete JSON -- use regex fallback
  }

  // Regex fallback for streaming partial JSON
  const abilityMatch = rawContent.match(/"ability"\s*:\s*"((?:[^"\\]|\\.)*)"/)
  if (!abilityMatch) {
    return null
  }

  const ability = abilityMatch[1]
  if (ability === 'run-code') {
    return null
  }

  // Try to extract parameters object
  const parameters: Record<string, unknown> = {}
  const paramMatches = rawContent.matchAll(/"(\w+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g)
  for (const match of paramMatches) {
    const key = match[1]
    if (key === 'ability') continue
    parameters[key] = match[2].replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"')
  }

  return { ability, parameters }
}

interface AbilityCallDisplayProps {
  data: AbilityCallData
  rawCode: string
}

export const AbilityCallDisplay = memo(function AbilityCallDisplay({ data }: AbilityCallDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const mapping = ABILITY_MAP[data.ability]
  const Icon = mapping?.icon ?? ZapIcon
  const label = mapping?.label ?? data.ability

  // Build summary from the designated summary param, or first string param as fallback
  let summary = ''
  if (mapping?.summaryParam && data.parameters[mapping.summaryParam]) {
    const val = String(data.parameters[mapping.summaryParam])
    summary = val.length > 80 ? `${val.slice(0, 80)}...` : val
  }
  else if (!mapping?.summaryParam) {
    const firstStr = Object.values(data.parameters).find(v => typeof v === 'string')
    if (firstStr) {
      const val = String(firstStr)
      summary = val.length > 80 ? `${val.slice(0, 80)}...` : val
    }
  }

  // Filter out 'ability' and 'type' keys for the expanded view
  const displayParams = Object.entries(data.parameters).filter(
    ([k]) => k !== 'ability' && k !== 'type',
  )

  return (
    <div data-ability-call-display className="my-2">
      <div className="border border-[#e5e5e5] rounded-lg overflow-hidden bg-white w-full">
        {/* Collapsed row */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-[#fafafa] transition-colors"
        >
          <Icon className="size-3.5 text-blue-500 shrink-0" />
          <span className="text-[13px] font-medium text-[#171717] shrink-0">
            {label}
          </span>
          {summary && (
            <span className="text-[12px] text-[#a3a3a3] truncate min-w-0 flex-1">
              {summary}
            </span>
          )}
          <ChevronDownIcon
            className={cn(
              'size-3.5 text-[#a3a3a3] shrink-0 transition-transform',
              isExpanded ? '' : '-rotate-90',
            )}
          />
        </button>

        {/* Expanded content */}
        {isExpanded && displayParams.length > 0 && (
          <div className="border-t border-[#f0f0f0] px-3 py-2">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
              {displayParams.map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="font-medium text-[#525252]">{key}</dt>
                  <dd className="text-[#737373] break-words whitespace-pre-wrap">
                    {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </div>
  )
})
