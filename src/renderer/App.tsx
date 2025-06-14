import React, { useState, useEffect, useCallback } from 'react';
import { Message } from '../preload';
import MessageList from './components/MessageList';
import MessageDetail from './components/MessageDetail';
import './App.css';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load messages from Electron API
  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      const loadedMessages = await window.electronAPI.getMessages();
      setMessages(loadedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize messages on component mount
  useEffect(() => {
    loadMessages();

    // Listen for messages from main process
    const handleShowMessage = (event: any, message: Message) => {
      setCurrentMessage(message);
    };

    window.electronAPI.onShowMessage(handleShowMessage);

    // Cleanup listener on unmount
    return () => {
      window.electronAPI.removeAllListeners('show-message');
    };
  }, [loadMessages]);

  // Mark message as read
  const markMessageRead = async (messageId: string) => {
    try {
      await window.electronAPI.markMessageRead(messageId);
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === messageId ? { ...msg, read: true } : msg
        )
      );
      if (currentMessage?.id === messageId) {
        setCurrentMessage(prev => prev ? { ...prev, read: true } : null);
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  // Delete message
  const deleteMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to delete this message?')) {
      return;
    }

    try {
      await window.electronAPI.deleteMessage(messageId);
      setMessages(prevMessages => prevMessages.filter(msg => msg.id !== messageId));
      if (currentMessage?.id === messageId) {
        setCurrentMessage(null);
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  // Show message detail
  const showMessageDetail = (message: Message) => {
    setCurrentMessage(message);
  };

  // Go back to message list
  const showMessageList = () => {
    setCurrentMessage(null);
    loadMessages(); // Refresh to show updated read status
  };

  return (
    <div className="app">
      {currentMessage ? (
        <MessageDetail
          message={currentMessage}
          onBack={showMessageList}
          onMarkRead={() => markMessageRead(currentMessage.id)}
          onDelete={() => deleteMessage(currentMessage.id)}
        />
      ) : (
        <MessageList
          messages={messages}
          isLoading={isLoading}
          onRefresh={loadMessages}
          onMessageClick={showMessageDetail}
        />
      )}
    </div>
  );
};

export default App; 