import React, { useEffect, useState } from 'react'
import { useMcpClient } from '../hooks/useMcpClient'
import { Badge } from './ui/badge'
import { Button } from './ui/button'

interface MCPChatComponentProps {
  serverUrl?: string
  clientName?: string
}

export const MCPChatComponent: React.FC<MCPChatComponentProps> = ({
  serverUrl = 'https://mcp.keyboard.dev',
  clientName = 'keyboard-approver-mcp',
}) => {
  const [messages, setMessages] = useState<Array<{ id: string, content: string, sender: 'user' | 'mcp' }>>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)

  // Use our custom MCP client hook (no OAuth required!)
  const {
    state,
    tools,
    resources,
    prompts,
    error,
    callTool,
    readResource,
    getPrompt,
    retry,
  } = useMcpClient({
    serverUrl,
    clientName,
    autoReconnect: true,
  })

  // Add initial status message when connection state changes
  useEffect(() => {
    const statusMessage = {
      id: `status-${Date.now()}`,
      content: getStatusMessage(),
      sender: 'mcp' as const,
    }

    setMessages((prev) => {
      // Remove previous status messages and add new one
      const filtered = prev.filter(msg => !msg.id.startsWith('status-'))
      return [statusMessage, ...filtered]
    })
  }, [state, tools.length, resources.length, prompts.length, error])

  const getStatusMessage = () => {
    switch (state) {
      case 'discovering':
        return '🔍 Discovering MCP server...'
      case 'connecting':
        return '🔌 Connecting to MCP server...'
      case 'loading':
        return '⏳ Loading MCP capabilities...'
      case 'ready':
        return `✅ Connected to MCP server! Found ${tools.length} tools, ${resources.length} resources, and ${prompts.length} prompts.`
      case 'failed':
        return `❌ Connection failed: ${error || 'Unknown error'}`
      default:
        return '🔍 Initializing MCP client...'
    }
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || loading) return

    const userMessage = {
      id: `user-${Date.now()}`,
      content: inputValue.trim(),
      sender: 'user' as const,
    }

    setMessages(prev => [userMessage, ...prev])
    setInputValue('')
    setLoading(true)

    try {
      if (state !== 'ready') {
        const errorResponse = {
          id: `mcp-${Date.now()}`,
          content: 'MCP server is not ready. Please wait for connection to be established.',
          sender: 'mcp' as const,
        }
        setMessages(prev => [errorResponse, ...prev])
        return
      }

      // Simple command parsing for demo
      const message = userMessage.content.toLowerCase()
      let response = ''

      if (message.includes('list tools') || message.includes('tools')) {
        response = `Available Tools (${tools.length}):\n\n${
          tools.map(tool => `🔧 **${tool.name}**\n   ${tool.description || 'No description'}`).join('\n\n')
        }`
      }
      else if (message.includes('list resources') || message.includes('resources')) {
        response = `Available Resources (${resources.length}):\n\n${
          resources.map(resource => `📄 **${resource.name}**\n   ${resource.description || 'No description'}\n   URI: ${resource.uri}`).join('\n\n')
        }`
      }
      else if (message.includes('list prompts') || message.includes('prompts')) {
        response = `Available Prompts (${prompts.length}):\n\n${
          prompts.map(prompt => `💭 **${prompt.name}**\n   ${prompt.description || 'No description'}`).join('\n\n')
        }`
      }
      else if (message.startsWith('call tool ')) {
        const toolName = message.replace('call tool ', '').trim()
        const tool = tools.find(t => t.name.toLowerCase() === toolName)

        if (tool) {
          try {
            const result = await callTool(tool.name, {})
            response = `Tool "${tool.name}" executed:\n\n${JSON.stringify(result, null, 2)}`
          }
          catch (err) {
            response = `Error calling tool "${tool.name}": ${err instanceof Error ? err.message : 'Unknown error'}`
          }
        }
        else {
          response = `Tool "${toolName}" not found. Available tools: ${tools.map(t => t.name).join(', ')}`
        }
      }
      else if (message.startsWith('read resource ')) {
        const resourceName = message.replace('read resource ', '').trim()
        const resource = resources.find(r => r.name.toLowerCase() === resourceName)

        if (resource) {
          try {
            const result = await readResource(resource.uri)
            response = `Resource "${resource.name}" content:\n\n${JSON.stringify(result, null, 2)}`
          }
          catch (err) {
            response = `Error reading resource "${resource.name}": ${err instanceof Error ? err.message : 'Unknown error'}`
          }
        }
        else {
          response = `Resource "${resourceName}" not found. Available resources: ${resources.map(r => r.name).join(', ')}`
        }
      }
      else {
        response = `MCP Server Integration Active! 

Try these commands:
• "list tools" - Show available tools
• "list resources" - Show available resources  
• "list prompts" - Show available prompts
• "call tool [name]" - Execute a tool
• "read resource [name]" - Read a resource

Your message: "${userMessage.content}"`
      }

      const mcpResponse = {
        id: `mcp-${Date.now()}`,
        content: response,
        sender: 'mcp' as const,
      }

      setMessages(prev => [mcpResponse, ...prev])
    }
    catch (error) {
      const errorResponse = {
        id: `mcp-${Date.now()}`,
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
        sender: 'mcp' as const,
      }
      setMessages(prev => [errorResponse, ...prev])
    }
    finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* MCP Status Bar */}
      <div className="p-4 border-b bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={state === 'ready' ? 'default' : state === 'failed' ? 'destructive' : 'secondary'}>
              {state === 'ready' ? '🟢' : state === 'failed' ? '🔴' : '🟡'}
              {' '}
              {state.toUpperCase()}
            </Badge>
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {serverUrl}
            </span>
          </div>

          {state === 'failed' && (
            <Button variant="outline" size="sm" onClick={retry}>
              Retry Connection
            </Button>
          )}
        </div>

        {state === 'ready' && (
          <div className="mt-2 flex gap-2 text-xs text-gray-500">
            <span>
              Tools:
              {tools.length}
            </span>
            <span>
              Resources:
              {resources.length}
            </span>
            <span>
              Prompts:
              {prompts.length}
            </span>
          </div>
        )}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0
          ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <p className="mb-2">MCP Chat Interface</p>
                  <p className="text-sm">Start a conversation to interact with the MCP server</p>
                </div>
              </div>
            )
          : (
              messages.map(message => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] p-3 rounded-lg whitespace-pre-wrap ${
                      message.sender === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))
            )}
      </div>

      {/* Chat Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <textarea
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message or command..."
            className="flex-1 min-h-[40px] max-h-[120px] px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            disabled={loading}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || loading || state !== 'ready'}
            className="px-6"
          >
            {loading ? '...' : 'Send'}
          </Button>
        </div>

        {state !== 'ready' && (
          <p className="mt-2 text-xs text-gray-500">
            Chat disabled - waiting for MCP connection
          </p>
        )}
      </div>
    </div>
  )
}
