import React from 'react';
import { Message } from '../../preload';
import MessageItem from './MessageItem';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  onRefresh: () => void;
  onMessageClick: (message: Message) => void;
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  onRefresh,
  onMessageClick,
}) => {
  // Sort messages by timestamp (newest first)
  const sortedMessages = [...messages].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="message-view">
      <header className="header">
        <h1>Messages</h1>
        <button
          className="refresh-btn"
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? '⟳' : '↻'} Refresh
        </button>
      </header>

      <div className="message-list" id="messageList">
        {messages.length === 0 ? (
          <div className="empty-state" id="emptyState">
            <div className="empty-state-content">
              <h2>No messages</h2>
              <p>You'll see your messages here when they arrive.</p>
            </div>
          </div>
        ) : (
          sortedMessages.map(message => (
            <MessageItem
              key={message.id}
              message={message}
              onClick={() => onMessageClick(message)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default MessageList; 