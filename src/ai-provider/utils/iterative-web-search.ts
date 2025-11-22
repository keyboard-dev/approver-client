/**
 * AI-driven iterative web search for finding executable code examples
 * Uses intelligent URL ranking, llms.txt discovery, and content quality assessment
 */

import type { AIProvider, AIProviderConfig, WebSearchQuery } from '../index'
import { contentFetcher, type FetchedContent } from './content-fetcher'

export interface SearchIteration {
  iteration: number
  query: string
  suggestedUrls: string[]
  fetchedContent: FetchedContent[]
  codeExamplesFound: boolean
  refinementReason?: string
}

export interface IterativeSearchResult {
  finalResults: Array<{
    title: string
    url: string
    snippet: string
    relevanceScore: number
    codeExamples: number
    hasExecutableCode: boolean
    codeLanguages: string[]
  }>
  iterations: SearchIteration[]
  totalSearchTime: number
  foundExecutableCode: boolean
  recommendations?: string[]
}

export class IterativeWebSearch {
  private maxIterations = 3
  private provider: AIProvider
  private config: AIProviderConfig

  constructor(provider: AIProvider, config: AIProviderConfig) {
    this.provider = provider
    this.config = config
  }

  /**
   * Main iterative search method - runs up to 3 iterations to find executable code examples
   */
  async search(query: WebSearchQuery): Promise<IterativeSearchResult> {
    const startTime = Date.now()
    const iterations: SearchIteration[] = []
    let foundExecutableCode = false
    let finalResults: any[] = []

    // Initial search query
    let currentQuery = this.buildInitialQuery(query)

    for (let i = 0; i < this.maxIterations && !foundExecutableCode; i++) {
      const iteration = await this.performSearchIteration(currentQuery, query, i + 1)
      iterations.push(iteration)

      // Evaluate if we found executable code
      const codeQuality = await this.evaluateCodeQuality(iteration.fetchedContent, query)

      if (codeQuality.hasExecutableCode) {
        foundExecutableCode = true
        finalResults = codeQuality.results
        break
      }

      // Refine query for next iteration if not found
      if (i < this.maxIterations - 1) {
        currentQuery = await this.refineSearchQuery(currentQuery, iterations, query)
      }
    }

    // If no executable code found, prepare recommendations
    let recommendations: string[] | undefined
    if (!foundExecutableCode) {
      recommendations = await this.generateRecommendations(iterations, query)
    }

    return {
      finalResults,
      iterations,
      totalSearchTime: Date.now() - startTime,
      foundExecutableCode,
      recommendations,
    }
  }

  /**
   * Build initial search query focused on finding code examples
   */
  private buildInitialQuery(query: WebSearchQuery): string {
    let searchQuery = query.query

    // Add code-specific terms if not already present
    if (!searchQuery.toLowerCase().includes('example') && !searchQuery.toLowerCase().includes('code')) {
      searchQuery += ' examples code'
    }

    // Add language preferences
    if (!searchQuery.toLowerCase().includes('typescript') && !searchQuery.toLowerCase().includes('javascript')) {
      searchQuery += ' TypeScript JavaScript'
    }

    return searchQuery
  }

  /**
   * Perform a single search iteration with URL ranking and smart fetching
   */
  private async performSearchIteration(
    searchQuery: string,
    originalQuery: WebSearchQuery,
    iteration: number,
  ): Promise<SearchIteration> {
    // Step 1: Get AI-suggested URLs
    const suggestedUrls = await this.getAISuggestedUrls(searchQuery, originalQuery, iteration)

    // Step 2: Check for llms.txt on documentation domains
    const enhancedUrls = await this.checkForLLMSTxt(suggestedUrls)

    // Step 3: Rank URLs by code example likelihood
    const rankedUrls = await this.rankUrlsByCodeLikelihood(enhancedUrls, searchQuery)

    // Step 4: Fetch content from top-ranked URLs
    const fetchedContent: FetchedContent[] = []
    const maxUrlsToFetch = Math.min(5, rankedUrls.length)

    for (let i = 0; i < maxUrlsToFetch; i++) {
      try {
        const content = await contentFetcher.fetchOptimizedContent(
          rankedUrls[i],
          searchQuery,
          {
            maxContentLength: 10000,
            timeout: 8000,
            prioritizeMarkdown: true,
            prioritizeDocs: true,
          },
        )
        fetchedContent.push(content)
      }
      catch (error) {
        console.warn(`Failed to fetch ${rankedUrls[i]}:`, error)
      }
    }

    return {
      iteration,
      query: searchQuery,
      suggestedUrls,
      fetchedContent,
      codeExamplesFound: false, // Will be determined later
    }
  }

  /**
   * Use AI to suggest relevant URLs for the search query
   */
  private async getAISuggestedUrls(
    searchQuery: string,
    originalQuery: WebSearchQuery,
    iteration: number,
  ): Promise<string[]> {
    const iterationContext = iteration > 1
      ? `\n\nThis is search iteration ${iteration}. Previous searches may not have found executable code examples, so suggest different, more specific URLs.`
      : ''

    const prompt = `I need to find executable code examples for: "${searchQuery}"

Focus on finding URLs that likely contain:
- Complete, runnable TypeScript/JavaScript code examples
- API client implementation examples  
- SDK documentation with code snippets
- Tutorial pages with working code
- GitHub repositories with example code

${originalQuery.prioritizeDocs ? 'Prioritize official documentation sites with examples sections.' : ''}
${originalQuery.prioritizeMarkdown ? 'Look for README files and markdown documentation with code blocks.' : ''}
${originalQuery.includeDomains ? `Focus on these domains: ${originalQuery.includeDomains.join(', ')}` : ''}

${iterationContext}

Please suggest 8-10 specific URLs that would most likely contain executable code examples. Include:
- Official docs with "examples" or "getting-started" sections
- GitHub repos with working examples
- Developer tutorial sites
- SDK reference pages

Format as JSON array:
[
  {
    "url": "specific URL",
    "title": "expected page title",
    "rationale": "why this URL likely has executable code",
    "codeConfidence": "high|medium|low"
  }
]`

    const response = await this.provider.sendMessage([{
      role: 'user',
      content: prompt,
    }], this.config)

    return this.parseUrlsFromResponse(response)
  }

  /**
   * Check documentation domains for llms.txt files
   */
  private async checkForLLMSTxt(urls: string[]): Promise<string[]> {
    const enhancedUrls = [...urls]
    const checkedDomains = new Set<string>()

    for (const url of urls) {
      try {
        const urlObj = new URL(url)
        const domain = urlObj.origin

        if (checkedDomains.has(domain)) continue
        checkedDomains.add(domain)

        // Check for llms.txt
        const llmsTxtUrl = `${domain}/llms.txt`
        try {
          const response = await fetch(llmsTxtUrl, {
            method: 'HEAD',
            signal: AbortSignal.timeout(3000),
          })

          if (response.ok) {
            enhancedUrls.unshift(llmsTxtUrl) // Add to front for priority
          }
        }
        catch {
          // llms.txt doesn't exist, continue
        }
      }
      catch {
        // Invalid URL, skip
        continue
      }
    }

    return enhancedUrls
  }

  /**
   * Use AI to rank URLs by likelihood of containing executable code examples
   */
  private async rankUrlsByCodeLikelihood(urls: string[], searchQuery: string): Promise<string[]> {
    const prompt = `Given these URLs for the search query "${searchQuery}", rank them by likelihood of containing executable, copy-paste ready code examples (1-10 scale, 10 being most likely).

URLs:
${urls.map((url, i) => `${i + 1}. ${url}`).join('\n')}

Consider:
- Official documentation with "examples", "quickstart", "getting-started" sections
- GitHub repositories with working code
- SDK documentation and API references
- Tutorial sites with complete implementations
- URLs containing "example", "tutorial", "guide" in path

Return as JSON array ordered by rank (highest first):
[
  {
    "url": "URL",
    "rank": 8,
    "reasoning": "why this URL likely has good code examples"
  }
]`

    const response = await this.provider.sendMessage([{
      role: 'user',
      content: prompt,
    }], this.config)

    const rankedUrls = this.parseRankedUrls(response)
    return rankedUrls.map(item => item.url)
  }

  /**
   * Evaluate the quality and executability of found content
   */
  private async evaluateCodeQuality(
    fetchedContent: FetchedContent[],
    originalQuery: WebSearchQuery,
  ): Promise<{ hasExecutableCode: boolean, results: any[] }> {
    if (fetchedContent.length === 0) {
      return { hasExecutableCode: false, results: [] }
    }

    // Extract code examples from all content
    const codeBlocks = fetchedContent.flatMap(content =>
      content.content.codeBlocks.map(block => ({
        code: block.code,
        language: block.language,
        isExample: block.isExample,
        sourceUrl: content.finalUrl,
        sourceTitle: content.content.metadata.title,
      })),
    )

    if (codeBlocks.length === 0) {
      return { hasExecutableCode: false, results: [] }
    }

    // Use AI to evaluate code quality
    const prompt = `Evaluate these code examples for the query "${originalQuery.query}". Determine if any contain executable, production-ready code that a developer could copy and use.

Code examples found:
${codeBlocks.map((block, i) =>
  `${i + 1}. Language: ${block.language || 'unknown'}\nSource: ${block.sourceTitle} (${block.sourceUrl})\nCode:\n${block.code.substring(0, 500)}${block.code.length > 500 ? '...' : ''}\n---`,
).join('\n')}

For each code example, assess:
1. Is it complete and executable? 
2. Does it address the user's query?
3. Is it production-ready or just a snippet?
4. What's missing (if anything) to make it runnable?

Return JSON assessment:
{
  "hasExecutableCode": boolean,
  "executableExamples": [
    {
      "codeIndex": number,
      "isExecutable": boolean,
      "completeness": "complete|partial|snippet",
      "language": "typescript|javascript|etc",
      "reasoning": "why this is/isn't executable"
    }
  ]
}`

    const response = await this.provider.sendMessage([{
      role: 'user',
      content: prompt,
    }], this.config)

    const assessment = this.parseCodeAssessment(response)

    // Build results from executable code
    const results = fetchedContent.map(content => ({
      title: content.content.metadata.title || 'API Documentation',
      url: content.finalUrl,
      snippet: this.createCodeEnhancedSnippet(content, assessment),
      relevanceScore: this.calculateCodeRelevance(content, assessment, originalQuery),
      codeExamples: content.content.codeBlocks.length,
      hasExecutableCode: this.hasExecutableCodeForUrl(content.finalUrl, assessment),
      codeLanguages: content.content.codeBlocks.map(b => b.language).filter(Boolean),
    }))

    return {
      hasExecutableCode: assessment.hasExecutableCode,
      results: results.filter(r => r.hasExecutableCode || r.codeExamples > 0),
    }
  }

  /**
   * Refine search query based on previous iteration results
   */
  private async refineSearchQuery(
    currentQuery: string,
    previousIterations: SearchIteration[],
    originalQuery: WebSearchQuery,
  ): Promise<string> {
    const prompt = `I'm searching for executable code examples but haven't found good results yet.

Original query: "${originalQuery.query}"
Current search: "${currentQuery}"
Previous iterations: ${previousIterations.length}

Based on the search so far, suggest a refined search query that's more likely to find executable TypeScript/JavaScript code examples. Consider:
- Adding more specific terms like "SDK", "client library", "implementation"
- Including "GitHub", "examples", "tutorial" 
- Being more specific about the API or service
- Adding framework-specific terms if relevant

Return just the refined search query (no explanation needed).`

    const response = await this.provider.sendMessage([{
      role: 'user',
      content: prompt,
    }], this.config)

    return response.trim().replace(/^["']|["']$/g, '') // Remove quotes if present
  }

  /**
   * Generate recommendations when no executable code is found
   */
  private async generateRecommendations(
    iterations: SearchIteration[],
    query: WebSearchQuery,
  ): Promise<string[]> {
    const allUrls = iterations.flatMap(iter => iter.suggestedUrls)
    const uniqueUrls = [...new Set(allUrls)]

    return [
      'No ready-to-use code examples were found in the search results.',
      `Consider reviewing these documentation URLs manually for implementation details:`,
      ...uniqueUrls.slice(0, 3).map(url => `• ${url}`),
      `Try searching for "${query.query} SDK" or "${query.query} JavaScript client library"`,
      'Look for \'Examples\', \'Getting Started\', or \'Quickstart\' sections in the official documentation',
      'Consider checking GitHub for community examples and unofficial SDKs',
    ]
  }

  // Helper methods for parsing AI responses
  private parseUrlsFromResponse(response: string): string[] {
    try {
      const jsonMatch = response.match(/\[[\s\S]*?\]/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return parsed.map((item: any) => item.url).filter(Boolean)
      }
    }
    catch (e) {
      console.warn('Failed to parse URLs from AI response:', e)
    }

    // Fallback: extract URLs from text
    const urlRegex = /https?:\/\/[^\s]+/g
    return [...new Set(response.match(urlRegex) || [])]
  }

  private parseRankedUrls(response: string): Array<{ url: string, rank: number }> {
    try {
      const jsonMatch = response.match(/\[[\s\S]*?\]/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return parsed.sort((a: any, b: any) => (b.rank || 0) - (a.rank || 0))
      }
    }
    catch (e) {
      console.warn('Failed to parse ranked URLs:', e)
    }
    return []
  }

  private parseCodeAssessment(response: string): any {
    try {
      const jsonMatch = response.match(/\{[\s\S]*?\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }
    }
    catch (e) {
      console.warn('Failed to parse code assessment:', e)
    }
    return { hasExecutableCode: false, executableExamples: [] }
  }

  private createCodeEnhancedSnippet(content: FetchedContent, assessment: any): string {
    const executableCount = assessment.executableExamples?.filter((ex: any) => ex.isExecutable).length || 0

    let snippet = content.content.metadata.title || 'API Documentation'

    if (executableCount > 0) {
      snippet += `\n\n✅ ${executableCount} executable code example${executableCount > 1 ? 's' : ''} found`
    }

    if (content.content.codeBlocks.length > 0) {
      const languages = [...new Set(content.content.codeBlocks.map(b => b.language).filter(Boolean))]
      if (languages.length > 0) {
        snippet += `\nLanguages: ${languages.join(', ')}`
      }
    }

    // Add a truncated version of the content
    const contentSnippet = content.content.markdown.slice(0, 300)
    snippet += `\n\n${contentSnippet}${content.content.markdown.length > 300 ? '...' : ''}`

    return snippet
  }

  private calculateCodeRelevance(content: FetchedContent, assessment: any, query: WebSearchQuery): number {
    let score = 0.5 // Base score

    // Boost for executable code
    const executableCount = assessment.executableExamples?.filter((ex: any) => ex.isExecutable).length || 0
    score += executableCount * 0.3

    // Boost for multiple code examples
    score += Math.min(content.content.codeBlocks.length * 0.1, 0.3)

    // Boost for API-related content
    const contentLower = content.content.markdown.toLowerCase()
    const queryWords = query.query.toLowerCase().split(' ')
    queryWords.forEach((word) => {
      if (contentLower.includes(word)) score += 0.1
    })

    // Boost for documentation sites
    if (content.content.metadata.isDocs) score += 0.2

    return Math.min(score, 1.0)
  }

  private hasExecutableCodeForUrl(url: string, assessment: any): boolean {
    return assessment.executableExamples?.some((ex: any) => ex.isExecutable) || false
  }
}
