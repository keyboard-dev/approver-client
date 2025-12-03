import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type {
  CallToolResult,
  JSONRPCMessage,
  ReadResourceResult,
  Resource,
  Tool,
} from '@modelcontextprotocol/sdk/types.js'

// Simple HTTP transport implementation
class HttpTransport implements Transport {
  private url: string
  private headers: Record<string, string>
  private messageHandler?: (message: JSONRPCMessage) => void
  private closeHandler?: () => void
  private errorHandler?: (error: Error) => void

  constructor(options: { url: string, headers?: Record<string, string> }) {
    this.url = options.url
    this.headers = options.headers || {}
  }

  async start(): Promise<void> {
    // HTTP transport doesn't need a persistent connection
  }

  async close(): Promise<void> {
    // HTTP transport doesn't need to close anything
    this.closeHandler?.()
  }

  async send(message: JSONRPCMessage): Promise<void> {
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          ...this.headers,
        },
        body: JSON.stringify(message),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json() as JSONRPCMessage
      this.messageHandler?.(result)
    }
    catch (error) {
      this.errorHandler?.(error instanceof Error ? error : new Error('Unknown error'))
    }
  }

  set onMessage(handler: ((message: JSONRPCMessage) => void) | undefined) {
    this.messageHandler = handler
  }

  set onClose(handler: (() => void) | undefined) {
    this.closeHandler = handler
  }

  set onError(handler: ((error: Error) => void) | undefined) {
    this.errorHandler = handler
  }
}

export interface MCPConnectionConfig {
  serverUrl: string
  accessToken: string
}

export interface MCPConnectionStatus {
  connected: boolean
  serverUrl?: string
  error?: string
  tools?: Tool[]
  resources?: Resource[]
}

export class MCPClientService {
  private client: Client | null = null
  private transport: HttpTransport | null = null
  private connectionStatus: MCPConnectionStatus = { connected: false }
  private reconnectAttempts = 0
  private maxReconnectAttempts = 3

  constructor() {
    // Initialize with disconnected state
  }

  async connect(config: MCPConnectionConfig): Promise<void> {
    try {
      // Clean up existing connection
      if (this.client) {
        await this.disconnect()
      }

      // Create HTTP transport with WorkOS auth token
      this.transport = new HttpTransport({
        url: config.serverUrl,
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      // Create MCP client
      this.client = new Client({
        name: 'keyboard-approver',
        version: '1.0.0',
      }, {
        capabilities: {
          sampling: {},
        },
      })

      // Connect to the server
      await this.client.connect(this.transport)

      // Update connection status
      this.connectionStatus = {
        connected: true,
        serverUrl: config.serverUrl,
      }

      // Discover available tools and resources
      await this.discoverCapabilities()

      this.reconnectAttempts = 0
    }
    catch (error) {
      this.connectionStatus = {
        connected: false,
        serverUrl: config.serverUrl,
        error: error instanceof Error ? error.message : 'Connection failed',
      }

      console.error('❌ Failed to connect to MCP server:', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close()
        this.client = null
      }

      if (this.transport) {
        this.transport = null
      }

      this.connectionStatus = { connected: false }
    }
    catch (error) {
      console.error('❌ Error during MCP disconnect:', error)
    }
  }

  async reconnect(config: MCPConnectionConfig): Promise<boolean> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached')
      return false
    }

    this.reconnectAttempts++

    try {
      await this.connect(config)
      return true
    }
    catch (error) {
      console.error('❌ Reconnection failed:', error)
      return false
    }
  }

  private async discoverCapabilities(): Promise<void> {
    if (!this.client) {
      throw new Error('MCP client not connected')
    }

    try {
      // Discover tools
      const toolsResponse = await this.client.listTools()
      const tools = toolsResponse.tools || []

      // Discover resources
      const resourcesResponse = await this.client.listResources()
      const resources = resourcesResponse.resources || []

      // Update connection status with capabilities
      this.connectionStatus = {
        ...this.connectionStatus,
        tools,
        resources,
      }
    }
    catch (error) {
      console.error('❌ Failed to discover MCP capabilities:', error)
      // Don't throw - connection is still valid, just missing discovery
    }
  }

  async callTool(name: string, arguments_: Record<string, unknown>): Promise<CallToolResult> {
    if (!this.client) {
      throw new Error('MCP client not connected')
    }

    try {
      const result = await this.client.callTool({
        name,
        arguments: arguments_,
      })
      // Ensure the result has the expected structure
      return {
        ...result,
        content: result.content || [],
      } as CallToolResult
    }
    catch (error) {
      console.error(`❌ Failed to call tool ${name}:`, error)
      throw error
    }
  }

  async readResource(uri: string): Promise<ReadResourceResult> {
    if (!this.client) {
      throw new Error('MCP client not connected')
    }

    try {
      const result = await this.client.readResource({ uri })
      // Ensure the result has the expected structure
      return {
        ...result,
        contents: result.contents || [],
      } as ReadResourceResult
    }
    catch (error) {
      console.error(`❌ Failed to read resource ${uri}:`, error)
      throw error
    }
  }

  getConnectionStatus(): MCPConnectionStatus {
    return this.connectionStatus
  }

  getAvailableTools(): Tool[] {
    return this.connectionStatus.tools || []
  }

  getAvailableResources(): Resource[] {
    return this.connectionStatus.resources || []
  }

  isConnected(): boolean {
    return this.connectionStatus.connected
  }
}

// Export singleton instance
export const mcpClient = new MCPClientService()
