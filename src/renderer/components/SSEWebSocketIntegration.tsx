import React, { useCallback, useEffect, useRef } from 'react'
import { useSSE } from '../hooks/useSSE'
import { ExecutorWebSocketClient } from '../../websocket-client-to-executor'
import { CodespaceData } from '../../services/SSEBackgroundService'

interface SSEWebSocketIntegrationProps {
  serverUrl: string
  executorClient: ExecutorWebSocketClient | null
}

export const SSEWebSocketIntegration: React.FC<SSEWebSocketIntegrationProps> = ({
  serverUrl,
  executorClient,
}) => {
  const executorClientRef = useRef(executorClient)

  // Update ref when prop changes
  useEffect(() => {
    executorClientRef.current = executorClient
  }, [executorClient])

  // Handle codespace online events from SSE
  const handleCodespaceOnline = useCallback((codespace: CodespaceData) => {
    if (executorClientRef.current) {
      // Attempt to connect to the codespace WebSocket
      executorClientRef.current.connectFromSSEEvent(codespace)
        .then((success) => {
          if (success) {
          }
          else {
          }
        })
        .catch((error) => {
        })
    }
    else {
    }
  }, [])

  // Handle codespace offline events from SSE
  const handleCodespaceOffline = useCallback((codespace: CodespaceData) => {
    if (executorClientRef.current) {
      const connectionInfo = executorClientRef.current.getConnectionInfo()
      if (connectionInfo.connected
        && connectionInfo.target?.type === 'codespace'
        && connectionInfo.target?.codespaceName === codespace.name) {
        executorClientRef.current.reconnect()
          .catch((error) => {
          })
      }
    }
  }, [])

  // Initialize SSE connection with event handlers
  const { sseState, sseService } = useSSE(
    serverUrl,
    handleCodespaceOnline,
    handleCodespaceOffline,
  )

  // Log SSE connection state changes for debugging
  useEffect(() => {
    if (sseState.lastEvent) {
    }
  }, [sseState.lastEvent])

  // This component doesn't render any UI - it's purely for integration
  // You could return a status indicator if needed
  return null
}

export default SSEWebSocketIntegration
