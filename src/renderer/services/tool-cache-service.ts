import type { Tool } from '@modelcontextprotocol/sdk/types.js'

/**
 * Tool Cache Service - Persistent storage for MCP tool definitions
 * Enables tool execution even when MCP connection is unavailable
 */

export interface CachedToolDefinition {
  tool: Tool
  lastUpdated: number
  serverUrl: string
}

export interface ToolCacheOptions {
  maxAge?: number // Max cache age in milliseconds (default: 24 hours)
  storageKey?: string // localStorage key for cache
}

export class ToolCacheService {
  private cache = new Map<string, CachedToolDefinition>()
  private readonly maxAge: number
  private readonly storageKey: string

  constructor(options: ToolCacheOptions = {}) {
    this.maxAge = options.maxAge || 24 * 60 * 60 * 1000 // 24 hours
    this.storageKey = options.storageKey || 'mcp-tool-cache'
    this.loadFromStorage()
  }

  /**
   * Cache tool definitions from successful MCP discovery
   */
  cacheTools(tools: Tool[], serverUrl: string): void {
    const now = Date.now()

    for (const tool of tools) {
      const cached: CachedToolDefinition = {
        tool,
        lastUpdated: now,
        serverUrl,
      }

      this.cache.set(tool.name, cached)
    }

    this.saveToStorage()
  }

  /**
   * Get cached tool definition by name
   */
  getTool(name: string): Tool | null {
    const cached = this.cache.get(name)

    if (!cached) {
      return null
    }

    // Check if cache entry is expired
    if (Date.now() - cached.lastUpdated > this.maxAge) {
      this.cache.delete(name)
      this.saveToStorage()
      return null
    }

    return cached.tool
  }

  /**
   * Get all cached tools (non-expired)
   */
  getAllTools(): Tool[] {
    const now = Date.now()
    const validTools: Tool[] = []

    for (const [name, cached] of this.cache.entries()) {
      if (now - cached.lastUpdated <= this.maxAge) {
        validTools.push(cached.tool)
      }
      else {
        // Remove expired entries
        this.cache.delete(name)
      }
    }

    if (this.cache.size !== validTools.length) {
      this.saveToStorage()
    }

    return validTools
  }

  /**
   * Check if tool exists in cache (and is not expired)
   */
  hasValidTool(name: string): boolean {
    return this.getTool(name) !== null
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalTools: number
    oldestEntry: number | null
    newestEntry: number | null
    cacheHitRatio?: number
  } {
    const tools = Array.from(this.cache.values())

    if (tools.length === 0) {
      return {
        totalTools: 0,
        oldestEntry: null,
        newestEntry: null,
      }
    }

    const timestamps = tools.map(t => t.lastUpdated)

    return {
      totalTools: tools.length,
      oldestEntry: Math.min(...timestamps),
      newestEntry: Math.max(...timestamps),
    }
  }

  /**
   * Clear all cached tools
   */
  clearCache(): void {
    this.cache.clear()
    this.saveToStorage()
  }

  /**
   * Remove expired entries manually
   */
  cleanupExpired(): number {
    const now = Date.now()
    let removedCount = 0

    for (const [name, cached] of this.cache.entries()) {
      if (now - cached.lastUpdated > this.maxAge) {
        this.cache.delete(name)
        removedCount++
      }
    }

    if (removedCount > 0) {
      this.saveToStorage()
    }

    return removedCount
  }

  /**
   * Load cached tools from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (!stored) return

      const data = JSON.parse(stored)
      if (!Array.isArray(data)) return

      for (const item of data) {
        if (item.tool && item.tool.name && item.lastUpdated && item.serverUrl) {
          this.cache.set(item.tool.name, item)
        }
      }
    }
    catch (error) {
      console.warn('Failed to load tool cache from storage:', error)
    }
  }

  /**
   * Save cached tools to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = Array.from(this.cache.values())
      localStorage.setItem(this.storageKey, JSON.stringify(data))
    }
    catch (error) {
      console.warn('Failed to save tool cache to storage:', error)
    }
  }
}

// Global instance
export const toolCacheService = new ToolCacheService()
