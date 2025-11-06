import { useMcp } from 'use-mcp/react'
import type { AIChatAdapter, ChatMessage, ChatResponse } from './ai-chat-adapter'
import { useCallback, useEffect, useState } from 'react'

export interface MCPConfig {
  serverUrl: string
  clientName: string
  autoReconnect?: boolean
}

export interface MCPAdapterOptions {
  config: MCPConfig
  accessToken?: string
}

/**
 * MCP Assistant Adapter that integrates use-mcp with assistant-ui
 * Bypasses OAuth since desktop app already has tokens
 */
export class MCPAssistantAdapter implements AIChatAdapter {
  private config: MCPConfig
  private accessToken?: string

  constructor(options: MCPAdapterOptions) {
    this.config = options.config
    this.accessToken = options.accessToken
  }

  async checkProviderAvailability(): Promise<boolean> {
    // Check if we have access token from desktop app
    if (!this.accessToken) {
      try {
        // Try to get token from desktop app's OAuth storage
        const providerStatus = await window.electronAPI?.getAIProviderKeys?.()
        const mcpProvider = providerStatus?.find(p => p.provider === 'mcp')
        return mcpProvider?.configured || false
      }
      catch (error) {
        console.error('Failed to check MCP provider availability:', error)
        return false
      }
    }
    return true
  }

  setProvider(provider: string, model: string): void {
    // MCP doesn't use traditional provider/model concept
    // But we can store these for reference
    console.log(`MCP adapter configured for provider: ${provider}, model: ${model}`)
  }

  async sendMessage(
    messages: ChatMessage[],
    onProgress?: (chunk: string) => void,
  ): Promise<ChatResponse> {
    throw new Error('Direct sendMessage not supported for MCP adapter. Use MCPChatComponent instead.')
  }
}

/**
 * React hook that provides MCP integration for assistant-ui
 */
export function useMCPAdapter(options: MCPAdapterOptions) {
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  // Get access token from desktop app
  useEffect(() => {
    const getToken = async () => {
      try {
        const token = await window.electronAPI?.getAccessToken?.()
        setAccessToken(token || null)
      }
      catch (error) {
        console.error('Failed to get access token for MCP adapter:', error)
      }
    }
    getToken()
  }, [])

  // Configure use-mcp hook
  const mcpHook = useMcp({
    url: options.config.serverUrl,
    clientName: options.config.clientName,
    autoReconnect: options.config.autoReconnect ?? true,
    // Prevent OAuth popup/callback since we use Bearer token auth
    preventAutoAuth: true,
    // Use Bearer token from desktop app's OAuth storage
    customHeaders: accessToken
      ? {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        }
      : {},
    debug: true,
  })

  const {
    state,
    tools,
    resources,
    prompts,
    error: mcpError,
    callTool,
    readResource,
    getPrompt,
    retry,
    clearStorage,
  } = mcpHook

  // Update ready state based on MCP connection
  useEffect(() => {
    if (state === 'ready') {
      setIsReady(true)
      setError(null)
    }
    else if (state === 'failed') {
      setIsReady(false)
      setError(mcpError || 'MCP connection failed')
    }
    else {
      setIsReady(false)
      setError(null)
    }
  }, [state, mcpError])

  // Function to handle chat with MCP tools
  const sendChatMessage = useCallback(async (
    message: string,
    onProgress?: (chunk: string) => void,
  ): Promise<ChatResponse> => {
    try {
      if (!isReady) {
        throw new Error('MCP connection not ready')
      }

      onProgress?.(`Processing message with ${tools.length} available tools...\n`)

      // For now, return a simple response that lists available tools
      // In a full implementation, this would integrate with an LLM that can use the tools
      const toolsList = tools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')
      const resourcesList = resources.map(resource => `- ${resource.name}: ${resource.description}`).join('\n')

      const response = `MCP Server Connected Successfully!

Available Tools (${tools.length}):
${toolsList || 'No tools available'}

Available Resources (${resources.length}):
${resourcesList || 'No resources available'}

Available Prompts (${prompts.length}):
${prompts.map(prompt => `- ${prompt.name}: ${prompt.description}`).join('\n') || 'No prompts available'}

Your message: "${message}"

Note: This is a basic MCP integration. To fully utilize MCP tools, integrate with an LLM that can call these tools based on your messages.`

      onProgress?.(response)

      return {
        message: response,
        success: true,
      }
    }
    catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      return {
        message: `Error: ${errorMessage}`,
        success: false,
        error: errorMessage,
      }
    }
  }, [isReady, tools, resources, prompts])

  // Function to call a specific MCP tool
  const callMCPTool = useCallback(async (
    toolName: string,
    args: Record<string, unknown>,
  ) => {
    if (!isReady) {
      throw new Error('MCP connection not ready')
    }

    return await callTool(toolName, args)
  }, [isReady, callTool])

  // Function to read an MCP resource
  const readMCPResource = useCallback(async (uri: string) => {
    if (!isReady) {
      throw new Error('MCP connection not ready')
    }

    return await readResource(uri)
  }, [isReady, readResource])

  // Function to get an MCP prompt
  const getMCPPrompt = useCallback(async (promptName: string, args?: Record<string, unknown>) => {
    if (!isReady) {
      throw new Error('MCP connection not ready')
    }

    return await getPrompt(promptName, args)
  }, [isReady, getPrompt])

  return {
    // MCP state
    state,
    isReady,
    error,
    tools,
    resources,
    prompts,

    // MCP functions
    callTool: callMCPTool,
    readResource: readMCPResource,
    getPrompt: getMCPPrompt,
    retry,
    clearStorage,

    // Chat integration
    sendMessage: sendChatMessage,

    // Adapter instance
    adapter: new MCPAssistantAdapter(options),
  }
}

/**
 * Create an MCP adapter with default configuration
 */
export function createMCPAdapter(serverUrl?: string): AIChatAdapter {
  const defaultConfig: MCPConfig = {
    serverUrl: serverUrl || 'https://mcp.keyboard.dev',
    clientName: 'keyboard-approver-mcp',
    autoReconnect: true,
  }

  return new MCPAssistantAdapter({ config: defaultConfig })
}
