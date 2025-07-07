import React from 'react';
import { Message } from '../../preload';

interface MessageDetailProps {
  message: Message;
  onBack: () => void;
  onMarkRead: () => void;
  onDelete: () => void;
}

const MessageDetail: React.FC<MessageDetailProps> = ({
  message,
  onBack,
  onMarkRead,
  onDelete,
}) => {
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 24 * 7) {
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  };

  return (
    <div className="message-detail">
      <header className="header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <div className="detail-actions">
          <button
            className="mark-read-btn"
            onClick={onMarkRead}
            disabled={message.read}
          >
            {message.read ? '✓ Read' : '✓ Mark Read'}
          </button>
          <button className="delete-btn" onClick={onDelete}>
            🗑 Delete
          </button>
        </div>
      </header>

      <div className="message-content">
        <div className="message-header">
          <h1 className="message-title">{message.title}</h1>
          <div className="message-meta">
            <div className="message-sender">
              {message.sender ? `From: ${message.sender}` : 'Unknown sender'}
            </div>
            <div className="message-time">{formatTime(message.timestamp)}</div>
            {message.priority && (
              <span className={`priority-badge ${message.priority}`}>
                {message.priority}
              </span>
            )}
          </div>
        </div>

        <div className="message-body">
          <pre>{message.body}</pre>
        </div>
      </div>
    </div>
  );
};

export default MessageDetail; 