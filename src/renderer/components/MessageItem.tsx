import React from 'react'
import { Message } from '../../preload'

interface MessageItemProps {
  message: Message
  onClick: () => void
}

const MessageItem: React.FC<MessageItemProps> = ({ message, onClick }) => {
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    }
    else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    }
  }

  const preview = message.body.length > 100
    ? message.body.substring(0, 100) + '...'
    : message.body

  return (
    <div
      className={`message-item ${!message.read ? 'unread' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <div className="message-item-header">
        <div className="message-item-title">{message.title}</div>
        <div className="message-item-time">{formatTime(message.timestamp)}</div>
      </div>
      <div className="message-item-preview">{preview}</div>
      <div className="message-item-meta">
        <div className="message-item-sender">
          {message.sender ? `From: ${message.sender}` : ''}
        </div>
        {message.priority && (
          <span className={`priority-badge ${message.priority}`}>
            {message.priority}
          </span>
        )}
      </div>
    </div>
  )
}

export default MessageItem
