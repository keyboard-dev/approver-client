import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import { useMcpClient } from '../hooks/useMcpClient'
import { AbilityDiscoveryService, type AbilitySearchResult } from './ability-discovery'
import { ResultProcessorService, type ProcessedResult, type ProcessingOptions } from './result-processor'
import { webSearchTool } from './web-search-tool'

/**
 * Universal MCP Ability Integration Service
 * Converts MCP abilities to function calling schemas compatible with all AI providers
 */

export interface MCPAbilityFunction {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, any>
      required?: string[]
    }
  }
}

export interface MCPIntegrationState {
  isEnabled: boolean
  isConnected: boolean
  abilities: Tool[]
  functions: MCPAbilityFunction[]
  error?: string
  abilityDiscovery: AbilityDiscoveryService
  resultProcessor: ResultProcessorService
}

/**
 * Convert MCP abilities to OpenAI-compatible function calling format
 * This format is widely supported across AI providers (OpenAI, Anthropic, Gemini)
 */
export function convertMCPAbilitiesToFunctions(mcpAbilities: Tool[]): MCPAbilityFunction[] {
  return mcpAbilities.map(ability => ({
    type: 'function',
    function: {
      name: ability.name,
      description: ability.description || `Execute ${ability.name} ability`,
      parameters: {
        type: 'object',
        properties: ability.inputSchema?.properties || {},
        required: ability.inputSchema?.required || [],
        ...ability.inputSchema,
      },
    },
  }))
}

/**
 * Convert function call arguments to MCP ability call format
 */
export function prepareMCPAbilityCall(functionName: string, args: Record<string, unknown>): {
  name: string
  args: Record<string, unknown>
} {
  return {
    name: functionName,
    args: args || {},
  }
}

/**
 * Format ability call results for AI provider consumption
 */
export function formatAbilityResult(abilityName: string, result: CallToolResult): string {
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
  }
  catch (error) {
    return `Error formatting result from ${abilityName}: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

/**
 * Execute web search using local enhanced implementation
 */
async function executeLocalWebSearch(
  args: Record<string, unknown>,
  processingOptions?: ProcessingOptions,
): Promise<ProcessedResult> {
  const startTime = performance.now()
  
  try {
    // Validate and prepare web search parameters
    const query = args.query as string
    if (!query || typeof query !== 'string') {
      throw new Error('Web search requires a valid query string')
    }

    const searchParams = {
      query,
      maxResults: (args.maxResults as number) || 5,
      prioritizeMarkdown: (args.prioritizeMarkdown as boolean) || false,
      prioritizeDocs: (args.prioritizeDocs as boolean) || true,
      includeDomains: (args.includeDomains as string[]) || undefined,
      excludeDomains: (args.excludeDomains as string[]) || undefined
    }

    console.log('🔍 Executing enhanced web search:', searchParams)

    // Execute web search using our enhanced tool
    const searchResult = await webSearchTool.execute(searchParams)
    
    // Format results for AI consumption
    const formattedContent = webSearchTool.formatResultsForAI(searchResult)
    
    const callTime = Math.round(performance.now() - startTime)
    console.log('✅ Enhanced web search completed in', callTime, 'ms')
    console.log('📊 Search results:', {
      totalResults: searchResult.totalResults,
      provider: searchResult.provider,
      searchTime: searchResult.searchTime
    })

    // Return in ProcessedResult format for MCP compatibility
    return {
      summary: formattedContent,
      tokenCount: Math.ceil(formattedContent.length / 4), // Rough token estimate
      wasFiltered: false,
      metadata: {
        searchQuery: searchResult.searchQuery,
        provider: searchResult.provider,
        totalResults: searchResult.totalResults,
        searchTime: searchResult.searchTime,
        enhancedSearch: true
      }
    }
    
  } catch (error) {
    const callTime = Math.round(performance.now() - startTime)
    console.error('❌ Enhanced web search failed:', error)
    
    // Return error in ProcessedResult format
    const errorMessage = `Enhanced web search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    return {
      summary: errorMessage,
      tokenCount: Math.ceil(errorMessage.length / 4),
      wasFiltered: false,
      metadata: {
        error: true,
        callTime
      }
    }
  }
}

/**
 * React hook for managing MCP ability integration state
 */
export function useMCPIntegration(serverUrl: string = 'https://mcp.keyboard.dev', clientName: string = 'keyboard-approver-mcp') {
  const mcpClient = useMcpClient({
    serverUrl,
    clientName,
    autoReconnect: true,
  })

  // Initialize discovery and processing services
  const abilityDiscovery = new AbilityDiscoveryService(mcpClient.tools)
  const resultProcessor = new ResultProcessorService()

  // Update discovery service when abilities change
  if (mcpClient.tools !== abilityDiscovery['abilities']) {
    abilityDiscovery.updateAbilities(mcpClient.tools)
  }

  const integrationState: MCPIntegrationState = {
    isEnabled: true, // Always enabled when using this hook
    isConnected: mcpClient.state === 'ready',
    abilities: mcpClient.tools,
    functions: convertMCPAbilitiesToFunctions(mcpClient.tools),
    error: mcpClient.error,
    abilityDiscovery,
    resultProcessor,
  }

  /**
   * Search for relevant abilities based on query (efficient discovery)
   */
  const searchAbilities = (query: string, maxResults: number = 5): AbilitySearchResult => {
    return abilityDiscovery.searchAbilities(query, maxResults)
  }

  /**
   * Get minimal ability definitions for context efficiency
   */
  const getMinimalAbilityDefinitions = (abilityNames: string[]) => {
    return abilityDiscovery.getMinimalAbilityDefinitions(abilityNames)
  }

  /**
   * Execute an MCP ability call with efficient result processing
   */
  const executeAbilityCall = async (
    functionName: string,
    args: Record<string, unknown>,
    processingOptions?: ProcessingOptions,
  ): Promise<ProcessedResult> => {
    console.log('🚀 keyboard.dev-ability Execution: Starting execution for', functionName)
    console.log('📊 MCP Client state:', mcpClient.state)
    console.log('🌐 Server URL:', serverUrl)

    try {
      // Intercept web-search calls and route to local implementation
      if (functionName === 'web-search') {
        console.log('🔍 Intercepting web-search call for enhanced local processing')
        return await executeLocalWebSearch(args, processingOptions)
      }

      if (mcpClient.state !== 'ready') {
        const error = `MCP client is not ready. Current state: ${mcpClient.state}`
        console.error('❌', error)
        throw new Error(error)
      }

      console.log('✅ MCP client is ready, proceeding with keyboard.dev-ability call')
      const { name, args: abilityArgs } = prepareMCPAbilityCall(functionName, args)
      console.log('📋 Prepared ability call - Name:', name, 'Args:', abilityArgs)

      console.log('🚀 Calling mcpClient.callTool...')
      const startTime = performance.now()
      const result = await mcpClient.callTool(name, abilityArgs)
      const callTime = Math.round(performance.now() - startTime)

      console.log('✅ keyboard.dev-ability call completed in', callTime, 'ms')
      console.log('📊 Raw MCP result:', result)

      // Process result efficiently
      const processedResult = resultProcessor.processResult(functionName, result, processingOptions)
      console.log('📄 Processed result summary (first 300 chars):', processedResult.summary.slice(0, 300))
      console.log('🔧 Processing stats:', {
        wasFiltered: processedResult.wasFiltered,
        tokenCount: processedResult.tokenCount,
        filterReason: processedResult.filterReason,
      })

      return processedResult
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error(`❌ Failed to execute keyboard.dev-ability ${functionName}:`, error)
      console.error('❌ Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: errorMessage,
        stack: error instanceof Error ? error.stack : 'No stack trace',
      })

      return {
        summary: `Error executing ${functionName}: ${errorMessage}`,
        tokenCount: errorMessage.length / 4,
        wasFiltered: false,
      }
    }
  }

  /**
   * Get system message with available keyboard.dev abilities for AI context
   */
  const getAbilitiesSystemMessage = (): string => {
    if (!integrationState.isConnected || integrationState.abilities.length === 0) {
      return ''
    }

    // const abilitiesInfo = integrationState.abilities
    //   .map(ability => `- ${ability.name}: ${ability.description || 'No description available'}`)
    //   .join('\n')

    const abilitiesInfo = integrationState.abilities
      .map(ability => `- ${ability.name}`).join('\n')

    return `You have access to the following keyboard.dev abilities. These are special capabilities that can help you accomplish tasks:

${abilitiesInfo}

When you need to use any keyboard.dev ability, first discover it by responding with **{{ability-name}}** (e.g., **list-all-codespaces-for-repo**). You will then receive the exact parameters and description needed to properly call that keyboard.dev ability.`
  }

  return {
    ...integrationState,
    mcpState: mcpClient.state,
    executeAbilityCall,
    getAbilitiesSystemMessage,
    searchAbilities,
    getMinimalAbilityDefinitions,
    retry: mcpClient.retry,
  }
}

/**
 * Provider-specific tool calling formats
 */
export const ProviderFormats = {
  /**
   * OpenAI function calling format
   */
  openai: {
    convertTools: (functions: MCPToolFunction[]) => functions,
    formatToolCall: (functionName: string, args: Record<string, unknown>) => ({
      type: 'function' as const,
      function: {
        name: functionName,
        arguments: JSON.stringify(args),
      },
    }),
  },

  /**
   * Anthropic tool use format
   */
  anthropic: {
    convertTools: (functions: MCPToolFunction[]) =>
      functions.map(func => ({
        name: func.function.name,
        description: func.function.description,
        input_schema: func.function.parameters,
      })),
    formatToolCall: (functionName: string, args: Record<string, unknown>) => ({
      type: 'tool_use' as const,
      id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: functionName,
      input: args,
    }),
  },

  /**
   * Gemini function calling format
   */
  gemini: {
    convertTools: (functions: MCPToolFunction[]) =>
      functions.map(func => ({
        function_declarations: [{
          name: func.function.name,
          description: func.function.description,
          parameters: func.function.parameters,
        }],
      })),
    formatToolCall: (functionName: string, args: Record<string, unknown>) => ({
      function_call: {
        name: functionName,
        args: args,
      },
    }),
  },
} as const
