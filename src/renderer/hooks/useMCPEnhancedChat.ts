import { useCallback, useEffect, useState } from 'react'
import { AIChatAdapter } from '../services/ai-chat-adapter'
import { useMCPIntegration } from '../services/mcp-tool-integration'

export interface MCPEnhancedChatConfig {
  provider: string
  model: string
  mcpEnabled: boolean
  serverUrl?: string
  clientName?: string
}

export interface AgenticProgress {
  step: number
  totalSteps: number
  currentAction: string
  isComplete: boolean
  intermediateMessages?: AbilityMessage[]
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

  // Ability execution state
  isExecutingAbility: boolean
  currentAbility?: string
  executions: AbilityExecution[]

  // Agentic state
  isAgenticMode: boolean
  agenticProgress?: AgenticProgress

  // Control functions
  setMCPEnabled: (enabled: boolean) => void
  refreshMCPConnection: () => void
  setAbilityExecutionState: (isExecuting: boolean, abilityName?: string) => void
  setAgenticMode: (enabled: boolean) => void

  // Execution tracking functions
  addExecution: (abilityName: string, parameters: Record<string, unknown>, provider?: string) => string
  updateExecution: (id: string, updates: Partial<AbilityExecution>) => void
  clearExecutions: () => void
  abilityMessages: AbilityMessage[]
  addAbilityMessage: (message: Omit<AbilityMessage, 'id' | 'timestamp'>) => void
  clearAbilityMessages: () => void
}

/**
 * Enhanced chat hook that bridges AI Chat Adapter with MCP Tool Integration
 * Manages the connection between AI providers and MCP tools
 */
export function useMCPEnhancedChat(config: MCPEnhancedChatConfig): MCPEnhancedChatState {
  const [adapter] = useState(() => new AIChatAdapter(config.provider, config.model, config.mcpEnabled))
  const [mcpEnabled, setMCPEnabledState] = useState(config.mcpEnabled)
  const [isExecutingAbility, setIsExecutingAbility] = useState(false)
  const [currentAbility, setCurrentAbility] = useState<string | undefined>()
  const [isAgenticMode, setAgenticModeState] = useState(true) // Default to agentic mode
  const [agenticProgress, setAgenticProgress] = useState<AgenticProgress | undefined>()
  const [executions, setExecutions] = useState<AbilityExecution[]>([])

  // Simple ability execution state management
  // The adapter will call these functions directly during ability execution
  const setAbilityExecutionState = useCallback((isExecuting: boolean, abilityName?: string) => {
    setIsExecutingAbility(isExecuting)
    setCurrentAbility(abilityName)
  }, [])

  // Agentic progress tracking
  const handleTaskProgress = useCallback((progress: AgenticProgress) => {
    setAgenticProgress(progress)
    if (progress.isComplete) {
      // Clear progress after a delay when complete
      setTimeout(() => setAgenticProgress(undefined), 3000)
    }
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
      metadata: {
        isLocalExecution: abilityName === 'web-search',
        intercepted: abilityName === 'web-search',
      },
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

  // Control agentic mode
  const setAgenticMode = useCallback((enabled: boolean) => {
    setAgenticModeState(enabled)
    if (!enabled) {
      setAgenticProgress(undefined)
    }
  }, [])

  // Initialize MCP integration when enabled
  const mcpIntegration = useMCPIntegration(
    config.serverUrl || 'https://mcp.keyboard.dev',
    config.clientName || 'keyboard-approver-mcp',
    { addExecution, updateExecution },
  )

  // Update adapter when provider/model/MCP settings change
  useEffect(() => {
    adapter.setProvider(config.provider, config.model, mcpEnabled)
  }, [adapter, config.provider, config.model, mcpEnabled])

  // Connect adapter with MCP integration when both are ready
  useEffect(() => {
    if (mcpEnabled && mcpIntegration.isConnected) {
      adapter.setMCPIntegration(mcpIntegration)
      adapter.setToolExecutionTracker(setAbilityExecutionState)
      adapter.setTaskProgressTracker(handleTaskProgress)
    }
    else {
      adapter.setMCPIntegration(null)
    }
  }, [adapter, mcpEnabled, mcpIntegration, setAbilityExecutionState, handleTaskProgress])

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

  return {
    adapter,
    mcpEnabled,
    mcpConnected: mcpEnabled ? mcpIntegration.isConnected : false,
    mcpAbilities: mcpIntegration.abilities?.length || 0,
    mcpError: mcpIntegration.error,
    isExecutingAbility,
    currentAbility,
    executions,
    isAgenticMode,
    agenticProgress,
    setMCPEnabled,
    refreshMCPConnection,
    setAbilityExecutionState, // Expose for adapter to call
    setAgenticMode,
    addExecution,
    updateExecution,
    clearExecutions,
  }
}
