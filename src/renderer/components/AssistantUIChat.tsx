import { AssistantRuntimeProvider, useLocalRuntime } from '@assistant-ui/react'
import React, { useEffect, useState } from 'react'
import { Message, Script } from '../../types'
import { useAuth } from '../hooks/useAuth'
import { useMCPEnhancedChat } from '../hooks/useMCPEnhancedChat'
import { useWebSocketConnection } from '../hooks/useWebSocketConnection'
import { AbilityExecutionPanel } from './AbilityExecutionPanel'
import { AgenticStatusIndicator } from './AgenticStatusIndicator'
import { Thread } from './assistant-ui/thread'
import { MCPChatComponent } from './MCPChatComponent'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader } from './ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { TooltipProvider } from './ui/tooltip'

interface AssistantUIChatProps {
  onBack: () => void
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
  onBack,
  currentApprovalMessage,
  onApproveMessage,
  onRejectMessage,
  onClearApprovalMessage,
}) => {
  const [selectedProvider, setSelectedProvider] = useState('keyboard')
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-5-20250929')
  const mcpEnabled = true // Always enabled
  const [availableProviders, setAvailableProviders] = useState<string[]>([])
  const [showExecutionPanel, setShowExecutionPanel] = useState(false)

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
        console.error('Failed to load provider status:', error)
        // Fallback to MCP if other providers fail
        setAvailableProviders(['mcp'])
        setSelectedProvider('mcp')
        setSelectedModel('mcp-tools')
      }
    }
    loadProviders()
  }, [selectedProvider])

  // Get current provider config
  const currentProvider = PROVIDERS.find(p => p.id === selectedProvider)

  // Set MCP to always enabled and auto-connect to codespace
  useEffect(() => {
    mcpChat.setMCPEnabled(true)
    mcpChat.setAgenticMode(true)
  }, [mcpChat])

  useEffect(() => {
    const tryConnect = async () => {
      if (connectionStatus === 'disconnected') {
        try {
          console.log('🔄 Attempting to auto-connect to codespace...')
          await connectToBestCodespace()
        }
        catch (error) {
          console.error('Failed to connect to codespace:', error)
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
          console.log('🔄 Attempting to auto-connect to codespace...')
          await connectToBestCodespace()
        }
        catch (error) {
          console.error('Failed to connect to codespace:', error)
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

  return (
    <TooltipProvider>
      <AssistantRuntimeProvider runtime={runtime}>
        <Card className="w-full h-full flex flex-col overflow-hidden">
          <CardHeader className="pb-3">
            {/* Compact single-row header */}
            <div className="flex items-center justify-between gap-3">
              <Button variant="outline" size="sm" onClick={onBack}>
                ← Back
              </Button>

              <div className="flex items-center gap-3 flex-1">
                {/* Provider Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={availableProviders.length === 0}>
                      <span className="text-xs font-medium">
                        {currentProvider?.name || 'Provider'}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {PROVIDERS
                      .filter(p => availableProviders.includes(p.id))
                      .map(provider => (
                        <DropdownMenuItem
                          key={provider.id}
                          onClick={() => {
                            setSelectedProvider(provider.id)
                            if (provider.models[0]) {
                              setSelectedModel(provider.models[0].id)
                            }
                          }}
                        >
                          {provider.name}
                        </DropdownMenuItem>
                      ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Model Dropdown */}
                {currentProvider && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="max-w-[200px]">
                        <span className="text-xs font-medium truncate">
                          {currentProvider.models.find(m => m.id === selectedModel)?.name || 'Model'}
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      {currentProvider.models.map(model => (
                        <DropdownMenuItem
                          key={model.id}
                          onClick={() => setSelectedModel(model.id)}
                        >
                          {model.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                {selectedProvider === 'mcp' && (
                  <Badge variant="outline" className="text-xs">
                    🔌 MCP Legacy Mode
                  </Badge>
                )}

                {availableProviders.length === 0 && (
                  <Badge variant="destructive" className="text-xs">
                    No providers configured
                  </Badge>
                )}
              </div>

              {/* MCP Status & Controls */}
              {currentProvider?.supportsMCP && selectedProvider !== 'mcp' && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 bg-background border rounded-lg px-3 py-1.5">
                    <span className="text-xs font-medium">🚀</span>
                    {mcpChat.mcpConnected && (
                      <Badge variant="secondary" className="text-xs h-5">
                        {mcpChat.mcpAbilities}
                      </Badge>
                    )}
                    {mcpChat.mcpConnected
                      ? (
                          <Badge variant="default" className="text-xs h-5 bg-green-100 text-green-800 border-0">
                            Connected
                          </Badge>
                        )
                      : mcpChat.mcpError
                        ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={mcpChat.refreshMCPConnection}
                              className="text-xs h-5 px-2"
                            >
                              Retry
                            </Button>
                          )
                        : (
                            <Badge variant="secondary" className="text-xs h-5">
                              Connecting...
                            </Badge>
                          )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowExecutionPanel(!showExecutionPanel)}
                    className="text-xs"
                  >
                    🔍
                    {' '}
                    {mcpChat.executions.length}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-6 min-h-0">
            <div className="flex-1 min-h-0 h-full">
              {selectedProvider === 'mcp'
                ? (
                    <MCPChatComponent
                      serverUrl="https://growing-goose-conversely.ngrok-free.appboard.dev"
                      clientName="keyboard-approver-mcp"
                    />
                  )
                : (
                    <div className="flex flex-col h-full">
                      {/* Agentic Status Indicator - only shown when actively working */}
                      {mcpEnabled && (mcpChat.isExecutingAbility || mcpChat.agenticProgress) && (
                        <div className="mb-2">
                          <AgenticStatusIndicator
                            isAgenticMode={mcpChat.isAgenticMode}
                            agenticProgress={mcpChat.agenticProgress}
                            isExecutingAbility={mcpChat.isExecutingAbility}
                            currentAbility={mcpChat.currentAbility}
                          />
                        </div>
                      )}

                      <div className="flex-1 flex flex-col gap-3 min-h-0">
                        <Thread
                          currentApprovalMessage={currentApprovalMessage}
                          onApproveMessage={onApproveMessage}
                          onRejectMessage={onRejectMessage}
                          onClearMessage={onClearApprovalMessage}
                        />
                      </div>
                    </div>
                  )}
            </div>
          </CardContent>
        </Card>
      </AssistantRuntimeProvider>

      {/* Ability Execution Panel - Fixed overlay */}
      <AbilityExecutionPanel
        executions={mcpChat.executions}
        isVisible={showExecutionPanel}
        onClose={() => setShowExecutionPanel(false)}
        currentStep={mcpChat.agenticProgress?.step}
        totalSteps={mcpChat.agenticProgress?.totalSteps}
        currentAction={mcpChat.agenticProgress?.currentAction}
      />
    </TooltipProvider>
  )
}

export const AssistantUIChat: React.FC<AssistantUIChatProps> = (props) => {
  return <AssistantUIChatContent {...props} />
}
