import { AssistantRuntimeProvider, useLocalRuntime } from '@assistant-ui/react'
import React, { useEffect, useMemo, useState } from 'react'
import { Message } from '../../types'
import { useAuth } from '../hooks/useAuth'
import { useMCPEnhancedChat } from '../hooks/useMCPEnhancedChat'
import { useWebSocketConnection } from '../hooks/useWebSocketConnection'
import { McpClientProvider } from '../services/mcp-client-context'
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

interface OrgProviderData {
  configured: boolean
  provider_type?: string
  display_name?: string
  is_active?: boolean
  allowed_models?: string[] | null
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'keyboard',
    name: 'Keyboard (default)',
    supportsMCP: true,
    models: [
      { id: 'claude-sonnet-4-6', name: 'Claude 4.6 Sonnet (default)' },
      { id: 'claude-opus-4-6', name: 'Claude 4.6 Opus (advanced)' },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude 4.5 Haiku (fastest)' },
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
      { id: 'claude-sonnet-4-6', name: 'Claude 4.6 Sonnet (recommended)' },
      { id: 'claude-opus-4-6', name: 'Claude 4.6 Opus (advanced)' },
      { id: 'claude-haiku-4-5', name: 'Claude 4.5 Haiku (fastest)' },
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
]

const AssistantUIChatContent: React.FC<AssistantUIChatProps> = ({
  currentApprovalMessage,
  onApproveMessage,
  onRejectMessage,
  onClearApprovalMessage,
}) => {
  const [selectedProvider, setSelectedProvider] = useState('keyboard')
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-6')
  const mcpEnabled = true // Always enabled
  const [availableProviders, setAvailableProviders] = useState<string[]>([])
  const [orgProvider, setOrgProvider] = useState<OrgProviderData | null>(null)
  const [dynamicProviders, setDynamicProviders] = useState<ProviderConfig[]>(PROVIDERS)

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
        // Fetch org provider and personal API keys in parallel
        const [orgResult, providerStatus] = await Promise.all([
          window.electronAPI.getOrgAIProvider().catch(() => ({ success: false, data: null })),
          window.electronAPI.getAIProviderKeys(),
        ])

        const orgData = orgResult.success && orgResult.data ? orgResult.data : null
        setOrgProvider(orgData)

        if (orgData?.configured && orgData.allowed_models?.length) {
          // Org provider is configured with allowed models — use those
          const orgKeyboardProvider: ProviderConfig = {
            id: 'keyboard',
            name: orgData.display_name || 'Organization Provider',
            supportsMCP: true,
            models: orgData.allowed_models.map(modelId => ({ id: modelId, name: modelId })),
          }
          setDynamicProviders([orgKeyboardProvider])
          setAvailableProviders(['keyboard'])
          setSelectedProvider('keyboard')
          setSelectedModel(orgData.allowed_models[0])
        }
        else {
          // No org provider — use personal API keys as before
          const configured = providerStatus
            .filter(p => p.configured)
            .map(p => p.provider)

          const allAvailable = ['keyboard', ...configured, 'mcp']
          setDynamicProviders(PROVIDERS)
          setAvailableProviders(allAvailable)

          if (allAvailable.length > 0 && !allAvailable.includes(selectedProvider)) {
            setSelectedProvider(allAvailable[0])
            const provider = PROVIDERS.find(p => p.id === allAvailable[0])
            if (provider?.models[0]) {
              setSelectedModel(provider.models[0].id)
            }
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
  }, [])

  // Set MCP to always enabled and auto-connect to codespace
  useEffect(() => {
    mcpChat.setMCPEnabled(true)
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

  // MCP Apps host context value
  const mcpClientContextValue = useMemo(() => ({
    callTool: mcpChat.mcpCallTool,
    readResource: mcpChat.mcpReadResource,
    toolResourceMap: mcpChat.toolResourceMap,
  }), [mcpChat.mcpCallTool, mcpChat.mcpReadResource, mcpChat.toolResourceMap])

  // Handler for provider change
  const handleProviderChange = (providerId: string, defaultModelId?: string) => {
    setSelectedProvider(providerId)
    if (defaultModelId) {
      setSelectedModel(defaultModelId)
    }
  }

  return (
    <TooltipProvider>
      <McpClientProvider value={mcpClientContextValue}>
        <AssistantRuntimeProvider runtime={runtime}>
          {/* Track current thread for approval message association and title generation */}
          <ThreadTracker onTitleCallbackReady={mcpChat.setThreadTitleCallback} />
          <div className="w-full h-full flex flex-col overflow-hidden">
            {selectedProvider === 'mcp'
              ? (
                  <MCPChatComponent
                    clientName="keyboard-approver-mcp"
                  />
                )
              : (
                  <div className="flex flex-col h-full">
                    <div className="flex-1 flex flex-col min-h-0">
                      <Thread
                        currentApprovalMessage={currentApprovalMessage}
                        onApproveMessage={onApproveMessage}
                        onRejectMessage={onRejectMessage}
                        onClearMessage={onClearApprovalMessage}
                        // Provider/Model props
                        providers={dynamicProviders}
                        availableProviders={availableProviders}
                        selectedProvider={selectedProvider}
                        selectedModel={selectedModel}
                        onProviderChange={handleProviderChange}
                        onModelChange={setSelectedModel}
                        // Org provider
                        orgProvider={orgProvider}
                        // Thinking mode
                        thinkingEnabled={mcpChat.thinkingEnabled}
                        onThinkingChange={mcpChat.setThinkingEnabled}
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
      </McpClientProvider>
    </TooltipProvider>
  )
}

export const AssistantUIChat: React.FC<AssistantUIChatProps> = (props) => {
  return <AssistantUIChatContent {...props} />
}
