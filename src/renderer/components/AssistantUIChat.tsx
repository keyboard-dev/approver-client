import { AssistantRuntimeProvider, useLocalRuntime } from '@assistant-ui/react'
import React, { useEffect, useState } from 'react'
import { Message } from '../../types'
import { useAuth } from '../hooks/useAuth'
import { useMCPEnhancedChat } from '../hooks/useMCPEnhancedChat'
import { useWebSocketConnection } from '../hooks/useWebSocketConnection'
import { AbilityExecutionPanel } from './AbilityExecutionPanel'
import { AgenticControls } from './AgenticControls'
import { AgenticStatusIndicator } from './AgenticStatusIndicator'
import { Thread } from './assistant-ui/thread'
import { ChatApprovalMessage } from './ChatApprovalMessage'
import { MCPChatComponent } from './MCPChatComponent'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { TooltipProvider } from './ui/tooltip'

interface AssistantUIChatProps {
  onBack: () => void
  currentApprovalMessage?: Message
  onApproveMessage?: (message: Message) => void
  onRejectMessage?: (message: Message) => void
}

interface ProviderConfig {
  id: string
  name: string
  models: Array<{ id: string, name: string }>
  supportsMCP?: boolean
}

const PROVIDERS: ProviderConfig[] = [
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
}) => {
  const [selectedProvider, setSelectedProvider] = useState('openai')
  const [selectedModel, setSelectedModel] = useState('gpt-3.5-turbo')
  const [mcpEnabled, setMCPEnabled] = useState(false)
  const [availableProviders, setAvailableProviders] = useState<string[]>([])
  const [showExecutionPanel, setShowExecutionPanel] = useState(false)

  // Auth and WebSocket connection management
  const { authStatus, isSkippingAuth } = useAuth()
  const { connectionStatus, connectToBestCodespace } = useWebSocketConnection(authStatus, isSkippingAuth)

  // Auto-connect to codespace when assistant chat opens
  useEffect(() => {
    const ensureConnection = async () => {
      if ((authStatus.authenticated || isSkippingAuth) && connectionStatus === 'disconnected') {
        try {
          await connectToBestCodespace()
        }
        catch (error) {
          console.error('Failed to auto-connect to codespace:', error)
        }
      }
    }

    ensureConnection()
  }, [authStatus.authenticated, isSkippingAuth, connectionStatus, connectToBestCodespace])

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

        // Always include MCP as it doesn't require traditional API keys
        const allAvailable = [...configured, 'mcp']
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

  // Update MCP state when toggle changes
  useEffect(() => {
    mcpChat.setMCPEnabled(mcpEnabled)
  }, [mcpEnabled, mcpChat])

  const runtime = useLocalRuntime(mcpChat.adapter)

  return (
    <TooltipProvider>
      <AssistantRuntimeProvider runtime={runtime}>
        <Card className="w-full h-full flex flex-col">
          <CardHeader>
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={onBack}>
                ← Back to Messages
              </Button>
              <CardTitle className="text-2xl font-bold">Assistant Chat</CardTitle>
              <div className="w-32" />
              {' '}
              {/* Spacer for centering title */}
            </div>

            {/* Provider and Model Selection */}
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Provider:</label>
                <select
                  value={selectedProvider}
                  onChange={(e) => {
                    setSelectedProvider(e.target.value)
                    const provider = PROVIDERS.find(p => p.id === e.target.value)
                    if (provider?.models[0]) {
                      setSelectedModel(provider.models[0].id)
                    }
                  }}
                  className="px-3 py-1 border border-gray-300 rounded text-sm"
                  disabled={availableProviders.length === 0}
                >
                  {PROVIDERS
                    .filter(p => availableProviders.includes(p.id))
                    .map(provider => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                </select>
              </div>

              {currentProvider && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Model:</label>
                  <select
                    value={selectedModel}
                    onChange={e => setSelectedModel(e.target.value)}
                    className="px-3 py-1 border border-gray-300 rounded text-sm"
                  >
                    {currentProvider.models.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* MCP Integration Toggle */}
              {currentProvider?.supportsMCP && selectedProvider !== 'mcp' && (
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={mcpEnabled}
                      onChange={e => setMCPEnabled(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span className="font-medium">🚀 Enable keyboard.dev Abilities</span>
                    {mcpChat.mcpConnected && mcpEnabled && (
                      <Badge variant="secondary" className="text-xs">
                        {mcpChat.mcpAbilities}
                        {' '}
                        abilities
                      </Badge>
                    )}
                  </label>

                  {mcpEnabled && (
                    <div className="flex items-center gap-2">
                      {mcpChat.mcpConnected
                        ? (
                            <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                              🟢 Connected
                            </Badge>
                          )
                        : mcpChat.mcpError
                          ? (
                              <div className="flex items-center gap-1">
                                <Badge variant="destructive" className="text-xs">
                                  🔴 Error
                                </Badge>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={mcpChat.refreshMCPConnection}
                                  className="text-xs h-6 px-2"
                                >
                                  Retry
                                </Button>
                              </div>
                            )
                          : (
                              <Badge variant="secondary" className="text-xs">
                                🟡 Connecting...
                              </Badge>
                            )}
                    </div>
                  )}
                </div>
              )}

              {availableProviders.length === 0 && (
                <div className="text-sm text-red-600">
                  No AI providers configured. Go to Settings → AI Providers to set up API keys.
                </div>
              )}

              {selectedProvider === 'mcp' && (
                <div className="text-sm text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                  🔌 MCP (Model Context Protocol) - Legacy direct connection mode
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-6 min-h-0">
            <div className="flex-1 min-h-0 h-full">
              {selectedProvider === 'mcp'
                ? (
                    <MCPChatComponent
                      serverUrl="https://mcp.keyboard.dev"
                      clientName="keyboard-approver-mcp"
                    />
                  )
                : (
                    <div className="flex flex-col h-full">
                      {/* Agentic Controls */}
                      <AgenticControls
                        isAgenticMode={mcpChat.isAgenticMode}
                        onToggleAgenticMode={mcpChat.setAgenticMode}
                        mcpEnabled={mcpEnabled}
                        mcpConnected={mcpChat.mcpConnected}
                        mcpAbilities={mcpChat.mcpAbilities}
                        onToggleMCP={setMCPEnabled}
                        onRefreshMCP={mcpChat.refreshMCPConnection}
                      />

                      {/* Execution Panel Toggle */}
                      {mcpEnabled && (
                        <div className="mb-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowExecutionPanel(!showExecutionPanel)}
                            className="text-xs"
                          >
                            🔍 View Executions (
                            {mcpChat.executions.length}
                            )
                          </Button>
                        </div>
                      )}

                      {/* Agentic Status Indicator */}
                      <AgenticStatusIndicator
                        isAgenticMode={mcpChat.isAgenticMode}
                        agenticProgress={mcpChat.agenticProgress}
                        isExecutingAbility={mcpChat.isExecutingAbility}
                        currentAbility={mcpChat.currentAbility}
                      />

                      <div className="flex-1 flex flex-col gap-3">
                        <Thread 
                          currentApprovalMessage={currentApprovalMessage}
                          onApproveMessage={onApproveMessage}
                          onRejectMessage={onRejectMessage}
                          onViewFullDetails={(message) => {
                            // This could trigger the full approval screen, but for now just log
                            console.log('View full details:', message)
                          }}
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
