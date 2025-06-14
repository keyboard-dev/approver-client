import React, { useState, useEffect, useCallback } from 'react';
import { Message } from '../preload';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Textarea } from '../components/ui/textarea';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Separator } from '../components/ui/separator';
import { Badge } from './components/ui/badge';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import './App.css';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState<Message | null>(null);
  const [feedback, setFeedback] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');

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

    // Listen for regular messages from main process
    const handleShowMessage = (event: any, message: Message) => {
      setCurrentMessage(message);
      setMessages(prev => {
        const existing = prev.find(m => m.id === message.id);
        if (existing) {
          return prev.map(m => m.id === message.id ? message : m);
        }
        return [message, ...prev];
      });
    };

    // Listen for websocket messages
    const handleWebSocketMessage = (event: any, message: Message) => {
      console.log('Received websocket message:', message);
      setCurrentMessage(message);
      setMessages(prev => {
        const existing = prev.find(m => m.id === message.id);
        if (existing) {
          return prev.map(m => m.id === message.id ? message : m);
        }
        return [message, ...prev];
      });
      setConnectionStatus('connected');
    };

    window.electronAPI.onShowMessage(handleShowMessage);
    window.electronAPI.onWebSocketMessage(handleWebSocketMessage);

    // Cleanup listeners on unmount
    return () => {
      window.electronAPI.removeAllListeners('show-message');
      window.electronAPI.removeAllListeners('websocket-message');
    };
  }, [loadMessages]);

  // Approve message
  const approveMessage = async () => {
    if (!currentMessage) return;

    try {
      await window.electronAPI.approveMessage(currentMessage.id, showFeedback ? feedback : undefined);
      
      const updatedMessage = { 
        ...currentMessage, 
        status: 'approved' as const, 
        feedback: showFeedback ? feedback : undefined 
      };
      
      setCurrentMessage(updatedMessage);
      setMessages(prev => prev.map(m => m.id === currentMessage.id ? updatedMessage : m));
      setFeedback('');
      setShowFeedback(false);
    } catch (error) {
      console.error('Error approving message:', error);
    }
  };

  // Reject message
  const rejectMessage = async () => {
    if (!currentMessage) return;

    try {
      await window.electronAPI.rejectMessage(currentMessage.id, showFeedback ? feedback : undefined);
      
      const updatedMessage = { 
        ...currentMessage, 
        status: 'rejected' as const, 
        feedback: showFeedback ? feedback : undefined 
      };
      
      setCurrentMessage(updatedMessage);
      setMessages(prev => prev.map(m => m.id === currentMessage.id ? updatedMessage : m));
      setFeedback('');
      setShowFeedback(false);
    } catch (error) {
      console.error('Error rejecting message:', error);
    }
  };

  // Show message detail
  const showMessageDetail = (message: Message) => {
    setCurrentMessage(message);
    setFeedback(message.feedback || '');
    setShowFeedback(false);
  };

  // Go back to message list
  const showMessageList = () => {
    setCurrentMessage(null);
    setFeedback('');
    setShowFeedback(false);
    loadMessages(); // Refresh to show updated status
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>;
      default:
        return <Badge variant="outline">New</Badge>;
    }
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">High Priority</Badge>;
      case 'normal':
        return <Badge variant="secondary">Normal</Badge>;
      case 'low':
        return <Badge variant="outline">Low Priority</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Connection Status */}
      <div className="fixed top-4 right-4 z-50">
        <Alert className={`w-64 ${connectionStatus === 'connected' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            WebSocket: {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
          </AlertDescription>
        </Alert>
      </div>

      <div className="max-w-4xl mx-auto">
        {currentMessage ? (
          // Message Detail View
          <Card className="w-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={showMessageList}>
                  ← Back to Messages
                </Button>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(currentMessage.status)}
                  {getStatusBadge(currentMessage.status)}
                </div>
              </div>
              <CardTitle className="text-2xl font-bold mt-4">
                {currentMessage.title}
              </CardTitle>
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <span>From: {currentMessage.sender || 'Unknown'}</span>
                <span>•</span>
                <span>{new Date(currentMessage.timestamp).toLocaleString()}</span>
                {currentMessage.priority && (
                  <>
                    <span>•</span>
                    {getPriorityBadge(currentMessage.priority)}
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Message Body */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Request Details</h3>
                <div className="bg-gray-100 p-4 rounded-lg">
                  <pre className="whitespace-pre-wrap text-sm">{currentMessage.body}</pre>
                </div>
              </div>

              <Separator />

              {/* Action Buttons */}
              {currentMessage.status === 'pending' || !currentMessage.status ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Actions Required</h3>
                  
                  {/* Feedback Section Toggle */}
                                     <div className="flex items-center space-x-2">
                     <input
                       type="checkbox"
                       id="show-feedback"
                       checked={showFeedback}
                       onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShowFeedback(e.target.checked)}
                       className="rounded"
                     />
                    <label htmlFor="show-feedback" className="text-sm">
                      Add feedback/comments
                    </label>
                  </div>

                  {/* Feedback Textarea */}
                  {showFeedback && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Feedback</label>
                      <Textarea
                        placeholder="Enter your feedback or comments..."
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        className="min-h-[100px]"
                      />
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex space-x-4">
                    <Button 
                      onClick={approveMessage}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button 
                      onClick={rejectMessage}
                      variant="destructive"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Status</h3>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(currentMessage.status)}
                    <span className="text-sm">
                      This request has been {currentMessage.status}
                    </span>
                  </div>
                  
                  {currentMessage.feedback && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Feedback</label>
                      <div className="bg-gray-100 p-3 rounded-lg text-sm">
                        {currentMessage.feedback}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          // Message List View
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold">Message Approvals</h1>
              <Button onClick={loadMessages} disabled={isLoading}>
                {isLoading ? 'Loading...' : 'Refresh'}
              </Button>
            </div>

            {messages.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Clock className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-gray-500">
                    {isLoading ? 'Loading messages...' : 'No messages to approve. Waiting for WebSocket messages...'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {messages.map((message) => (
                  <Card 
                    key={message.id} 
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => showMessageDetail(message)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold truncate">{message.title}</h3>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(message.status)}
                          {getStatusBadge(message.status)}
                        </div>
                      </div>
                      <p className="text-gray-600 text-sm mb-2 line-clamp-2">
                        {message.body}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>From: {message.sender || 'Unknown'}</span>
                        <span>{new Date(message.timestamp).toLocaleString()}</span>
                      </div>
                      {message.priority && (
                        <div className="mt-2">
                          {getPriorityBadge(message.priority)}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App; 