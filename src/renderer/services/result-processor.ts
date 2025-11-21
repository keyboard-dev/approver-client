import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

export interface ProcessedResult {
  summary: string
  fullResult?: string
  tokenCount: number
  wasFiltered: boolean
  filterReason?: string
}

export interface ProcessingOptions {
  maxTokens?: number
  includeFullResult?: boolean
  filterSensitiveData?: boolean
  summarizeLargeData?: boolean
  contextKeywords?: string[]
}

/**
 * Result processing service for efficient context management
 * Filters, summarizes, and optimizes ability results before sending to AI
 */
export class ResultProcessorService {
  private readonly DEFAULT_MAX_TOKENS = 500
  private readonly LARGE_DATA_THRESHOLD = 1000

  /**
   * Process ability result for efficient context usage
   */
  processResult(
    abilityName: string,
    result: CallToolResult,
    options: ProcessingOptions = {}
  ): ProcessedResult {
    const {
      maxTokens = this.DEFAULT_MAX_TOKENS,
      includeFullResult = false,
      filterSensitiveData = true,
      summarizeLargeData = true,
      contextKeywords = [],
    } = options

    // Extract text content from MCP result
    const rawText = this.extractTextFromResult(result)
    const estimatedTokens = this.estimateTokens(rawText)

    // Check if filtering is needed
    if (estimatedTokens <= maxTokens && !filterSensitiveData) {
      return {
        summary: rawText,
        fullResult: includeFullResult ? rawText : undefined,
        tokenCount: estimatedTokens,
        wasFiltered: false,
      }
    }

    // Apply processing based on content type and size
    let processed: ProcessedResult

    if (this.isStructuredData(rawText)) {
      processed = this.processStructuredData(abilityName, rawText, options)
    } else if (this.isLargeText(rawText)) {
      processed = this.processLargeText(abilityName, rawText, options)
    } else {
      processed = this.processGenericText(abilityName, rawText, options)
    }

    // Filter sensitive data if requested
    if (filterSensitiveData) {
      processed = this.filterSensitiveData(processed)
    }

    return processed
  }

  /**
   * Extract text content from MCP CallToolResult
   */
  private extractTextFromResult(result: CallToolResult): string {
    try {
      if (result.content && Array.isArray(result.content)) {
        const textContent = result.content
          .filter(item => item.type === 'text')
          .map(item => item.text)
          .join('\n')
        
        if (textContent) {
          return textContent
        }
      }

      // Fallback to JSON representation
      return JSON.stringify(result, null, 2)
    } catch (error) {
      return `Error processing result: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }

  /**
   * Format ability call results for AI provider consumption
   */
  formatAbilityResult(abilityName: string, result: CallToolResult): string {
    try {
      // Extract useful content from MCP ability result
      if (result.content && Array.isArray(result.content)) {
        const textContent = result.content
          .filter(item => item.type === 'text')
          .map(item => item.text)
          .join('\n')
        
        if (textContent) {
          return textContent
        }
      }

      // Fallback to JSON representation
      return JSON.stringify(result, null, 2)
    } catch (error) {
      return `Error formatting result from ${abilityName}: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }

  /**
   * Estimate token count (rough approximation: 4 chars = 1 token)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }

  /**
   * Check if content appears to be structured data (JSON, CSV, etc.)
   */
  private isStructuredData(text: string): boolean {
    // Check for JSON
    if ((text.startsWith('{') && text.endsWith('}')) || 
        (text.startsWith('[') && text.endsWith(']'))) {
      return true
    }

    // Check for CSV-like structure
    const lines = text.split('\n')
    if (lines.length > 3) {
      const firstLine = lines[0]
      const hasCommas = firstLine.includes(',')
      const hasTabs = firstLine.includes('\t')
      if (hasCommas || hasTabs) {
        return true
      }
    }

    return false
  }

  /**
   * Check if text is large and needs summarization
   */
  private isLargeText(text: string): boolean {
    return this.estimateTokens(text) > this.LARGE_DATA_THRESHOLD
  }

  /**
   * Process structured data (JSON, CSV, etc.)
   */
  private processStructuredData(
    abilityName: string,
    text: string,
    options: ProcessingOptions
  ): ProcessedResult {
    try {
      // Try to parse as JSON
      const data = JSON.parse(text)
      
      if (Array.isArray(data)) {
        return this.summarizeArrayData(abilityName, data, options)
      } else if (typeof data === 'object') {
        return this.summarizeObjectData(abilityName, data, options)
      }
    } catch {
      // Not valid JSON, try CSV
      if (text.includes(',') || text.includes('\t')) {
        return this.summarizeCSVData(abilityName, text, options)
      }
    }

    return this.processGenericText(abilityName, text, options)
  }

  /**
   * Summarize array data
   */
  private summarizeArrayData(
    abilityName: string,
    data: any[],
    options: ProcessingOptions
  ): ProcessedResult {
    const length = data.length
    const firstFew = data.slice(0, 3)
    const sampleKeys = this.extractObjectKeys(firstFew)

    let summary = `${abilityName} returned ${length} items.`
    
    if (length > 0) {
      summary += ` Sample items (first 3):\n`
      summary += firstFew.map((item, i) => `${i + 1}. ${this.summarizeItem(item)}`).join('\n')
      
      if (sampleKeys.length > 0) {
        summary += `\n\nCommon fields: ${sampleKeys.join(', ')}`
      }
    }

    if (options.contextKeywords?.length) {
      const relevantItems = this.filterByKeywords(data, options.contextKeywords)
      if (relevantItems.length < length) {
        summary += `\n\nItems matching context "${options.contextKeywords.join(', ')}": ${relevantItems.length}`
      }
    }

    return {
      summary,
      fullResult: options.includeFullResult ? JSON.stringify(data, null, 2) : undefined,
      tokenCount: this.estimateTokens(summary),
      wasFiltered: true,
      filterReason: 'Large array data summarized',
    }
  }

  /**
   * Summarize object data
   */
  private summarizeObjectData(
    abilityName: string,
    data: object,
    options: ProcessingOptions
  ): ProcessedResult {
    const keys = Object.keys(data)
    const summary = `${abilityName} returned an object with ${keys.length} fields: ${keys.slice(0, 10).join(', ')}${keys.length > 10 ? '...' : ''}`

    return {
      summary,
      fullResult: options.includeFullResult ? JSON.stringify(data, null, 2) : undefined,
      tokenCount: this.estimateTokens(summary),
      wasFiltered: true,
      filterReason: 'Object data summarized',
    }
  }

  /**
   * Summarize CSV data
   */
  private summarizeCSVData(
    abilityName: string,
    text: string,
    options: ProcessingOptions
  ): ProcessedResult {
    const lines = text.split('\n').filter(line => line.trim())
    const headers = lines[0]?.split(',') || []
    const rowCount = lines.length - 1

    let summary = `${abilityName} returned CSV data with ${rowCount} rows and ${headers.length} columns.`
    if (headers.length > 0) {
      summary += `\nColumns: ${headers.slice(0, 10).join(', ')}${headers.length > 10 ? '...' : ''}`
    }

    if (rowCount > 0) {
      summary += `\nSample row: ${lines[1] || 'N/A'}`
    }

    return {
      summary,
      fullResult: options.includeFullResult ? text : undefined,
      tokenCount: this.estimateTokens(summary),
      wasFiltered: true,
      filterReason: 'CSV data summarized',
    }
  }

  /**
   * Process large text content
   */
  private processLargeText(
    abilityName: string,
    text: string,
    options: ProcessingOptions
  ): ProcessedResult {
    const maxTokens = options.maxTokens || this.DEFAULT_MAX_TOKENS
    const approximateMaxChars = maxTokens * 4

    if (text.length <= approximateMaxChars) {
      return {
        summary: text,
        tokenCount: this.estimateTokens(text),
        wasFiltered: false,
      }
    }

    // Create summary for large text
    const beginning = text.substring(0, approximateMaxChars / 2)
    const ending = text.substring(text.length - approximateMaxChars / 4)
    
    const summary = `${abilityName} returned large text content (${text.length} chars). 

Beginning:
${beginning}

[... content truncated ...]

End:
${ending}`

    return {
      summary,
      fullResult: options.includeFullResult ? text : undefined,
      tokenCount: this.estimateTokens(summary),
      wasFiltered: true,
      filterReason: 'Large text truncated',
    }
  }

  /**
   * Process generic text content
   */
  private processGenericText(
    abilityName: string,
    text: string,
    options: ProcessingOptions
  ): ProcessedResult {
    const maxTokens = options.maxTokens || this.DEFAULT_MAX_TOKENS
    const approximateMaxChars = maxTokens * 4

    if (text.length <= approximateMaxChars) {
      return {
        summary: text,
        tokenCount: this.estimateTokens(text),
        wasFiltered: false,
      }
    }

    // Truncate at word boundary
    const truncated = text.substring(0, approximateMaxChars)
    const lastSpace = truncated.lastIndexOf(' ')
    const finalText = lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...'

    return {
      summary: finalText,
      fullResult: options.includeFullResult ? text : undefined,
      tokenCount: this.estimateTokens(finalText),
      wasFiltered: true,
      filterReason: 'Text truncated for efficiency',
    }
  }

  /**
   * Filter out potentially sensitive data
   */
  private filterSensitiveData(result: ProcessedResult): ProcessedResult {
    // Simple regex patterns for sensitive data
    const patterns = [
      /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, // Email
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
      /sk-[a-zA-Z0-9]{48}/g, // OpenAI API keys
      /xoxb-[a-zA-Z0-9-]+/g, // Slack tokens
    ]

    let filteredSummary = result.summary
    let wasModified = false

    for (const pattern of patterns) {
      const original = filteredSummary
      filteredSummary = filteredSummary.replace(pattern, '[REDACTED]')
      if (filteredSummary !== original) {
        wasModified = true
      }
    }

    return {
      ...result,
      summary: filteredSummary,
      filterReason: wasModified 
        ? `${result.filterReason || 'Processed'} + sensitive data redacted`
        : result.filterReason,
    }
  }

  /**
   * Extract common keys from objects in array
   */
  private extractObjectKeys(items: any[]): string[] {
    const keyFreq: Record<string, number> = {}
    
    for (const item of items) {
      if (typeof item === 'object' && item !== null) {
        for (const key of Object.keys(item)) {
          keyFreq[key] = (keyFreq[key] || 0) + 1
        }
      }
    }

    // Return keys that appear in most items
    const threshold = Math.ceil(items.length / 2)
    return Object.entries(keyFreq)
      .filter(([_, freq]) => freq >= threshold)
      .map(([key, _]) => key)
      .slice(0, 10) // Limit to avoid noise
  }

  /**
   * Summarize a single item
   */
  private summarizeItem(item: any): string {
    if (typeof item === 'string') {
      return item.length > 50 ? item.substring(0, 50) + '...' : item
    }
    if (typeof item === 'object' && item !== null) {
      const keys = Object.keys(item)
      if (keys.length <= 3) {
        return JSON.stringify(item)
      }
      return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`
    }
    return String(item)
  }

  /**
   * Filter array by keywords
   */
  private filterByKeywords(data: any[], keywords: string[]): any[] {
    const lowerKeywords = keywords.map(k => k.toLowerCase())
    
    return data.filter(item => {
      const itemStr = JSON.stringify(item).toLowerCase()
      return lowerKeywords.some(keyword => itemStr.includes(keyword))
    })
  }
}