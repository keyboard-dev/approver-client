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
  timeout?: number // Timeout in milliseconds for MCP operations
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
  const [prompts] = useState<Array<{ name: string, description?: string }>>([])
  const [error, setError] = useState<string | undefined>()
  const [accessToken, setAccessToken] = useState<string | null>(null)

  // Refs to hold client and transport instances
  const clientRef = useRef<Client | null>(null)
  const transportRef = useRef<StreamableHTTPClientTransport | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const isConnectingRef = useRef(false)
  const stateRef = useRef(state) // Add state ref to track current state
  const healthCheckRef = useRef<NodeJS.Timeout | null>(null)

  // Update state ref when state changes
  useEffect(() => {
    stateRef.current = state
  }, [state])

  // Get access token from desktop app
  useEffect(() => {
    const getToken = async () => {
      try {
        const token = await window.electronAPI?.getAccessToken?.()
        setAccessToken(token || null)
      }
      catch (err) {
        setError('Failed to get authentication token')
        setState('failed')
      }
    }
    getToken()
  }, [])

  // Cleanup function
  const cleanup = useCallback(async () => {
    if (healthCheckRef.current) {
      clearInterval(healthCheckRef.current)
      healthCheckRef.current = null
    }
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
      // console.log('🔍 Discovering prompts...')
      // const promptsResponse = await client.listPrompts()
      // setPrompts((promptsResponse.prompts || []).map(p => ({
      //   name: p.name,
      //   description: p.description,
      // })))
    }
    catch (err) {
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
      const url = new URL(`${serverUrl}/mcp`)
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

      // Set up error handlers — trigger reconnect on error
      transport.onerror = (error) => {
        console.error('[MCP] Transport error:', error.message)
        setError(error.message)
        setState('failed')
        if (options.autoReconnect && !isConnectingRef.current) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 15000)
          console.log(`[MCP] Will reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`)
          reconnectAttemptsRef.current++
          setTimeout(() => {
            if (accessToken && options.serverUrl && !isConnectingRef.current) {
              connect(accessToken, options.serverUrl).catch(() => {})
            }
          }, delay)
        }
      }

      // Reconnect on close if we were previously ready
      transport.onclose = () => {
        console.log('[MCP] Transport closed, state was:', stateRef.current)
        if (options.autoReconnect && !isConnectingRef.current) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 15000)
          console.log(`[MCP] Will reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})`)
          reconnectAttemptsRef.current++
          setTimeout(() => {
            if (accessToken && options.serverUrl && !isConnectingRef.current) {
              connect(accessToken, options.serverUrl).catch(() => {})
            }
          }, delay)
        }
      }

      // Connect to the server FIRST
      await client.connect(transport)

      setState('loading')

      // Set up notification handlers AFTER connection is established
      try {
        client.setNotificationHandler('notifications/tools/list_changed', () => {
          setTimeout(() => discoverCapabilities(), 0)
        })

        client.setNotificationHandler('notifications/resources/list_changed', () => {
          setTimeout(() => discoverCapabilities(), 0)
        })

        client.setNotificationHandler('notifications/prompts/list_changed', () => {
          setTimeout(() => discoverCapabilities(), 0)
        })
      }
      catch (notificationError) {
      }

      // Discover capabilities
      await discoverCapabilities()

      reconnectAttemptsRef.current = 0
      console.log('[MCP] Connected and ready')
      setState('ready')

      // Start health check — if client becomes unavailable, trigger reconnect
      if (healthCheckRef.current) clearInterval(healthCheckRef.current)
      healthCheckRef.current = setInterval(() => {
        if (!clientRef.current || !transportRef.current) {
          console.log('[MCP] Health check: client gone, reconnecting...')
          if (healthCheckRef.current) {
            clearInterval(healthCheckRef.current)
            healthCheckRef.current = null
          }
          if (accessToken && options.serverUrl && !isConnectingRef.current) {
            connect(accessToken, options.serverUrl).catch(() => {})
          }
        }
      }, 15000)
    }
    catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
      setState('failed')
      // Auto-retry on failed initial connection
      if (options.autoReconnect && !isConnectingRef.current) {
        const delay = Math.min(2000 * Math.pow(2, reconnectAttemptsRef.current), 15000)
        console.log(`[MCP] Connection failed, retry in ${delay}ms`)
        reconnectAttemptsRef.current++
        setTimeout(() => {
          if (accessToken && options.serverUrl && !isConnectingRef.current) {
            connect(accessToken, options.serverUrl).catch(() => {})
          }
        }, delay)
      }
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
    connect(accessToken, options.serverUrl).catch((err) => {
      hasConnectedRef.current = false // Reset on failure so retry can work
    })
  }, [accessToken, options.serverUrl, connect])

  // Reset connection tracking when token or URL changes
  useEffect(() => {
    hasConnectedRef.current = false
  }, [accessToken, options.serverUrl])

  // Tool calling function — auto-reconnects if client is unavailable
  const callTool = useCallback(async (name: string, args: Record<string, unknown> = {}): Promise<CallToolResult> => {
    let client = clientRef.current
    if (!client) {
      // Attempt reconnect before failing
      console.log('[MCP] Client unavailable for callTool, attempting reconnect...')
      if (accessToken && options.serverUrl && !isConnectingRef.current) {
        try {
          await connect(accessToken, options.serverUrl)
          client = clientRef.current
        }
        catch {
          // connect failed
        }
      }
      if (!client) {
        throw new Error('MCP client is not available')
      }
    }

    try {
      // Pass timeout directly to SDK to override the 60-second default
      const timeout = options.timeout || 300000 // Default 5 minutes
      return await client.callTool({
        name,
        arguments: args,
      }, undefined, { timeout })
    }
    catch (err) {
      // If it's a connection error, try reconnect + retry once
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed') || msg.includes('PROTOCOL_ERROR')) {
        console.log('[MCP] callTool connection error, reconnecting and retrying:', msg)
        if (accessToken && options.serverUrl && !isConnectingRef.current) {
          try {
            await connect(accessToken, options.serverUrl)
            const retryClient = clientRef.current
            if (retryClient) {
              const timeout = options.timeout || 300000
              return await retryClient.callTool({ name, arguments: args }, undefined, { timeout })
            }
          }
          catch {
            // retry also failed
          }
        }
      }
      throw err
    }
  }, [options.timeout, accessToken, options.serverUrl, connect])

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
        arguments: args as Record<string, string>,
      })
      return {
        messages: result.messages || [],
      }
    }
    catch (err) {
      throw err
    }
  }, [state])

  // Retry function
  const retry = useCallback(() => {
    if (isConnectingRef.current) return

    // Reset attempt counter on explicit retry (e.g., triggered by failed tool call)
    // This ensures mid-chat reconnects aren't blocked by prior auto-reconnect exhaustion
    reconnectAttemptsRef.current = 0

    if (accessToken && options.serverUrl) {
      reconnectAttemptsRef.current++

      setState('connecting')
      setError(undefined)
      hasConnectedRef.current = false // Reset connection tracking for retry

      connect(accessToken, options.serverUrl).catch(() => {
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
