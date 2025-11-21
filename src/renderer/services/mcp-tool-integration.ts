import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import { useMcpClient } from '../hooks/useMcpClient'
import { AbilityDiscoveryService, type AbilitySearchResult } from './ability-discovery'
import { ResultProcessorService, type ProcessingOptions } from './result-processor'
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
 * React hook for managing MCP ability integration state
 */
export function useMCPIntegration(
  serverUrl: string = 'https://mcp.keyboard.dev',
  clientName: string = 'keyboard-approver-mcp',
  executionTracker?: {
    addExecution: (abilityName: string, parameters: Record<string, unknown>, provider?: string) => string
    updateExecution: (id: string, updates: Partial<any>) => void
  },
) {
  const mcpClient = useMcpClient({
    serverUrl,
    clientName,
    autoReconnect: true,
    timeout: 900000, // 15 minutes for long-running tools like run-code
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
  ) => {
    console.log('🚀 keyboard.dev-ability Execution: Starting execution for', functionName)
    console.log('📊 MCP Client state:', mcpClient.state)
    console.log('🌐 Server URL:', serverUrl)

    // Start execution tracking
    const executionId = executionTracker?.addExecution(functionName, args, typeof args.provider === 'string' ? args.provider : undefined)

    try {
      // Intercept web-search calls and route to local implementation
      if (functionName === 'web-search') {
        console.log('🔍 Intercepting web-search call for enhanced local processing')

        // Validate required parameters for web search
        if (!args.query || typeof args.query !== 'string') {
          throw new Error('Query parameter is required for web search and must be a string')
        }
        if (!args.company || typeof args.company !== 'string') {
          throw new Error('Company parameter is required for web search and must be a string')
        }

        const result = await webSearchTool.execute({
          provider: typeof args.provider === 'string' ? args.provider : undefined,
          query: args.query,
          company: args.company,
          maxResults: typeof args.maxResults === 'number' ? args.maxResults : undefined,
          prioritizeMarkdown: typeof args.prioritizeMarkdown === 'boolean' ? args.prioritizeMarkdown : undefined,
          prioritizeDocs: typeof args.prioritizeDocs === 'boolean' ? args.prioritizeDocs : undefined,
          includeDomains: Array.isArray(args.includeDomains) ? args.includeDomains as string[] : undefined,
          excludeDomains: Array.isArray(args.excludeDomains) ? args.excludeDomains as string[] : undefined,
        })

        // Update execution with success
        if (executionId) {
          executionTracker?.updateExecution(executionId, {
            status: 'success',
            response: result,
            metadata: {
              isLocalExecution: true,
              intercepted: true,
            },
          })
        }

        return result
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

      // Update execution with success
      if (executionId) {
        executionTracker?.updateExecution(executionId, {
          status: 'success',
          response: result,
          metadata: {
            isLocalExecution: false,
            intercepted: false,
            callTime,
          },
        })
      }

      return JSON.stringify(result, null, 2)
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error(`❌ Failed to execute keyboard.dev-ability ${functionName}:`, error)
      console.error('❌ Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: errorMessage,
        stack: error instanceof Error ? error.stack : 'No stack trace',
      })

      // Update execution with error
      if (executionId) {
        executionTracker?.updateExecution(executionId, {
          status: 'error',
          error: errorMessage,
        })
      }

      return {
        summary: `Error executing ${functionName}: ${errorMessage}`,
        tokenCount: errorMessage.length / 4,
        wasFiltered: false,
      }
    }
  }

  return {
    ...integrationState,
    mcpState: mcpClient.state,
    executeAbilityCall,
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
    convertTools: (functions: MCPAbilityFunction[]) => functions,
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
    convertTools: (functions: MCPAbilityFunction[]) =>
      functions.map(func => ({
        name: func.function.name,
        description: func.function.description,
        input_schema: func.function.parameters,
      })),
    formatToolCall: (functionName: string, args: Record<string, unknown>) => ({
      type: 'tool_use' as const,
      id: `tool_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      name: functionName,
      input: args,
    }),
  },

  /**
   * Gemini function calling format
   */
  gemini: {
    convertTools: (functions: MCPAbilityFunction[]) =>
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
