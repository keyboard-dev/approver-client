import { AIMessage, AIProvider, AIProviderConfig, WebSearchQuery, WebSearchResponse } from '../index'
import { contentFetcher } from '../utils/content-fetcher'

export class AnthropicProvider implements AIProvider {
  name = 'anthropic'

  async sendMessage(messages: AIMessage[], config: AIProviderConfig): Promise<string> {
    const url = `${config.baseUrl || 'https://api.anthropic.com'}/v1/messages`

    const systemMessage = messages.find(m => m.role === 'system')
    const conversationMessages = messages.filter(m => m.role !== 'system')

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model || 'claude-sonnet-4-5',
        max_tokens: 4096,
        system: systemMessage?.content,
        messages: conversationMessages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
      }),
    })

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as any
    return data.content[0]?.text || ''
  }

  async* streamMessage(messages: AIMessage[], config: AIProviderConfig): AsyncGenerator<string, void, unknown> {
    const url = `${config.baseUrl || 'https://api.anthropic.com'}/v1/messages`

    const systemMessage = messages.find(m => m.role === 'system')
    const conversationMessages = messages.filter(m => m.role !== 'system')

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model || 'claude-sonnet-4-5',
        max_tokens: 4096,
        system: systemMessage?.content,
        messages: conversationMessages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        stream: true,
      }),
    })

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)

            try {
              const parsed = JSON.parse(data)
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                yield parsed.delta.text
              }
            }
            catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    }
    finally {
      reader.releaseLock()
    }
  }

  async webSearch(query: WebSearchQuery, config: AIProviderConfig): Promise<WebSearchResponse> {
    try {
      // Step 1: Use Claude to optimize search query and find relevant URLs
      const searchResults = await this.performClaudeAssistedSearch(query, config)

      // Step 2: Fetch and process content from top results using our enhanced system
      const enhancedResults = await this.enhanceSearchResults(searchResults, query)

      return {
        results: enhancedResults,
        searchQuery: query.query,
        provider: 'anthropic',
      }
    }
    catch (error) {
      console.error('Anthropic web search error:', error)
      throw new Error(`Anthropic web search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async performClaudeAssistedSearch(query: WebSearchQuery, config: AIProviderConfig) {
    // Use Claude to help generate search queries and suggest relevant URLs
    let searchPrompt = `I need to search for information about: "${query.query}"\n\n`

    if (query.prioritizeDocs) {
      searchPrompt += `Focus on finding official documentation, API references, and developer guides.\n`
    }

    if (query.prioritizeMarkdown) {
      searchPrompt += `Prioritize markdown files, README documents, and technical documentation.\n`
    }

    if (query.includeDomains && query.includeDomains.length > 0) {
      searchPrompt += `Focus on these specific domains: ${query.includeDomains.join(', ')}\n`
    }

    searchPrompt += `\nPlease suggest 5-10 specific URLs that would likely contain relevant information about "${query.query}". 
Include official documentation sites, GitHub repositories, and authoritative technical resources.

Format your response as a JSON array with objects containing:
- "url": the specific URL
- "title": expected page title
- "rationale": why this URL is relevant

Example format:
[
  {
    "url": "https://docs.stripe.com/api/payment_intents",
    "title": "Payment Intents API Reference", 
    "rationale": "Official Stripe API documentation for payment intents"
  }
]`

    const response = await this.sendMessage([{
      role: 'user',
      content: searchPrompt,
    }], config)

    return this.parseClaudeSearchResponse(response, query)
  }

  private async enhanceSearchResults(basicResults: any[], query: WebSearchQuery) {
    const enhancedResults = []
    const maxResults = query.maxResults || 5

    // Process top results with our enhanced content fetching
    for (let i = 0; i < Math.min(basicResults.length, maxResults); i++) {
      const result = basicResults[i]

      try {
        // Fetch optimized content using our smart content fetcher
        const fetchedContent = await contentFetcher.fetchOptimizedContent(
          result.url,
          query.query,
          {
            maxContentLength: 8000,
            timeout: 8000,
            prioritizeMarkdown: query.prioritizeMarkdown,
            prioritizeDocs: query.prioritizeDocs,
          },
        )

        // Create enhanced result with processed content
        enhancedResults.push({
          title: result.title,
          url: fetchedContent.finalUrl,
          snippet: this.createEnhancedSnippet(fetchedContent, query),
          relevanceScore: this.calculateRelevance(result.title, fetchedContent.content.markdown, result.url, query),
          isMarkdown: fetchedContent.content.metadata.isMarkdown,
          isDocs: fetchedContent.content.metadata.isDocs,
          contentFormat: fetchedContent.format,
          codeExamples: fetchedContent.content.codeBlocks.filter(block => block.isExample).length,
        })
      }
      catch (error) {
        console.warn(`Failed to enhance Anthropic search result ${result.url}:`, error)
        // Fall back to basic result
        enhancedResults.push({
          title: result.title,
          url: result.url,
          snippet: result.rationale || 'No description available',
          relevanceScore: 0.5,
          isMarkdown: result.url.includes('.md'),
          isDocs: this.isDocsContent(result.url, result.title, result.rationale || ''),
        })
      }
    }

    // Sort by relevance score
    return enhancedResults.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
  }

  private parseClaudeSearchResponse(response: string, query: WebSearchQuery) {
    // Try to extract JSON from Claude's response
    const jsonMatch = response.match(/\[[\s\S]*?\]/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        if (Array.isArray(parsed)) {
          return parsed.map(result => ({
            title: result.title || 'Untitled',
            url: result.url || '',
            rationale: result.rationale || '',
          }))
        }
      }
      catch (e) {
        console.warn('Failed to parse JSON from Claude search response:', e)
      }
    }

    // Fallback: extract URLs from text
    return this.extractUrlsFromText(response, query)
  }

  private extractUrlsFromText(text: string, query: WebSearchQuery): Array<{ title: string, url: string, rationale: string }> {
    const results: Array<{ title: string, url: string, rationale: string }> = []
    const urlRegex = /https?:\/\/[^\s]+/g
    const urls = text.match(urlRegex) || []

    // Get unique URLs and create basic results
    const uniqueUrls = [...new Set(urls)].slice(0, query.maxResults || 10)

    uniqueUrls.forEach((url) => {
      // Try to extract context around the URL for title/description
      const urlIndex = text.indexOf(url)
      const contextStart = Math.max(0, urlIndex - 100)
      const contextEnd = Math.min(text.length, urlIndex + url.length + 100)
      const context = text.slice(contextStart, contextEnd)

      // Extract potential title from context
      const lines = context.split('\n')
      const titleLine = lines.find(line =>
        line.includes(url)
        || /^[-*]\s/.test(line)
        || /^\d+\./.test(line),
      )

      results.push({
        title: titleLine ? titleLine.replace(url, '').trim() : 'Suggested Resource',
        url: url,
        rationale: context.trim(),
      })
    })

    return results
  }

  private createEnhancedSnippet(fetchedContent: any, query: WebSearchQuery): string {
    const content = fetchedContent.content

    let snippet = ''

    if (content.metadata.title) {
      snippet += `${content.metadata.title}\n\n`
    }

    // Add code examples info
    const relevantCode = content.codeBlocks.filter((block: any) => block.isExample).slice(0, 1)
    if (relevantCode.length > 0) {
      snippet += `Code examples available in ${relevantCode[0].language || 'code'}\n`
    }

    // Add content snippet
    const markdownSnippet = content.markdown.slice(0, 400).replace(/```[\s\S]*?```/g, '[code]')
    snippet += markdownSnippet

    if (content.markdown.length > 400) {
      snippet += '...'
    }

    return snippet
  }

  private isDocsContent(url: string, title: string, snippet: string): boolean {
    const docsKeywords = ['docs', 'documentation', 'guide', 'api', 'reference', 'tutorial']
    const docsDomains = ['docs.', 'developer.', 'dev.', 'api.']

    return docsKeywords.some(keyword =>
      url.toLowerCase().includes(keyword)
      || title.toLowerCase().includes(keyword)
      || snippet.toLowerCase().includes(keyword),
    ) || docsDomains.some(domain => url.toLowerCase().includes(domain))
  }

  private calculateRelevance(title: string, content: string, url: string, query: WebSearchQuery): number {
    let score = 0
    const queryLower = query.query.toLowerCase()
    const titleLower = title.toLowerCase()
    const contentLower = content.toLowerCase()

    // Basic keyword matching
    const queryWords = queryLower.split(' ')
    queryWords.forEach((word) => {
      if (titleLower.includes(word)) score += 3
      if (contentLower.includes(word)) score += 1
      if (url.toLowerCase().includes(word)) score += 2
    })

    // Boost for developer content
    if (query.prioritizeDocs && this.isDocsContent(url, title, content)) score += 10
    if (query.prioritizeMarkdown && (url.includes('.md') || content.includes('```'))) score += 5

    // Boost for API examples
    if (content.includes('curl') || content.includes('fetch') || content.includes('api')) score += 5

    return Math.min(score / 20, 1) // Normalize to 0-1
  }

  validateConfig(config: AIProviderConfig): boolean {
    return !!(config.apiKey && config.apiKey.startsWith('sk-ant-'))
  }
}
