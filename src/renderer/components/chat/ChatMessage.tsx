import React from 'react'
import { useMessage, useMessageContext } from '@assistant-ui/react'
import { User, Bot } from 'lucide-react'
import { cn } from '../../lib/utils'
import { ToolCallRenderer } from './ToolCallRenderer'

export const ChatMessage: React.FC = () => {
  const message = useMessage()
  const { role, content } = message.message

  const isUser = role === 'user'

  return (
    <div
      className={cn(
        'flex gap-3 p-4',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full',
          isUser ? 'bg-blue-500' : 'bg-gray-200',
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-white" />
        ) : (
          <Bot className="h-4 w-4 text-gray-700" />
        )}
      </div>

      {/* Content */}
      <div
        className={cn(
          'flex flex-col gap-2 max-w-[80%]',
          isUser ? 'items-end' : 'items-start',
        )}
      >
        {/* Text content */}
        {content.map((part, index) => {
          if (part.type === 'text') {
            return (
              <div
                key={index}
                className={cn(
                  'rounded-2xl px-4 py-2',
                  isUser
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-900',
                )}
              >
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  {part.text}
                </div>
              </div>
            )
          }
          if (part.type === 'tool-call') {
            return <ToolCallRenderer key={index} toolCall={part} />
          }
          return null
        })}

        {/* Timestamp */}
        <div className="text-xs text-gray-500">
          {new Date(message.message.createdAt).toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}
