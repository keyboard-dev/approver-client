/**
 * Universal web search tool for MCP integration
 * Delegates to the appropriate AI provider's web search capability
 */

export interface WebSearchToolParams {
  query: string
  company: string
  maxResults?: number
  prioritizeMarkdown?: boolean
  prioritizeDocs?: boolean
  includeDomains?: string[]
  excludeDomains?: string[]
  provider?: string // Optional: specify provider, otherwise use current
}

export interface WebSearchToolResult {
  results: Array<{
    title: string
    url: string
    snippet: string
    relevanceScore?: number
    isMarkdown?: boolean
    isDocs?: boolean
    contentFormat?: string
    codeExamples?: number
  }>
  searchQuery: string
  provider: string
  totalResults: number
  searchTime?: number
}

export class WebSearchTool {
  /**
   * Execute web search using the current or specified AI provider
   */
  async execute(params: WebSearchToolParams): Promise<WebSearchToolResult> {
    try {
      const startTime = Date.now()

      // Validate required parameters
      if (!params.query?.trim()) {
        throw new Error('Query parameter is required and cannot be empty')
      }
      if (!params.company?.trim()) {
        throw new Error('Company parameter is required and cannot be empty')
      }

      // Determine which provider to use
      const provider = params.provider || this.getCurrentProvider()

      if (!provider) {
        throw new Error('No AI provider available for web search')
      }

      // Call the provider's web search through IPC with all required parameters
      const response = await window.electronAPI.webSearch(provider, params.query, params.company)

      const searchTime = Date.now() - startTime

      // Extract web search results from the nested API response structure
      // API returns: {success: true, data: {content: [...]} }
      console.log('YO WHAT IS THE RESPONSE', response)
      const webSearchResults = response?.data?.content?.filter((item: { type: string }) => item.type === 'web_search_tool_result') || []
      const results = webSearchResults.content.map(function (item: any) {
        const data: any = {}
        if (item.url) data.url = item.url
        if (item.text) data.text = item.text
        if (item.title) data.title = item.title
        if (item.citations) data.citations = item.citations.map(function (citation: any) {
          return {
            url: citation.url,
            text: citation.cited_text,
            title: citation.title,
          }
        })
      })

      return {
        results: results,
        searchQuery: params.query,
        provider: provider,
        totalResults: results.length,
        searchTime,
      }
    }
    catch (error) {
      console.error('Web search tool error:', error)
      throw new Error(`Web search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Check if web search is available for the current provider
   */
  async isAvailable(provider?: string): Promise<boolean> {
    try {
      const targetProvider = provider || this.getCurrentProvider()
      if (!targetProvider) return false

      // Check if provider is configured and supports web search
      const providers = await window.electronAPI.getAIProviderKeys()
      const providerInfo = providers.find(p => p.provider === targetProvider)

      return !!(providerInfo?.configured && this.supportsWebSearch(targetProvider))
    }
    catch (error) {
      console.error('Error checking web search availability:', error)
      return false
    }
  }

  /**
   * Get description for MCP tool registration
   */
  getToolDescription(): string {
    return `Search the web for developer documentation, API references, and code examples. 
Automatically fetches and processes content from documentation sites, prioritizes markdown files, 
and extracts relevant code snippets. Optimized for technical queries and developer workflows.

Example usage:
- "stripe payment intents api" - finds Stripe API documentation
- "react hooks tutorial" - finds React documentation and tutorials  
- "python requests library" - finds Python requests documentation

Results include processed content with code examples when available.`
  }

  /**
   * Get tool schema for MCP integration
   */
  getToolSchema() {
    return {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for web content (e.g., "stripe payment api", "react hooks tutorial")',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of results to return (default: 5)',
          minimum: 1,
          maximum: 10,
        },
        prioritizeMarkdown: {
          type: 'boolean',
          description: 'Prioritize markdown files and README documents (default: false)',
        },
        prioritizeDocs: {
          type: 'boolean',
          description: 'Prioritize documentation websites and developer guides (default: true)',
        },
        includeDomains: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific domains to focus on (e.g., ["docs.stripe.com", "developer.mozilla.org"])',
        },
        excludeDomains: {
          type: 'array',
          items: { type: 'string' },
          description: 'Domains to exclude from search results',
        },
      },
      required: ['query'],
    }
  }

  /**
   * Format results for AI consumption
   */
  formatResultsForAI(result: WebSearchToolResult): string {
    const { results, searchQuery, provider, totalResults, searchTime } = result

    let output = `# Web Search Results for "${searchQuery}"\n\n`
    output += `**Provider:** ${provider} | **Results:** ${totalResults} | **Time:** ${searchTime}ms\n\n`

    results.forEach((item, index) => {
      output += `## ${index + 1}. ${item.title}\n`
      output += `**URL:** ${item.url}\n`

      if (item.contentFormat) {
        output += `**Format:** ${item.contentFormat}`
      }
      if (item.isMarkdown) output += ' | 📝 Markdown'
      if (item.isDocs) output += ' | 📚 Documentation'
      if (item.codeExamples && item.codeExamples > 0) output += ` | 💻 ${item.codeExamples} code examples`

      output += '\n\n'
      output += item.snippet
      output += '\n\n---\n\n'
    })

    if (results.length === 0) {
      output += '*No results found. Try refining your search query or checking for typos.*\n'
    }

    return output
  }

  /**
   * Get current AI provider from local storage or settings
   */
  private getCurrentProvider(): string | null {
    // This would typically come from the current chat context or settings
    // For now, we'll check what providers are available and configured
    try {
      // Try to get from localStorage or app state
      const storedProvider = localStorage.getItem('currentAIProvider')
      if (storedProvider) return storedProvider

      // Default to gemini if available since it has the best web search support
      return 'gemini'
    }
    catch (error) {
      console.warn('Could not determine current provider:', error)
      return 'gemini' // Default fallback
    }
  }

  /**
   * Check if a provider supports web search
   */
  private supportsWebSearch(provider: string): boolean {
    // Currently only Gemini has full web search support implemented
    // OpenAI and Anthropic will be added next
    const supportedProviders = ['gemini', 'openai', 'anthropic']
    return supportedProviders.includes(provider.toLowerCase())
  }

  /**
   * Get default domains to search based on query
   */
  private getDefaultDomains(query: string): string[] {
    const queryLower = query.toLowerCase()
    const domains: string[] = []

    // Add domains based on query keywords
    if (queryLower.includes('stripe')) {
      domains.push('docs.stripe.com', 'stripe.com')
    }
    if (queryLower.includes('react')) {
      domains.push('react.dev', 'reactjs.org')
    }
    if (queryLower.includes('node') || queryLower.includes('npm')) {
      domains.push('nodejs.org', 'npmjs.com')
    }
    if (queryLower.includes('python')) {
      domains.push('docs.python.org', 'python.org')
    }
    if (queryLower.includes('typescript')) {
      domains.push('typescriptlang.org')
    }
    if (queryLower.includes('mdn') || queryLower.includes('javascript') || queryLower.includes('css')) {
      domains.push('developer.mozilla.org')
    }

    // Add general documentation domains
    domains.push('github.com', 'stackoverflow.com')

    return [...new Set(domains)] // Remove duplicates
  }
}

// Export singleton instance
export const webSearchTool = new WebSearchTool()
