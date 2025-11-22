/**
 * Global content parser utility using unified.js ecosystem
 * Handles markdown, HTML, and LLM-optimized content formats
 * Located in main process to support AI providers
 */

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkStringify from 'remark-stringify'
import rehypeParse from 'rehype-parse'
import rehypeRemark from 'rehype-remark'
import { visit } from 'unist-util-visit'
import type { Node } from 'unist'

export interface ParsedContent {
  markdown: string
  codeBlocks: CodeBlock[]
  headings: Heading[]
  links: Link[]
  metadata: ContentMetadata
}

export interface CodeBlock {
  language?: string
  code: string
  filename?: string
  isExample?: boolean
}

export interface Heading {
  level: number
  text: string
  id?: string
}

export interface Link {
  url: string
  text: string
  isInternal?: boolean
}

export interface ContentMetadata {
  title?: string
  description?: string
  wordCount: number
  hasApiExamples: boolean
  isDocs: boolean
  isMarkdown: boolean
}

export class ContentParser {
  private markdownProcessor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkStringify)

  private htmlToMarkdownProcessor = unified()
    .use(rehypeParse as any, { fragment: true })
    .use(rehypeRemark as any)
    .use(remarkGfm)
    .use(remarkStringify as any)

  /**
   * Parse content from various formats into a unified structure
   */
  async parseContent(content: string, format: 'markdown' | 'html' | 'llms-txt' = 'markdown'): Promise<ParsedContent> {
    let ast: Node
    let markdown: string

    try {
      switch (format) {
        case 'markdown':
        case 'llms-txt':
          ast = this.markdownProcessor.parse(content)
          markdown = content
          break
        case 'html':
          const result = await this.htmlToMarkdownProcessor.process(content)
          ast = this.markdownProcessor.parse(String(result))
          markdown = String(result)
          break
        default:
          throw new Error(`Unsupported format: ${format}`)
      }

      // Extract structured data from AST
      const codeBlocks = this.extractCodeBlocks(ast)
      const headings = this.extractHeadings(ast)
      const links = this.extractLinks(ast)
      const metadata = this.generateMetadata(content, ast, format)

      return {
        markdown,
        codeBlocks,
        headings,
        links,
        metadata,
      }
    }
    catch (error) {
      console.error('Content parsing error:', error)
      // Return minimal structure on parse failure
      return {
        markdown: content,
        codeBlocks: [],
        headings: [],
        links: [],
        metadata: {
          wordCount: content.split(/\s+/).length,
          hasApiExamples: false,
          isDocs: false,
          isMarkdown: format === 'markdown' || format === 'llms-txt',
        },
      }
    }
  }

  /**
   * Extract relevant sections based on query context
   */
  extractRelevantSections(parsedContent: ParsedContent, query: string): ParsedContent {
    const queryWords = query.toLowerCase().split(' ').filter(word => word.length > 2)
    const relevantSections: string[] = []
    const relevantCodeBlocks: CodeBlock[] = []
    const relevantHeadings: Heading[] = []

    // Filter code blocks by relevance
    parsedContent.codeBlocks.forEach((block) => {
      if (this.isRelevantCodeBlock(block, queryWords)) {
        relevantCodeBlocks.push(block)
      }
    })

    // Filter headings and get their sections
    parsedContent.headings.forEach((heading) => {
      if (this.isRelevantHeading(heading, queryWords)) {
        relevantHeadings.push(heading)
        // Extract section content around this heading
        const section = this.extractSectionContent(parsedContent.markdown, heading)
        if (section.trim()) relevantSections.push(section)
      }
    })

    // If no specific sections found, return top sections
    if (relevantSections.length === 0 && parsedContent.headings.length > 0) {
      const topSections = parsedContent.headings.slice(0, 3)
      topSections.forEach((heading) => {
        const section = this.extractSectionContent(parsedContent.markdown, heading)
        if (section.trim()) relevantSections.push(section)
      })
    }

    // Build filtered markdown
    const filteredMarkdown = this.buildFilteredMarkdown(relevantSections, relevantCodeBlocks)

    return {
      ...parsedContent,
      markdown: filteredMarkdown || parsedContent.markdown.slice(0, 2000), // Fallback to truncated original
      codeBlocks: relevantCodeBlocks,
      headings: relevantHeadings,
      metadata: {
        ...parsedContent.metadata,
        wordCount: (filteredMarkdown || '').split(' ').length,
      },
    }
  }

  private extractCodeBlocks(ast: Node): CodeBlock[] {
    const codeBlocks: CodeBlock[] = []

    visit(ast, 'code', (node: any) => {
      const language = node.lang || undefined
      const code = node.value || ''
      const isExample = this.isExampleCode(code, language)

      codeBlocks.push({
        language,
        code,
        isExample,
      })
    })

    return codeBlocks
  }

  private extractHeadings(ast: Node): Heading[] {
    const headings: Heading[] = []

    visit(ast, 'heading', (node: any) => {
      const text = this.extractTextFromNode(node)
      const level = node.depth || 1

      headings.push({
        level,
        text,
        id: this.generateHeadingId(text),
      })
    })

    return headings
  }

  private extractLinks(ast: Node): Link[] {
    const links: Link[] = []

    visit(ast, 'link', (node: any) => {
      const url = node.url || ''
      const text = this.extractTextFromNode(node)
      const isInternal = this.isInternalLink(url)

      links.push({
        url,
        text,
        isInternal,
      })
    })

    return links
  }

  private generateMetadata(content: string, ast: Node, format: string): ContentMetadata {
    const wordCount = content.split(/\s+/).length
    const hasApiExamples = this.hasApiExamples(content)
    const isDocs = this.isDocsContent(content)
    const isMarkdown = format === 'markdown' || format === 'llms-txt'

    // Extract title from first heading or content
    let title: string | undefined
    visit(ast, 'heading', (node: any) => {
      if (!title && node.depth === 1) {
        title = this.extractTextFromNode(node)
        return false // Stop visiting
      }
      return true // Continue visiting
    })

    return {
      title,
      wordCount,
      hasApiExamples,
      isDocs,
      isMarkdown,
    }
  }

  private isRelevantCodeBlock(block: CodeBlock, queryWords: string[]): boolean {
    const codeContent = block.code.toLowerCase()

    // Check if code contains query terms
    const hasQueryTerms = queryWords.some(word => codeContent.includes(word))

    // Boost relevance for API examples
    const isApiExample = (block.isExample || false) && (
      codeContent.includes('api')
      || codeContent.includes('fetch')
      || codeContent.includes('request')
      || codeContent.includes('curl')
    )

    return hasQueryTerms || isApiExample
  }

  private isRelevantHeading(heading: Heading, queryWords: string[]): boolean {
    const headingText = heading.text.toLowerCase()
    return queryWords.some(word => headingText.includes(word))
  }

  private extractSectionContent(markdown: string, heading: Heading): string {
    const lines = markdown.split('\n')
    const headingPattern = new RegExp(`^#{1,${heading.level}}\\s+.*${this.escapeRegex(heading.text)}`, 'i')

    let startIndex = -1
    let endIndex = lines.length

    // Find heading start
    for (let i = 0; i < lines.length; i++) {
      if (headingPattern.test(lines[i])) {
        startIndex = i
        break
      }
    }

    if (startIndex === -1) return ''

    // Find next heading of same or higher level
    for (let i = startIndex + 1; i < lines.length; i++) {
      const nextHeadingMatch = lines[i].match(/^(#{1,6})\s+/)
      if (nextHeadingMatch && nextHeadingMatch[1].length <= heading.level) {
        endIndex = i
        break
      }
    }

    return lines.slice(startIndex, endIndex).join('\n')
  }

  private buildFilteredMarkdown(sections: string[], codeBlocks: CodeBlock[]): string {
    const parts: string[] = []

    // Add relevant sections
    if (sections.length > 0) {
      parts.push(...sections)
    }

    // Add standalone code blocks that weren't in sections
    codeBlocks.forEach((block) => {
      if (block.isExample) {
        const codeMarkdown = `\`\`\`${block.language || ''}\n${block.code}\n\`\`\``
        if (!sections.some(section => section.includes(block.code))) {
          parts.push(`### Code Example\n${codeMarkdown}`)
        }
      }
    })

    return parts.join('\n\n')
  }

  private isExampleCode(code: string, language?: string): boolean {
    // Check for common API example patterns
    const apiPatterns = [
      /curl\s+-X/i,
      /fetch\(/i,
      /axios\./i,
      /api\./i,
      /\.post\(|\.get\(|\.put\(|\.delete\(/i,
      /headers\s*:/i,
      /authorization/i,
      /stripe\./i,
      /import.*stripe/i,
    ]

    return apiPatterns.some(pattern => pattern.test(code))
  }

  private hasApiExamples(content: string): boolean {
    return /```[\s\S]*?(curl|fetch|axios|api|stripe)[\s\S]*?```/i.test(content)
  }

  private isDocsContent(content: string): boolean {
    const docsKeywords = ['api', 'documentation', 'guide', 'reference', 'tutorial', 'examples', 'stripe', 'developer']
    const contentLower = content.toLowerCase()
    return docsKeywords.some(keyword => contentLower.includes(keyword))
  }

  private isInternalLink(url: string): boolean {
    return url.startsWith('/') || url.startsWith('#') || url.startsWith('../')
  }

  private extractTextFromNode(node: any): string {
    if (node.type === 'text') {
      return node.value || ''
    }

    if (node.children && Array.isArray(node.children)) {
      return node.children.map((child: any) => this.extractTextFromNode(child)).join('')
    }

    return ''
  }

  private generateHeadingId(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
  }

  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}

// Export singleton instance for global use
export const contentParser = new ContentParser()
