import { useState, useEffect, useCallback } from 'react'
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
  
  // Agentic state
  isAgenticMode: boolean
  agenticProgress?: AgenticProgress
  
  // Control functions
  setMCPEnabled: (enabled: boolean) => void
  refreshMCPConnection: () => void
  setAbilityExecutionState: (isExecuting: boolean, abilityName?: string) => void
  setAgenticMode: (enabled: boolean) => void
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
    config.clientName || 'keyboard-approver-mcp'
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
    } else {
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
    isAgenticMode,
    agenticProgress,
    setMCPEnabled,
    refreshMCPConnection,
    setAbilityExecutionState, // Expose for adapter to call
    setAgenticMode,
  }
}