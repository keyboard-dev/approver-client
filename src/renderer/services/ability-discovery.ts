import type { Tool } from '@modelcontextprotocol/sdk/types.js'
import { AbilityFilesystem } from './ability-filesystem'

import { toolsToAbilities } from './ability-tools'

export interface AbilityMatch {
  ability: Tool
  relevanceScore: number
  matchedKeywords: string[]
}

export interface AbilitySearchResult {
  matches: AbilityMatch[]
  totalAvailable: number
  searchQuery: string
}

/**
 * Progressive ability discovery service
 * Implements efficient ability search and relevance scoring
 */

const webSearchAbility: Tool = {
  name: 'web-search',
  description: 'use this ability to search the web for developer documentation, API references, and technical information. Automatically fetches full content from docs sites, processes markdown files, and extracts relevant code examples. Perfect for finding API documentation, tutorials, and technical resources. Example: {"ability": "web-search", "parameters": {"query": "stripe payment intents api", "company": "mycompany"}}',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query for web content' },
      company: { type: 'string', description: 'Company context for the search' },
      provider: { type: 'string', description: 'AI provider to use (optional)' },
      maxResults: { type: 'number', description: 'Maximum number of results' },
      prioritizeMarkdown: { type: 'boolean', description: 'Prioritize markdown files' },
      prioritizeDocs: { type: 'boolean', description: 'Prioritize documentation sites' },
    },
    required: ['query', 'company'],
  },
}

export class AbilityDiscoveryService {
  private abilities: Tool[] = []
  private abilityKeywords: Map<string, string[]> = new Map()
  private filesystem: AbilityFilesystem

  constructor(abilities: Tool[] = []) {
    this.filesystem = new AbilityFilesystem(abilities)
    this.updateAbilities(abilities)
  }

  /**
   * Update available abilities and rebuild keyword index
   */
  updateAbilities(abilities: Tool[]): void {
    this.abilities = abilities
    this.abilities.push(webSearchAbility)
    this.filesystem.organizeAbilities(abilities)
    this.rebuildKeywordIndex()
  }

  /**
   * Search for relevant abilities based on query
   */
  searchAbilities(query: string, maxResults: number = 5): AbilitySearchResult {
    if (!query.trim()) {
      return {
        matches: [],
        totalAvailable: this.abilities.length,
        searchQuery: query,
      }
    }

    const queryKeywords = this.extractKeywords(query.toLowerCase())
    const matches: AbilityMatch[] = []

    for (const ability of this.abilities) {
      const score = this.calculateRelevanceScore(ability, queryKeywords)
      if (score > 0) {
        const matchedKeywords = this.getMatchedKeywords(ability, queryKeywords)
        matches.push({
          ability,
          relevanceScore: score,
          matchedKeywords,
        })
      }
    }

    // Sort by relevance score (highest first)
    matches.sort((a, b) => b.relevanceScore - a.relevanceScore)

    return {
      matches: matches.slice(0, maxResults),
      totalAvailable: this.abilities.length,
      searchQuery: query,
    }
  }

  /**
   * Get ability by exact name
   */
  getAbilityByName(name: string): Tool | undefined {
    return this.abilities.find(ability => ability.name === name)
  }

  /**
   * Get abilities by category/prefix
   */
  getAbilitiesByCategory(category: string): Tool[] {
    return this.filesystem.getAbilitiesByCategory(category)
  }

  /**
   * Get filesystem-style directory listing
   */
  getDirectoryListing(path: string = '/'): string {
    return this.filesystem.getDirectoryListing(path)
  }

  /**
   * Get available categories
   */
  getCategories(): Array<{ name: string, description: string, abilityCount: number }> {
    return this.filesystem.getCategories()
  }

  /**
   * Get minimal ability definitions for efficient context
   */
  getMinimalAbilityDefinitions(abilityNames: string[]): Array<{ name: string, description: string }> {
    return abilityNames
      .map(name => this.getAbilityByName(name))
      .filter((ability): ability is Tool => ability !== undefined)
      .map(ability => ({
        name: ability.name,
        description: ability.description || `Execute ${ability.name} ability`,
      }))
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !this.isStopWord(word))
  }

  /**
   * Calculate relevance score for an ability given query keywords
   */
  private calculateRelevanceScore(ability: Tool, queryKeywords: string[]): number {
    const abilityKeywords = this.abilityKeywords.get(ability.name) || []
    let score = 0

    // Exact name match gets highest score
    if (queryKeywords.includes(ability.name.toLowerCase())) {
      score += 100
    }

    // Partial name matches
    for (const keyword of queryKeywords) {
      if (ability.name.toLowerCase().includes(keyword)) {
        score += 50
      }
    }

    // Description keyword matches
    for (const keyword of queryKeywords) {
      const matches = abilityKeywords.filter(abilityKeyword =>
        abilityKeyword.includes(keyword) || keyword.includes(abilityKeyword),
      ).length
      score += matches * 10
    }

    // Category/prefix bonus
    for (const keyword of queryKeywords) {
      if (ability.name.toLowerCase().startsWith(keyword)) {
        score += 25
      }
    }

    return score
  }

  /**
   * Get matched keywords for an ability
   */
  private getMatchedKeywords(ability: Tool, queryKeywords: string[]): string[] {
    const abilityKeywords = this.abilityKeywords.get(ability.name) || []
    const matched: string[] = []

    // Check exact name match
    if (queryKeywords.includes(ability.name.toLowerCase())) {
      matched.push(ability.name.toLowerCase())
    }

    // Check keyword matches
    for (const keyword of queryKeywords) {
      const abilityMatches = abilityKeywords.filter(abilityKeyword =>
        abilityKeyword.includes(keyword) || keyword.includes(abilityKeyword),
      )
      matched.push(...abilityMatches.slice(0, 3)) // Limit to avoid noise
    }

    return [...new Set(matched)] // Remove duplicates
  }

  /**
   * Rebuild keyword index for all abilities
   */
  private rebuildKeywordIndex(): void {
    this.abilityKeywords.clear()

    for (const ability of this.abilities) {
      const keywords: string[] = []

      // Add name keywords
      keywords.push(...this.extractKeywords(ability.name))

      // Add description keywords
      if (ability.description) {
        keywords.push(...this.extractKeywords(ability.description))
      }

      // Add schema keywords if available
      if (ability.inputSchema?.properties) {
        for (const [prop, schema] of Object.entries(ability.inputSchema.properties)) {
          keywords.push(prop.toLowerCase())
          if (typeof schema === 'object' && schema.description) {
            keywords.push(...this.extractKeywords(schema.description))
          }
        }
      }

      this.abilityKeywords.set(ability.name, [...new Set(keywords)])
    }
  }

  /**
   * Check if word is a stop word (common words to ignore)
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have',
      'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
    ])
    return stopWords.has(word)
  }
}

/**
 * Create context-efficient ability discovery prompt
 */
export function createAbilityDiscoveryPrompt(
  userQuery: string,
  searchResult: AbilitySearchResult,
  filesystem?: AbilityFilesystem,
): string {
  if (searchResult.matches.length === 0) {
    const prompt = `Based on your request "${userQuery}", I couldn't find any directly relevant abilities.`
  }

  return `Based on the user query "${userQuery}", I have some abilities that might be relevant to the task:
  
  ${toolsToAbilities.categories['abilities around running tasks'].map(ability => `- ${ability.command}: ${ability.description}`).join('\n')}

  Do you want to use one of these abilities to help you complete the task? If so mention the ability name and I will help you call it.
  `

  // const filesystem = new AbilityFilesystem(searchResult.abilities)
  // if (filesystem) {
  //   const categories = filesystem.getCategories()
  //   const topCategories = categories
  //     .sort((a, b) => b.abilityCount - a.abilityCount)
  //     .slice(0, 5)
  //     .map(cat => `${cat.name} (${cat.abilityCount} abilities)`)
  //     .join(', ')

  //   prompt += ` I have ${searchResult.totalAvailable} total abilities organized in categories: ${topCategories}. Would you like me to search in a specific category or with different keywords?`
  // }
  // else {
  //   prompt += ` I have ${searchResult.totalAvailable} total abilities available. Would you like me to search with different keywords or proceed without abilities?`
  // }

  // return prompt
  //   }

  //   const abilityList = searchResult.matches
  //     .map(match => `- ${match.ability.name}: ${match.ability.description || 'No description'} (relevance: ${match.relevanceScore})`)
  //     .join('\n')

  //   return `Based on your request "${userQuery}", I found ${searchResult.matches.length} relevant abilities:

  // ${abilityList}

  // If you need to use any of these abilities, provide your ability call in this JSON format:

  // \`\`\`json
  // {
  //   "ability": "ability-name",
  //   "parameters": {
  //     "param1": "value1",
  //     "param2": "value2"
  //   }
  // }
  // \`\`\`

// I'll only load the full parameter details for abilities you actually want to use, keeping our conversation efficient.`
}
