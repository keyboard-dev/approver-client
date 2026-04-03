import { memo, useMemo } from 'react'
import { useMessage, useMessagePartText } from '@assistant-ui/react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { MarkdownText } from './markdown-text'
import { ResearchPhaseDisplay, type ResearchPhaseData } from './research-phase-display'
import { EvaluationDisplay, type EvalPhaseData } from './evaluation-display'
import { PolishStepDisplay, type PolishStepData } from './polish-step-display'
import { PolishSummaryDisplay, type PolishSummaryData } from './polish-summary-display'
import { ToolActivityDisplay, type ToolActivityData } from './tool-activity-display'

const RESEARCH_MARKER = '<!--RESEARCH_PHASE_JSON'
const RESEARCH_END_MARKER = 'RESEARCH_PHASE_JSON_END-->'

const EVAL_MARKER = '<!--EVAL_PHASE_JSON'
const EVAL_END_MARKER = 'EVAL_PHASE_JSON_END-->'

const POLISH_STEP_MARKER = '<!--POLISH_STEP_JSON'
const POLISH_STEP_END_MARKER = 'POLISH_STEP_JSON_END-->'

const POLISH_SUMMARY_MARKER = '<!--POLISH_SUMMARY_JSON'
const POLISH_SUMMARY_END_MARKER = 'POLISH_SUMMARY_JSON_END-->'

const TOOL_ACTIVITY_MARKER = '<!--TOOL_ACTIVITY_JSON'
const TOOL_ACTIVITY_END_MARKER = 'TOOL_ACTIVITY_JSON_END-->'

function parseResearchData(text: string): ResearchPhaseData | null {
  const startIdx = text.indexOf(RESEARCH_MARKER)
  if (startIdx === -1) return null

  const endIdx = text.indexOf(RESEARCH_END_MARKER)
  if (endIdx === -1) return null

  const jsonStart = startIdx + RESEARCH_MARKER.length
  const jsonStr = text.slice(jsonStart, endIdx).trim()

  try {
    return JSON.parse(jsonStr) as ResearchPhaseData
  }
  catch {
    return null
  }
}

function parseEvalData(text: string): EvalPhaseData | null {
  const startIdx = text.indexOf(EVAL_MARKER)
  if (startIdx === -1) return null

  const endIdx = text.indexOf(EVAL_END_MARKER)
  if (endIdx === -1) return null

  const jsonStart = startIdx + EVAL_MARKER.length
  const jsonStr = text.slice(jsonStart, endIdx).trim()

  try {
    return JSON.parse(jsonStr) as EvalPhaseData
  }
  catch {
    return null
  }
}

function parsePolishStepData(text: string): PolishStepData | null {
  const startIdx = text.indexOf(POLISH_STEP_MARKER)
  if (startIdx === -1) return null

  const endIdx = text.indexOf(POLISH_STEP_END_MARKER)
  if (endIdx === -1) return null

  const jsonStart = startIdx + POLISH_STEP_MARKER.length
  const jsonStr = text.slice(jsonStart, endIdx).trim()

  try {
    return JSON.parse(jsonStr) as PolishStepData
  }
  catch {
    return null
  }
}

function parsePolishSummaryData(text: string): PolishSummaryData | null {
  const startIdx = text.indexOf(POLISH_SUMMARY_MARKER)
  if (startIdx === -1) return null

  const endIdx = text.indexOf(POLISH_SUMMARY_END_MARKER)
  if (endIdx === -1) return null

  const jsonStart = startIdx + POLISH_SUMMARY_MARKER.length
  const jsonStr = text.slice(jsonStart, endIdx).trim()

  try {
    return JSON.parse(jsonStr) as PolishSummaryData
  }
  catch {
    return null
  }
}

function parseToolActivityData(text: string): ToolActivityData | null {
  const startIdx = text.indexOf(TOOL_ACTIVITY_MARKER)
  if (startIdx === -1) return null

  const endIdx = text.indexOf(TOOL_ACTIVITY_END_MARKER)
  if (endIdx === -1) return null

  const jsonStart = startIdx + TOOL_ACTIVITY_MARKER.length
  const jsonStr = text.slice(jsonStart, endIdx).trim()

  try {
    return JSON.parse(jsonStr) as ToolActivityData
  }
  catch {
    return null
  }
}

/** Strip a marker (from start tag to end tag) out of text */
function stripMarker(text: string, startMarker: string, endMarker: string): string {
  const startIdx = text.indexOf(startMarker)
  if (startIdx === -1) return text
  const endIdx = text.indexOf(endMarker)
  if (endIdx === -1) return text
  return (text.slice(0, startIdx) + text.slice(endIdx + endMarker.length)).trim()
}

/** Strip internal API markers that sometimes get echoed into model responses */
function stripInternalMarkers(text: string): string {
  // Strip [Used tool: name({...})] — tool_use blocks flattened for API history
  let result = text.replace(/\[Used tool:.*?\)\]/gs, '')
  // Strip [Tool result for id]: content — tool_result blocks flattened for API history
  result = result.replace(/\[Tool result for [^\]]+\]:[^\[]*/gs, '')
  return result.trim()
}

const MarkdownContent = memo(function MarkdownContent({ text }: { text: string }) {
  if (!text) return null
  return (
    <div className="aui-md">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="mt-4 mb-4 leading-7 first:mt-0 last:mb-0">{children}</p>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="font-medium text-[#99A0FF] underline underline-offset-4 cursor-pointer"
              onClick={(e) => {
                e.preventDefault()
                if (href) window.electronAPI.openExternalUrl(href)
              }}
            >
              {children}
            </a>
          ),
        }}
      >
        {text}
      </Markdown>
    </div>
  )
})

const SmartTextImpl = () => {
  const part = useMessagePartText()
  const rawText = 'text' in part ? part.text : ''
  const text = useMemo(() => stripInternalMarkers(rawText), [rawText])
  const { status } = useMessage()
  const stopped = status.type !== 'running'

  // Tool activity is rendered alongside other content, not as a replacement
  const toolActivityData = useMemo(() => parseToolActivityData(text), [text])

  // Strip tool activity marker to get the "rest" of the text for other displays
  const restText = useMemo(
    () => toolActivityData ? stripMarker(text, TOOL_ACTIVITY_MARKER, TOOL_ACTIVITY_END_MARKER) : text,
    [text, toolActivityData],
  )

  const researchData = useMemo(() => parseResearchData(restText), [restText])
  const evalData = useMemo(() => parseEvalData(restText), [restText])
  const polishStepData = useMemo(() => parsePolishStepData(restText), [restText])
  const polishSummaryData = useMemo(() => parsePolishSummaryData(restText), [restText])

  // Build the "rest" content (everything except tool activity)
  let restContent: React.ReactNode = null

  if (polishSummaryData) {
    restContent = <PolishSummaryDisplay data={polishSummaryData} />
  }
  else if (polishStepData) {
    restContent = <PolishStepDisplay data={polishStepData} />
  }
  else if (researchData) {
    restContent = <ResearchPhaseDisplay data={researchData} />
  }
  else if (evalData) {
    const evalIdx = restText.indexOf(EVAL_MARKER)
    const preEvalText = evalIdx > 0 ? restText.slice(0, evalIdx).trim() : ''
    restContent = (
      <>
        {preEvalText && <MarkdownContent text={preEvalText} />}
        <EvaluationDisplay data={evalData} />
      </>
    )
  }
  else if (restText) {
    // No special markers — render as markdown (use MarkdownText for hook-based rendering when no stripping needed)
    restContent = toolActivityData ? <MarkdownContent text={restText} /> : <MarkdownText />
  }

  // If we have tool activity, render it above the rest of the content
  if (toolActivityData) {
    return (
      <>
        <ToolActivityDisplay data={toolActivityData} stopped={stopped} />
        {restContent}
      </>
    )
  }

  return <>{restContent}</>
}

export const SmartText = memo(SmartTextImpl)
