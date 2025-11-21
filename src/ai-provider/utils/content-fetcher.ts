/**
 * Smart content fetcher service for LLM-optimized documentation
 * Detects and fetches content in the best available format
 * Prioritizes /llms.txt, markdown, and developer documentation
 */

import { contentParser, type ParsedContent } from './content-parser'

export interface ContentFormat {
  type: 'llms-txt' | 'markdown' | 'html' | 'json'
  url: string
  priority: number
}

export interface FetchedContent {
  originalUrl: string
  finalUrl: string
  format: ContentFormat['type']
  content: ParsedContent
  fetchTime: number
}

export interface ContentFetchOptions {
  maxContentLength?: number
  timeout?: number
  prioritizeMarkdown?: boolean
  prioritizeDocs?: boolean
  includeDomains?: string[]
  excludeDomains?: string[]
}

export class ContentFetcher {
  private readonly defaultTimeout = 10000 // 10 seconds
  private readonly maxContentLength = 100000 // 100KB default
  
  /**
   * Fetch content using smart format detection
   */
  async fetchOptimizedContent(
    url: string, 
    query?: string, 
    options: ContentFetchOptions = {}
  ): Promise<FetchedContent> {
    const startTime = Date.now()
    
    try {
      // Detect available content formats
      const formats = await this.detectContentFormats(url, options)
      
      // Try formats in priority order
      for (const format of formats) {
        try {
          const content = await this.fetchContentInFormat(format, query, options)
          return {
            originalUrl: url,
            finalUrl: format.url,
            format: format.type,
            content,
            fetchTime: Date.now() - startTime
          }
        } catch (error) {
          console.warn(`Failed to fetch ${format.type} from ${format.url}:`, error)
          continue
        }
      }
      
      throw new Error('All content format attempts failed')
      
    } catch (error) {
      console.error('Content fetching failed:', error)
      throw error
    }
  }

  /**
   * Detect available content formats for a URL
   */
  private async detectContentFormats(url: string, options: ContentFetchOptions): Promise<ContentFormat[]> {
    const formats: ContentFormat[] = []
    const baseUrl = this.getBaseUrl(url)
    
    // 1. Try LLMs.txt (highest priority)
    formats.push({
      type: 'llms-txt',
      url: `${baseUrl}/llms.txt`,
      priority: 10
    })
    
    // 2. Try docs.json or API index
    formats.push({
      type: 'json',
      url: `${baseUrl}/docs.json`,
      priority: 9
    })
    
    // 3. Direct markdown detection
    if (url.includes('.md') || url.includes('README')) {
      formats.push({
        type: 'markdown',
        url,
        priority: 8
      })
    }
    
    // 4. GitHub raw markdown URLs
    if (url.includes('github.com') && !url.includes('raw.githubusercontent.com')) {
      const rawUrl = this.convertToGitHubRaw(url)
      if (rawUrl) {
        formats.push({
          type: 'markdown',
          url: rawUrl,
          priority: 7
        })
      }
    }
    
    // 5. Documentation-specific formats
    if (this.isDocsUrl(url)) {
      formats.push({
        type: 'html',
        url,
        priority: 6
      })
    }
    
    // 6. Fallback to original URL as HTML
    formats.push({
      type: 'html',
      url,
      priority: 1
    })
    
    // Sort by priority (highest first)
    return formats.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Fetch content in specific format
   */
  private async fetchContentInFormat(
    format: ContentFormat, 
    query?: string, 
    options: ContentFetchOptions = {}
  ): Promise<ParsedContent> {
    const timeout = options.timeout || this.defaultTimeout
    const maxLength = options.maxContentLength || this.maxContentLength
    
    // Fetch raw content
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    
    try {
      const response = await fetch(format.url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LLM-ContentFetcher/1.0)',
          'Accept': this.getAcceptHeader(format.type)
        }
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      let rawContent = await response.text()
      
      // Truncate if too long
      if (rawContent.length > maxLength) {
        rawContent = rawContent.substring(0, maxLength) + '\n\n[Content truncated...]'
      }
      
      // Process JSON format
      if (format.type === 'json') {
        rawContent = this.processJsonDocs(rawContent, query)
      }
      
      // Parse content
      const parsedContent = await contentParser.parseContent(rawContent, format.type === 'json' ? 'markdown' : format.type)
      
      // Extract relevant sections if query provided
      if (query && query.trim()) {
        return contentParser.extractRelevantSections(parsedContent, query)
      }
      
      return parsedContent
      
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Process JSON documentation format
   */
  private processJsonDocs(jsonContent: string, query?: string): string {
    try {
      const docs = JSON.parse(jsonContent)
      
      // Handle different JSON doc formats
      if (docs.content) {
        return docs.content
      }
      
      if (docs.sections && Array.isArray(docs.sections)) {
        return docs.sections.map((section: any) => {
          const title = section.title ? `# ${section.title}\n\n` : ''
          const content = section.content || section.description || ''
          return `${title}${content}`
        }).join('\n\n')
      }
      
      if (docs.pages && Array.isArray(docs.pages)) {
        return docs.pages.map((page: any) => {
          const title = page.title ? `# ${page.title}\n\n` : ''
          const content = page.content || page.markdown || ''
          return `${title}${content}`
        }).join('\n\n')
      }
      
      // Fallback: return pretty-printed JSON
      return `# API Documentation\n\n\`\`\`json\n${JSON.stringify(docs, null, 2)}\n\`\`\``
      
    } catch (error) {
      console.warn('Failed to parse JSON docs:', error)
      return jsonContent
    }
  }

  /**
   * Get base URL for a given URL
   */
  private getBaseUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      return `${urlObj.protocol}//${urlObj.host}`
    } catch {
      return url.split('/').slice(0, 3).join('/')
    }
  }

  /**
   * Convert GitHub URL to raw content URL
   */
  private convertToGitHubRaw(url: string): string | null {
    try {
      // Convert github.com URLs to raw.githubusercontent.com
      if (url.includes('github.com') && (url.includes('.md') || url.includes('README'))) {
        return url
          .replace('github.com', 'raw.githubusercontent.com')
          .replace('/blob/', '/')
      }
      return null
    } catch {
      return null
    }
  }

  /**
   * Check if URL is likely documentation
   */
  private isDocsUrl(url: string): boolean {
    const docsPatterns = [
      /docs\./i,
      /developer\./i,
      /api\./i,
      /\/docs\//i,
      /\/documentation\//i,
      /\/guide\//i,
      /\/reference\//i,
      /stripe\.com\/docs/i,
      /docs\..*\.com/i
    ]
    
    return docsPatterns.some(pattern => pattern.test(url))
  }

  /**
   * Get appropriate Accept header for content type
   */
  private getAcceptHeader(type: ContentFormat['type']): string {
    switch (type) {
      case 'markdown':
        return 'text/markdown, text/plain, */*'
      case 'json':
        return 'application/json, */*'
      case 'llms-txt':
        return 'text/plain, */*'
      case 'html':
      default:
        return 'text/html, application/xhtml+xml, text/plain, */*'
    }
  }
}

// Export singleton instance
export const contentFetcher = new ContentFetcher()