import React, { useState, useRef } from 'react'
import { Paperclip, Globe, Settings, Code, Send } from 'lucide-react'
import { Button } from './ui/button'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend?: () => void
  placeholder?: string
  onAttachFile?: (file: File) => void
  onAttachImage?: (file: File) => void
  className?: string
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  placeholder = 'Type your message here...',
  onAttachFile,
  onAttachImage,
  className = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (file.type.startsWith('image/')) {
        onAttachImage?.(file)
      }
      else {
        onAttachFile?.(file)
      }
    }
  }

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      onSend?.()
    }
  }

  const handleSendClick = () => {
    onSend?.()
  }

  return (
    <div className={`relative ${className}`}>
      {/* Main input container with gradient background */}
      <div className="relative bg-gradient-to-br from-pink-100 to-orange-200 p-4 rounded-2xl">
        {/* Light input box */}
        <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-200">
          {/* Text input area */}
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            className="w-full bg-transparent text-gray-900 placeholder-gray-500 resize-none outline-none min-h-[60px] max-h-[200px]"
            rows={1}
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          />

          {/* Icon row */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center space-x-4">
              {/* File attachment */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-gray-500 hover:text-gray-700 transition-colors"
                title="Attach file"
              >
                <Paperclip className="h-5 w-5" />
              </button>

              {/* Vertical separator */}
              <div className="w-px h-5 bg-gray-300"></div>

              {/* Link/URL */}
              <button
                className="text-gray-500 hover:text-gray-700 transition-colors"
                title="Add link"
              >
                <Globe className="h-5 w-5" />
              </button>

              {/* Vertical separator */}
              <div className="w-px h-5 bg-gray-300"></div>

              {/* Settings */}
              <button
                className="text-gray-500 hover:text-gray-700 transition-colors"
                title="Settings"
              >
                <Settings className="h-5 w-5" />
              </button>

              {/* Vertical separator */}
              <div className="w-px h-5 bg-gray-300"></div>

              {/* Code/Files */}
              <button
                onClick={() => imageInputRef.current?.click()}
                className="text-gray-500 hover:text-gray-700 transition-colors"
                title="Attach image"
              >
                <Code className="h-5 w-5" />
              </button>
            </div>

            {/* Send button */}
            <Button
              onClick={handleSendClick}
              disabled={!value.trim()}
              className="w-10 h-10 rounded-full p-0 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              title="Send message"
            >
              <Send className="h-5 w-5 text-white" />
            </Button>
          </div>
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelect}
        className="hidden"
        accept="*/*"
      />
      <input
        ref={imageInputRef}
        type="file"
        onChange={handleFileSelect}
        className="hidden"
        accept="image/*"
      />
    </div>
  )
}
