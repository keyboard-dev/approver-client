import React, { useCallback, useState, useEffect } from 'react'
import { AssistantRuntimeProvider } from '@assistant-ui/react'
import { ChatInterface } from '../chat/ChatInterface'
import { Button } from '../ui/button'
import { Settings, Plus, MessageSquare, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { createUnifiedRuntime } from '../../runtime/UnifiedRuntime'
import { AVAILABLE_PROVIDERS, type AIProviderType } from '../../runtime/providers'
import { chatPersistence, type ChatSession } from '../../services/ChatPersistence'

export const EnhancedChatScreen: React.FC = () => {
  const [provider, setProvider] = useState<AIProviderType>('mcp')
  const [apiKey, setApiKey] = useState<string>('')
  const [model, setModel] = useState<string>('')
  const [serverUrl, setServerUrl] = useState('https://mcp.keyboard.dev')
  const [temperature, setTemperature] = useState(0.7)
  const [enableStreaming, setEnableStreaming] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Session management
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [sessionSidebarOpen, setSessionSidebarOpen] = useState(false)

  // Load sessions on mount
  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    try {
      await chatPersistence.init()
      const allSessions = await chatPersistence.getAllSessions()
      setSessions(allSessions)

      // If no current session, create a new one
      if (!currentSessionId && allSessions.length === 0) {
        await createNewSession()
      }
      else if (!currentSessionId && allSessions.length > 0) {
        setCurrentSessionId(allSessions[0].id)
      }
    }
    catch (error) {
      console.error('Error loading sessions:', error)
    }
  }

  const createNewSession = async () => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      name: `Chat ${sessions.length + 1}`,
      provider,
      model: model || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    try {
      await chatPersistence.createSession(newSession)
      setSessions([newSession, ...sessions])
      setCurrentSessionId(newSession.id)
    }
    catch (error) {
      console.error('Error creating session:', error)
    }
  }

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this chat session?')) return

    try {
      await chatPersistence.deleteSession(sessionId)
      const updatedSessions = sessions.filter(s => s.id !== sessionId)
      setSessions(updatedSessions)

      if (currentSessionId === sessionId) {
        setCurrentSessionId(updatedSessions[0]?.id || null)
      }
    }
    catch (error) {
      console.error('Error deleting session:', error)
    }
  }

  // Handle tool approval callback
  const handleToolCall = useCallback(
    async (toolCall: {
      id: string
      name: string
      arguments: Record<string, unknown>
    }): Promise<'approved' | 'rejected'> => {
      // Show approval dialog to user
      const approved = window.confirm(
        `Do you want to approve the tool call "${toolCall.name}"?\n\n` +
          `Arguments: ${JSON.stringify(toolCall.arguments, null, 2)}`,
      )

      return approved ? 'approved' : 'rejected'
    },
    [],
  )

  // Save message callback
  const handleSaveMessage = useCallback(
    async (message: any) => {
      if (!currentSessionId) return

      try {
        await chatPersistence.saveMessage({
          id: message.id,
          sessionId: currentSessionId,
          role: message.role,
          content: message.content,
          createdAt: message.createdAt.getTime(),
        })

        // Update session's updatedAt
        await chatPersistence.updateSession(currentSessionId, {
          updatedAt: Date.now(),
        })
      }
      catch (error) {
        console.error('Error saving message:', error)
      }
    },
    [currentSessionId],
  )

  // Create runtime with current settings
  const runtime = createUnifiedRuntime({
    provider,
    apiKey,
    model,
    serverUrl,
    temperature,
    enableStreaming,
    onToolCall: handleToolCall,
    onSaveMessage: handleSaveMessage,
  })

  const currentProvider = AVAILABLE_PROVIDERS.find(p => p.id === provider)
  const currentSession = sessions.find(s => s.id === currentSessionId)

  return (
    <div className="h-screen w-full flex">
      {/* Session sidebar */}
      {sessionSidebarOpen && (
        <div className="w-64 border-r bg-gray-50 flex flex-col">
          <div className="p-4 border-b">
            <h3 className="font-semibold mb-2">Chat Sessions</h3>
            <Button
              onClick={createNewSession}
              size="sm"
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sessions.map(session => (
              <div
                key={session.id}
                className={`
                  p-3 border-b cursor-pointer hover:bg-gray-100 flex items-center justify-between
                  ${session.id === currentSessionId ? 'bg-blue-50' : ''}
                `}
                onClick={() => setCurrentSessionId(session.id)}
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">{session.name}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(session.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteSession(session.id)
                  }}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b px-4 py-2 bg-gray-50">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSessionSidebarOpen(!sessionSidebarOpen)}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            <div>
              <div className="font-medium">{currentSession?.name || 'New Chat'}</div>
              <div className="text-xs text-gray-500">
                {currentProvider?.name} • {model || currentProvider?.defaultModel}
              </div>
            </div>
          </div>
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>AI Provider Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Provider selection */}
                <div className="space-y-2">
                  <Label>AI Provider</Label>
                  <Select value={provider} onValueChange={(v) => setProvider(v as AIProviderType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_PROVIDERS.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    {currentProvider?.description}
                  </p>
                </div>

                {/* Model selection */}
                {currentProvider?.models && (
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Select value={model || currentProvider.defaultModel} onValueChange={setModel}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {currentProvider.models.map(m => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* API Key (if required) */}
                {currentProvider?.requiresApiKey && (
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <Input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={`Enter your ${currentProvider.name} API key`}
                    />
                  </div>
                )}

                {/* MCP Server URL */}
                {provider === 'mcp' && (
                  <div className="space-y-2">
                    <Label>MCP Server URL</Label>
                    <Input
                      value={serverUrl}
                      onChange={(e) => setServerUrl(e.target.value)}
                      placeholder="https://mcp.keyboard.dev"
                    />
                  </div>
                )}

                {/* Advanced settings */}
                <div className="space-y-2">
                  <Label>Temperature</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="flex-1"
                    />
                    <span className="w-12 text-sm">{temperature}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="streaming"
                    checked={enableStreaming}
                    onChange={(e) => setEnableStreaming(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="streaming">Enable Streaming (experimental)</Label>
                </div>

                <Button
                  onClick={() => setSettingsOpen(false)}
                  className="w-full"
                >
                  Save Settings
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Chat interface */}
        <div className="flex-1 overflow-hidden">
          <AssistantRuntimeProvider runtime={runtime}>
            <ChatInterface />
          </AssistantRuntimeProvider>
        </div>
      </div>
    </div>
  )
}
