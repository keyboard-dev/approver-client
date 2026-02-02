import { AssistantRuntimeProvider, useLocalRuntime } from '@assistant-ui/react'
import React, { useEffect, useState } from 'react'
import { Message } from '../../types'
import { useAuth } from '../hooks/useAuth'
import { useMCPEnhancedChat } from '../hooks/useMCPEnhancedChat'
import { useWebSocketConnection } from '../hooks/useWebSocketConnection'
import { AgenticStatusIndicator } from './AgenticStatusIndicator'
import { Thread } from './assistant-ui/thread'
import { ThreadTracker } from './assistant-ui/ThreadTracker'
import { MCPChatComponent } from './MCPChatComponent'
import { TooltipProvider } from './ui/tooltip'

interface AssistantUIChatProps {
  currentApprovalMessage?: Message
  onApproveMessage?: (message: Message) => void
  onRejectMessage?: (message: Message) => void
  onClearApprovalMessage?: () => void
}

interface ProviderConfig {
  id: string
  name: string
  models: Array<{ id: string, name: string }>
  supportsMCP?: boolean
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'keyboard',
    name: 'Keyboard (Default)',
    supportsMCP: true,
    models: [
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude 4.5 Sonnet (Default)' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude 4.5 Haiku (Fastest)' },
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    supportsMCP: true,
    models: [
      { id: 'gpt-4', name: 'GPT-4' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    supportsMCP: true,
    models: [
      { id: 'claude-sonnet-4-5', name: 'Claude 4.5 Sonnet (Recommended)' },
      { id: 'claude-haiku-4-5', name: 'Claude 4.5 Haiku (Fastest)' },
      { id: 'claude-opus-4-1', name: 'Claude 4.1 Opus (Advanced)' },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    supportsMCP: true,
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-pro', name: 'Gemini Pro' },
    ],
  },
  {
    id: 'mcp',
    name: 'MCP Server (Legacy)',
    supportsMCP: false,
    models: [
      { id: 'mcp-tools', name: 'MCP Tools & Resources' },
    ],
  },
]

const AssistantUIChatContent: React.FC<AssistantUIChatProps> = ({
  currentApprovalMessage,
  onApproveMessage,
  onRejectMessage,
  onClearApprovalMessage,
}) => {
  const [selectedProvider, setSelectedProvider] = useState('keyboard')
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-5-20250929')
  const mcpEnabled = true // Always enabled
  const [availableProviders, setAvailableProviders] = useState<string[]>([])

  // Auth and WebSocket connection management
  const { authStatus, isSkippingAuth } = useAuth()

  // Auto-connect to codespace when assistant chat opens
  const { connectToBestCodespace, connectionStatus } = useWebSocketConnection(authStatus, isSkippingAuth)

  // Initialize MCP enhanced chat
  const mcpChat = useMCPEnhancedChat({
    provider: selectedProvider,
    model: selectedModel,
    mcpEnabled,
  })

  // Load available providers on mount
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const providerStatus = await window.electronAPI.getAIProviderKeys()
        const configured = providerStatus
          .filter(p => p.configured)
          .map(p => p.provider)

        // Always include Keyboard and MCP as they don't require traditional API keys
        const allAvailable = ['keyboard', ...configured, 'mcp']
        setAvailableProviders(allAvailable)

        // Set default to first available provider
        if (allAvailable.length > 0 && !allAvailable.includes(selectedProvider)) {
          setSelectedProvider(allAvailable[0])
          const provider = PROVIDERS.find(p => p.id === allAvailable[0])
          if (provider?.models[0]) {
            setSelectedModel(provider.models[0].id)
          }
        }
      }
      catch (error) {
        setAvailableProviders(['mcp'])
        setSelectedProvider('mcp')
        setSelectedModel('mcp-tools')
      }
    }
    loadProviders()
  }, [selectedProvider])

  // Set MCP to always enabled and auto-connect to codespace
  useEffect(() => {
    mcpChat.setMCPEnabled(true)
    mcpChat.setAgenticMode(true)
  }, [mcpChat])

  useEffect(() => {
    const tryConnect = async () => {
      if (connectionStatus === 'disconnected') {
        try {
          await connectToBestCodespace()
        }
        catch (error) {
        }
      }
    }
    tryConnect()
  }, [mcpEnabled])

  // Auto-connect to codespace with retry functionality
  useEffect(() => {
    const tryConnect = async () => {
      if ((authStatus.authenticated || isSkippingAuth) && connectionStatus === 'disconnected') {
        try {
          await connectToBestCodespace()
        }
        catch (error) {
        }
      }
    }

    // Initial connection attempt
    tryConnect()

    // Set up retry interval for persistent connection attempts
    const retryInterval = setInterval(() => {
      if (connectionStatus === 'disconnected' && (authStatus.authenticated || isSkippingAuth)) {
        tryConnect()
      }
    }, 10000) // Retry every 10 seconds when disconnected

    return () => {
      clearInterval(retryInterval)
    }
  }, [authStatus.authenticated, isSkippingAuth, connectionStatus, connectToBestCodespace])

  const runtime = useLocalRuntime(mcpChat.adapter)

  // Handler for provider change
  const handleProviderChange = (providerId: string, defaultModelId?: string) => {
    setSelectedProvider(providerId)
    if (defaultModelId) {
      setSelectedModel(defaultModelId)
    }
  }

  return (
    <TooltipProvider>
      <AssistantRuntimeProvider runtime={runtime}>
        {/* Track current thread for approval message association */}
        <ThreadTracker />
        <div className="w-full h-full flex flex-col overflow-hidden">
          {selectedProvider === 'mcp'
            ? (
                <MCPChatComponent
                  serverUrl="https://mcp.keyboard.dev"
                  clientName="keyboard-approver-mcp"
                />
              )
            : (
                <div className="flex flex-col h-full">
                  {/* Agentic Status Indicator - only shown when actively working */}
                  {mcpEnabled && (mcpChat.isExecutingAbility || mcpChat.agenticProgress) && (
                    <div className="mb-2 px-4">
                      <AgenticStatusIndicator
                        isAgenticMode={mcpChat.isAgenticMode}
                        agenticProgress={mcpChat.agenticProgress}
                        isExecutingAbility={mcpChat.isExecutingAbility}
                        currentAbility={mcpChat.currentAbility}
                      />
                    </div>
                  )}

                  <div className="flex-1 flex flex-col min-h-0">
                    <Thread
                      currentApprovalMessage={currentApprovalMessage}
                      onApproveMessage={onApproveMessage}
                      onRejectMessage={onRejectMessage}
                      onClearMessage={onClearApprovalMessage}
                      // Provider/Model props
                      providers={PROVIDERS}
                      availableProviders={availableProviders}
                      selectedProvider={selectedProvider}
                      selectedModel={selectedModel}
                      onProviderChange={handleProviderChange}
                      onModelChange={setSelectedModel}
                      // MCP props
                      mcpConnected={mcpChat.mcpConnected}
                      mcpAbilities={mcpChat.mcpAbilities}
                      mcpError={mcpChat.mcpError}
                      onRetryMCP={mcpChat.refreshMCPConnection}
                    />
                  </div>
                </div>
              )}
        </div>
      </AssistantRuntimeProvider>
    </TooltipProvider>
  )
}

export const AssistantUIChat: React.FC<AssistantUIChatProps> = (props) => {
  return <AssistantUIChatContent {...props} />
}
