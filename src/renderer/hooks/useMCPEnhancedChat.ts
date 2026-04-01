import type { CallToolResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Script } from '../../types'
import { currentThreadRef } from '../components/screens/ChatPage'
import { AIChatAdapter } from '../services/ai-chat-adapter'
import { useMCPIntegration } from '../services/mcp-tool-integration'
import { runCodeResultContext } from '../services/run-code-result-context'

export interface MCPEnhancedChatConfig {
  provider: string
  model: string
  mcpEnabled: boolean
  serverUrl?: string
  clientName?: string
}

export interface AbilityMessage {
  id: string
  type: 'status' | 'result' | 'error' | 'progress'
  content: string
  timestamp: number
  abilityName?: string
  data?: any
}

export interface AbilityExecution {
  id: string
  abilityName: string
  status: 'executing' | 'success' | 'error'
  startTime: number
  endTime?: number
  duration?: number
  parameters: Record<string, unknown>
  response?: any
  error?: string
  provider?: string
  metadata?: {
    isLocalExecution?: boolean
    intercepted?: boolean
    [key: string]: any
  }
}

export interface MCPEnhancedChatState {
  // Adapter state
  adapter: AIChatAdapter

  // MCP state
  mcpEnabled: boolean
  mcpConnected: boolean
  mcpAbilities: number
  mcpError?: string

  // Thinking mode
  thinkingEnabled: boolean
  setThinkingEnabled: (enabled: boolean) => void

  // Ability execution state
  isExecutingAbility: boolean
  currentAbility?: string
  executions: AbilityExecution[]

  // Control functions
  setMCPEnabled: (enabled: boolean) => void
  refreshMCPConnection: () => void
  setAbilityExecutionState: (isExecuting: boolean, abilityName?: string) => void
  setSelectedScripts: (scripts: Script[]) => void
  setThreadTitleCallback: (callback: (title: string) => void) => void

  // Execution tracking functions
  addExecution: (abilityName: string, parameters: Record<string, unknown>, provider?: string) => string
  updateExecution: (id: string, updates: Partial<AbilityExecution>) => void
  clearExecutions: () => void
  abilityMessages: AbilityMessage[]
  addAbilityMessage: (message: Omit<AbilityMessage, 'id' | 'timestamp'>) => void
  clearAbilityMessages: () => void

  // MCP Apps host support
  mcpCallTool: (name: string, args?: Record<string, unknown>) => Promise<CallToolResult>
  mcpReadResource: (uri: string) => Promise<ReadResourceResult>
  toolResourceMap: Map<string, string>
}

/**
 * Enhanced chat hook that bridges AI Chat Adapter with MCP Tool Integration
 * Manages the connection between AI providers and MCP tools
 */
export function useMCPEnhancedChat(config: MCPEnhancedChatConfig): MCPEnhancedChatState {
  const [adapter] = useState(() => new AIChatAdapter(config.provider, config.model, config.mcpEnabled))
  const [mcpEnabled, setMCPEnabledState] = useState(config.mcpEnabled)
  const [thinkingEnabled, setThinkingEnabledState] = useState(false)
  const [isExecutingAbility, setIsExecutingAbility] = useState(false)
  const [currentAbility, setCurrentAbility] = useState<string | undefined>()
  const [executions, setExecutions] = useState<AbilityExecution[]>([])
  const [scripts, setScripts] = useState<Script[]>([])

  const lastThreadIdRef = useRef<string | null>(null)

  // Ability messages state
  const [abilityMessages, setAbilityMessages] = useState<AbilityMessage[]>([])

  // Clear run-code result context when switching threads
  useEffect(() => {
    const checkThreadChange = () => {
      const currentThreadId = currentThreadRef.threadId

      if (currentThreadId && currentThreadId !== lastThreadIdRef.current) {
        lastThreadIdRef.current = currentThreadId
        runCodeResultContext.clearResults()
        adapter.resetTitleGeneration()
      }
    }

    checkThreadChange()
    const interval = setInterval(checkThreadChange, 500)
    return () => clearInterval(interval)
  }, [])

  // Simple ability execution state management
  // The adapter will call these functions directly during ability execution
  const setAbilityExecutionState = useCallback((isExecuting: boolean, abilityName?: string) => {
    setIsExecutingAbility(isExecuting)
    setCurrentAbility(abilityName)
  }, [])

  // Execution tracking functions
  const addExecution = useCallback((abilityName: string, parameters: Record<string, unknown>, provider?: string): string => {
    const id = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    const execution: AbilityExecution = {
      id,
      abilityName,
      status: 'executing',
      startTime: Date.now(),
      parameters,
      provider,
      metadata: {},
    }

    setExecutions((prev) => {
      // Keep only the last 50 executions to prevent memory bloat
      const updated = [execution, ...prev].slice(0, 50)
      return updated
    })

    return id
  }, [])

  const updateExecution = useCallback((id: string, updates: Partial<AbilityExecution>) => {
    setExecutions(prev => prev.map((exec) => {
      if (exec.id === id) {
        const updated = { ...exec, ...updates }
        // Calculate duration if ending
        if (updates.status !== 'executing' && !updated.endTime) {
          updated.endTime = Date.now()
          updated.duration = updated.endTime - updated.startTime
        }
        return updated
      }
      return exec
    }))
  }, [])

  const clearExecutions = useCallback(() => {
    setExecutions([])
  }, [])

  // Resolve MCP server URL from main process (supports MCP_SERVER_URL env var)
  // Initialize as null to prevent connecting to wrong server before IPC resolves
  const [resolvedServerUrl, setResolvedServerUrl] = useState<string | null>(config.serverUrl || null)
  useEffect(() => {
    if (!config.serverUrl) {
      window.electronAPI.getMcpServerUrl().then((url) => {
        setResolvedServerUrl(url)
      }).catch(() => {
        setResolvedServerUrl('https://mcp.keyboard.dev')
      })
    }
  }, [config.serverUrl])

  // Initialize MCP integration when enabled
  // Pass empty string when URL not yet resolved to prevent premature connection
  const mcpIntegration = useMCPIntegration(
    resolvedServerUrl || '',
    config.clientName || 'keyboard-approver-mcp',
    { addExecution, updateExecution },
  )

  // Build tool→resourceUri map from tools with _meta.ui.resourceUri (MCP Apps)
  const toolResourceMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const tool of mcpIntegration.abilities) {
      const meta = tool as { _meta?: { ui?: { resourceUri?: string } } }
      const uri = meta._meta?.ui?.resourceUri
      if (uri) {
        map.set(tool.name, uri)
      }
    }
    return map
  }, [mcpIntegration.abilities])

  // Update adapter when provider/model/MCP settings change
  useEffect(() => {
    adapter.setProvider(config.provider, config.model, mcpEnabled)
  }, [adapter, config.provider, config.model, mcpEnabled])

  // Connect adapter with MCP integration when both are ready
  useEffect(() => {
    if (mcpEnabled && mcpIntegration.isConnected) {
      adapter.setMCPIntegration(mcpIntegration)
      adapter.setToolExecutionTracker(setAbilityExecutionState)
    }
    else {
      adapter.setMCPIntegration(null)
    }
  }, [adapter, mcpEnabled, mcpIntegration, setAbilityExecutionState])

  // Handle thinking mode toggle
  const setThinkingEnabled = useCallback((enabled: boolean) => {
    setThinkingEnabledState(enabled)
    adapter.setThinking(enabled ? { type: 'enabled', budget_tokens: 10000 } : undefined)
  }, [adapter])

  // Handle MCP enablement toggle
  const setMCPEnabled = useCallback((enabled: boolean) => {
    setMCPEnabledState(enabled)

    if (!enabled) {
      // Disconnect MCP integration when disabled
      adapter.setMCPIntegration(null)
    }
  }, [adapter])

  // Refresh MCP connection
  const refreshMCPConnection = useCallback(() => {
    if (mcpIntegration.retry) {
      mcpIntegration.retry()
    }
  }, [mcpIntegration])

  // Set selected scripts
  const setSelectedScripts = useCallback((scripts: Script[]) => {
    setScripts(scripts)
    adapter.setSelectedScripts(scripts)
  }, [adapter])

  // Set thread title callback
  const setThreadTitleCallback = useCallback((callback: (title: string) => void) => {
    adapter.resetTitleGeneration()
    adapter.setThreadTitleCallback(callback)
  }, [adapter])

  // Ability message functions
  const addAbilityMessage = useCallback((message: Omit<AbilityMessage, 'id' | 'timestamp'>) => {
    const newMessage: AbilityMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: Date.now(),
    }
    setAbilityMessages(prev => [...prev, newMessage])
  }, [])

  const clearAbilityMessages = useCallback(() => {
    setAbilityMessages([])
  }, [])

  return {
    adapter,
    mcpEnabled,
    mcpConnected: mcpEnabled ? mcpIntegration.isConnected : false,
    mcpAbilities: mcpIntegration.abilities?.length || 0,
    mcpError: mcpIntegration.error,
    thinkingEnabled,
    setThinkingEnabled,
    isExecutingAbility,
    currentAbility,
    executions,
    // Control functions
    setMCPEnabled,
    refreshMCPConnection,
    setAbilityExecutionState, // Expose for adapter to call
    setSelectedScripts,
    setThreadTitleCallback,
    // Execution tracking
    addExecution,
    updateExecution,
    clearExecutions,
    // Ability messages
    abilityMessages,
    addAbilityMessage,
    clearAbilityMessages,
    // MCP Apps host support
    mcpCallTool: mcpIntegration.mcpCallTool,
    mcpReadResource: mcpIntegration.mcpReadResource,
    toolResourceMap,
  }
}
