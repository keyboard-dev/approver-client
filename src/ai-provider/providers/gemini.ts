import { AIProvider, AIProviderConfig, AIMessage, WebSearchQuery, WebSearchResponse } from '../index'
import { contentFetcher } from '../utils/content-fetcher'

export class GeminiProvider implements AIProvider {
  name = 'gemini'

  async sendMessage(messages: AIMessage[], config: AIProviderConfig): Promise<string> {
    const url = `${config.baseUrl || 'https://generativelanguage.googleapis.com'}/v1beta/models/${config.model || 'gemini-2.5-flash'}:generateContent`

    const contents = this.convertMessagesToGeminiFormat(messages)
    console.log('this is the contents', contents)
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey,
      },
      body: JSON.stringify({
        contents,
      }),
    })

    if (!response.ok) {
      console.log('this is the response', response)
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as any
    console.log('this is the data', data)
    return data.candidates[0]?.content?.parts[0]?.text || ''
  }

  async* streamMessage(messages: AIMessage[], config: AIProviderConfig): AsyncGenerator<string, void, unknown> {
    const url = `${config.baseUrl || 'https://generativelanguage.googleapis.com'}/v1beta/models/${config.model || 'gemini-2.5-flash'}:streamGenerateContent`

    const contents = this.convertMessagesToGeminiFormat(messages)
    console.log('this is the contents', contents)
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey,
      },
      body: JSON.stringify({
        contents,
      }),
    })

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`)
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
          if (line.trim() && line.startsWith('{')) {
            try {
              const parsed = JSON.parse(line)
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text
              if (text) {
                yield text
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
    const url = `${config.baseUrl || 'https://generativelanguage.googleapis.com'}/v1beta/models/${config.model || 'gemini-2.5-flash'}:generateContent`

    try {
      // Step 1: Use Gemini grounding to find relevant URLs
      const searchResults = await this.performGeminiSearch(query, config)
      
      // Step 2: Fetch and process content from top results
      const enhancedResults = await this.enhanceSearchResults(searchResults, query)
      
      return {
        results: enhancedResults,
        searchQuery: query.query,
        provider: 'gemini'
      }
      
    } catch (error) {
      console.error('Gemini web search error:', error)
      throw new Error(`Gemini web search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async performGeminiSearch(query: WebSearchQuery, config: AIProviderConfig) {
    const url = `${config.baseUrl || 'https://generativelanguage.googleapis.com'}/v1beta/models/${config.model || 'gemini-2.5-flash'}:generateContent`

    // Prepare search-optimized prompt
    let searchPrompt = `Find web resources for: ${query.query}`
    
    if (query.prioritizeDocs) {
      searchPrompt += ` Focus on official documentation, developer guides, API references, and technical resources.`
    }
    
    if (query.prioritizeMarkdown) {
      searchPrompt += ` Prioritize README files, markdown documentation, and code examples.`
    }

    if (query.includeDomains && query.includeDomains.length > 0) {
      searchPrompt += ` Focus on these domains: ${query.includeDomains.join(', ')}`
    }

    searchPrompt += ` Return a JSON array of results with title, url, and snippet. Focus on developer resources and documentation.`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.apiKey,
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: searchPrompt }]
        }],
        tools: [{
          google_search_retrieval: {
            dynamic_retrieval_config: {
              mode: 'MODE_DYNAMIC',
              dynamic_threshold: 0.7
            }
          }
        }]
      }),
    })

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as any
    const responseText = data.candidates[0]?.content?.parts[0]?.text || ''
    
    // Parse the response to extract search results
    return this.parseGeminiSearchResults(responseText, query)
  }

  private async enhanceSearchResults(basicResults: any[], query: WebSearchQuery) {
    const enhancedResults = []
    const maxResults = query.maxResults || 5
    
    // Process top results with content fetching
    for (let i = 0; i < Math.min(basicResults.length, maxResults); i++) {
      const result = basicResults[i]
      
      try {
        // Fetch optimized content for this URL
        const fetchedContent = await contentFetcher.fetchOptimizedContent(
          result.url,
          query.query,
          {
            maxContentLength: 8000, // Limit content size
            timeout: 8000, // 8 second timeout
            prioritizeMarkdown: query.prioritizeMarkdown,
            prioritizeDocs: query.prioritizeDocs
          }
        )
        
        // Create enhanced result with content
        enhancedResults.push({
          title: result.title,
          url: fetchedContent.finalUrl,
          snippet: this.createEnhancedSnippet(fetchedContent, query),
          relevanceScore: this.calculateRelevance(result.title, fetchedContent.content.markdown, result.url, query),
          isMarkdown: fetchedContent.content.metadata.isMarkdown,
          isDocs: fetchedContent.content.metadata.isDocs,
          contentFormat: fetchedContent.format,
          codeExamples: fetchedContent.content.codeBlocks.filter(block => block.isExample).length
        })
        
      } catch (error) {
        console.warn(`Failed to enhance result ${result.url}:`, error)
        // Fall back to basic result
        enhancedResults.push({
          title: result.title,
          url: result.url,
          snippet: result.snippet || 'No snippet available',
          relevanceScore: 0.5,
          isMarkdown: result.url.includes('.md'),
          isDocs: this.isDocsContent(result.url, result.title, result.snippet)
        })
      }
    }
    
    // Sort by relevance score
    return enhancedResults.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
  }

  private createEnhancedSnippet(fetchedContent: any, query: WebSearchQuery): string {
    const content = fetchedContent.content
    
    // Create snippet from metadata and key content
    let snippet = ''
    
    if (content.metadata.title) {
      snippet += `${content.metadata.title}\n\n`
    }
    
    // Add relevant code examples if available
    const relevantCode = content.codeBlocks.filter((block: any) => block.isExample).slice(0, 1)
    if (relevantCode.length > 0) {
      snippet += `Code example available in ${relevantCode[0].language || 'code'}\n`
    }
    
    // Add portion of markdown content
    const markdownSnippet = content.markdown.slice(0, 400).replace(/```[\s\S]*?```/g, '[code]')
    snippet += markdownSnippet
    
    if (content.markdown.length > 400) {
      snippet += '...'
    }
    
    return snippet
  }

  private parseGeminiSearchResults(responseText: string, query: WebSearchQuery) {
    // Try to extract JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*?\]|\{[\s\S]*?\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        if (Array.isArray(parsed)) {
          return parsed.map(result => this.normalizeSearchResult(result))
        } else if (parsed.results && Array.isArray(parsed.results)) {
          return parsed.results.map((result: any) => this.normalizeSearchResult(result))
        }
      } catch (e) {
        console.warn('Failed to parse JSON from Gemini search response:', e)
      }
    }

    // Fallback: extract results from text format
    return this.extractResultsFromText(responseText, query)
  }

  private normalizeSearchResult(result: any) {
    return {
      title: result.title || result.name || 'Untitled',
      url: result.url || result.link || '',
      snippet: result.snippet || result.description || result.summary || ''
    }
  }

  private extractResultsFromText(text: string, query: WebSearchQuery) {
    // Basic extraction from text format
    const results = []
    const lines = text.split('\n')
    
    let currentResult: any = {}
    for (const line of lines) {
      if (line.includes('http')) {
        if (currentResult.url) {
          results.push(this.normalizeSearchResult(currentResult))
          currentResult = {}
        }
        currentResult.url = line.match(/https?:\/\/[^\s]+/)?.[0] || ''
      } else if (line.trim() && !currentResult.title && !line.includes('http')) {
        currentResult.title = line.trim()
      } else if (line.trim() && currentResult.title && !currentResult.snippet) {
        currentResult.snippet = line.trim()
      }
    }
    
    if (currentResult.url) {
      results.push(this.normalizeSearchResult(currentResult))
    }
    
    return results.slice(0, query.maxResults || 10)
  }

  private isDocsContent(url: string, title: string, snippet: string): boolean {
    const docsKeywords = ['docs', 'documentation', 'guide', 'api', 'reference', 'tutorial']
    const docsDomains = ['docs.', 'developer.', 'dev.', 'api.']
    
    return docsKeywords.some(keyword => 
      url.toLowerCase().includes(keyword) || 
      title.toLowerCase().includes(keyword) || 
      snippet.toLowerCase().includes(keyword)
    ) || docsDomains.some(domain => url.toLowerCase().includes(domain))
  }

  private calculateRelevance(title: string, content: string, url: string, query: WebSearchQuery): number {
    let score = 0
    const queryLower = query.query.toLowerCase()
    const titleLower = title.toLowerCase()
    const contentLower = content.toLowerCase()
    
    // Basic keyword matching
    const queryWords = queryLower.split(' ')
    queryWords.forEach(word => {
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
    return !!(config.apiKey && config.apiKey.length > 0)
  }

  private convertMessagesToGeminiFormat(messages: AIMessage[]) {
    const contents = []

    for (const message of messages) {
      if (message.role === 'system') {
        // Gemini doesn't have a system role, prepend to first user message
        continue
      }

      contents.push({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      })
    }

    // Add system message to first user message if exists
    const systemMessage = messages.find(m => m.role === 'system')
    if (systemMessage && contents.length > 0 && contents[0].role === 'user') {
      contents[0].parts[0].text = `${systemMessage.content}\n\n${contents[0].parts[0].text}`
    }

    return contents
  }
}
