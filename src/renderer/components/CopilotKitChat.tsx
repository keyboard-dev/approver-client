import React from 'react'
import { CopilotKit } from '@copilotkit/react-core'
import { CopilotChat } from '@copilotkit/react-ui'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

interface CopilotKitChatProps {
  onBack: () => void
}

export const CopilotKitChat: React.FC<CopilotKitChatProps> = ({ onBack }) => {
  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onBack}>
            ← Back to Messages
          </Button>
          <CardTitle className="text-2xl font-bold">AI Chat</CardTitle>
          <div className="w-32" /> {/* Spacer for centering title */}
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-6 min-h-0">
        <div className="flex-1 min-h-0">
          <CopilotKit 
            runtimeUrl="/api/copilotkit"
            // You can configure the API endpoint here
            // For now, we'll use a placeholder endpoint
          >
            <CopilotChat
              labels={{
                title: "Chat with AI Assistant",
                initial: "Hi! How can I help you today?",
              }}
              className="h-full"
            />
          </CopilotKit>
        </div>
      </CardContent>
    </Card>
  )
}