import React, { useState } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { ChatInput } from './ChatInput'

interface ChatProps {
  onBack: () => void
}

interface ChatMessage {
  id: string
  content: string
  timestamp: number
  sender: 'user' | 'assistant'
}

export const Chat: React.FC<ChatProps> = ({ onBack }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')

  const handleSendMessage = () => {
    if (!inputValue.trim()) return

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      timestamp: Date.now(),
      sender: 'user'
    }

    setMessages(prev => [...prev, newMessage])
    setInputValue('')

    // TODO: Add actual chat functionality here
    // For now, just add a simple response
    setTimeout(() => {
      const response: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: `Echo: ${newMessage.content}`,
        timestamp: Date.now(),
        sender: 'assistant'
      }
      setMessages(prev => [...prev, response])
    }, 500)
  }

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onBack}>
            ← Back to Messages
          </Button>
          <CardTitle className="text-2xl font-bold">Chat</CardTitle>
          <div className="w-32" /> {/* Spacer for centering title */}
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-6 space-y-4">
        {/* Chat Messages Area */}
        <div className="flex-1 overflow-auto space-y-3 min-h-0">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              Start a conversation...
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] p-3 rounded-lg ${
                    message.sender === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Chat Input */}
        <div className="border-t pt-4">
          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSendMessage}
            placeholder="Type your message..."
          />
        </div>
      </CardContent>
    </Card>
  )
}