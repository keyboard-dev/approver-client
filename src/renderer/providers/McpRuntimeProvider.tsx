import React, { createContext, useContext, useMemo, useState, useCallback } from 'react'
import { AssistantRuntimeProvider } from '@assistant-ui/react'
import { createMcpRuntime, type McpMessage, type McpRuntimeOptions } from '../runtime/McpRuntime'

interface McpRuntimeContextValue {
  serverUrl: string
  setServerUrl: (url: string) => void
  apiKey?: string
  setApiKey: (key?: string) => void
  onToolCall?: (toolCall: { id: string, name: string, arguments: Record<string, unknown> }) => Promise<'approved' | 'rejected'>
  setOnToolCall: (callback?: (toolCall: { id: string, name: string, arguments: Record<string, unknown> }) => Promise<'approved' | 'rejected'>) => void
}

const McpRuntimeContext = createContext<McpRuntimeContextValue | null>(null)

export const useMcpRuntime = () => {
  const context = useContext(McpRuntimeContext)
  if (!context) {
    throw new Error('useMcpRuntime must be used within McpRuntimeProvider')
  }
  return context
}

interface McpRuntimeProviderProps {
  children: React.ReactNode
  defaultServerUrl?: string
  defaultApiKey?: string
  initialMessages?: McpMessage[]
}

export const McpRuntimeProvider: React.FC<McpRuntimeProviderProps> = ({
  children,
  defaultServerUrl = 'https://mcp.keyboard.dev',
  defaultApiKey,
  initialMessages,
}) => {
  const [serverUrl, setServerUrl] = useState(defaultServerUrl)
  const [apiKey, setApiKey] = useState(defaultApiKey)
  const [onToolCall, setOnToolCall] = useState<
    ((toolCall: { id: string, name: string, arguments: Record<string, unknown> }) => Promise<'approved' | 'rejected'>) | undefined
  >()

  const runtime = useMemo(() => {
    const options: McpRuntimeOptions = {
      serverUrl,
      apiKey,
      initialMessages,
      onToolCall,
    }
    return createMcpRuntime(options)
  }, [serverUrl, apiKey, initialMessages, onToolCall])

  const contextValue = useMemo(
    () => ({
      serverUrl,
      setServerUrl,
      apiKey,
      setApiKey,
      onToolCall,
      setOnToolCall: useCallback((callback?: (toolCall: { id: string, name: string, arguments: Record<string, unknown> }) => Promise<'approved' | 'rejected'>) => {
        setOnToolCall(() => callback)
      }, []),
    }),
    [serverUrl, apiKey, onToolCall],
  )

  return (
    <McpRuntimeContext.Provider value={contextValue}>
      <AssistantRuntimeProvider runtime={runtime}>
        {children}
      </AssistantRuntimeProvider>
    </McpRuntimeContext.Provider>
  )
}
