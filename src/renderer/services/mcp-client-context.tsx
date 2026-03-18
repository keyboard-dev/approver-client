import type { CallToolResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js'
import { createContext, useContext } from 'react'

export interface McpClientContextValue {
  callTool: (name: string, args?: Record<string, unknown>) => Promise<CallToolResult>
  readResource: (uri: string) => Promise<ReadResourceResult>
  /** Map of toolName → MCP App resourceUri for tools with UI widgets */
  toolResourceMap: Map<string, string>
}

const McpClientContext = createContext<McpClientContextValue | null>(null)

export const useMcpClientContext = (): McpClientContextValue => {
  const ctx = useContext(McpClientContext)
  if (!ctx) {
    throw new Error('useMcpClientContext must be used within McpClientProvider')
  }
  return ctx
}

export const McpClientProvider = McpClientContext.Provider
