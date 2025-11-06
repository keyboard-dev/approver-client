import React, { useState, useEffect } from 'react'
import { AssistantRuntimeProvider, useLocalRuntime } from '@assistant-ui/react'
import { Thread } from './assistant-ui/thread'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { TooltipProvider } from './ui/tooltip'
import { AIChatAdapter, createOpenAIAdapter, createAnthropicAdapter, createGeminiAdapter, createMCPAdapter } from '../services/ai-chat-adapter'
import { MCPChatComponent } from './MCPChatComponent'

interface AssistantUIChatProps {
  onBack: () => void
}

interface ProviderConfig {
  id: string
  name: string
  adapter: AIChatAdapter
  models: Array<{ id: string, name: string }>
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    adapter: createOpenAIAdapter(),
    models: [
      { id: 'gpt-4', name: 'GPT-4' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    adapter: createAnthropicAdapter(),
    models: [
      { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    adapter: createGeminiAdapter(),
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-pro', name: 'Gemini Pro' },
    ],
  },
  {
    id: 'mcp',
    name: 'MCP Server',
    adapter: createMCPAdapter(),
    models: [
      { id: 'mcp-tools', name: 'MCP Tools & Resources' },
      { id: 'mcp-local', name: 'Local MCP Server' },
    ],
  },
]

const AssistantUIChatContent: React.FC<AssistantUIChatProps> = ({ onBack }) => {
  const [selectedProvider, setSelectedProvider] = useState('openai')
  const [selectedModel, setSelectedModel] = useState('gpt-3.5-turbo')
  const [availableProviders, setAvailableProviders] = useState<string[]>([])

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

  // Update adapter when provider/model changes
  useEffect(() => {
    if (currentProvider) {
      currentProvider.adapter.setProvider(selectedProvider, selectedModel)
    }
  }, [selectedProvider, selectedModel, currentProvider])

  const runtime = useLocalRuntime(currentProvider?.adapter || createOpenAIAdapter())

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

              {availableProviders.length === 0 && (
                <div className="text-sm text-red-600">
                  No AI providers configured. Go to Settings → AI Providers to set up API keys.
                </div>
              )}

              {selectedProvider === 'mcp' && (
                <div className="text-sm text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                  🔌 MCP (Model Context Protocol) - Connect to external tools and resources
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
                    <Thread />
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
