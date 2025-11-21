import React, { useState } from 'react'
import { Script } from '../../main'
import { ChatInput } from './ChatInput'
import { ScriptSelector } from './ScriptSelector'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

interface ChatProps {
  onBack: () => void
}

interface ChatMessage {
  id: string
  content: string
  timestamp: number
  sender: 'user' | 'assistant'
  script?: Script
}

export const Chat: React.FC<ChatProps> = ({ onBack }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [selectedScript, setSelectedScript] = useState<Script | null>(null)

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return

    // Ensure we have a connection before sending

    // Create message content with script context if selected
    let messageContent = inputValue.trim()
    if (selectedScript) {
      messageContent = `[Script: ${selectedScript.name}] ${messageContent}\n\nScript Context:\n- Name: ${selectedScript.name}\n- ID: ${selectedScript.id}\n- Description: ${selectedScript.description}`
      if (selectedScript.tags && selectedScript.tags.length > 0) {
        messageContent += `\n- Tags: ${selectedScript.tags.join(', ')}`
      }
      if (selectedScript.services && selectedScript.services.length > 0) {
        messageContent += `\n- Services: ${selectedScript.services.join(', ')}`
      }
    }

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      content: messageContent,
      timestamp: Date.now(),
      sender: 'user',
      script: selectedScript || undefined,
    }

    setMessages(prev => [...prev, newMessage])
    setInputValue('')
    setSelectedScript(null) // Clear script selection after sending

    // TODO: Add actual chat functionality here
    // For now, just add a simple response
    setTimeout(() => {
      const response: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: selectedScript 
          ? `I'll help you with that using the ${selectedScript.name} script. ${inputValue.trim()}`
          : `Echo: ${inputValue.trim()}`,
        timestamp: Date.now(),
        sender: 'assistant',
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
          <div className="w-32" />
          {' '}
          {/* Spacer for centering title */}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-6 space-y-4">
        {/* Chat Messages Area */}
        <div className="flex-1 overflow-auto space-y-3 min-h-0">
          {messages.length === 0
            ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Start a conversation...
                </div>
              )
            : (
                messages.map(message => (
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

        {/* Script Selection and Chat Input */}
        <div className="border-t pt-4 space-y-3">
          <ScriptSelector
            selectedScript={selectedScript}
            onScriptSelect={setSelectedScript}
          />
          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSend={handleSendMessage}
            placeholder="Type your message..."
            selectedScript={selectedScript}
          />
        </div>
      </CardContent>
    </Card>
  )
}
