import React from 'react'
import { AssistantRuntimeProvider, useLocalRuntime } from '@assistant-ui/react'
import { Thread } from './assistant-ui/thread'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { TooltipProvider } from './ui/tooltip'

interface AssistantUIChatProps {
  onBack: () => void
}

// Simple mock runtime for demonstration
const mockChatAdapter = {
  async run({ messages, onUpdate }) {
    // Simulate a simple echo response
    const userMessage = messages[messages.length - 1]
    
    if (userMessage?.content?.[0]?.type === 'text') {
      const response = `Echo: ${userMessage.content[0].text}`
      
      // Simulate streaming response
      onUpdate({
        content: [{ type: 'text', text: response }],
        status: { type: 'complete' }
      })
    }
  }
}

const AssistantUIChatContent: React.FC<AssistantUIChatProps> = ({ onBack }) => {
  const runtime = useLocalRuntime(mockChatAdapter)

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
              <div className="w-32" /> {/* Spacer for centering title */}
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col p-6 min-h-0">
            <div className="flex-1 min-h-0 h-full">
              <Thread />
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