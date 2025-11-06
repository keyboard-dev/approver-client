import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { useMcpClient } from '../hooks/useMcpClient'

/**
 * Universal MCP Tool Integration Service
 * Converts MCP tools to function calling schemas compatible with all AI providers
 */

export interface MCPToolFunction {
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
  tools: Tool[]
  functions: MCPToolFunction[]
  error?: string
}

/**
 * Convert MCP tools to OpenAI-compatible function calling format
 * This format is widely supported across AI providers (OpenAI, Anthropic, Gemini)
 */
export function convertMCPToolsToFunctions(mcpTools: Tool[]): MCPToolFunction[] {
  return mcpTools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description || `Execute ${tool.name} tool`,
      parameters: {
        type: 'object',
        properties: tool.inputSchema?.properties || {},
        required: tool.inputSchema?.required || [],
        ...tool.inputSchema,
      },
    },
  }))
}

/**
 * Convert function call arguments to MCP tool call format
 */
export function prepareMCPToolCall(functionName: string, args: Record<string, unknown>): {
  name: string
  args: Record<string, unknown>
} {
  return {
    name: functionName,
    args: args || {},
  }
}

/**
 * Format tool call results for AI provider consumption
 */
export function formatToolResult(toolName: string, result: CallToolResult): string {
  try {
    // Extract useful content from MCP tool result
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
  } catch (error) {
    return `Error formatting result from ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

/**
 * React hook for managing MCP tool integration state
 */
export function useMCPIntegration(serverUrl: string = 'https://mcp.keyboard.dev', clientName: string = 'keyboard-approver-mcp') {
  const mcpClient = useMcpClient({ 
    serverUrl, 
    clientName, 
    autoReconnect: true 
  })

  const integrationState: MCPIntegrationState = {
    isEnabled: true, // Always enabled when using this hook
    isConnected: mcpClient.state === 'ready',
    tools: mcpClient.tools,
    functions: convertMCPToolsToFunctions(mcpClient.tools),
    error: mcpClient.error,
  }

  /**
   * Execute an MCP tool call
   */
  const executeToolCall = async (functionName: string, args: Record<string, unknown>): Promise<string> => {
    console.log('🚀 keyboard.dev-ability Execution: Starting execution for', functionName)
    console.log('📊 MCP Client state:', mcpClient.state)
    console.log('🌐 Server URL:', serverUrl)
    
    try {
      if (mcpClient.state !== 'ready') {
        const error = `MCP client is not ready. Current state: ${mcpClient.state}`
        console.error('❌', error)
        throw new Error(error)
      }

      console.log('✅ MCP client is ready, proceeding with keyboard.dev-ability call')
      const { name, args: abilityArgs } = prepareMCPToolCall(functionName, args)
      console.log('📋 Prepared ability call - Name:', name, 'Args:', abilityArgs)
      
      console.log('🚀 Calling mcpClient.callTool...')
      const startTime = performance.now()
      const result = await mcpClient.callTool(name, abilityArgs)
      const callTime = Math.round(performance.now() - startTime)
      
      console.log('✅ keyboard.dev-ability call completed in', callTime, 'ms')
      console.log('📊 Raw MCP result:', result)
      
      const formattedResult = formatToolResult(functionName, result)
      console.log('📄 Formatted result (first 300 chars):', formattedResult.slice(0, 300))
      
      return formattedResult
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      console.error(`❌ Failed to execute keyboard.dev-ability ${functionName}:`, error)
      console.error('❌ Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: errorMessage,
        stack: error instanceof Error ? error.stack : 'No stack trace'
      })
      return `Error executing ${functionName}: ${errorMessage}`
    }
  }

  /**
   * Get system message with available keyboard.dev abilities for AI context
   */
  const getToolsSystemMessage = (): string => {
    if (!integrationState.isConnected || integrationState.tools.length === 0) {
      return ''
    }

    const abilitiesInfo = integrationState.tools
      .map(ability => `- ${ability.name}: ${ability.description || 'No description available'}`)
      .join('\n')

    return `You have access to the following keyboard.dev abilities. These are special capabilities that can help you accomplish tasks:

${abilitiesInfo}

When you need to use any keyboard.dev ability, first discover it by responding with **{{ability-name}}** (e.g., **list-all-codespaces-for-repo**). You will then receive the exact parameters and description needed to properly call that keyboard.dev ability.`
  }

  return {
    ...integrationState,
    mcpState: mcpClient.state,
    executeToolCall,
    getToolsSystemMessage,
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