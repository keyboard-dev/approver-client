import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js'
import { useMcpClient } from '../hooks/useMcpClient'
import { AbilityDiscoveryService, type AbilitySearchResult } from './ability-discovery'
import { generateFingerprint, registerPendingCall, removePendingCall } from './pending-tool-calls'
import { ResultProcessorService } from './result-processor'
import { toolCacheService } from './tool-cache-service'


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

  // Cache tools whenever we successfully get them from MCP client
  if (mcpClient.tools.length > 0) {
    toolCacheService.cacheTools(mcpClient.tools, serverUrl)
  }

  // Use cached tools as fallback when MCP client isn't ready
  const availableTools = mcpClient.tools.length > 0 ? mcpClient.tools : toolCacheService.getAllTools()

  // Filter out app-only tools (visibility: ['app']) — these are widget-internal helpers
  // that should not be callable by the AI model (e.g. search-apps, fetch-accounts-data).
  // The AI should use the parent tool (e.g. connect-reconnect-accounts) which blocks properly.
  const modelVisibleTools = availableTools.filter((tool) => {
    const visibility = (tool as any)?._meta?.ui?.visibility
    if (Array.isArray(visibility) && visibility.includes('app') && !visibility.includes('model')) {
      return false
    }
    return true
  })

  // Log status for debugging
  if (availableTools.length === 0) {
  }
  else if (mcpClient.tools.length === 0 && availableTools.length > 0) {
  }

  const integrationState: MCPIntegrationState = {
    isEnabled: true, // Always enabled when using this hook
    isConnected: mcpClient.state === 'ready',
    abilities: modelVisibleTools,
    functions: convertMCPAbilitiesToFunctions(modelVisibleTools),
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
   * Helper: wait for MCP client to reconnect by polling the client ref's availability.
   * Note: mcpClient.state is a React state snapshot and won't update inside this closure,
   * so we rely on retry() completing (which resolves the connect() promise) and then
   * attempt a simple tool list to verify the connection is live.
   */
  const waitForReconnect = (timeoutMs: number = 15000): Promise<boolean> => {
    return new Promise((resolve) => {
      if (mcpClient.state === 'ready') return resolve(true)
      // Just wait for the retry() to complete — the connect() call inside useMcpClient
      // will set state to 'ready' and restore the client ref
      const start = Date.now()
      const interval = setInterval(() => {
        // Check if enough time has passed for reconnect to complete
        if (Date.now() - start > timeoutMs) {
          clearInterval(interval)
          resolve(false)
        }
      }, 1000)
      // Also resolve early if retry succeeds (connect resolves before timeout)
      setTimeout(() => {
        clearInterval(interval)
        resolve(true) // Optimistically assume reconnect worked — attemptToolCall will fail if not
      }, Math.min(5000, timeoutMs))
    })
  }

  /**
   * Core tool call logic (extracted to allow retry)
   */
  const attemptToolCall = async (
    functionName: string,
    args: Record<string, unknown>,
    executionId?: string,
  ): Promise<string | { summary: string, tokenCount: number, wasFiltered: boolean }> => {
    // Check if we have any tools available before attempting execution
    if (availableTools.length === 0) {
      throw new Error('No tools available. Please ensure connection to mcp.keyboard.dev or wait for tools to be cached.')
    }

    const { name, args: abilityArgs } = prepareMCPAbilityCall(functionName, args)
    const startTime = performance.now()

    const toolsRequiringApproval = ['run-code']
    let result: CallToolResult
    let pendingCallId: string | null = null

    if (toolsRequiringApproval.includes(name)) {
      const explanation = typeof abilityArgs.explanation_of_code === 'string'
        ? abilityArgs.explanation_of_code
        : undefined
      const fingerprint = explanation ? generateFingerprint(explanation) : undefined
      const pending = registerPendingCall(name, fingerprint)
      pendingCallId = pending.id

      // Add a timeout so the pending promise doesn't hang forever (10 min)
      const pendingTimeout = 10 * 60 * 1000
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Tool call ${name} timed out after ${pendingTimeout / 1000}s. If this was a background job, try using list-background-jobs or poll-background-job to check its status.`)), pendingTimeout)
      })

      try {
        result = await Promise.race([
          mcpClient.callTool(name, abilityArgs).then((mcpResult) => {
            removePendingCall(pendingCallId!)
            return mcpResult
          }),
          pending.promise.then((approvalResult) => {
            return approvalResult
          }),
          timeoutPromise,
        ])
      }
      catch (raceError) {
        if (pendingCallId) removePendingCall(pendingCallId)
        throw raceError
      }
    }
    else {
      result = await mcpClient.callTool(name, abilityArgs)
    }

    const callTime = Math.round(performance.now() - startTime)
    if (executionId) {
      executionTracker?.updateExecution(executionId, {
        status: 'success',
        response: result,
        metadata: { isLocalExecution: false, intercepted: false, callTime },
      })
    }
    return JSON.stringify(result, null, 2)
  }

  /**
   * Execute an MCP ability call with automatic reconnect on connection failure
   */
  const executeAbilityCall = async (
    functionName: string,
    args: Record<string, unknown>,
  ) => {
    const executionId = executionTracker?.addExecution(functionName, args, typeof args.provider === 'string' ? args.provider : undefined)

    try {
      return await attemptToolCall(functionName, args, executionId)
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      const isConnectionError = errorMessage.includes('fetch')
        || errorMessage.includes('network')
        || errorMessage.includes('timeout')
        || errorMessage.includes('connection')
        || errorMessage.includes('not available')
        || errorMessage.includes('MCP client is not available')
        || errorMessage.includes('SSE')
        || errorMessage.includes('PROTOCOL_ERROR')
        || errorMessage.includes('disconnected')
        || errorMessage.includes('Failed')

      // On connection error, attempt reconnect + single retry
      if (isConnectionError) {
        try {
          mcpClient.retry()
          const reconnected = await waitForReconnect(15000)
          if (reconnected) {
            return await attemptToolCall(functionName, args, executionId)
          }
        }
        catch (retryError) {
        }
      }

      const errorType = isConnectionError ? 'Connection Error' : 'Execution Error'
      if (executionId) {
        executionTracker?.updateExecution(executionId, {
          status: 'error',
          error: errorMessage,
          metadata: {
            errorType,
            mcpClientState: mcpClient.state,
            toolCached: toolCacheService.hasValidTool(functionName),
          },
        })
      }

      let userFriendlyMessage = errorMessage
      if (isConnectionError) {
        userFriendlyMessage = `Connection issue with ${functionName}. Reconnect attempted but failed — please check your connection.`
      }

      return {
        summary: `${errorType}: ${userFriendlyMessage}`,
        tokenCount: userFriendlyMessage.length / 4,
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
    // Expose raw MCP client functions for MCP Apps host
    mcpCallTool: mcpClient.callTool,
    mcpReadResource: mcpClient.readResource,
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
