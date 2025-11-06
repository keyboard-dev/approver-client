interface MCPTool {
  name: string
  description?: string
  inputSchema: {
    type: string
    properties?: Record<string, any>
    required?: string[]
  }
}

interface AssistantUITool {
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

interface MCPToolCallResult {
  content: Array<{
    type: 'text' | 'image' | 'resource'
    text?: string
    data?: string
    mimeType?: string
  }>
  isError?: boolean
}

export class MCPToolAdapter {
  private availableTools: MCPTool[] = []
  private toolCallHandlers = new Map<string, (args: any) => Promise<any>>()

  async refreshTools(): Promise<void> {
    try {
      const tools = await window.electronAPI.mcpGetTools()
      this.availableTools = tools
      console.log(`✅ Refreshed ${tools.length} MCP tools`)
    }
    catch (error) {
      console.error('❌ Failed to refresh MCP tools:', error)
      this.availableTools = []
    }
  }

  getAvailableTools(): MCPTool[] {
    return this.availableTools
  }

  convertToAssistantUITools(): AssistantUITool[] {
    return this.availableTools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description || `Execute ${tool.name} tool`,
        parameters: {
          type: 'object',
          properties: tool.inputSchema.properties || {},
          required: tool.inputSchema.required || [],
        },
      },
    }))
  }

  registerToolCallHandler(toolName: string, handler: (args: any) => Promise<any>): void {
    this.toolCallHandlers.set(toolName, handler)
  }

  async callTool(toolName: string, arguments_: Record<string, unknown>): Promise<MCPToolCallResult> {
    try {
      // Check if we have a custom handler
      const customHandler = this.toolCallHandlers.get(toolName)
      if (customHandler) {
        const result = await customHandler(arguments_)
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        }
      }

      // Default: call through MCP client
      const result = await window.electronAPI.mcpCallTool(toolName, arguments_)

      // Convert MCP result to our format
      if (result && result.content) {
        return result
      }

      // Fallback: wrap result as text
      return {
        content: [{
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        }],
      }
    }
    catch (error) {
      console.error(`❌ Failed to call MCP tool ${toolName}:`, error)

      return {
        content: [{
          type: 'text',
          text: `Error calling tool ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        }],
        isError: true,
      }
    }
  }

  async getMCPConnectionStatus(): Promise<any> {
    try {
      return await window.electronAPI.mcpGetStatus()
    }
    catch (error) {
      console.error('❌ Failed to get MCP status:', error)
      return { connected: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  async connectMCP(): Promise<void> {
    try {
      await window.electronAPI.mcpConnect()
      await this.refreshTools()
    }
    catch (error) {
      console.error('❌ Failed to connect to MCP:', error)
      throw error
    }
  }

  async disconnectMCP(): Promise<void> {
    try {
      await window.electronAPI.mcpDisconnect()
      this.availableTools = []
    }
    catch (error) {
      console.error('❌ Failed to disconnect from MCP:', error)
      throw error
    }
  }

  isToolAvailable(toolName: string): boolean {
    return this.availableTools.some(tool => tool.name === toolName)
  }

  getToolDescription(toolName: string): string | undefined {
    const tool = this.availableTools.find(t => t.name === toolName)
    return tool?.description
  }

  getToolSchema(toolName: string): any {
    const tool = this.availableTools.find(t => t.name === toolName)
    return tool?.inputSchema
  }

  // Helper method to format tool results for display
  formatToolResult(result: MCPToolCallResult): string {
    if (result.isError) {
      return `❌ ${result.content[0]?.text || 'Unknown error'}`
    }

    return result.content
      .map((item) => {
        if (item.type === 'text') {
          return item.text || ''
        }
        else if (item.type === 'image') {
          return `[Image: ${item.mimeType || 'unknown'}]`
        }
        else if (item.type === 'resource') {
          return `[Resource: ${item.mimeType || 'unknown'}]`
        }
        return '[Unknown content type]'
      })
      .join('\n')
  }
}

// Export singleton instance
export const mcpToolAdapter = new MCPToolAdapter()
