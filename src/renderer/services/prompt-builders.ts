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
