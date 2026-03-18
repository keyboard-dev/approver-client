import { memo, useMemo } from 'react'
import { useMessagePartText } from '@assistant-ui/react'

import { MarkdownText } from './markdown-text'
import { ResearchPhaseDisplay, type ResearchPhaseData } from './research-phase-display'
import { EvaluationDisplay, type EvalPhaseData } from './evaluation-display'
import { PolishStepDisplay, type PolishStepData } from './polish-step-display'
import { PolishSummaryDisplay, type PolishSummaryData } from './polish-summary-display'

const RESEARCH_MARKER = '<!--RESEARCH_PHASE_JSON'
const RESEARCH_END_MARKER = 'RESEARCH_PHASE_JSON_END-->'

const EVAL_MARKER = '<!--EVAL_PHASE_JSON'
const EVAL_END_MARKER = 'EVAL_PHASE_JSON_END-->'

const POLISH_STEP_MARKER = '<!--POLISH_STEP_JSON'
const POLISH_STEP_END_MARKER = 'POLISH_STEP_JSON_END-->'

const POLISH_SUMMARY_MARKER = '<!--POLISH_SUMMARY_JSON'
const POLISH_SUMMARY_END_MARKER = 'POLISH_SUMMARY_JSON_END-->'

function parseResearchData(text: string): ResearchPhaseData | null {
  const startIdx = text.indexOf(RESEARCH_MARKER)
  if (startIdx === -1) return null

  const endIdx = text.indexOf(RESEARCH_END_MARKER)
  if (endIdx === -1) return null

  const jsonStart = startIdx + RESEARCH_MARKER.length
  const jsonStr = text.slice(jsonStart, endIdx).trim()

  try {
    return JSON.parse(jsonStr) as ResearchPhaseData
  } catch {
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
  } catch {
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
  } catch {
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
  } catch {
    return null
  }
}

const SmartTextImpl = () => {
  const part = useMessagePartText()
  const text = 'text' in part ? part.text : ''

  const researchData = useMemo(() => parseResearchData(text), [text])
  const evalData = useMemo(() => parseEvalData(text), [text])
  const polishStepData = useMemo(() => parsePolishStepData(text), [text])
  const polishSummaryData = useMemo(() => parsePolishSummaryData(text), [text])

  if (polishSummaryData) {
    return <PolishSummaryDisplay data={polishSummaryData} />
  }

  if (polishStepData) {
    return <PolishStepDisplay data={polishStepData} />
  }

  if (researchData) {
    return <ResearchPhaseDisplay data={researchData} />
  }

  if (evalData) {
    return <EvaluationDisplay data={evalData} />
  }

  return <MarkdownText />
}

export const SmartText = memo(SmartTextImpl)
