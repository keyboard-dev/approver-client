import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type {
  CallToolResult,
  GetPromptResult,
  ReadResourceResult,
  Resource,
  Tool,
} from '@modelcontextprotocol/sdk/types.js'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseMcpClientOptions {
  serverUrl: string
  clientName?: string
  autoReconnect?: boolean
}

export interface UseMcpClientResult {
  state: 'discovering' | 'connecting' | 'loading' | 'ready' | 'failed'
  tools: Tool[]
  resources: Resource[]
  prompts: Array<{ name: string, description?: string }>
  error?: string
  callTool: (name: string, args?: Record<string, unknown>) => Promise<CallToolResult>
  readResource: (uri: string) => Promise<ReadResourceResult>
  getPrompt: (name: string, args?: Record<string, unknown>) => Promise<{ messages: Array<{ role: string, content: unknown }> }>
  retry: () => void
}

export function useMcpClient(options: UseMcpClientOptions): UseMcpClientResult {
  // State management
  const [state, setState] = useState<UseMcpClientResult['state']>('discovering')
  const [tools, setTools] = useState<Tool[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [prompts, setPrompts] = useState<Array<{ name: string, description?: string }>>([])
  const [error, setError] = useState<string | undefined>()
  const [accessToken, setAccessToken] = useState<string | null>(null)

  // Refs to hold client and transport instances
  const clientRef = useRef<Client | null>(null)
  const transportRef = useRef<StreamableHTTPClientTransport | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const isConnectingRef = useRef(false)
  const stateRef = useRef(state) // Add state ref to track current state
  const maxReconnectAttempts = 3

  // Update state ref when state changes
  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Get access token from desktop app
  useEffect(() => {
    const getToken = async () => {
      try {
        const token = await window.electronAPI?.getAccessToken?.()
        console.log('this is the access token', token)
        setAccessToken(token || null)
      }
      catch (err) {
        console.error('Failed to get access token for MCP client:', err)
        setError('Failed to get authentication token')
        setState('failed')
      }
    }
    getToken()
  }, [])

  // Cleanup function
  const cleanup = useCallback(async () => {
    try {
      if (clientRef.current) {
        await clientRef.current.close()
        clientRef.current = null
      }
      if (transportRef.current) {
        await transportRef.current.close()
        transportRef.current = null
      }
    }
    catch (err) {
      console.error('Error during MCP cleanup:', err)
    }
  }, [])

  // Discover server capabilities
  const discoverCapabilities = useCallback(async () => {
    const client = clientRef.current
    if (!client) return

    try {
      // Discover tools
      const toolsResponse = await client.listTools()
      setTools(toolsResponse.tools || [])

      // Discover resources
      const resourcesResponse = await client.listResources()
      setResources(resourcesResponse.resources || [])

      // Discover prompts
      const promptsResponse = await client.listPrompts()
      setPrompts((promptsResponse.prompts || []).map(p => ({
        name: p.name,
        description: p.description,
      })))

      console.log(`✅ Discovered ${toolsResponse.tools?.length || 0} tools, ${resourcesResponse.resources?.length || 0} resources, ${promptsResponse.prompts?.length || 0} prompts`)
    }
    catch (err) {
      console.error('❌ Failed to discover MCP capabilities:', err)
      // Don't fail the entire connection for discovery issues
    }
  }, [])

  // Connect to MCP server - REMOVED state from dependencies to prevent infinite loop
  const connect = useCallback(async (token: string, serverUrl: string) => {
    if (isConnectingRef.current) return

    try {
      isConnectingRef.current = true
      setState('connecting')
      setError(undefined)

      // Clean up any existing connections
      await cleanup()

      // Create the transport with proper authentication headers
      const url = new URL(serverUrl)
      const transport = new StreamableHTTPClientTransport(url, {
        requestInit: {
          headers: {
            Authorization: 'Bearer ' + token,
          },
        },
      })

      transportRef.current = transport

      // Create the client
      const client = new Client({
        name: options.clientName || 'mcp-react-client',
        version: '1.0.0',
      }, {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      })

      clientRef.current = client

      // Set up error handlers
      transport.onerror = (error) => {
        console.error('Transport error:', error)
        setError(error.message)
        setState('failed')
      }

      // Fix onclose handler to use current state via ref
      transport.onclose = () => {
        console.log('Transport closed')
        if (stateRef.current === 'ready' && options.autoReconnect) {
          setTimeout(() => {
            if (accessToken && options.serverUrl) {
              connect(accessToken, options.serverUrl).catch(console.error)
            }
          }, 1000)
        }
      }

      // Connect to the server FIRST
      await client.connect(transport)

      setState('loading')

      // Set up notification handlers AFTER connection is established
      try {
        client.setNotificationHandler('notifications/tools/list_changed', () => {
          console.log('Tools list changed, refreshing...')
          setTimeout(() => discoverCapabilities(), 0)
        })

        client.setNotificationHandler('notifications/resources/list_changed', () => {
          console.log('Resources list changed, refreshing...')
          setTimeout(() => discoverCapabilities(), 0)
        })

        client.setNotificationHandler('notifications/prompts/list_changed', () => {
          console.log('Prompts list changed, refreshing...')
          setTimeout(() => discoverCapabilities(), 0)
        })
      }
      catch (notificationError) {
        console.warn('Failed to set up notification handlers:', notificationError)
      }

      // Discover capabilities
      await discoverCapabilities()

      reconnectAttemptsRef.current = 0
      setState('ready')
      console.log('✅ Connected to MCP server:', serverUrl)
    }
    catch (err) {
      console.error('❌ Failed to connect to MCP server:', err)
      setError(err instanceof Error ? err.message : 'Connection failed')
      setState('failed')
      throw err
    }
    finally {
      isConnectingRef.current = false
    }
  }, [options.clientName, options.autoReconnect, cleanup, discoverCapabilities]) // Removed 'state' from dependencies

  // Connect when we have a token - added connection tracking to prevent multiple calls
  const hasConnectedRef = useRef(false)

  useEffect(() => {
    if (!accessToken || !options.serverUrl || hasConnectedRef.current || isConnectingRef.current) {
      return
    }

    hasConnectedRef.current = true
    console.log('Initiating connection with token:', !!accessToken)

    connect(accessToken, options.serverUrl).catch((err) => {
      console.error('Connection failed:', err)
      hasConnectedRef.current = false // Reset on failure so retry can work
    })
  }, [accessToken, options.serverUrl, connect])

  // Reset connection tracking when token or URL changes
  useEffect(() => {
    hasConnectedRef.current = false
  }, [accessToken, options.serverUrl])

  // Tool calling function
  const callTool = useCallback(async (name: string, args: Record<string, unknown> = {}): Promise<CallToolResult> => {
    const client = clientRef.current
    if (state !== 'ready' || !client) {
      throw new Error('MCP client is not ready')
    }

    try {
      return await client.callTool({
        name,
        arguments: args,
      })
    }
    catch (err) {
      console.error(`Failed to call tool ${name}:`, err)
      throw err
    }
  }, [state])

  // Resource reading function
  const readResource = useCallback(async (uri: string): Promise<ReadResourceResult> => {
    const client = clientRef.current
    if (state !== 'ready' || !client) {
      throw new Error('MCP client is not ready')
    }

    try {
      return await client.readResource({ uri })
    }
    catch (err) {
      console.error(`Failed to read resource ${uri}:`, err)
      throw err
    }
  }, [state])

  // Prompt getting function
  const getPrompt = useCallback(async (name: string, args: Record<string, unknown> = {}): Promise<{ messages: Array<{ role: string, content: unknown }> }> => {
    const client = clientRef.current
    if (state !== 'ready' || !client) {
      throw new Error('MCP client is not ready')
    }

    try {
      const result: GetPromptResult = await client.getPrompt({
        name,
        arguments: args,
      })
      return {
        messages: result.messages || [],
      }
    }
    catch (err) {
      console.error(`Failed to get prompt ${name}:`, err)
      throw err
    }
  }, [state])

  // Retry function
  const retry = useCallback(() => {
    if (isConnectingRef.current) return

    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached')
      setError(`Max reconnection attempts (${maxReconnectAttempts}) reached`)
      return
    }

    if (accessToken && options.serverUrl) {
      reconnectAttemptsRef.current++
      console.log(`🔄 Reconnecting to MCP server (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`)

      setState('connecting')
      setError(undefined)
      hasConnectedRef.current = false // Reset connection tracking for retry

      connect(accessToken, options.serverUrl).catch((err) => {
        console.error('Reconnection failed:', err)
        hasConnectedRef.current = false
      })
    }
  }, [accessToken, options.serverUrl, connect])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    state,
    tools,
    resources,
    prompts,
    error,
    callTool,
    readResource,
    getPrompt,
    retry,
  }
}
