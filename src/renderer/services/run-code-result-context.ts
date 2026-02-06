/**
 * Run-Code Result Context Service
 * Manages tool execution results in conversation context with intelligent summarization
 * - Keeps full results in context if under 25,000 tokens
 * - Summarizes large results while preserving important data (IDs, URLs, etc.)
 */

export interface StoredResult {
  id: string
  toolName: string
  timestamp: number
  fullResult: string
  summary: string
  tokenCount: number
  wasSummarized: boolean
  extractedData: ExtractedImportantData
}

export interface ExtractedImportantData {
  ids: string[]
  urls: string[]
  apiEndpoints: string[]
  credentials: string[] // Sanitized - just mentions presence, not values
  keyValuePairs: Record<string, string>
  errorMessages: string[]
  successIndicators: string[]
}

export interface ResultContextOptions {
  maxTokensForFullResult?: number // Default: 25000
  maxStoredResults?: number // Default: 10 (keep last 10 results)
  summarizeThreshold?: number // Token count above which we summarize
}

const DEFAULT_OPTIONS: Required<ResultContextOptions> = {
  maxTokensForFullResult: 25000,
  maxStoredResults: 10,
  summarizeThreshold: 25000,
}

/**
 * Estimate token count from text (roughly 4 characters per token)
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4)
}

/**
 * Extract important data from result text for future reference
 */
function extractImportantData(text: string): ExtractedImportantData {
  const extracted: ExtractedImportantData = {
    ids: [],
    urls: [],
    apiEndpoints: [],
    credentials: [],
    keyValuePairs: {},
    errorMessages: [],
    successIndicators: [],
  }

  // Extract URLs
  const urlPattern = /https?:\/\/[^\s"'<>]+/gi
  const urls = text.match(urlPattern) || []
  extracted.urls = [...new Set(urls)].slice(0, 20) // Dedupe and limit

  // Extract API endpoints (paths starting with /api, /v1, /v2, etc.)
  const apiPattern = /\/(?:api|v[0-9]+)\/[^\s"'<>,)]+/gi
  const apis = text.match(apiPattern) || []
  extracted.apiEndpoints = [...new Set(apis)].slice(0, 10)

  // Extract IDs - common patterns
  const idPatterns = [
    // UUID
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    // MongoDB ObjectId
    /[0-9a-f]{24}/gi,
    // Generic ID patterns in JSON ("id": "...", "Id": "...", "_id": "...")
    /"(?:_?[iI]d|[a-zA-Z]+[iI]d)":\s*"([^"]+)"/g,
    // Numeric IDs
    /"(?:_?[iI]d|[a-zA-Z]+[iI]d)":\s*(\d+)/g,
  ]

  for (const pattern of idPatterns) {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      const id = match[1] || match[0]
      if (id && id.length > 4 && id.length < 100) {
        extracted.ids.push(id)
      }
    }
  }
  extracted.ids = [...new Set(extracted.ids)].slice(0, 30)

  // Extract key-value pairs that look important (from JSON)
  const kvPatterns = [
    // Common important fields
    /"(name|title|email|username|fileName|filePath|status|state|type|format|version)":\s*"([^"]+)"/gi,
    // Resource identifiers
    /"(resourceId|projectId|workspaceId|organizationId|teamId|userId|accountId)":\s*"([^"]+)"/gi,
    // URLs and paths in JSON
    /"(url|href|path|location|endpoint|baseUrl|downloadUrl)":\s*"([^"]+)"/gi,
  ]

  for (const pattern of kvPatterns) {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      const key = match[1]
      const value = match[2]
      if (key && value && value.length < 500) {
        extracted.keyValuePairs[key] = value
      }
    }
  }

  // Check for credential presence (don't extract values)
  const credentialIndicators = ['api_key', 'apikey', 'api-key', 'token', 'secret', 'password', 'auth', 'bearer']
  for (const indicator of credentialIndicators) {
    if (text.toLowerCase().includes(indicator)) {
      extracted.credentials.push(`Contains ${indicator} reference`)
    }
  }
  extracted.credentials = [...new Set(extracted.credentials)]

  // Extract error messages
  const errorPatterns = [
    /error[:\s]+([^\n]{10,200})/gi,
    /"error":\s*"([^"]+)"/gi,
    /"message":\s*"([^"]*error[^"]*)"/gi,
    /failed[:\s]+([^\n]{10,200})/gi,
  ]

  for (const pattern of errorPatterns) {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      if (match[1]) {
        extracted.errorMessages.push(match[1].trim())
      }
    }
  }
  extracted.errorMessages = [...new Set(extracted.errorMessages)].slice(0, 5)

  // Extract success indicators
  const successPatterns = [
    /success(?:ful(?:ly)?)?[:\s]+([^\n]{10,100})/gi,
    /"success":\s*true/gi,
    /"status":\s*"(?:ok|success|complete|done)"/gi,
    /created[:\s]+([^\n]{10,100})/gi,
    /completed[:\s]+([^\n]{10,100})/gi,
  ]

  for (const pattern of successPatterns) {
    const matches = text.matchAll(pattern)
    for (const match of matches) {
      const indicator = match[1] || match[0]
      extracted.successIndicators.push(indicator.trim())
    }
  }
  extracted.successIndicators = [...new Set(extracted.successIndicators)].slice(0, 5)

  return extracted
}

/**
 * Generate a smart summary of the result
 */
function generateSummary(toolName: string, result: string, extractedData: ExtractedImportantData): string {
  const lines: string[] = []

  lines.push(`## ${toolName} Result Summary`)
  lines.push('')

  // Add success/error status
  if (extractedData.errorMessages.length > 0) {
    lines.push('### Errors Detected:')
    extractedData.errorMessages.forEach(err => lines.push(`- ${err}`))
    lines.push('')
  }
  else if (extractedData.successIndicators.length > 0) {
    lines.push('### Status: Success')
    extractedData.successIndicators.forEach(s => lines.push(`- ${s}`))
    lines.push('')
  }

  // Add important IDs
  if (extractedData.ids.length > 0) {
    lines.push('### Important IDs (for future API calls):')
    extractedData.ids.slice(0, 10).forEach(id => lines.push(`- ${id}`))
    lines.push('')
  }

  // Add URLs
  if (extractedData.urls.length > 0) {
    lines.push('### URLs:')
    extractedData.urls.slice(0, 10).forEach(url => lines.push(`- ${url}`))
    lines.push('')
  }

  // Add API endpoints
  if (extractedData.apiEndpoints.length > 0) {
    lines.push('### API Endpoints:')
    extractedData.apiEndpoints.forEach(api => lines.push(`- ${api}`))
    lines.push('')
  }

  // Add key metadata
  const kvEntries = Object.entries(extractedData.keyValuePairs)
  if (kvEntries.length > 0) {
    lines.push('### Key Data:')
    kvEntries.slice(0, 15).forEach(([key, value]) => {
      const displayValue = value.length > 100 ? value.substring(0, 100) + '...' : value
      lines.push(`- **${key}**: ${displayValue}`)
    })
    lines.push('')
  }

  // Add truncated preview of raw result
  const resultPreview = result.length > 1000
    ? result.substring(0, 500) + '\n\n...[truncated]...\n\n' + result.substring(result.length - 300)
    : result

  lines.push('### Result Preview:')
  lines.push('```')
  lines.push(resultPreview)
  lines.push('```')

  return lines.join('\n')
}

/**
 * Run-Code Result Context Service
 */
export class RunCodeResultContextService {
  private results: StoredResult[] = []
  private options: Required<ResultContextOptions>

  constructor(options: ResultContextOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Store a tool execution result
   * @returns The stored result with summary and extracted data
   */
  storeResult(toolName: string, result: string): StoredResult {
    const tokenCount = estimateTokenCount(result)
    const extractedData = extractImportantData(result)
    const wasSummarized = tokenCount > this.options.summarizeThreshold

    const summary = wasSummarized
      ? generateSummary(toolName, result, extractedData)
      : result

    const storedResult: StoredResult = {
      id: `result_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      toolName,
      timestamp: Date.now(),
      fullResult: result,
      summary,
      tokenCount,
      wasSummarized,
      extractedData,
    }

    // Add to results, keeping only the last N results
    this.results.unshift(storedResult)
    if (this.results.length > this.options.maxStoredResults) {
      this.results = this.results.slice(0, this.options.maxStoredResults)
    }

    return storedResult
  }

  /**
   * Get the content to include in conversation context
   * Returns full result if under token limit, otherwise returns summary
   */
  getContextContent(resultId: string): string {
    const result = this.results.find(r => r.id === resultId)
    if (!result) {
      return ''
    }

    return result.wasSummarized ? result.summary : result.fullResult
  }

  /**
   * Get all results formatted for conversation context
   * Respects token limits and prioritizes recent results
   */
  getAllResultsForContext(): string {
    if (this.results.length === 0) {
      return ''
    }

    const lines: string[] = []
    lines.push('## Previous Tool Execution Results')
    lines.push('')

    let totalTokens = 0
    const maxTotalTokens = this.options.maxTokensForFullResult

    for (const result of this.results) {
      const content = result.wasSummarized ? result.summary : result.fullResult
      const contentTokens = estimateTokenCount(content)

      // Check if adding this result would exceed our total budget
      if (totalTokens + contentTokens > maxTotalTokens) {
        // Add just the summary even if we were going to include full result
        const summaryContent = result.wasSummarized
          ? result.summary
          : generateSummary(result.toolName, result.fullResult, result.extractedData)

        lines.push(`### ${result.toolName} (${new Date(result.timestamp).toLocaleTimeString()})`)
        lines.push(summaryContent)
        lines.push('')

        totalTokens += estimateTokenCount(summaryContent)

        // If even summaries are exceeding budget, stop adding
        if (totalTokens > maxTotalTokens) {
          lines.push('_[Additional results omitted due to context limits]_')
          break
        }
      }
      else {
        lines.push(`### ${result.toolName} (${new Date(result.timestamp).toLocaleTimeString()})`)
        if (result.wasSummarized) {
          lines.push('_[Result summarized - original was large]_')
        }
        lines.push(content)
        lines.push('')
        totalTokens += contentTokens
      }
    }

    return lines.join('\n')
  }

  /**
   * Get just the extracted data from all results (very compact)
   * Useful for providing context without large token usage
   */
  getExtractedDataSummary(): string {
    if (this.results.length === 0) {
      return ''
    }

    const allIds: string[] = []
    const allUrls: string[] = []
    const allKv: Record<string, string> = {}

    for (const result of this.results) {
      allIds.push(...result.extractedData.ids)
      allUrls.push(...result.extractedData.urls)
      Object.assign(allKv, result.extractedData.keyValuePairs)
    }

    const lines: string[] = []
    lines.push('## Available Data from Previous Executions')

    if (allIds.length > 0) {
      lines.push('### IDs:')
      ;[...new Set(allIds)].slice(0, 20).forEach(id => lines.push(`- ${id}`))
    }

    if (allUrls.length > 0) {
      lines.push('### URLs:')
      ;[...new Set(allUrls)].slice(0, 15).forEach(url => lines.push(`- ${url}`))
    }

    const kvEntries = Object.entries(allKv)
    if (kvEntries.length > 0) {
      lines.push('### Key Data:')
      kvEntries.slice(0, 20).forEach(([key, value]) => {
        const displayValue = value.length > 80 ? value.substring(0, 80) + '...' : value
        lines.push(`- **${key}**: ${displayValue}`)
      })
    }

    return lines.join('\n')
  }

  /**
   * Clear all stored results
   */
  clearResults(): void {
    this.results = []
  }

  /**
   * Get the most recent result
   */
  getLatestResult(): StoredResult | null {
    return this.results[0] || null
  }

  /**
   * Get all stored results
   */
  getAllResults(): StoredResult[] {
    return [...this.results]
  }

  /**
   * Get result by ID
   */
  getResultById(id: string): StoredResult | undefined {
    return this.results.find(r => r.id === id)
  }

  /**
   * Check if a specific tool has been executed
   */
  hasToolResult(toolName: string): boolean {
    return this.results.some(r => r.toolName === toolName)
  }

  /**
   * Get all results for a specific tool
   */
  getResultsForTool(toolName: string): StoredResult[] {
    return this.results.filter(r => r.toolName === toolName)
  }
}

// Export singleton instance for use across the app
export const runCodeResultContext = new RunCodeResultContextService()
