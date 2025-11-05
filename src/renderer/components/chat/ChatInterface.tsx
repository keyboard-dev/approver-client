import React from 'react'
import {
  Thread,
  ThreadWelcome,
  Composer,
  ThreadMessages,
  useThreadContext,
} from '@assistant-ui/react'
import { Send, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import { ChatMessage } from './ChatMessage'

export const ChatInterface: React.FC = () => {
  return (
    <div className="flex flex-col h-full w-full bg-white">
      <Thread>
        {/* Header */}
        <div className="border-b px-6 py-4">
          <h2 className="text-xl font-semibold">MCP Chat</h2>
          <p className="text-sm text-gray-500">
            Chat with your MCP tools at keyboard.dev
          </p>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          <ThreadWelcome>
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
                <span className="text-2xl text-white">💬</span>
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Welcome to MCP Chat
              </h3>
              <p className="text-gray-500 max-w-md">
                Start a conversation with your MCP server. You can ask questions,
                run tools, and get approvals for actions.
              </p>
            </div>
          </ThreadWelcome>

          <ThreadMessages
            components={{
              UserMessage: ChatMessage,
              AssistantMessage: ChatMessage,
            }}
          />
        </div>

        {/* Input area */}
        <div className="border-t px-6 py-4">
          <ChatComposer />
        </div>
      </Thread>
    </div>
  )
}

const ChatComposer: React.FC = () => {
  const { useComposer } = useThreadContext()
  const composer = useComposer()
  const [input, setInput] = React.useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    composer.send()
    setInput('')
  }

  return (
    <Composer>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Composer.Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={composer.isRunning}
        />
        <Button
          type="submit"
          disabled={!input.trim() || composer.isRunning}
          className="px-6"
        >
          {composer.isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Send
            </>
          )}
        </Button>
      </form>
    </Composer>
  )
}
