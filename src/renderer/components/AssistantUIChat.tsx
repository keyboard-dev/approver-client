import { AssistantRuntimeProvider, useLocalRuntime } from '@assistant-ui/react'
import React, { useEffect, useState } from 'react'
import { useMCPEnhancedChat } from '../hooks/useMCPEnhancedChat'
import { Thread } from './assistant-ui/thread'
import { MCPChatComponent } from './MCPChatComponent'
import { AgenticControls } from './AgenticControls'
import { AgenticStatusIndicator } from './AgenticStatusIndicator'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { TooltipProvider } from './ui/tooltip'

interface AssistantUIChatProps {
  onBack: () => void
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
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
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

const AssistantUIChatContent: React.FC<AssistantUIChatProps> = ({ onBack }) => {
  const [selectedProvider, setSelectedProvider] = useState('openai')
  const [selectedModel, setSelectedModel] = useState('gpt-3.5-turbo')
  const [mcpEnabled, setMCPEnabled] = useState(false)
  const [availableProviders, setAvailableProviders] = useState<string[]>([])

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
                        {mcpChat.mcpTools}
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
                        mcpTools={mcpChat.mcpTools}
                        onToggleMCP={setMCPEnabled}
                        onRefreshMCP={mcpChat.refreshMCPConnection}
                      />
                      
                      {/* Agentic Status Indicator */}
                      <AgenticStatusIndicator
                        isAgenticMode={mcpChat.isAgenticMode}
                        agenticProgress={mcpChat.agenticProgress}
                        isExecutingTool={mcpChat.isExecutingTool}
                        currentTool={mcpChat.currentTool}
                      />
                      
                      <div className="flex-1">
                        <Thread />
                      </div>
                    </div>
                  )}
            </div>
          </CardContent>
        </Card>
      </AssistantRuntimeProvider>
    </TooltipProvider>
  )
}

export const AssistantUIChat: React.FC<AssistantUIChatProps> = ({ onBack }) => {
  return <AssistantUIChatContent onBack={onBack} />
}
