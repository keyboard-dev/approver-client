import { generatePlanningToken, toolsToAbilities } from './ability-tools'
import type { MCPAbilityFunction } from './mcp-tool-integration'

export interface CodespaceInfo {
  success: boolean
  data?: {
    keyName?: string
    resources?: unknown[]
    services?: string[]
    environment?: Record<string, string>
  }
  status?: number
  error?: {
    message: string
  }
}

export interface UserTokensResponse {
  tokensAvailable?: string[]
  error?: string
}

export interface EnhancedContext {
  planningToken: string
  userTokens: string[]
  codespaceInfo: CodespaceInfo | null
  timestamp: number
}

export class ContextService {
  private cachedContext: EnhancedContext | null = null
  private contextExpiry: number = 5 * 60 * 1000 // 5 minutes
  private mcpFunctions: MCPAbilityFunction[] = []

  /**
   * Set MCP functions for the context service
   */
  setMCPFunctions(functions: MCPAbilityFunction[]): void {
    this.mcpFunctions = functions
  }

  /**
   * Get MCP tools filtered out from toolsToAbilities
   */
  private getFilteredMCPTools(): MCPAbilityFunction[] {
    const keyboardAbilityNames = new Set<string>()
    console.log('mcpFunctions', this.mcpFunctions)
    // Extract all ability names from toolsToAbilities
    Object.values(toolsToAbilities.categories).forEach((abilities) => {
      abilities.forEach((ability) => {
        keyboardAbilityNames.add(ability.command)
      })
    })

    // Filter out tools that are in toolsToAbilities
    return this.mcpFunctions.filter(func =>
      keyboardAbilityNames.has(func.function.name),
    )
  }

  /**
   * Get comprehensive context for AI system prompt
   */
  async getEnhancedContext(): Promise<EnhancedContext> {
    // Check if we have valid cached context
    if (this.cachedContext && (Date.now() - this.cachedContext.timestamp) < this.contextExpiry) {
      console.log('🔄 Using cached context')
      return this.cachedContext
    }

    console.log('🔍 Fetching fresh context...')

    // Generate new planning token
    const planningToken = generatePlanningToken()

    // Fetch user tokens in parallel
    const [userTokens, codespaceInfo] = await Promise.allSettled([
      this.fetchUserTokens(),
      this.fetchCodespaceInfo(),
    ])

    const context: EnhancedContext = {
      planningToken,
      userTokens: userTokens.status === 'fulfilled' ? userTokens.value : [],
      codespaceInfo: codespaceInfo.status === 'fulfilled' ? codespaceInfo.value : null,
      timestamp: Date.now(),
    }

    // Cache the context
    this.cachedContext = context
    console.log('✅ Context cached:', {
      planningToken: context.planningToken,
      userTokensCount: context.userTokens.length,
      hasCodespaceInfo: !!context.codespaceInfo?.success,
    })

    return context
  }

  /**
   * Build enhanced system prompt with all context
   */
  async buildEnhancedSystemPrompt(userMessage: string): Promise<string> {
    const context = await this.getEnhancedContext()
    const userTokensList = context.userTokens.length > 0
      ? context.userTokens.map(token => `- ${token}`).join('\n')
      : '- No user tokens currently available'

    const codespaceDetails = context.codespaceInfo?.success
      ? JSON.stringify(context.codespaceInfo.data, null, 2)
      : 'No codespace information available'

    const abilitiesList = JSON.stringify(toolsToAbilities, null, 2)

    // Get filtered MCP tools (excluding keyboard abilities)
    const filteredMCPTools = this.getFilteredMCPTools()
    const additionalToolsList = filteredMCPTools.length > 0
      ? filteredMCPTools.map(func => ({
          name: func.function.name,
          description: func.function.description,
          parameters: func.function.parameters,
        }))
      : []

    const additionalToolsSection = additionalToolsList.length > 0
      ? `

ADDITIONAL MCP TOOLS AVAILABLE:
${JSON.stringify(additionalToolsList, null, 2)}

Note: These are additional MCP tools beyond the core keyboard abilities. You can call these using the same JSON format.`
      : ''

    return `You are a helpful AI assistant with access to a secure code execution environment.  Any code you will try to execute will also be reviewed by a human before execution so you can execute and write code with confidence.

This is a real planning token to pass the run-code ability.  Make sure to use it when calling the run-code ability.
PLANNING TOKEN: ${context.planningToken}

Here are actual user token environment variables that you can leverage in your code.  Just avoid console.loging their full values.

AVAILABLE USER TOKENS:
${userTokensList}

Here is information about the actual code execution environment.  This is where you will execute your code.  Additionally there will be a list of other environment variables that you can leverage in your code. 

CODESPACE INFORMATION:
${codespaceDetails}

API RESEARCH GUIDANCE:
- Use the web-search ability to find official documentation and examples
- Always research API documentation when working with external services
- Use web-search ability to find official documentation and examples
- Look for code examples, best practices, and common patterns
- Check for rate limits, authentication requirements, and error handling
- Only after you tried to use the web-search ability, and it didn't work, then you can use the run-code ability to execute code but the idea is to use the web-search ability first.

Full abilities description and schema:
${abilitiesList}${additionalToolsSection}

INSTRUCTIONS:
- You can execute abilities directly using JSON format: {"ability": "ability-name", "parameters": {...}}
- Planning token is automatically provided above - DO NOT use the 'plan' ability, go directly to 'run-code'
- Use the planning token provided above when calling run-code abilities
- Research APIs and documentation before implementing solutions
- Be proactive in suggesting relevant abilities for the user's task
- Always provide clear explanations of what you're doing and why

USER REQUEST: ${userMessage}`
  }

  /**
   * Fetch available user tokens from current session
   */
  private async fetchUserTokens(): Promise<string[]> {
    try {
      console.log('🔑 Fetching user tokens...')

      // Try to get tokens from the current WebSocket session via electron API
      const tokensResponse = await window.electronAPI?.getUserTokens?.() as UserTokensResponse | undefined

      if (tokensResponse?.tokensAvailable) {
        console.log('✅ User tokens fetched:', tokensResponse.tokensAvailable.length)
        return tokensResponse.tokensAvailable
      }

      console.log('⚠️ No user tokens available')
      return []
    }
    catch (error) {
      console.error('❌ Failed to fetch user tokens:', error)
      return []
    }
  }

  /**
   * Fetch codespace information using GitHub PAT token
   */
  private async fetchCodespaceInfo(): Promise<CodespaceInfo | null> {
    try {
      console.log('🏗️ Fetching codespace info...')

      // Get codespace info via electron API
      const codespaceInfo = await window.electronAPI?.getCodespaceInfo?.() as CodespaceInfo | undefined
      console.log('codespaceInfo from fetchCodespaceInfo', codespaceInfo)

      if (codespaceInfo) {
        console.log('✅ Codespace info fetched successfully')
        return codespaceInfo
      }

      console.log('⚠️ No codespace information available')
      return null
    }
    catch (error) {
      console.error('❌ Failed to fetch codespace info:', error)
      return null
    }
  }

  /**
   * Clear cached context (useful for forcing refresh)
   */
  clearCache(): void {
    this.cachedContext = null
    console.log('🗑️ Context cache cleared')
  }

  /**
   * Check if context is stale and needs refresh
   */
  isContextStale(): boolean {
    return !this.cachedContext || (Date.now() - this.cachedContext.timestamp) >= this.contextExpiry
  }
}

// Export singleton instance
export const contextService = new ContextService()
