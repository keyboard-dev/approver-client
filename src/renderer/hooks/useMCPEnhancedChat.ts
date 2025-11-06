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

export interface MCPEnhancedChatState {
  // Adapter state
  adapter: AIChatAdapter
  
  // MCP state
  mcpEnabled: boolean
  mcpConnected: boolean
  mcpTools: number
  mcpError?: string
  
  // Control functions
  setMCPEnabled: (enabled: boolean) => void
  refreshMCPConnection: () => void
}

/**
 * Enhanced chat hook that bridges AI Chat Adapter with MCP Tool Integration
 * Manages the connection between AI providers and MCP tools
 */
export function useMCPEnhancedChat(config: MCPEnhancedChatConfig): MCPEnhancedChatState {
  const [adapter] = useState(() => new AIChatAdapter(config.provider, config.model, config.mcpEnabled))
  const [mcpEnabled, setMCPEnabledState] = useState(config.mcpEnabled)

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
    } else {
      adapter.setMCPIntegration(null)
    }
  }, [adapter, mcpEnabled, mcpIntegration])

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
    mcpTools: mcpIntegration.tools?.length || 0,
    mcpError: mcpIntegration.error,
    setMCPEnabled,
    refreshMCPConnection,
  }
}