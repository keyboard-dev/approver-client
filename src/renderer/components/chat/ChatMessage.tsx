import React from 'react'
import { useMessage } from '@assistant-ui/react'
import { User, Bot, Copy, Check } from 'lucide-react'
import { cn } from '../../lib/utils'
import { ToolCallRenderer } from './ToolCallRenderer'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export const ChatMessage: React.FC = () => {
  const message = useMessage()
  const { role, content } = message.message
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null)

  const isUser = role === 'user'

  const handleCopyCode = async (code: string, language: string) => {
    await navigator.clipboard.writeText(code)
    setCopiedCode(`${language}-${code}`)
    setTimeout(() => setCopiedCode(null), 2000)
  }

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
                <div className={cn(
                  'prose prose-sm max-w-none',
                  isUser ? 'prose-invert' : '',
                )}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '')
                        const language = match ? match[1] : ''
                        const code = String(children).replace(/\n$/, '')

                        if (!inline && language) {
                          return (
                            <div className="relative group">
                              <button
                                onClick={() => handleCopyCode(code, language)}
                                className="absolute right-2 top-2 p-1.5 rounded bg-gray-700 hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Copy code"
                              >
                                {copiedCode === `${language}-${code}` ? (
                                  <Check className="h-4 w-4 text-green-400" />
                                ) : (
                                  <Copy className="h-4 w-4 text-gray-300" />
                                )}
                              </button>
                              <SyntaxHighlighter
                                style={oneDark}
                                language={language}
                                PreTag="div"
                                {...props}
                              >
                                {code}
                              </SyntaxHighlighter>
                            </div>
                          )
                        }

                        return (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        )
                      },
                    }}
                  >
                    {part.text}
                  </ReactMarkdown>
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
