import React, { useCallback, useState } from 'react'
import { McpRuntimeProvider } from '../../providers/McpRuntimeProvider'
import { ChatInterface } from '../chat/ChatInterface'
import { Button } from '../ui/button'
import { Settings } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog'
import { Input } from '../ui/input'

export const ChatScreen: React.FC = () => {
  const [serverUrl, setServerUrl] = useState('https://mcp.keyboard.dev')
  const [apiKey, setApiKey] = useState<string>()
  const [settingsOpen, setSettingsOpen] = useState(false)

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

  return (
    <div className="h-screen w-full flex flex-col">
      {/* Top bar with settings */}
      <div className="flex items-center justify-between border-b px-4 py-2 bg-gray-50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm text-gray-600">
            Connected to {serverUrl}
          </span>
        </div>
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>MCP Chat Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Server URL</label>
                <Input
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="https://mcp.keyboard.dev"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">API Key (Optional)</label>
                <Input
                  type="password"
                  value={apiKey || ''}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your API key"
                />
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
        <McpRuntimeProvider
          defaultServerUrl={serverUrl}
          defaultApiKey={apiKey}
          initialMessages={[]}
        >
          <ChatInterface />
        </McpRuntimeProvider>
      </div>
    </div>
  )
}
