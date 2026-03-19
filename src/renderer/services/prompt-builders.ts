export function buildTaskCompletionPrompt(aiResponse: string, userGoal: string, toolSignals?: string): string {
  const toolSignalsSection = toolSignals
    ? `\nTOOL EXECUTION SIGNALS:\n${toolSignals.slice(0, 1500)}\n`
    : ''

  const toolSignalsEval = toolSignals
    ? `\n4. Do the tool execution signals corroborate the AI's claims?`
    : ''

  const toolSignalsRules = toolSignals
    ? `
- If tool signals show errors but the AI claims success, return isComplete: false
- If the user's goal requires a created resource (sheet, doc, file, etc.) but tool signals contain no IDs or URLs, return isComplete: false
- If tool signals show "WARNING: No meaningful data extracted", verify the AI's claims carefully — this often indicates an empty or incomplete result
- If the user's goal involves populating/writing data to a resource (sheet, doc, database) and the tool output only shows the resource was created (URL/ID present) but does NOT contain evidence of data being written (row counts, cell values, record counts, "wrote N rows", etc.), return isComplete: false with reasoning that data population was not confirmed
- If the tool result shows a resource URL but no output confirming content was added/modified, treat this as incomplete unless the AI's response explicitly confirms data was written with specifics (e.g., "added 50 rows", "populated columns A-D")
- If tool signals include "WARNING: Resource created but no data-write confirmation", this strongly indicates the resource exists but was not populated — return isComplete: false`
    : ''

  return `You are evaluating whether an AI assistant's response indicates the user's task is complete. Answer with JSON only.

AI'S RESPONSE:
${aiResponse.slice(0, 3000)}

ORIGINAL USER GOAL: ${userGoal.slice(0, 500)}
${toolSignalsSection}
EVALUATE:
1. Did the AI indicate the work is finished and the user's goal is met?
2. Or is the AI still planning next steps, reporting partial progress, asking for clarification, or discussing what to do next?
3. Is the AI presenting a final answer, summary, or deliverable to the user?${toolSignalsEval}

RULES:
- If the AI clearly states the task is done and presents results, return isComplete: true
- If the AI is mid-conversation, planning, asking questions, or discussing approach, return isComplete: false
- If the AI completed only part of the task and acknowledges more work is needed, return isComplete: false
- If the task involves creating multiple items (e.g. slides, pages, sections, rows) and the output shows fewer were created than requested, return isComplete: false
- When in doubt, return isComplete: false — it is better to do one more iteration than to exit early
- Styling, images, and visual polish are handled separately — do not require them for completion${toolSignalsRules}

Return ONLY valid JSON:
{ "isComplete": true/false, "reasoning": "brief explanation" }`
}

export function buildRecoveryResearchPrompt(aiAnalysis: string, toolResults: string, userGoal: string): string {
  return `Evaluate whether web research would help fix a failed code execution. Answer with JSON only.

AI'S ANALYSIS:
${aiAnalysis.slice(0, 2000)}

TOOL OUTPUT (stdout/stderr):
${toolResults.slice(0, 3000)}

USER GOAL: ${userGoal.slice(0, 500)}

RULES:
- HTTP 4xx/5xx or API errors (wrong endpoint, missing params, invalid format): needsResearch: true
- Silent failures where values are undefined/null or response has unexpected structure (e.g., HTML instead of JSON, wrong nesting): needsResearch: true — search for the API's actual response format
- Pure JS errors (TypeError, SyntaxError) or transient network issues: needsResearch: false
- Image fetching errors (Unsplash, Pexels, etc.): needsResearch: false — use search-images ability instead
- When in doubt: needsResearch: true

Return ONLY valid JSON:
{ "needsResearch": true/false, "reasoning": "brief explanation" }`
}
