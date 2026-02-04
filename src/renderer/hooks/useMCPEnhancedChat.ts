import { useCallback, useEffect, useRef, useState } from 'react'
import { Script } from '../../types'
import { AIChatAdapter, ConnectionCheckResult, MissingConnectionInfo } from '../services/ai-chat-adapter'
import { useMCPIntegration } from '../services/mcp-tool-integration'
import { currentThreadRef } from '../components/screens/ChatPage'

// =============================================================================
// Thread-scoped Connection Requirements Storage
// =============================================================================

const THREAD_CONNECTIONS_KEY = 'keyboard_thread_connection_requirements'

interface ThreadConnectionRequirements {
  threadId: string
  missingConnections: MissingConnectionInfo[]
  timestamp: number
}

function getThreadConnectionRequirements(threadId: string): MissingConnectionInfo[] | null {
  try {
    const stored = localStorage.getItem(THREAD_CONNECTIONS_KEY)
    if (!stored) return null

    const data = JSON.parse(stored) as Record<string, ThreadConnectionRequirements>
    const threadData = data[threadId]

    // Expire after 1 hour
    if (threadData && Date.now() - threadData.timestamp < 60 * 60 * 1000) {
      return threadData.missingConnections
    }
    return null
  }
  catch {
    return null
  }
}

function setThreadConnectionRequirements(threadId: string, connections: MissingConnectionInfo[]): void {
  try {
    const stored = localStorage.getItem(THREAD_CONNECTIONS_KEY)
    const data: Record<string, ThreadConnectionRequirements> = stored ? JSON.parse(stored) : {}

    if (connections.length === 0) {
      // Remove entry if no connections
      delete data[threadId]
    }
    else {
      data[threadId] = {
        threadId,
        missingConnections: connections,
        timestamp: Date.now(),
      }
    }

    // Clean up old entries (older than 1 hour)
    const now = Date.now()
    for (const key of Object.keys(data)) {
      if (now - data[key].timestamp > 60 * 60 * 1000) {
        delete data[key]
      }
    }

    localStorage.setItem(THREAD_CONNECTIONS_KEY, JSON.stringify(data))
  }
  catch {
    // Ignore localStorage errors
  }
}

function clearThreadConnectionRequirements(threadId: string): void {
  setThreadConnectionRequirements(threadId, [])
}

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

  // Connection requirements state
  missingConnections: MissingConnectionInfo[]
  showConnectionPrompt: boolean

  // Control functions
  setMCPEnabled: (enabled: boolean) => void
  refreshMCPConnection: () => void
  setAbilityExecutionState: (isExecuting: boolean, abilityName?: string) => void
  setAgenticMode: (enabled: boolean) => void
  setSelectedScripts: (scripts: Script[]) => void
  setThreadTitleCallback: (callback: (title: string) => void) => void

  // Connection requirements functions
  clearConnectionPrompt: () => void
  skipConnectionCheckOnce: () => void
  getContinuationMessage: () => Promise<string | null>

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
  const [scripts, setScripts] = useState<Script[]>([])

  // Connection requirements state (thread-scoped)
  const [missingConnections, setMissingConnections] = useState<MissingConnectionInfo[]>([])
  const [showConnectionPrompt, setShowConnectionPrompt] = useState(false)
  const lastThreadIdRef = useRef<string | null>(null)

  // Ability messages state
  const [abilityMessages, setAbilityMessages] = useState<AbilityMessage[]>([])

  // Track thread changes and clear/restore connection prompt accordingly
  useEffect(() => {
    const checkThreadChange = () => {
      const currentThreadId = currentThreadRef.threadId

      if (currentThreadId && currentThreadId !== lastThreadIdRef.current) {
        // Thread changed - clear current prompt and check if new thread has saved requirements
        const previousThreadId = lastThreadIdRef.current
        lastThreadIdRef.current = currentThreadId

        // Save current requirements to old thread (if any)
        if (previousThreadId && missingConnections.length > 0) {
          setThreadConnectionRequirements(previousThreadId, missingConnections)
        }

        // Check if new thread has saved requirements
        const savedRequirements = getThreadConnectionRequirements(currentThreadId)
        if (savedRequirements && savedRequirements.length > 0) {
          setMissingConnections(savedRequirements)
          setShowConnectionPrompt(true)
        }
        else {
          // Clear prompt for new thread
          setMissingConnections([])
          setShowConnectionPrompt(false)
        }
      }
    }

    // Check immediately
    checkThreadChange()

    // Poll for thread changes (since currentThreadRef is a mutable ref)
    const interval = setInterval(checkThreadChange, 500)
    return () => clearInterval(interval)
  }, [missingConnections])

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

  // Set selected scripts
  const setSelectedScripts = useCallback((scripts: Script[]) => {
    setScripts(scripts)
    adapter.setSelectedScripts(scripts)
  }, [adapter])

  // Set thread title callback
  const setThreadTitleCallback = useCallback((callback: (title: string) => void) => {
    adapter.setThreadTitleCallback(callback)
  }, [adapter])

  // Connection requirements callback (saves to current thread)
  const handleMissingConnections = useCallback((result: ConnectionCheckResult) => {
    setMissingConnections(result.missingConnections)
    setShowConnectionPrompt(result.missingConnections.length > 0)

    // Save to localStorage for the current thread
    const currentThreadId = currentThreadRef.threadId
    if (currentThreadId) {
      setThreadConnectionRequirements(currentThreadId, result.missingConnections)
    }
  }, [])

  // Clear connection prompt (also clears from localStorage for current thread)
  const clearConnectionPrompt = useCallback(() => {
    setMissingConnections([])
    setShowConnectionPrompt(false)

    // Clear from localStorage for the current thread
    const currentThreadId = currentThreadRef.threadId
    if (currentThreadId) {
      clearThreadConnectionRequirements(currentThreadId)
    }
  }, [])

  // Skip connection check once (for "continue anyway" flow)
  const skipConnectionCheckOnce = useCallback(() => {
    adapter.setSkipConnectionCheck(true)
    setMissingConnections([])
    setShowConnectionPrompt(false)

    // Clear from localStorage for the current thread
    const currentThreadId = currentThreadRef.threadId
    if (currentThreadId) {
      clearThreadConnectionRequirements(currentThreadId)
    }
  }, [adapter])

  // Get continuation message for "continue anyway" flow
  const getContinuationMessage = useCallback(async (): Promise<string | null> => {
    const originalMessage = adapter.getLastConnectionCheckMessage()
    if (!originalMessage) return null

    // Skip connection check on next run
    adapter.setSkipConnectionCheck(true)
    adapter.clearLastConnectionCheckMessage()

    // Clear the prompt
    setMissingConnections([])
    setShowConnectionPrompt(false)
    const currentThreadId = currentThreadRef.threadId
    if (currentThreadId) {
      clearThreadConnectionRequirements(currentThreadId)
    }

    // Fetch connected accounts to provide context
    let connectedAccountsContext = ''
    try {
      const [pipedreamResponse, composioResponse, localStatus] = await Promise.all([
        window.electronAPI?.fetchPipedreamAccountsDetailed?.().catch(() => null),
        window.electronAPI?.listComposioConnectedAccounts?.().catch(() => null),
        window.electronAPI?.getProviderAuthStatus?.().catch(() => ({})),
      ])

      const connectedApps: string[] = []

      // Pipedream accounts
      if (pipedreamResponse?.success && pipedreamResponse?.data) {
        const accounts = (pipedreamResponse.data as { accounts?: Array<{ app: { name: string } }> }).accounts || []
        connectedApps.push(...accounts.map(a => a.app.name))
      }

      // Composio accounts
      if (composioResponse?.success && composioResponse?.data) {
        const items = (composioResponse.data as { items?: Array<{ appName?: string, status: string }> }).items || []
        connectedApps.push(...items.filter(a => a.status === 'ACTIVE').map(a => a.appName || 'Unknown'))
      }

      // Local providers
      if (localStatus) {
        const authenticated = Object.entries(localStatus as Record<string, { authenticated?: boolean }>)
          .filter(([_, status]) => status?.authenticated)
          .map(([provider]) => provider)
        connectedApps.push(...authenticated)
      }

      if (connectedApps.length > 0) {
        connectedAccountsContext = `\n\n**Note:** I'll proceed with your available connected services: ${[...new Set(connectedApps)].join(', ')}.`
      }
    }
    catch {
      // Ignore errors fetching connected accounts
    }

    return `${originalMessage}${connectedAccountsContext}`
  }, [adapter])

  // Set up connection requirements callback on adapter
  useEffect(() => {
    adapter.setMissingConnectionsCallback(handleMissingConnections)
  }, [adapter, handleMissingConnections])

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
    isExecutingAbility,
    currentAbility,
    executions,
    isAgenticMode,
    agenticProgress,
    // Connection requirements state
    missingConnections,
    showConnectionPrompt,
    // Control functions
    setMCPEnabled,
    refreshMCPConnection,
    setAbilityExecutionState, // Expose for adapter to call
    setAgenticMode,
    setSelectedScripts,
    setThreadTitleCallback,
    // Connection requirements functions
    clearConnectionPrompt,
    skipConnectionCheckOnce,
    getContinuationMessage,
    // Execution tracking
    addExecution,
    updateExecution,
    clearExecutions,
    // Ability messages
    abilityMessages,
    addAbilityMessage,
    clearAbilityMessages,
  }
}
